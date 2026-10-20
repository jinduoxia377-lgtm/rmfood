"""add mcp server command column for stdio transport

MCP stdio 传输支持：
- ai_mcp_servers 增加 command 列（stdio 启动命令）
- url 改为可空（stdio 传输不依赖 URL）

Revision ID: 20261014_020000
Revises: 20261014_010000
Create Date: 2026-10-14
"""
from alembic import op
import sqlalchemy as sa


revision = "20261014_020000"
down_revision = "20261014_010000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "ai_mcp_servers",
        sa.Column("command", sa.String(length=512), nullable=True),
    )
    op.alter_column("ai_mcp_servers", "url", existing_type=sa.String(length=512), nullable=True)


def downgrade() -> None:
    op.alter_column("ai_mcp_servers", "url", existing_type=sa.String(length=512), nullable=False)
    op.drop_column("ai_mcp_servers", "command")