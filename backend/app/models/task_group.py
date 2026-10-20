"""研发任务模型（v3.3：任务驱动自动建群）。

记录"任务 -> 任务群"的关联与状态流转：
recruiting → dispatching → completed / failed；归档为 archived。
"""
from datetime import datetime
from typing import Any, Optional

import sqlalchemy as sa
from sqlalchemy import BigInteger, String, Text, DateTime, Index
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base
from app.models.utils import now_utc_mapped


class TaskGroup(Base):
    """研发任务记录"""

    __tablename__ = "ai_task_groups"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    group_id: Mapped[int] = mapped_column(
        BigInteger, nullable=False, index=True, comment="关联 ai_bot_group_sessions.id",
    )
    created_by: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)

    task_content: Mapped[str] = mapped_column(Text, nullable=False)
    # 阶段 B：任务规划结果持久化（角色/子任务计划），避免派单时重复调用 LLM 规划
    plan: Mapped[list | None] = mapped_column(
        sa.JSON, nullable=True, default=None, comment="TaskPlanner 输出的角色计划 JSON",
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="recruiting",
        comment="recruiting | dispatching | completed | failed | archived",
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc_mapped, nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped,
        nullable=False,
    )

    __table_args__ = (
        Index("ix_ai_task_groups_tenant_status", "tenant_id", "status"),
    )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "group_id": self.group_id,
            "created_by": self.created_by,
            "task_content": self.task_content,
            "plan": self.plan,
            "status": self.status,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }