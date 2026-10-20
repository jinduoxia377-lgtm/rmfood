"""AI 用量统计模型（Phase 3：用量统计）。

记录每次 Bot 智能体执行/对话的 LLM token 用量（prompt + completion），
用于用量统计与成本分析。
"""
from datetime import datetime
from typing import Any, Optional

import sqlalchemy as sa
from sqlalchemy import BigInteger, String, Integer, Text, DateTime, Index
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base
from app.models.utils import now_utc_mapped


class AiBotUsage(Base):
    """AI Bot 用量记录"""

    __tablename__ = "ai_bot_usage"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    bot_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True)
    user_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    model: Mapped[str] = mapped_column(String(128), nullable=False, server_default="")
    prompt_tokens: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    completion_tokens: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    endpoint: Mapped[str] = mapped_column(String(64), nullable=False, server_default="agent")
    task_execution_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc_mapped, nullable=False,
    )

    __table_args__ = (
        Index("ix_ai_bot_usage_tenant_created", "tenant_id", "created_at"),
    )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "bot_id": self.bot_id,
            "user_id": self.user_id,
            "model": self.model,
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "total_tokens": self.prompt_tokens + self.completion_tokens,
            "endpoint": self.endpoint,
            "task_execution_id": self.task_execution_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }