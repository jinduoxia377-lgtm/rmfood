"""
RMFOODFP 肽链结构分析模块 - 数据库迁移文件
使用 Alembic 进行版本控制
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# 迁移 ID - 使用当前日期作为版本号
revision = '20260515_000001_add_peptide_structure'
down_revision = '20260910_000000_add_cfam_tables'
branch_labels = None
depends_on = None


def upgrade():
    """
    添加肽链结构相关字段到现有表
    
    策略：在 peptide_analysis_details 表的 JSON data 字段中存储结构信息，
    同时创建独立的 peptide_structures 表用于快速查询和缓存。
    """
    # 1. 创建 peptide_structures 表（用于存储序列与 SMILES 的映射）
    op.create_table(
        'peptide_structures',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('sequence', sa.String(100), nullable=False, index=True),
        sa.Column('smiles', sa.Text, nullable=True),
        sa.Column('selfies', sa.String(2000), nullable=True),
        sa.Column('is_cyclic', sa.Boolean(), default=False),
        sa.Column('cyclization_type', sa.String(50), nullable=True),
        sa.Column('modifications', postgresql.JSONB, nullable=True),
        sa.Column('molecular_weight', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('sequence', name='uq_peptide_sequence'),
    )
    
    # 2. 给 peptide_analyses 表添加结构相关索引字段（可选，用于快速过滤）
    op.add_column('peptide_analyses', sa.Column('has_structure', sa.Boolean(), nullable=True))
    
    # 3. 创建索引加速查询
    op.create_index('idx_peptide_structures_sequence', 'peptide_structures', ['sequence'])
    op.create_index(
        'idx_peptide_structures_smiles', 
        'peptide_structures', 
        ['smiles'], 
        postgresql_using='gin', 
        postgresql_ops={'smiles': 'gin_trgm_ops'}
    )


def downgrade():
    """回滚迁移"""
    op.drop_index('idx_peptide_structures_smiles', table_name='peptide_structures')
    op.drop_index('idx_peptide_structures_sequence', table_name='peptide_structures')
    op.drop_column('peptide_analyses', 'has_structure')
    op.drop_table('peptide_structures')
