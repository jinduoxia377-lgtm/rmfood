"""添加性能索引

Revision ID: 008_performance_indexes
Revises: 007_add_cloud_sync_team_ai_tables
Create Date: 2026-06-02

为高频查询字段添加索引以提升查询性能。
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = '20260602_000000'
down_revision = '20260520_000000_cloud_sync_team_ai'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """添加性能索引"""

    # ── 用户表索引 ──
    op.create_index('ix_users_email', 'users', ['email'], unique=False)
    op.create_index('ix_users_username', 'users', ['username'], unique=False)
    op.create_index('ix_users_created_at', 'users', ['created_at'], unique=False)
    op.create_index('ix_users_role', 'users', ['role'], unique=False)
    op.create_index('ix_users_is_active', 'users', ['is_active'], unique=False)

    # ── 配方表索引 ──
    op.create_index('ix_formulas_status', 'formulas', ['status'], unique=False)
    op.create_index('ix_formulas_created_at', 'formulas', ['created_at'], unique=False)
    op.create_index('ix_formulas_creator_id', 'formulas', ['creator_id'], unique=False)
    op.create_index('ix_formulas_updated_at', 'formulas', ['updated_at'], unique=False)

    # 复合索引：按状态+创建时间查询（列表页常用）
    op.create_index(
        'ix_formulas_status_created',
        'formulas',
        ['status', 'created_at'],
        unique=False,
    )

    # 复合索引：按创建者+状态查询
    op.create_index(
        'ix_formulas_creator_status',
        'formulas',
        ['creator_id', 'status'],
        unique=False,
    )

    # ── 实验表索引 ──
    op.create_index('ix_experiments_status', 'experiments', ['status'], unique=False)
    op.create_index('ix_experiments_created_at', 'experiments', ['created_at'], unique=False)
    op.create_index('ix_experiments_researcher_id', 'experiments', ['researcher_id'], unique=False)
    op.create_index('ix_experiments_formula_id', 'experiments', ['formula_id'], unique=False)

    # ── 成分表索引 ──
    op.create_index('ix_ingredients_name', 'ingredients', ['name'], unique=False)
    op.create_index('ix_ingredients_category', 'ingredients', ['category'], unique=False)
    op.create_index('ix_ingredients_is_food_homology', 'ingredients', ['is_food_homology'], unique=False)

    # ── 肽表索引 ──
    op.create_index('ix_peptides_sequence', 'peptides', ['sequence'], unique=False)
    op.create_index('ix_peptides_activity_type', 'peptides', ['activity_type'], unique=False)

    # ── 通知表索引 ──
    op.create_index('ix_notifications_user_id', 'notifications', ['user_id'], unique=False)
    op.create_index('ix_notifications_is_read', 'notifications', ['is_read'], unique=False)

    # 复合索引：按用户+已读状态查询
    op.create_index(
        'ix_notifications_user_read',
        'notifications',
        ['user_id', 'is_read'],
        unique=False,
    )

    # ── 审计日志索引 ──
    op.create_index('ix_audit_logs_user_id', 'audit_logs', ['user_id'], unique=False)
    op.create_index('ix_audit_logs_created_at', 'audit_logs', ['created_at'], unique=False)
    op.create_index('ix_audit_logs_action_type', 'audit_logs', ['action_type'], unique=False)

    # ── 工作流索引 ──
    op.create_index('ix_workflows_status', 'workflows', ['status'], unique=False)
    op.create_index('ix_workflows_created_by', 'workflows', ['created_by'], unique=False)

    # ── 标签索引 ──
    op.create_index('ix_tags_name', 'tags', ['name'], unique=False)

    # ── 分类索引 ──
    op.create_index('ix_categories_name', 'categories', ['name'], unique=False)
    op.create_index('ix_categories_parent_id', 'categories', ['parent_id'], unique=False)


def downgrade() -> None:
    """移除性能索引"""

    # 分类
    op.drop_index('ix_categories_parent_id', table_name='categories')
    op.drop_index('ix_categories_name', table_name='categories')

    # 标签
    op.drop_index('ix_tags_name', table_name='tags')

    # 工作流
    op.drop_index('ix_workflows_created_by', table_name='workflows')
    op.drop_index('ix_workflows_status', table_name='workflows')

    # 审计日志
    op.drop_index('ix_audit_logs_action_type', table_name='audit_logs')
    op.drop_index('ix_audit_logs_created_at', table_name='audit_logs')
    op.drop_index('ix_audit_logs_user_id', table_name='audit_logs')

    # 通知
    op.drop_index('ix_notifications_user_read', table_name='notifications')
    op.drop_index('ix_notifications_is_read', table_name='notifications')
    op.drop_index('ix_notifications_user_id', table_name='notifications')

    # 肽
    op.drop_index('ix_peptides_activity_type', table_name='peptides')
    op.drop_index('ix_peptides_sequence', table_name='peptides')

    # 成分
    op.drop_index('ix_ingredients_is_food_homology', table_name='ingredients')
    op.drop_index('ix_ingredients_category', table_name='ingredients')
    op.drop_index('ix_ingredients_name', table_name='ingredients')

    # 实验
    op.drop_index('ix_experiments_formula_id', table_name='experiments')
    op.drop_index('ix_experiments_researcher_id', table_name='experiments')
    op.drop_index('ix_experiments_created_at', table_name='experiments')
    op.drop_index('ix_experiments_status', table_name='experiments')

    # 配方
    op.drop_index('ix_formulas_creator_status', table_name='formulas')
    op.drop_index('ix_formulas_status_created', table_name='formulas')
    op.drop_index('ix_formulas_updated_at', table_name='formulas')
    op.drop_index('ix_formulas_creator_id', table_name='formulas')
    op.drop_index('ix_formulas_created_at', table_name='formulas')
    op.drop_index('ix_formulas_status', table_name='formulas')

    # 用户
    op.drop_index('ix_users_is_active', table_name='users')
    op.drop_index('ix_users_role', table_name='users')
    op.drop_index('ix_users_created_at', table_name='users')
    op.drop_index('ix_users_username', table_name='users')
    op.drop_index('ix_users_email', table_name='users')
