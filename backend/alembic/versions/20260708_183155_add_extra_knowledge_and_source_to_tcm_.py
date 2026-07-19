"""add_extra_knowledge_and_source_to_tcm_herbs

Revision ID: f21c3fe4ee7b
Revises: 023_symmap_field_lengths
Create Date: 2026-07-08 18:31:55.257205

扩展 TCMHerb 表：
- 添加 source 字段：数据来源标识（tcsp/mmid/seed）
- 添加 extra_knowledge 字段：JSON 文本，存储扩展知识（dosage/pairing/meridian/contraindication）
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision: str = 'f21c3fe4ee7b'
down_revision: Union[str, None] = '023_symmap_field_lengths'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """添加 source 和 extra_knowledge 列"""
    op.add_column('tcm_herbs', sa.Column('source', sa.String(50), nullable=True, server_default='tcsp'))
    op.add_column('tcm_herbs', sa.Column('extra_knowledge', sa.Text(), nullable=True))


def downgrade() -> None:
    """回滚：删除列"""
    op.drop_column('tcm_herbs', 'extra_knowledge')
    op.drop_column('tcm_herbs', 'source')
