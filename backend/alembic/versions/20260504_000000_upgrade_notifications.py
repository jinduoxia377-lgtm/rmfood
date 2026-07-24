"""升级通知系统表结构

Revision ID: 005_upgrade_notification_system
Revises: 004_add_peptide_analysis_design
Create Date: 2026-05-04

作者: RMFOOD Team
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260504_000000_upgrade_notifications'
down_revision: Union[str, None] = '20260503_000100_peptide_analysis'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """升级通知系统表结构"""
    
    # ============================================================
    # 1. 升级 notifications 表 - 添加新字段
    # ============================================================
    
    # 添加 subject 字段（兼容旧的 title）
    op.add_column('notifications', sa.Column('subject', sa.String(length=200), nullable=True))
    
    # 添加 body 字段（兼容旧的 content）
    op.add_column('notifications', sa.Column('body', sa.Text(), nullable=True))
    
    # 添加 channel 字段
    op.add_column('notifications', sa.Column('channel', sa.String(length=20), server_default='in_app', nullable=False))
    
    # 添加 metadata 字段（JSON格式存储额外信息）
    op.add_column('notifications', sa.Column('metadata', sa.JSON(), nullable=True))
    
    # 添加 is_read 字段（替代旧的 status 字段）
    op.add_column('notifications', sa.Column('is_read', sa.Boolean(), server_default='false', nullable=False))
    
    # 添加 read_at 字段
    op.add_column('notifications', sa.Column('read_at', sa.DateTime(), nullable=True))
    
    # 数据迁移：从旧字段复制数据到新字段
    op.execute("""
        UPDATE notifications 
        SET subject = COALESCE(title, '无标题'),
            body = COALESCE(content, ''),
            is_read = (status = 'read')
    """)
    
    # ============================================================
    # 2. 创建 notification_preferences 表
    # ============================================================
    op.create_table('notification_preferences',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('data', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_notification_preferences_user_id', 'notification_preferences', ['user_id'], unique=True)
    
    print("✅ 通知系统表结构升级完成")


def downgrade() -> None:
    """回滚通知系统表结构升级"""
    
    # 删除 notification_preferences 表
    op.drop_index('ix_notification_preferences_user_id', table_name='notification_preferences')
    op.drop_table('notification_preferences')
    
    # 删除新增的字段
    op.drop_column('notifications', 'read_at')
    op.drop_column('notifications', 'is_read')
    op.drop_column('notifications', 'metadata')
    op.drop_column('notifications', 'channel')
    op.drop_column('notifications', 'body')
    op.drop_column('notifications', 'subject')
    
    print("⏪ 通知系统表结构已回滚")
