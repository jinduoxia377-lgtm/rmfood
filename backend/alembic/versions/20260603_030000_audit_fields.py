"""添加审计字段

Revision ID: 012_add_audit_fields
Revises: 011_add_soft_delete
Create Date: 2026-06-03

为缺少审计的表添加 created_by、updated_by 字段。
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '20260603_030000_audit_fields'
down_revision: Union[str, None] = '20260603_020000_soft_delete'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# 需要添加审计字段的表
AUDIT_TABLES = [
    "formulas",
    "experiments",
    "ingredients",
    "peptides",
    "categories",
    "tags",
    "workflows",
    "workflow_tasks",
    "notifications",
    "teams",
]


def upgrade() -> None:
    """添加审计字段"""
    for table in AUDIT_TABLES:
        try:
            op.add_column(
                table,
                sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
            )
        except Exception:
            pass

        try:
            op.add_column(
                table,
                sa.Column('updated_by', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
            )
        except Exception:
            pass


def downgrade() -> None:
    """删除审计字段"""
    for table in AUDIT_TABLES:
        try:
            op.drop_column(table, 'created_by')
        except Exception:
            pass
        try:
            op.drop_column(table, 'updated_by')
        except Exception:
            pass
