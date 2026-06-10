"""添加专业术语数据库表结构

Revision ID: 006_add_terminology_tables
Revises: 005_upgrade_notification_system
Create Date: 2026-05-17

作者: RMFOOD Team
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '006_terminology'
down_revision: Union[str, None] = '005_upgrade_notification_system'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """创建术语相关表"""
    
    # ============================================================
    # 1. 创建 term_categories 表（术语分类）
    # ============================================================
    op.create_table('term_categories',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('name_en', sa.String(length=100), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('parent_id', sa.Integer(), nullable=True),
        sa.Column('level', sa.Integer(), server_default='1', nullable=False),
        sa.Column('sort_order', sa.Integer(), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['parent_id'], ['term_categories.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_term_categories_name', 'term_categories', ['name'], unique=True)
    op.create_index('ix_term_categories_parent_id', 'term_categories', ['parent_id'])
    
    # ============================================================
    # 2. 创建 terms 表（术语）
    # ============================================================
    op.create_table('terms',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('term', sa.String(length=200), nullable=False),
        sa.Column('term_en', sa.String(length=200), nullable=True),
        sa.Column('pinyin', sa.String(length=200), nullable=True),
        sa.Column('pinyin_abbr', sa.String(length=100), nullable=True),
        sa.Column('abbreviation', sa.String(length=50), nullable=True),
        sa.Column('definition', sa.Text(), nullable=False),
        sa.Column('definition_en', sa.Text(), nullable=True),
        sa.Column('category_id', sa.Integer(), nullable=False),
        sa.Column('subcategory', sa.String(length=100), nullable=True),
        sa.Column('unit', sa.String(length=50), nullable=True),
        sa.Column('examples', sa.JSON(), nullable=True),
        sa.Column('synonyms', sa.JSON(), nullable=True),
        sa.Column('related_terms', sa.JSON(), nullable=True),
        sa.Column('source', sa.String(length=200), nullable=True),
        sa.Column('is_standard', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('confidence', sa.Float(), server_default='1.0', nullable=False),
        sa.Column('frequency', sa.Integer(), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['category_id'], ['term_categories.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_terms_term', 'terms', ['term'], unique=True)
    op.create_index('ix_terms_category_id', 'terms', ['category_id'])
    op.create_index('ix_terms_term_en', 'terms', ['term_en'])
    
    # ============================================================
    # 3. 创建 term_variants 表（术语变体）
    # ============================================================
    op.create_table('term_variants',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('variant', sa.String(length=200), nullable=False),
        sa.Column('term_id', sa.Integer(), nullable=False),
        sa.Column('similarity', sa.Float(), server_default='0.8', nullable=False),
        sa.Column('variant_type', sa.String(length=50), server_default='synonym', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['term_id'], ['terms.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_term_variants_variant', 'term_variants', ['variant'], unique=True)
    op.create_index('ix_term_variants_term_id', 'term_variants', ['term_id'])
    
    # ============================================================
    # 4. 创建 term_validations 表（术语验证记录）
    # ============================================================
    op.create_table('term_validations',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('input_term', sa.String(length=200), nullable=False),
        sa.Column('matched_term_id', sa.Integer(), nullable=True),
        sa.Column('is_valid', sa.Boolean(), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=True),
        sa.Column('suggested_term', sa.String(length=200), nullable=True),
        sa.Column('correction_needed', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('validation_type', sa.String(length=50), server_default='auto', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['matched_term_id'], ['terms.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_term_validations_input_term', 'term_validations', ['input_term'])
    op.create_index('ix_term_validations_matched_term_id', 'term_validations', ['matched_term_id'])
    
    # ============================================================
    # 5. 创建 term_normalization_rules 表（术语标准化规则）
    # ============================================================
    op.create_table('term_normalization_rules',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('pattern', sa.String(length=500), nullable=False),
        sa.Column('replacement', sa.String(length=500), nullable=False),
        sa.Column('rule_type', sa.String(length=50), server_default='regex', nullable=False),
        sa.Column('priority', sa.Integer(), server_default='100', nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('enabled', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_term_normalization_rules_priority', 'term_normalization_rules', ['priority'])
    
    # ============================================================
    # 6. 创建 term_statistics 表（术语统计信息）
    # ============================================================
    op.create_table('term_statistics',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('category_id', sa.Integer(), nullable=True),
        sa.Column('total_terms', sa.Integer(), server_default='0', nullable=False),
        sa.Column('validation_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('correction_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('accuracy_rate', sa.Float(), server_default='1.0', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['category_id'], ['term_categories.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_term_statistics_category_id', 'term_statistics', ['category_id'])
    
    print("✅ 术语数据库表结构创建完成")


def downgrade() -> None:
    """回滚术语数据库表结构"""
    
    # 删除表（按依赖顺序）
    op.drop_index('ix_term_statistics_category_id', table_name='term_statistics')
    op.drop_table('term_statistics')
    
    op.drop_index('ix_term_normalization_rules_priority', table_name='term_normalization_rules')
    op.drop_table('term_normalization_rules')
    
    op.drop_index('ix_term_validations_matched_term_id', table_name='term_validations')
    op.drop_index('ix_term_validations_input_term', table_name='term_validations')
    op.drop_table('term_validations')
    
    op.drop_index('ix_term_variants_term_id', table_name='term_variants')
    op.drop_index('ix_term_variants_variant', table_name='term_variants')
    op.drop_table('term_variants')
    
    op.drop_index('ix_terms_term_en', table_name='terms')
    op.drop_index('ix_terms_category_id', table_name='terms')
    op.drop_index('ix_terms_term', table_name='terms')
    op.drop_table('terms')
    
    op.drop_index('ix_term_categories_parent_id', table_name='term_categories')
    op.drop_index('ix_term_categories_name', table_name='term_categories')
    op.drop_table('term_categories')
    
    print("⏪ 术语数据库表结构已回滚")