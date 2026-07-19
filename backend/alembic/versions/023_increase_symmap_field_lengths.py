"""修正 SymMap 药材表字段长度

Revision ID: 023_increase_symmap_field_lengths
Revises: 022_fix_symmap_herbdb_id_length
Create Date: 2026-07-03

增加 SymMap 药材表中较长字段的长度，以适应实际数据。
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "023_symmap_field_lengths"
down_revision = "022_fix_symmap_herbdb_id_length"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """增加字段长度"""
    op.alter_column('symmap_herbs', 'name_latin',
                   existing_type=sa.String(300),
                   type_=sa.String(500))
    op.alter_column('symmap_herbs', 'nature_cn',
                   existing_type=sa.String(200),
                   type_=sa.String(500))
    op.alter_column('symmap_herbs', 'nature_eng',
                   existing_type=sa.String(200),
                   type_=sa.String(500))
    op.alter_column('symmap_herbs', 'meridians_cn',
                   existing_type=sa.String(200),
                   type_=sa.String(500))
    op.alter_column('symmap_herbs', 'meridians_eng',
                   existing_type=sa.String(200),
                   type_=sa.String(500))
    op.alter_column('symmap_herbs', 'category_cn',
                   existing_type=sa.String(100),
                   type_=sa.String(200))
    op.alter_column('symmap_herbs', 'category_eng',
                   existing_type=sa.String(100),
                   type_=sa.String(200))
    op.alter_column('symmap_herbs', 'use_part',
                   existing_type=sa.String(100),
                   type_=sa.String(200))
    op.alter_column('symmap_herbs', 'alias',
                   existing_type=sa.String(300),
                   type_=sa.String(500))


def downgrade() -> None:
    """回滚字段长度修改"""
    op.alter_column('symmap_herbs', 'alias',
                   existing_type=sa.String(500),
                   type_=sa.String(300))
    op.alter_column('symmap_herbs', 'use_part',
                   existing_type=sa.String(200),
                   type_=sa.String(100))
    op.alter_column('symmap_herbs', 'category_eng',
                   existing_type=sa.String(200),
                   type_=sa.String(100))
    op.alter_column('symmap_herbs', 'category_cn',
                   existing_type=sa.String(200),
                   type_=sa.String(100))
    op.alter_column('symmap_herbs', 'meridians_eng',
                   existing_type=sa.String(500),
                   type_=sa.String(200))
    op.alter_column('symmap_herbs', 'meridians_cn',
                   existing_type=sa.String(500),
                   type_=sa.String(200))
    op.alter_column('symmap_herbs', 'nature_eng',
                   existing_type=sa.String(500),
                   type_=sa.String(200))
    op.alter_column('symmap_herbs', 'nature_cn',
                   existing_type=sa.String(500),
                   type_=sa.String(200))
    op.alter_column('symmap_herbs', 'name_latin',
                   existing_type=sa.String(500),
                   type_=sa.String(300))
