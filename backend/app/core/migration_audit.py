"""
RMFOOD 企业级审计与权限表迁移脚本

本迁移创建:
1. audit_logs - HTTP 请求审计日志表
2. permission_entries - 权限生命周期管理表
3. backup_records - 备份记录表
4. data_lineage - 数据血缘追踪表

使用方法:
    # 交互式:
    python -m app.core.migration_audit

    # 程序化:
    from app.core.migration_audit import run_migration
    await run_migration(db_session)
"""

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Integer, BigInteger, DateTime, Text, Boolean,
    ForeignKey, Index, UniqueConstraint, CheckConstraint,
    JSON, Enum as SAEnum,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import declarative_base
from typing import Any, Dict

from .logging_config import logger

Base = declarative_base()

# ──────────────────────────────────────────────
# 表结构定义
# ──────────────────────────────────────────────

class AuditLog(Base):
    """HTTP 请求审计日志表"""
    __tablename__ = "audit_logs"

    id = Column(String(64), primary_key=True)
    request_id = Column(String(64), index=True)
    user_id = Column(Integer, nullable=True, index=True)
    username = Column(String(128), nullable=True)
    user_role = Column(String(32), nullable=True)
    method = Column(String(8), nullable=False)
    path = Column(String(512), nullable=False, index=True)
    query_params = Column(JSONB, nullable=True)
    status_code = Column(Integer, nullable=True)
    duration_ms = Column(Integer, nullable=True)
    client_ip = Column(String(45), nullable=True)
    user_agent = Column(String(512), nullable=True)
    action = Column(String(256), nullable=True)
    severity = Column(String(16), nullable=False, default="low", index=True)
    masked_request_body = Column(Text, nullable=True)
    masked_response_body = Column(Text, nullable=True)
    checksum_chain = Column(String(64), nullable=True)
    error = Column(Text, nullable=True)
    metadata = Column(JSONB, nullable=True, default=dict)
    created_at = Column(DateTime(timezone=True), nullable=False,
                        default=lambda: datetime.now(timezone.utc), index=True)

    __table_args__ = (
        Index("ix_audit_logs_created_severity", "created_at", "severity"),
        Index("ix_audit_logs_user_created", "user_id", "created_at"),
        Index("ix_audit_logs_path_created", "path", "created_at"),
    )


class PermissionEntry(Base):
    """权限生命周期管理表"""
    __tablename__ = "permission_entries"

    id = Column(String(64), primary_key=True)
    user_id = Column(Integer, nullable=False, index=True)
    user_name = Column(String(128), nullable=False)
    resource = Column(String(64), nullable=False)
    action = Column(String(32), nullable=False)
    permission_type = Column(String(32), nullable=False, default="standard")
    status = Column(String(32), nullable=False, default="active", index=True)
    scope = Column(String(16), nullable=False, default="own")
    priority = Column(Integer, nullable=False, default=0)
    requires_mfa = Column(Boolean, nullable=False, default=False)
    max_session_hours = Column(Integer, nullable=True)

    granted_at = Column(DateTime(timezone=True), nullable=False,
                         default=lambda: datetime.now(timezone.utc))
    granted_by = Column(Integer, nullable=True)
    granted_reason = Column(Text, nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True, index=True)
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    auto_expire_hours = Column(Integer, nullable=True)

    metadata = Column(JSONB, nullable=True, default=dict)
    change_history = Column(JSONB, nullable=True, default=list)

    __table_args__ = (
        Index("ix_perm_user_resource_action", "user_id", "resource", "action"),
        Index("ix_perm_status_expires", "status", "expires_at"),
        UniqueConstraint("user_id", "resource", "action", name="uq_perm_user_resource_action"),
    )


class BackupRecord(Base):
    """备份记录表"""
    __tablename__ = "backup_records"

    id = Column(String(64), primary_key=True)
    backup_type = Column(String(32), nullable=False)
    status = Column(String(32), nullable=False, default="pending", index=True)
    file_path = Column(String(512), nullable=True)
    file_size = Column(BigInteger, nullable=True)
    duration_seconds = Column(Integer, nullable=False, default=0)
    checksum = Column(String(64), nullable=True)
    encryption_key_id = Column(String(64), nullable=True)
    parent_backup_id = Column(String(64), nullable=True)
    data_records = Column(Integer, nullable=False, default=0)
    retention_days = Column(Integer, nullable=False, default=30)
    location = Column(String(32), nullable=False, default="local")

    created_at = Column(DateTime(timezone=True), nullable=False,
                         default=lambda: datetime.now(timezone.utc), index=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    metadata = Column(JSONB, nullable=True, default=dict)

    __table_args__ = (
        Index("ix_backup_status_created", "status", "created_at"),
    )


class DataLineage(Base):
    """数据血缘追踪表"""
    __tablename__ = "data_lineage"

    id = Column(String(64), primary_key=True)
    entity_type = Column(String(64), nullable=False, index=True)
    entity_id = Column(String(64), nullable=False)
    field_name = Column(String(128), nullable=False)
    source_type = Column(String(64), nullable=True)
    source_id = Column(String(64), nullable=True)
    transformation = Column(Text, nullable=True)
    created_by = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False,
                         default=lambda: datetime.now(timezone.utc), index=True)
    metadata = Column(JSONB, nullable=True, default=dict)

    __table_args__ = (
        Index("ix_lineage_entity", "entity_type", "entity_id"),
        Index("ix_lineage_source", "source_type", "source_id"),
        UniqueConstraint("entity_type", "entity_id", "field_name",
                        name="uq_lineage_entity_field"),
    )


# ──────────────────────────────────────────────
# 迁移逻辑
# ──────────────────────────────────────────────

async def create_tables(session: AsyncSession) -> None:
    """创建所有表"""
    logger.info("📋 开始创建企业级审计与权限表...")

    tables_created = []

    for model in [AuditLog, PermissionEntry, BackupRecord, DataLineage]:
        table_name = model.__tablename__
        try:
            # 检查表是否存在
            result = await session.execute(
                f"SELECT 1 FROM information_schema.tables "
                f"WHERE table_name = '{table_name}'"
            )
            exists = result.scalar() is not None

            if not exists:
                await session.run_sync(model.__table__.create)
                tables_created.append(table_name)
                logger.info(f"  ✓ 已创建表: {table_name}")
            else:
                logger.info(f"  - 表已存在，跳过: {table_name}")

        except Exception as e:
            logger.warning(f"  ⚠️ 表 {table_name} 处理异常: {e}")

    await session.commit()
    return tables_created


async def create_indexes(session: AsyncSession) -> None:
    """创建额外索引（性能优化）"""
    indexes = [
        # AuditLog 额外索引
        ("ix_audit_logs_user_method", "audit_logs", "user_id, method"),
        ("ix_audit_logs_created_user", "audit_logs", "created_at DESC, user_id"),

        # PermissionEntry 额外索引
        ("ix_perm_status_granted", "permission_entries", "status, granted_at DESC"),
        ("ix_perm_user_status", "permission_entries", "user_id, status"),

        # BackupRecord 额外索引
        ("ix_backup_type_created", "backup_records", "backup_type, created_at DESC"),
    ]

    logger.info("📇 开始创建索引...")
    for idx_name, table, cols in indexes:
        try:
            # 检查索引是否存在
            result = await session.execute(
                f"SELECT 1 FROM pg_indexes WHERE indexname = '{idx_name}'"
            )
            if result.scalar() is None:
                # 注意: CREATE INDEX CONCURRENTLY 不能在事务中执行
                # 使用 text() 以避免 SQLAlchemy 的自动参数化问题
                from sqlalchemy import text
                await session.execute(
                    text(f"CREATE INDEX CONCURRENTLY {idx_name} ON {table} ({cols})")
                )
                logger.info(f"  ✓ 已创建索引: {idx_name}")
            else:
                logger.info(f"  - 索引已存在，跳过: {idx_name}")
        except Exception as e:
            logger.warning(f"  ⚠️ 索引 {idx_name} 创建失败: {e}")

    await session.commit()


async def run_migration(session: AsyncSession) -> Dict[str, Any]:
    """
    执行完整迁移

    Returns:
        {"tables_created": [...], "indexes_created": [...]}
    """
    logger.info("=" * 60)
    logger.info("🚀 开始执行企业级审计与权限表迁移")
    logger.info("=" * 60)

    tables = await create_tables(session)
    await create_indexes(session)

    logger.info("=" * 60)
    logger.info("✅ 迁移完成")
    logger.info(f"   新建表: {tables}")
    logger.info("=" * 60)

    return {
        "tables_created": tables,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


async def rollback_migration(session: AsyncSession) -> None:
    """回滚迁移（删除所有表）"""
    logger.warning("⚠️ 开始回滚迁移 — 将删除所有企业级表！")

    for model in [DataLineage, BackupRecord, PermissionEntry, AuditLog]:
        table_name = model.__tablename__
        try:
            await session.execute(f"DROP TABLE IF EXISTS {table_name} CASCADE")
            logger.info(f"  ✓ 已删除表: {table_name}")
        except Exception as e:
            logger.warning(f"  ⚠️ 表 {table_name} 删除失败: {e}")

    await session.commit()
    logger.warning("⚠️ 回滚完成")


# ──────────────────────────────────────────────
# CLI 入口
# ──────────────────────────────────────────────

if __name__ == "__main__":
    from .session import async_session_factory

    async def main():
        import sys
        if len(sys.argv) > 1 and sys.argv[1] == "--rollback":
            async with async_session_factory() as session:
                await rollback_migration(session)
        else:
            async with async_session_factory() as session:
                await run_migration(session)

    asyncio.run(main())
