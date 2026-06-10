"""添加软删除支持

Revision ID: 011_add_soft_delete
Revises: 010_add_fulltext_search
Create Date: 2026-06-03

为关键表添加 deleted_at 字段，支持软删除。
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '011_soft_delete'
down_revision: Union[str, None] = '010_fulltext'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# 需要添加软删除的表
SOFT_DELETE_TABLES = [
    "users",
    "formulas",
    "experiments",
    "teams",
    "ingredients",
    "peptides",
    "workflows",
    "prompt_templates",
]


def upgrade() -> None:
    """添加 deleted_at 字段"""
    for table in SOFT_DELETE_TABLES:
        try:
            op.add_column(
                table,
                sa.Column('deleted_at', sa.DateTime(), nullable=True, index=True)
            )
        except Exception:
            # 字段可能已存在
            pass


def downgrade() -> None:
    """删除 deleted_at 字段"""
    for table in SOFT_DELETE_TABLES:
        try:
            op.drop_column(table, 'deleted_at')
        except Exception:
            pass
