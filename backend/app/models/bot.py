"""多智能体协作平台 — Bot 与记忆持久化模型

存储 AIBot 实体与 Bot 记忆条目：
- ai_bots: 具名 Bot（人设、模型绑定、能力白名单、可见性、软删除）
- ai_bot_memories: Bot 跨会话记忆（偏好/事实/禁忌，含重要性）

设计依据：docs/DSBot多智能体协作平台移植方案.md（v1.2）
- 模型绑定：model_config_id 继承场景配置（API/密钥/兜底链）
  + provider/model_id/temperature/max_tokens 实现"每个 Bot 独立选模型"
- 可见性：private（仅创建者）/ org（组织共享）
- 软删除：deleted_at 置空即删除，查询过滤
"""
from datetime import datetime
from typing import Any

import sqlalchemy as sa
from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.utils import now_utc_mapped

from .base import Base


class AIBot(Base):
    """AI Bot 实体 — 可配置身份/模型/能力白名单的具名智能体。"""

    __tablename__ = "ai_bots"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # ── 租户与归属 ──────────────────────────────────────────────
    tenant_id: Mapped[int] = mapped_column(
        BigInteger, nullable=False, index=True, comment="关联 tenants.id，默认租户为 1",
    )
    created_by: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
        comment="创建者用户 ID",
    )

    # ── 身份信息 ──────────────────────────────────────────────
    name: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="具名 Bot 名称，如「配方专家」",
    )
    avatar: Mapped[str | None] = mapped_column(
        String(500), nullable=True, comment="头像标识（图标名/Emoji/URL）",
    )
    description: Mapped[str | None] = mapped_column(
        String(500), nullable=True, comment="一句话介绍",
    )
    persona_prompt: Mapped[str] = mapped_column(
        Text, nullable=False, comment="人设 System Prompt（核心，创建/更新时须过 PromptGuard）",
    )

    # ── 模型绑定（M1 修订）────────────────────────────────────
    # model_config_id 关联 ai_model_configs.id，继承该场景的 API/密钥/兜底链；
    # provider/model_id 实现具体模型选择，temperature/max_tokens 独立推理参数。
    model_config_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("ai_model_configs.id", ondelete="SET NULL"),
        nullable=True, comment="关联 ai_model_configs.id（场景配置）",
    )
    model_type: Mapped[str] = mapped_column(
        String(64), nullable=False, server_default="llm",
        comment="场景类型（llm/formula_gpt/...），用于配额与路由",
    )
    provider: Mapped[str | None] = mapped_column(
        String(64), nullable=True, comment="具体 Provider（如 deepseek / zhipu）",
    )
    model_id: Mapped[str | None] = mapped_column(
        String(128), nullable=True, comment="具体模型 ID（如 deepseek-chat / agnes-3.0-flash）",
    )
    temperature: Mapped[float] = mapped_column(
        Float, nullable=False, server_default="0.7",
    )
    max_tokens: Mapped[int] = mapped_column(
        # P1-4 修复（2026-10-26）：server_default 由 "4096" 提到 "16000"，
        # 与 AIModelConfig.max_tokens 及 ModelConfig 代码层默认值对齐。
        # bot_router 的 bot.max_tokens 是 bot 对话端点的输出上限默认值。
        Integer, nullable=False, server_default="16000",
    )

    # ── 能力与角色 ─────────────────────────────────────────────
    capabilities: Mapped[list] = mapped_column(
        JSON, nullable=False, server_default="[]",
        comment="工具白名单，如 [rag_retrieve, formula_tool]（须与工具注册表校验）",
    )
    is_chief: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=sa.text("false"),
        comment="是否主控 Bot",
    )
    is_system: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=sa.text("false"),
        comment="系统种子 Bot（Chief/专业模板），禁止删除",
    )

    # ── 可见性与状态 ─────────────────────────────────────────
    visibility: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="private",
        comment="private（仅创建者）/ org（组织共享）",
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="active",
        comment="active / disabled / archived",
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None, index=True,
        comment="软删除时间戳（NULL=未删除）",
    )

    # ── 时间戳 ─────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc_mapped, nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped,
        nullable=False,
    )

    __table_args__ = (
        Index("ix_ai_bots_tenant_status", "tenant_id", "status"),
        Index("ix_ai_bots_tenant_creator", "tenant_id", "created_by"),
    )

    def to_dict(self, include_persona: bool = True) -> dict[str, Any]:
        d: dict[str, Any] = {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "created_by": self.created_by,
            "name": self.name,
            "avatar": self.avatar,
            "description": self.description,
            "model_config_id": self.model_config_id,
            "model_type": self.model_type,
            "provider": self.provider,
            "model_id": self.model_id,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "capabilities": self.capabilities or [],
            "is_chief": self.is_chief,
            "is_system": self.is_system,
            "visibility": self.visibility,
            "status": self.status,
            "deleted_at": self.deleted_at.isoformat() if self.deleted_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_persona:
            d["persona_prompt"] = self.persona_prompt
        return d


class BotMemory(Base):
    """Bot 跨会话记忆条目。

    memory_type: preference（用户偏好）/ fact（项目事实）/ contraindication（禁忌/过敏原）
    importance: 1-5，注入时按 (importance DESC, created_at DESC) 截断条数。
    """

    __tablename__ = "ai_bot_memories"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    bot_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("ai_bots.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    memory_type: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="preference",
        comment="preference / fact / contraindication",
    )
    content: Mapped[str] = mapped_column(Text, nullable=False, comment="记忆内容")
    importance: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="3", comment="重要性 1-5",
    )
    source: Mapped[str | None] = mapped_column(
        String(100), nullable=True, comment="来源（会话 ID / manual）",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc_mapped, nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped,
        nullable=False,
    )

    __table_args__ = (
        Index("ix_ai_bot_memories_bot_user", "bot_id", "user_id"),
    )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "bot_id": self.bot_id,
            "user_id": self.user_id,
            "memory_type": self.memory_type,
            "content": self.content,
            "importance": self.importance,
            "source": self.source,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


# ════════════════════════════════════════════════════════════
# 群聊协作（Phase 2）
# ════════════════════════════════════════════════════════════


class BotGroupSession(Base):
    """群聊会话 — 多 Bot 协作空间。

    chief_bot_id 为群管理员（默认回复并派单，对齐 DS Bot 成本优化）。
    """

    __tablename__ = "ai_bot_group_sessions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    chief_bot_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("ai_bots.id", ondelete="SET NULL"), nullable=False, index=True,
    )
    created_by: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    archived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None,
        comment="归档时间戳（NULL=未归档）",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc_mapped, nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped,
        nullable=False,
    )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "name": self.name,
            "chief_bot_id": self.chief_bot_id,
            "created_by": self.created_by,
            "archived_at": self.archived_at.isoformat() if self.archived_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class BotGroupMember(Base):
    """群聊成员（Bot）— 关联表，而非 JSON 数组（评审 S2）。"""

    __tablename__ = "ai_bot_group_members"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    group_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("ai_bot_group_sessions.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    bot_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("ai_bots.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    role: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="member", comment="admin / member",
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc_mapped, nullable=False,
    )

    __table_args__ = (
        Index("ix_ai_bot_group_members_group_bot", "group_id", "bot_id", unique=True),
    )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "group_id": self.group_id,
            "bot_id": self.bot_id,
            "role": self.role,
            "joined_at": self.joined_at.isoformat() if self.joined_at else None,
        }


class BotGroupMessage(Base):
    """群聊消息。

    sender_type: user（人类成员）/ bot（智能体回复）
    mentioned_bot_ids: @ 定向的 Bot 列表（JSON）
    task_execution_id: 触发回复的 Agent 执行记录 ID（若由派单产生）
    """

    __tablename__ = "ai_bot_group_messages"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    group_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("ai_bot_group_sessions.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    sender_type: Mapped[str] = mapped_column(
        String(10), nullable=False, server_default="user", comment="user / bot",
    )
    sender_user_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
    sender_bot_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("ai_bots.id", ondelete="SET NULL"), nullable=True,
    )
    # v3.3：冗余发送者 Bot 名称（临时专家等不在前端 bots 列表时也能显示专业角色名）
    sender_bot_name: Mapped[str | None] = mapped_column(
        String(100), nullable=True,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    reply_to: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True, comment="引用的群聊消息 ID",
    )
    mentioned_bot_ids: Mapped[list | None] = mapped_column(JSON, nullable=True, default=list)
    task_execution_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc_mapped, nullable=False, index=True,
    )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "group_id": self.group_id,
            "sender_type": self.sender_type,
            "sender_user_id": self.sender_user_id,
            "sender_bot_id": self.sender_bot_id,
            "content": self.content,
            "reply_to": self.reply_to,
            "mentioned_bot_ids": self.mentioned_bot_ids or [],
            "task_execution_id": self.task_execution_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
