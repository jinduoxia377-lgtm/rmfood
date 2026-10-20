"""add plan column to ai_task_groups

阶段 B：任务规划结果持久化，避免派单时重复调用 LLM 规划。

Revision ID: 20261015_000000
Revises: 20261014_020000
Create Date: 2026-10-15
"""
from alembic import op
import sqlalchemy as sa


revision = "20261015_000000"
down_revision = "20261014_020000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("ai_task_groups", sa.Column("plan", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("ai_task_groups", "plan")