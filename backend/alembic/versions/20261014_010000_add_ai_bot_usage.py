"""add ai_bot_usage table

Phase 3：AI 用量统计表。

Revision ID: 20261014_010000
Revises: 20261014_000000
Create Date: 2026-10-14
"""
from alembic import op
import sqlalchemy as sa


revision = "20261014_010000"
down_revision = "20261014_000000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_bot_usage",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False, primary_key=True),
        sa.Column("tenant_id", sa.BigInteger(), nullable=False, index=True),
        sa.Column("bot_id", sa.BigInteger(), nullable=True, index=True),
        sa.Column("user_id", sa.BigInteger(), nullable=False, index=True),
        sa.Column("model", sa.String(length=128), nullable=False, server_default=""),
        sa.Column("prompt_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completion_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("endpoint", sa.String(length=64), nullable=False, server_default="agent"),
        sa.Column("task_execution_id", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Index("ix_ai_bot_usage_tenant_created", "tenant_id", "created_at"),
    )


def downgrade() -> None:
    op.drop_table("ai_bot_usage")