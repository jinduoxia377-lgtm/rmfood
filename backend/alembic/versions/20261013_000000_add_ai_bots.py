"""新增多智能体协作平台表：ai_bots / ai_bot_memories + chat_sessions.bot_id

DS Bot 移植 v1.2（Phase 1）：
- ai_bots: 具名 Bot（身份/人设/模型绑定/能力白名单/可见性/软删除）
- ai_bot_memories: Bot 跨会话记忆（偏好/事实/禁忌）
- chat_sessions 增加可空 bot_id（单 Bot 对话复用既有会话表）

Revision ID: 20261013_000000
Revises: 20261008_000000
Create Date: 2026-10-13
"""
from alembic import op
import sqlalchemy as sa


revision = "20261013_000000"
down_revision = "20261008_000000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_bots",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False, primary_key=True),
        sa.Column("tenant_id", sa.BigInteger(), nullable=False, index=True),
        sa.Column("created_by", sa.BigInteger(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("avatar", sa.String(length=500), nullable=True),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column("persona_prompt", sa.Text(), nullable=False),
        sa.Column("model_config_id", sa.BigInteger(), nullable=True),
        sa.Column("model_type", sa.String(length=64), nullable=False, server_default="llm"),
        sa.Column("provider", sa.String(length=64), nullable=True),
        sa.Column("model_id", sa.String(length=128), nullable=True),
        sa.Column("temperature", sa.Float(), nullable=False, server_default="0.7"),
        sa.Column("max_tokens", sa.Integer(), nullable=False, server_default="4096"),
        sa.Column("capabilities", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("is_chief", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("visibility", sa.String(length=20), nullable=False, server_default="private"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["model_config_id"], ["ai_model_configs.id"], ondelete="SET NULL"),
        sa.Index("ix_ai_bots_tenant_status", "tenant_id", "status"),
        sa.Index("ix_ai_bots_tenant_creator", "tenant_id", "created_by"),
    )

    op.create_table(
        "ai_bot_memories",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False, primary_key=True),
        sa.Column("bot_id", sa.BigInteger(), nullable=False, index=True),
        sa.Column("user_id", sa.BigInteger(), nullable=False, index=True),
        sa.Column("memory_type", sa.String(length=20), nullable=False, server_default="preference"),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("importance", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("source", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["bot_id"], ["ai_bots.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.Index("ix_ai_bot_memories_bot_user", "bot_id", "user_id"),
    )

    # chat_sessions 增加 bot_id（单 Bot 对话复用既有会话表）
    op.add_column(
        "chat_sessions",
        sa.Column("bot_id", sa.BigInteger(), nullable=True),
    )
    op.create_index("ix_chat_sessions_bot_id", "chat_sessions", ["bot_id"], unique=False)
    op.create_foreign_key(
        "fk_chat_sessions_bot_id_ai_bots",
        "chat_sessions", "ai_bots",
        ["bot_id"], ["id"], ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_chat_sessions_bot_id_ai_bots", "chat_sessions", type_="foreignkey")
    op.drop_index("ix_chat_sessions_bot_id", table_name="chat_sessions")
    op.drop_column("chat_sessions", "bot_id")
    op.drop_table("ai_bot_memories")
    op.drop_table("ai_bots")