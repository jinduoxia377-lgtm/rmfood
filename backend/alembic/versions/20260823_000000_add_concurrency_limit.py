"""add concurrency_limit column to ai_model_configs table

Revision ID: 20260823_000000_add_concurrency_limit
Revises: 20260821_150000_add_ai_model_configs
Create Date: 2026-08-23 00:00:00

新增并发限制字段：
- concurrency_limit: 最大并发请求数（1-10），默认 3
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '20260823_000000_add_concurrency_limit'
down_revision: Union[str, None] = '20260821_150000_add_ai_model_configs'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 添加 concurrency_limit 列，默认值为 3
    op.add_column(
        "ai_model_configs",
        sa.Column(
            "concurrency_limit",
            sa.Integer(),
            nullable=False,
            server_default="3",
            comment="最大并发请求数（1-10）",
        ),
    )


def downgrade() -> None:
    op.drop_column("ai_model_configs", "concurrency_limit")
