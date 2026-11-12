"""
RAG 知识库文档版本管理 (v2.0)

为每个文档维护版本历史，支持：
- 上传同名文档时自动创建新版本
- 查询时返回最新版本
- 回滚到历史版本
- 版本变更审计日志
- 数据库持久化（内存缓存 + PostgreSQL 双写）

P1-4（跨租户隔离）：版本记录与审计日志均携带 user_id 归属。
内存存储键从「filename」升级为「{user_id}:{filename}」复合键，
所有版本/审计查询按当前用户过滤，删除只删除当前用户的版本。
数据库侧沿用现有 JSON 列（metadata_ / details）持久化 user_id，
无需 schema 迁移，兼容已有数据结构（旧数据缺失 user_id 时按 "system" 兼容读取）。
"""

import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


@dataclass
class DocumentVersion:
    """文档版本信息"""
    id: str
    version: int
    filename: str
    content_type: str
    chunk_count: int
    file_size: int
    created_at: datetime
    checksum: str  # 文件哈希，用于检测重复
    metadata: dict = field(default_factory=dict)
    user_id: str = "system"  # P1-4：版本归属租户


class DocumentVersionManager:
    """文档版本管理器"""

    def __init__(self):
        # versioned_docs: {"{user_id}:{filename}": [DocumentVersion, ...]}（P1-4 复合键）
        self._versioned_docs: dict[str, list[DocumentVersion]] = {}
        # 审计日志（每条记录含 user_id）
        self._audit_log: list[dict] = []

    @staticmethod
    def _key(user_id: str | None, filename: str) -> str:
        """复合键：{user_id}:{filename}，实现跨租户版本隔离"""
        return f"{user_id or 'system'}:{filename}"

    def add_version(self, version: DocumentVersion) -> DocumentVersion:
        """添加新版本（同名文档，按租户隔离）"""
        user_id = version.user_id or "system"
        filename = version.filename
        key = self._key(user_id, filename)
        if key not in self._versioned_docs:
            self._versioned_docs[key] = []

        # 检查是否为新文件（checksum 不同）
        existing = self._versioned_docs[key]
        if existing and existing[-1].checksum == version.checksum:
            logger.info("文档未变更，跳过版本创建: %s (user_id=%s)", filename, user_id)
            return existing[-1]

        # 新版本
        version.version = (existing[-1].version + 1) if existing else 1
        version.id = str(uuid.uuid4())
        existing.append(version)

        # 审计日志
        self._audit_log.append({
            "action": "version_added",
            "user_id": user_id,
            "filename": filename,
            "version": version.version,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        logger.info("文档新版本创建: %s v%d (%d chunks, user_id=%s)", filename, version.version, version.chunk_count, user_id)

        return version

    def get_latest(self, filename: str, user_id: str = None) -> Optional[DocumentVersion]:
        """获取最新版本（按租户过滤）"""
        versions = self._versioned_docs.get(self._key(user_id, filename), [])
        return versions[-1] if versions else None

    def get_all_versions(self, filename: str, user_id: str = None) -> list[DocumentVersion]:
        """获取所有版本（按租户过滤）"""
        return list(self._versioned_docs.get(self._key(user_id, filename), []))

    def get_all_documents(self, user_id: str = None) -> dict[str, list[DocumentVersion]]:
        """获取指定租户的所有文档及其版本"""
        prefix = f"{user_id or 'system'}:"
        return {
            key.split(":", 1)[1]: versions
            for key, versions in self._versioned_docs.items()
            if key.startswith(prefix)
        }

    def remove_document(self, filename: str, user_id: str = None) -> None:
        """删除指定租户的文档版本记录（P1-4：只删当前用户，不影响其他租户同名版本）"""
        key = self._key(user_id, filename)
        removed = self._versioned_docs.pop(key, None)
        if removed is not None:
            logger.info("移除文档版本记录: %s (user_id=%s)", filename, user_id or "system")

    def rollback(self, filename: str, target_version: int, user_id: str = None) -> Optional[DocumentVersion]:
        """回滚到指定版本（标记旧版本为 archived，按租户隔离）"""
        key = self._key(user_id, filename)
        versions = self._versioned_docs.get(key, [])
        if target_version < 1 or target_version > len(versions):
            logger.warning("无效的回滚版本: %s v%d (user_id=%s)", filename, target_version, user_id or "system")
            return None

        # 创建回滚版本
        source = versions[target_version - 1]
        rollback = DocumentVersion(
            id=str(uuid.uuid4()),
            version=target_version,
            filename=filename,
            content_type=source.content_type,
            chunk_count=source.chunk_count,
            file_size=source.file_size,
            created_at=datetime.now(timezone.utc),
            checksum=source.checksum,
            metadata={"rolled_back_from": source.version, "original_created": source.created_at.isoformat()},
            user_id=user_id or "system",
        )
        versions.append(rollback)

        self._audit_log.append({
            "action": "version_rollback",
            "user_id": user_id or "system",
            "filename": filename,
            "from_version": source.version,
            "to_version": target_version,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        logger.info("文档回滚: %s v%d → v%d (user_id=%s)", filename, source.version, target_version, user_id or "system")
        return rollback

    def archive_old_versions(self, filename: str, keep: int = 3, user_id: str = None):
        """归档旧版本，只保留最近 N 个（按租户隔离）"""
        key = self._key(user_id, filename)
        versions = self._versioned_docs.get(key, [])
        if len(versions) <= keep:
            return

        archived = versions[:-keep]
        versions[:] = versions[-keep:]

        for v in archived:
            self._audit_log.append({
                "action": "version_archived",
                "user_id": user_id or "system",
                "filename": filename,
                "archived_version": v.version,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })

        logger.info("归档旧版本: %s (保留最近 %d 个, user_id=%s)", filename, keep, user_id or "system")

    def get_audit_log(self, filename: str | None = None, limit: int = 50, user_id: str = None) -> list[dict]:
        """获取审计日志（按租户过滤）"""
        uid = user_id or "system"
        logs = [e for e in self._audit_log if e.get("user_id", "system") == uid]
        if filename:
            logs = [e for e in logs if e.get("filename") == filename]
        return logs[-limit:]

    def get_document_count(self, user_id: str = None) -> int:
        """文档种类数（按租户）"""
        prefix = f"{user_id or 'system'}:"
        return sum(1 for k in self._versioned_docs if k.startswith(prefix))

    def get_total_versions(self, user_id: str = None) -> int:
        """总版本数（按租户）"""
        prefix = f"{user_id or 'system'}:"
        return sum(len(v) for k, v in self._versioned_docs.items() if k.startswith(prefix))

    # ═══════════════════════════════════════════════════
    # 数据库持久化（异步）
    # ═══════════════════════════════════════════════════

    async def sync_to_db(self, db: AsyncSession) -> None:
        """将当前版本数据和审计日志持久化到数据库"""
        from app.models.document_version import DocumentAuditLog as DBLog
        from app.models.document_version import DocumentVersion as DBVersion

        # 写入版本记录
        for versions in self._versioned_docs.values():
            for v in versions:
                # 检查是否已存在
                stmt = select(DBVersion).where(DBVersion.id == v.id)
                result = await db.execute(stmt)
                if not result.scalar_one_or_none():
                    db_version = DBVersion(
                        id=v.id,
                        version=v.version,
                        filename=v.filename,
                        content_type=v.content_type,
                        chunk_count=v.chunk_count,
                        file_size=v.file_size,
                        checksum=v.checksum,
                        created_at=v.created_at if isinstance(v.created_at, datetime) else datetime.fromisoformat(v.created_at),
                        # P1-4：user_id 持久化到 JSON 列，避免 schema 迁移
                        metadata_={**v.metadata, "user_id": v.user_id},
                    )
                    db.add(db_version)

        # 写入审计日志
        for log in self._audit_log:
            log_id = log.get("id") or str(uuid.uuid4())
            stmt = select(DBLog).where(DBLog.id == log_id)
            result = await db.execute(stmt)
            if not result.scalar_one_or_none():
                db_log = DBLog(
                    id=log_id,
                    action=log.get("action", "unknown"),
                    filename=log.get("filename", ""),
                    version=log.get("version"),
                    from_version=log.get("from_version"),
                    to_version=log.get("to_version"),
                    archived_version=log.get("archived_version"),
                    timestamp=datetime.fromisoformat(log["timestamp"]) if isinstance(log.get("timestamp"), str) else log.get("timestamp", datetime.utcnow()),
                    # P1-4：user_id 持久化到 details JSON 列
                    details={"user_id": log.get("user_id", "system")},
                )
                db.add(db_log)

        await db.commit()
        logger.info("版本数据已同步到数据库: %d 个文档, %d 条日志",
                    len(self._versioned_docs), len(self._audit_log))

    async def load_from_db(self, db: AsyncSession) -> None:
        """从数据库加载版本数据到内存（兼容旧数据：缺失 user_id 时按 "system" 读取）"""
        from app.models.document_version import DocumentAuditLog as DBLog
        from app.models.document_version import DocumentVersion as DBVersion

        # 加载版本
        stmt = select(DBVersion).order_by(DBVersion.filename, DBVersion.version)
        result = await db.execute(stmt)
        db_versions = result.scalars().all()

        for db_v in db_versions:
            # P1-4：旧数据无 user_id 字段，从 metadata_ JSON 兼容读取，缺省 "system"
            meta = db_v.metadata_ or {}
            user_id = str(meta.get("user_id", "system"))
            v = DocumentVersion(
                id=db_v.id,
                version=db_v.version,
                filename=db_v.filename,
                content_type=db_v.content_type,
                chunk_count=db_v.chunk_count,
                file_size=db_v.file_size,
                checksum=db_v.checksum,
                created_at=db_v.created_at,
                metadata=meta,
                user_id=user_id,
            )
            key = self._key(user_id, v.filename)
            if key not in self._versioned_docs:
                self._versioned_docs[key] = []
            self._versioned_docs[key].append(v)

        # 加载审计日志
        stmt = select(DBLog).order_by(DBLog.timestamp).limit(500)
        result = await db.execute(stmt)
        self._audit_log = []
        for db_log in result.scalars().all():
            details = db_log.details or {}
            self._audit_log.append({
                "id": db_log.id,
                "action": db_log.action,
                "user_id": str(details.get("user_id", "system")),
                "filename": db_log.filename,
                "version": db_log.version,
                "from_version": db_log.from_version,
                "to_version": db_log.to_version,
                "archived_version": db_log.archived_version,
                "timestamp": db_log.timestamp.isoformat() if db_log.timestamp else None,
            })

        logger.info("从数据库加载版本数据: %d 个文档, %d 条日志",
                    len(self._versioned_docs), len(self._audit_log))
