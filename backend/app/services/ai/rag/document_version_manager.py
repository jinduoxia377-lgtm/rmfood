"""
RAG 知识库文档版本管理 (v1.0)

为每个文档维护版本历史，支持：
- 上传同名文档时自动创建新版本
- 查询时返回最新版本
- 回滚到历史版本
- 版本变更审计日志
"""

import logging
import uuid
import json
from datetime import datetime, timezone
from dataclasses import dataclass, field
from typing import Optional

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


class DocumentVersionManager:
    """文档版本管理器"""

    def __init__(self):
        # versioned_docs: {filename: [DocumentVersion, ...]}
        self._versioned_docs: dict[str, list[DocumentVersion]] = {}
        # 审计日志
        self._audit_log: list[dict] = []

    def add_version(self, version: DocumentVersion) -> DocumentVersion:
        """添加新版本（同名文档）"""
        filename = version.filename
        if filename not in self._versioned_docs:
            self._versioned_docs[filename] = []

        # 检查是否为新文件（checksum 不同）
        existing = self._versioned_docs[filename]
        if existing and existing[-1].checksum == version.checksum:
            logger.info("文档未变更，跳过版本创建: %s", filename)
            return existing[-1]

        # 新版本
        version.version = (existing[-1].version + 1) if existing else 1
        version.id = str(uuid.uuid4())
        existing.append(version)

        # 审计日志
        self._audit_log.append({
            "action": "version_added",
            "filename": filename,
            "version": version.version,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        logger.info("文档新版本创建: %s v%d (%d chunks)", filename, version.version, version.chunk_count)

        return version

    def get_latest(self, filename: str) -> Optional[DocumentVersion]:
        """获取最新版本"""
        versions = self._versioned_docs.get(filename, [])
        return versions[-1] if versions else None

    def get_all_versions(self, filename: str) -> list[DocumentVersion]:
        """获取所有版本"""
        return list(self._versioned_docs.get(filename, []))

    def get_all_documents(self) -> dict[str, list[DocumentVersion]]:
        """获取所有文档及其版本"""
        return dict(self._versioned_docs)

    def rollback(self, filename: str, target_version: int) -> Optional[DocumentVersion]:
        """回滚到指定版本（标记旧版本为 archived）"""
        versions = self._versioned_docs.get(filename, [])
        if target_version < 1 or target_version > len(versions):
            logger.warning("无效的回滚版本: %s v%d", filename, target_version)
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
        )
        versions.append(rollback)

        self._audit_log.append({
            "action": "version_rollback",
            "filename": filename,
            "from_version": source.version,
            "to_version": target_version,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        logger.info("文档回滚: %s v%d → v%d", filename, source.version, target_version)
        return rollback

    def archive_old_versions(self, filename: str, keep: int = 3):
        """归档旧版本，只保留最近 N 个"""
        versions = self._versioned_docs.get(filename, [])
        if len(versions) <= keep:
            return

        archived = versions[:-keep]
        versions[:] = versions[-keep:]

        for v in archived:
            self._audit_log.append({
                "action": "version_archived",
                "filename": filename,
                "archived_version": v.version,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })

        logger.info("归档旧版本: %s (保留最近 %d 个)", filename, keep)

    def get_audit_log(self, filename: str | None = None, limit: int = 50) -> list[dict]:
        """获取审计日志"""
        if filename:
            return [e for e in self._audit_log if e.get("filename") == filename][-limit:]
        return self._audit_log[-limit:]

    def get_document_count(self) -> int:
        """文档种类数"""
        return len(self._versioned_docs)

    def get_total_versions(self) -> int:
        """总版本数"""
        return sum(len(v) for v in self._versioned_docs.values())
