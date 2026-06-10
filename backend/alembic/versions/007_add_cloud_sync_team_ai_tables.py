"""添加云端同步、团队协作和AI辅助模块表结构

Revision ID: 007_add_cloud_sync_team_ai_tables
Revises: 006_add_terminology_tables
Create Date: 2026-05-20

作者: RMFOOD Team

功能特性:
- ✅ 用户设备管理（多设备同步）
- ✅ 团队协作（团队+成员权限）
- ✅ 同步日志（操作审计）
- ✅ Prompt版本历史
- ✅ AI建议追踪
- ✅ 扩展通知系统
- ✅ 完整索引优化
- ✅ 级联删除策略
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '007_cloud_sync'
down_revision: Union[str, None] = '006_terminology'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """创建所有新表"""
    
    # ============================================================
    # 1. 创建 device_type 枚举类型
    # ============================================================
    op.execute("CREATE TYPE devicetype AS ENUM ('web', 'ios', 'android', 'desktop')")
    
    # ============================================================
    # 2. 创建 user_devices 表（用户设备）
    # ============================================================
    op.create_table('user_devices',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('device_id', sa.String(length=100), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('device_type', sa.String(length=50), nullable=False),
        sa.Column('device_name', sa.String(length=100), nullable=False),
        sa.Column('last_sync_at', sa.DateTime(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='1', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_user_devices_device_id', 'user_devices', ['device_id'], unique=True)
    op.create_index('ix_user_devices_user_id', 'user_devices', ['user_id'])
    op.create_index('idx_user_device_user_id_created_at', 'user_devices', ['user_id', 'created_at'])
    
    # ============================================================
    # 3. 创建 teamrole 枚举类型
    # ============================================================
    op.execute("CREATE TYPE teamrole AS ENUM ('owner', 'admin', 'member', 'guest')")
    
    # ============================================================
    # 4. 创建 teams 表（团队）
    # ============================================================
    op.create_table('teams',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('owner_id', sa.Integer(), nullable=False),
        sa.Column('settings', sa.JSON(), nullable=True),
        sa.Column('is_archived', sa.Boolean(), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_teams_owner_id', 'teams', ['owner_id'])
    op.create_index('ix_teams_created_at', 'teams', ['created_at'])
    op.create_index('idx_team_owner_id_created_at', 'teams', ['owner_id', 'created_at'])
    
    # ============================================================
    # 5. 创建 team_members 表（团队成员）
    # ============================================================
    op.create_table('team_members',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('team_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('role', sa.Teamrole(), server_default='member', nullable=False),
        sa.Column('invited_by', sa.Integer(), nullable=True),
        sa.Column('joined_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['team_id'], ['teams.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['invited_by'], ['users.id'], ondelete='SET NULL'),
        sa.UniqueConstraint('team_id', 'user_id', name='uq_team_user'),
    )
    op.create_index('ix_team_members_team_id', 'team_members', ['team_id'])
    op.create_index('ix_team_members_user_id', 'team_members', ['user_id'])
    op.create_index('idx_team_member_team_id_joined_at', 'team_members', ['team_id', 'joined_at'])
    
    # ============================================================
    # 6. 创建 syncaction 枚举类型
    # ============================================================
    op.execute("CREATE TYPE syncaction AS ENUM ('create', 'update', 'delete', 'conflict', 'merge')")
    
    # ============================================================
    # 7. 创建 syncstatus 枚举类型
    # ============================================================
    op.execute("CREATE TYPE syncstatus AS ENUM ('pending', 'in_progress', 'completed', 'failed', 'conflict')")
    
    # ============================================================
    # 8. 创建 sync_logs 表（同步日志）
    # ============================================================
    op.create_table('sync_logs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('device_id', sa.Integer(), nullable=True),
        sa.Column('action', sa.Syncaction(), nullable=False),
        sa.Column('entity_type', sa.String(length=50), nullable=False),
        sa.Column('entity_id', sa.Integer(), nullable=True),
        sa.Column('payload', sa.JSON(), nullable=True),
        sa.Column('status', sa.Syncstatus(), server_default='pending', nullable=False),
        sa.Column('error_msg', sa.Text(), nullable=True),
        sa.Column('timestamp', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['device_id'], ['user_devices.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_sync_logs_user_id', 'sync_logs', ['user_id'])
    op.create_index('ix_sync_logs_device_id', 'sync_logs', ['device_id'])
    op.create_index('ix_sync_logs_timestamp', 'sync_logs', ['timestamp'])
    op.create_index('idx_sync_log_user_timestamp', 'sync_logs', ['user_id', 'timestamp'])
    op.create_index('idx_sync_log_entity', 'sync_logs', ['entity_type', 'entity_id'])
    
    # ============================================================
    # 9. 创建 prompt_versions 表（Prompt版本历史）
    # ============================================================
    op.create_table('prompt_versions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('prompt_template_id', sa.Integer(), nullable=False),
        sa.Column('version_number', sa.Integer(), nullable=False),
        sa.Column('content_snapshot', sa.Text(), nullable=False),
        sa.Column('diff_summary', sa.Text(), nullable=True),
        sa.Column('changelog', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['prompt_template_id'], ['prompt_templates.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_prompt_versions_prompt_template_id', 'prompt_versions', ['prompt_template_id'])
    op.create_index('idx_prompt_version_template_version', 'prompt_versions', ['prompt_template_id', 'version_number'])
    
    # ============================================================
    # 10. 创建 suggestiontype 枚举类型
    # ============================================================
    op.execute("CREATE TYPE suggestiontype AS ENUM ('ingredient_replacement', 'process_improvement', 'cost_optimization', 'nutrition_enhancement', 'taste_adjustment')")
    
    # ============================================================
    # 11. 创建 ai_suggestions 表（AI建议）
    # ============================================================
    op.create_table('ai_suggestions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('prompt_id', sa.Integer(), nullable=True),
        sa.Column('suggestion_type', sa.Suggestiontype(), nullable=False),
        sa.Column('content', sa.JSON(), nullable=False),
        sa.Column('confidence_score', sa.Float(), nullable=True),
        sa.Column('is_applied', sa.Boolean(), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['prompt_id'], ['prompt_versions.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_ai_suggestions_created_at', 'ai_suggestions', ['created_at'])
    op.create_index('idx_ai_suggestion_type_created_at', 'ai_suggestions', ['suggestion_type', 'created_at'])
    
    # ============================================================
    # 12. 更新 notifications 表（添加 is_read 字段）
    # ============================================================
    op.add_column('notifications', sa.Column('is_read', sa.Boolean(), server_default='0', nullable=False))
    op.add_column('notifications', sa.Column('read_at', sa.DateTime(), nullable=True))
    op.create_index('idx_notification_user_read_created', 'notifications', ['user_id', 'is_read', 'created_at'])


def downgrade() -> None:
    """回滚所有新表"""
    
    # 删除新增的索引
    op.drop_index('idx_notification_user_read_created', table_name='notifications')
    op.drop_column('notifications', 'read_at')
    op.drop_column('notifications', 'is_read')
    
    op.drop_index('idx_ai_suggestion_type_created_at', table_name='ai_suggestions')
    op.drop_index('ix_ai_suggestions_created_at', table_name='ai_suggestions')
    op.drop_table('ai_suggestions')
    
    op.drop_index('idx_prompt_version_template_version', table_name='prompt_versions')
    op.drop_index('ix_prompt_versions_prompt_template_id', table_name='prompt_versions')
    op.drop_table('prompt_versions')
    
    op.drop_index('idx_sync_log_entity', table_name='sync_logs')
    op.drop_index('idx_sync_log_user_timestamp', table_name='sync_logs')
    op.drop_index('ix_sync_logs_timestamp', table_name='sync_logs')
    op.drop_index('ix_sync_logs_device_id', table_name='sync_logs')
    op.drop_index('ix_sync_logs_user_id', table_name='sync_logs')
    op.drop_table('sync_logs')
    
    op.drop_index('idx_team_member_team_id_joined_at', table_name='team_members')
    op.drop_index('ix_team_members_user_id', table_name='team_members')
    op.drop_index('ix_team_members_team_id', table_name='team_members')
    op.drop_table('team_members')
    
    op.drop_index('idx_team_owner_id_created_at', table_name='teams')
    op.drop_index('ix_teams_created_at', table_name='teams')
    op.drop_index('ix_teams_owner_id', table_name='teams')
    op.drop_table('teams')
    
    op.drop_index('idx_user_device_user_id_created_at', table_name='user_devices')
    op.drop_index('ix_user_devices_user_id', table_name='user_devices')
    op.drop_index('ix_user_devices_device_id', table_name='user_devices')
    op.drop_table('user_devices')
    
    # 删除枚举类型
    op.execute("DROP TYPE IF EXISTS suggestiontype")
    op.execute("DROP TYPE IF EXISTS syncstatus")
    op.execute("DROP TYPE IF EXISTS syncaction")
    op.execute("DROP TYPE IF EXISTS teamrole")
    op.execute("DROP TYPE IF EXISTS devicetype")
