"""修正 symmap_herbs 表的 herbdb_id 字段长度

Revision ID: 022_fix_symmap_herbdb_id_length
Revises: 021_add_symmap_herbs_table
Create Date: 2026-07-03

修正 herbdb_id 字段长度从 50 增加到 100，以容纳更长的 ID。
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "022_fix_symmap_herbdb_id_length"
down_revision = "021_add_symmap_herbs_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """修改 herbdb_id 字段长度"""
    op.alter_column('symmap_herbs', 'herbdb_id',
                   existing_type=sa.String(50),
                   type_=sa.String(100),
                   existing_nullable=True)


def downgrade() -> None:
    """回滚修改"""
    op.alter_column('symmap_herbs', 'herbdb_id',
                   existing_type=sa.String(100),
                   type_=sa.String(50),
                   existing_nullable=True)
