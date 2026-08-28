"""搜索持久化表：收藏/最近浏览/搜索历史

Revision ID: 016_add_search_persistence
Revises: 015_enhance_tcm_dfbp_tables
Create Date: 2026-06-24

新增表：
- search_history: 搜索历史记录
- search_favorites: 搜索收藏
- search_recent_views: 最近浏览记录
"""
from alembic import op
import sqlalchemy as sa

revision = '20260624_000000'
down_revision = '20260603_060000_enhance_tcm_dfbp'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 搜索历史表
    op.create_table(
        'search_history',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('keyword', sa.String(200), nullable=False),
        sa.Column('result_count', sa.Integer(), default=0),
        sa.Column('searched_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Index('ix_search_history_user_searched', 'user_id', 'searched_at'),
    )

    # 搜索收藏表
    op.create_table(
        'search_favorites',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('item_type', sa.String(50), nullable=False),
        sa.Column('item_id', sa.Integer(), nullable=False),
        sa.Column('favorited_at', sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint('user_id', 'item_type', 'item_id', name='uq_search_favorites'),
        sa.Index('ix_search_favorites_user', 'user_id', 'favorited_at'),
    )

    # 最近浏览表
    op.create_table(
        'search_recent_views',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('item_type', sa.String(50), nullable=False),
        sa.Column('item_id', sa.Integer(), nullable=False),
        sa.Column('viewed_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Index('ix_search_recent_views_user', 'user_id', 'viewed_at'),
    )


def downgrade() -> None:
    op.drop_table('search_recent_views')
    op.drop_table('search_favorites')
    op.drop_table('search_history')
