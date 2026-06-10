"""
肽数据库集成 - 数据库迁移

新增表:
- peptide_analyses (肽序列分析)
- peptide_analysis_details (分析详情)
- peptide_designs (肽设计优化)
- peptide_design_candidates (设计候选序列)

修改表:
- peptides 表添加4个新字段:
  - analysis_count (关联分析次数)
  - last_analysis_at (最后分析时间)
  - design_usage_count (被设计使用的次数)
  - deleted_at (软删除时间戳)

Revision ID: 004_add_peptide_analysis_design
Revises: 003_sss_enterprise_features
Create Date: 2026-05-03
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '004_peptide'
down_revision = '003_sss'
branch_labels = None
depends_on = None


def upgrade():
    # ══════════════════════════════════════════════
    # 1. 创建 peptide_analyses 表（肽序列分析）
    # ══════════════════════════════════════════════
    op.create_table(
        'peptide_analyses',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('sequence', sa.String(50), nullable=False),
        sa.Column('user_id', sa.Integer, sa.ForeignKey('users.id'), nullable=False),
        sa.Column(
            'analysis_mode',
            sa.Enum('quick', 'deep', 'custom', name='analysis_mode'),
            nullable=False,
            server_default='quick'
        ),
        sa.Column('tags', postgresql.JSONB, server_default='[]'),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column(
            'peptide_id',
            sa.Integer,
            sa.ForeignKey('peptides.id', ondelete='SET NULL'),
            nullable=True
        ),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.Integer, sa.ForeignKey('users.id'), nullable=False),
    )

    op.create_index('ix_peptide_analyses_sequence', 'peptide_analyses', ['sequence'])
    op.create_index('ix_peptide_analyses_user_id', 'peptide_analyses', ['user_id'])

    # ══════════════════════════════════════════════
    # 2. 创建 peptide_analysis_details 表（分析详情）
    # ══════════════════════════════════════════════
    op.create_table(
        'peptide_analysis_details',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            'analysis_id',
            sa.Integer,
            sa.ForeignKey('peptide_analyses.id', ondelete='CASCADE'),
            nullable=False
        ),
        sa.Column(
            'dimension_type',
            sa.Enum(
                'basic', 'structure', 'physicochemical',
                'bioactivity', 'safety', 'overall',
                name='dimension_type'
            ),
            nullable=False
        ),
        sa.Column('data', postgresql.JSONB, nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_index(
        'ix_peptide_analysis_details_analysis_id',
        'peptide_analysis_details',
        ['analysis_id']
    )
    op.create_index(
        'ix_peptide_analysis_details_dimension_type',
        'peptide_analysis_details',
        ['dimension_type']
    )

    # ══════════════════════════════════════════════
    # 3. 创建 peptide_designs 表（肽设计优化项目）
    # ══════════════════════════════════════════════
    op.create_table(
        'peptide_designs',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('project_name', sa.String(200), nullable=False),
        sa.Column('user_id', sa.Integer, sa.ForeignKey('users.id'), nullable=False),
        sa.Column('target_effects', postgresql.JSONB, server_default='[]'),
        sa.Column('objective_weights', postgresql.JSONB, server_default='{}'),
        sa.Column('constraints', postgresql.JSONB, nullable=True),
        sa.Column('seed_sequence', sa.String(50), nullable=True),
        sa.Column(
            'status',
            sa.Enum('draft', 'in_progress', 'completed', 'archived', name='peptide_design_status'),
            nullable=False,
            server_default='draft'
        ),
        sa.Column('version', sa.Integer, server_default='1'),
        sa.Column(
            'parent_version_id',
            sa.Integer,
            sa.ForeignKey('peptide_designs.id'),
            nullable=True
        ),
        sa.Column('total_candidates', sa.Integer, server_default='0'),
        sa.Column('pareto_size', sa.Integer, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('archived_at', sa.DateTime(timezone=True), nullable=True),
    )

    op.create_index('ix_peptide_designs_user_id', 'peptide_designs', ['user_id'])
    op.create_index('ix_peptide_designs_status', 'peptide_designs', ['status'])
    op.create_index('ix_peptide_designs_created_at', 'peptide_designs', ['created_at'])

    # ══════════════════════════════════════════════
    # 4. 创建 peptide_design_candidates 表（设计候选序列）
    # ══════════════════════════════════════════════
    op.create_table(
        'peptide_design_candidates',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            'design_id',
            sa.Integer,
            sa.ForeignKey('peptide_designs.id', ondelete='CASCADE'),
            nullable=False
        ),
        sa.Column('sequence', sa.String(50), nullable=False),
        sa.Column('objectives_scores', postgresql.JSONB, server_default='{}'),
        sa.Column('rank', sa.Integer, nullable=True),
        sa.Column('is_pareto_frontier', sa.Boolean, server_default='false'),
        sa.Column('dominated_by_count', sa.Integer, server_default='0'),
        sa.Column(
            'peptide_id',
            sa.Integer,
            sa.ForeignKey('peptides.id'),
            nullable=True
        ),
        sa.Column('additional_data', postgresql.JSONB, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_index(
        'ix_peptide_design_candidates_design_id',
        'peptide_design_candidates',
        ['design_id']
    )
    op.create_index(
        'ix_peptide_design_candidates_rank',
        'peptide_design_candidates',
        ['rank']
    )

    # ══════════════════════════════════════════════
    # 5. 修改 peptides 表添加新字段
    # ══════════════════════════════════════════════
    op.add_column(
        'peptides',
        sa.Column('analysis_count', sa.Integer, server_default='0', comment='关联分析次数')
    )
    op.add_column(
        'peptides',
        sa.Column('last_analysis_at', sa.DateTime(timezone=True), nullable=True, comment='最后分析时间')
    )
    op.add_column(
        'peptides',
        sa.Column('design_usage_count', sa.Integer, server_default='0', comment='被设计使用的次数')
    )
    op.add_column(
        'peptides',
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True, comment='软删除时间戳')
    )


def downgrade():
    # ══════════════════════════════════════════════
    # 删除 peptides 表的新增列（按添加顺序的逆序）
    # ══════════════════════════════════════════════
    op.drop_column('peptides', 'deleted_at')
    op.drop_column('peptides', 'design_usage_count')
    op.drop_column('peptides', 'last_analysis_at')
    op.drop_column('peptides', 'analysis_count')

    # ══════════════════════════════════════════════
    # 删除新创建的表（按依赖关系逆序）
    # ══════════════════════════════════════════════
    op.drop_table('peptide_design_candidates')
    op.drop_table('peptide_designs')
    op.drop_table('peptide_analysis_details')
    op.drop_table('peptide_analyses')

    # 删除枚举类型
    op.execute("DROP TYPE IF EXISTS analysis_mode")
    op.execute("DROP TYPE IF EXISTS dimension_type")
    op.execute("DROP TYPE IF EXISTS peptide_design_status")
