"""add task groups and mcp servers tables + group archive/message sender_bot_name

v3.3：任务驱动自动建群
- ai_mcp_servers: 外部 MCP 服务器注册表（HTTP/SSE，租户隔离，工具白名单）
- ai_task_groups: 研发任务记录与状态机（recruiting/dispatching/completed/failed/archived）
- ai_bot_group_sessions: 增加 archived_at（任务群归档）
- ai_bot_group_messages: 增加 sender_bot_name（冗余发送者专业角色名）

Revision ID: 20261014_000000
Revises: 4dfbe6e25d76
Create Date: 2026-10-14
"""
from alembic import op
import sqlalchemy as sa


revision = "20261014_000000"
down_revision = "4dfbe6e25d76"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_mcp_servers",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False, primary_key=True),
        sa.Column("tenant_id", sa.BigInteger(), nullable=False, index=True),
        sa.Column("name", sa.String(length=64), nullable=False, unique=True),
        sa.Column("transport", sa.String(length=16), nullable=False, server_default="http"),
        sa.Column("url", sa.String(length=512), nullable=False),
        sa.Column("headers", sa.JSON(), nullable=True),
        sa.Column("auth_token_encrypted", sa.Text(), nullable=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("allow_tools", sa.JSON(), nullable=True),
        sa.Column("visibility", sa.String(length=16), nullable=False, server_default="org"),
        sa.Column("created_by", sa.BigInteger(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Index("ix_ai_mcp_servers_tenant_enabled", "tenant_id", "enabled"),
    )

    op.create_table(
        "ai_task_groups",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False, primary_key=True),
        sa.Column("tenant_id", sa.BigInteger(), nullable=False, index=True),
        sa.Column("group_id", sa.BigInteger(), nullable=False, index=True),
        sa.Column("created_by", sa.BigInteger(), nullable=False, index=True),
        sa.Column("task_content", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="recruiting"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Index("ix_ai_task_groups_tenant_status", "tenant_id", "status"),
    )

    op.add_column(
        "ai_bot_group_sessions",
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "ai_bot_group_messages",
        sa.Column("sender_bot_name", sa.String(length=100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("ai_bot_group_messages", "sender_bot_name")
    op.drop_column("ai_bot_group_sessions", "archived_at")
    op.drop_table("ai_task_groups")
    op.drop_table("ai_mcp_servers")