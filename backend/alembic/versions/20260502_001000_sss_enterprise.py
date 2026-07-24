"""
SSS级企业功能 - 数据库迁移

新增表:
- notifications (通知中心)
- notification_preferences (通知偏好)
- organizations (组织)
- organization_members (组织成员)
- teams (团队)
- webhooks (Webhook配置)
- webhook_deliveries (投递日志)
- api_keys (API密钥)
- integrations (第三方集成)
- audit_logs (审计日志)
- report_configs (报表配置)

Revision ID: 003_sss_enterprise_features
Revises: 002_add_account_security
Create Date: 2026-05-02
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '20260502_001000_sss_enterprise'
down_revision = '20260503_000000_formula_deep_integration'
branch_labels = None
depends_on = None


def upgrade():
    # ══════════════════════════════════════════════
    # 注: notifications / audit_logs 已在 001_initial 中创建
    # 此迁移仅创建 001 中不存在的新表
    # ══════════════════════════════════════════════

    # ══════════════════════════════════════════════
    # 1. 通知偏好表 (notification_preferences)
    # ══════════════════════════════════════════════
    
    # ══════════════════════════════════════════════
    # 2. 多租户组织管理表
    # ══════════════════════════════════════════════
    op.create_table(
        'organizations',
        sa.Column('id', sa.Integer, sa.Sequence('org_id_seq'), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('slug', sa.String(50), unique=True, nullable=False, index=True),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('logo_url', sa.String(500), nullable=True),
        sa.Column('owner_id', sa.Integer, sa.ForeignKey('users.id'), nullable=False),
        sa.Column('plan', sa.String(20), nullable=False, default='free'),
        sa.Column('settings', postgresql.JSONB, server_default='{}'),
        sa.Column('is_active', sa.Boolean, default=True, index=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    
    op.create_table(
        'organization_members',
        sa.Column('id', sa.Integer, sa.Sequence('org_member_id_seq'), primary_key=True),
        sa.Column('org_id', sa.Integer, sa.ForeignKey('organizations.id'), nullable=False, index=True),
        sa.Column('user_id', sa.Integer, sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('role', sa.String(20), nullable=False, default='member'),
        sa.Column('team_ids', postgresql.ARRAY(sa.Integer), server_default='{}'),
        sa.Column('joined_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('invited_by', sa.Integer, sa.ForeignKey('users.id'), nullable=True),
        sa.UniqueConstraint('org_id', 'user_id', name='uq_org_member'),
    )
    
    op.create_table(
        'teams',
        sa.Column('id', sa.Integer, sa.Sequence('team_id_seq'), primary_key=True),
        sa.Column('org_id', sa.Integer, sa.ForeignKey('organizations.id'), nullable=False, index=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('lead_id', sa.Integer, sa.ForeignKey('users.id'), nullable=True),
        sa.Column('permissions', postgresql.JSONB, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    
    # ══════════════════════════════════════════════
    # 3. Webhook & 集成框架表
    # ══════════════════════════════════════════════
    op.create_table(
        'webhooks',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('url', sa.String(500), nullable=False),
        sa.Column('events', postgresql.ARRAY(sa.String(50)), server_default='{}'),
        sa.Column('secret', sa.String(128), nullable=False),
        sa.Column('headers', postgresql.JSONB, server_default='{}'),
        sa.Column('status', sa.String(20), nullable=False, default='active'),
        sa.Column('owner_id', sa.Integer, sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('org_id', sa.Integer, sa.ForeignKey('organizations.id'), nullable=True),
        sa.Column('last_trigger_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('success_count', sa.Integer, default=0),
        sa.Column('failure_count', sa.Integer, default=0),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    
    op.create_table(
        'webhook_deliveries',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('webhook_id', sa.String(36), sa.ForeignKey('webhooks.id'), nullable=False, index=True),
        sa.Column('event_type', sa.String(50), nullable=False),
        sa.Column('payload', postgresql.JSONB, nullable=False),
        sa.Column('response_status', sa.Integer, nullable=True),
        sa.Column('response_body', sa.Text, nullable=True),
        sa.Column('duration_ms', sa.Integer, nullable=True),
        sa.Column('success', sa.Boolean, default=False, index=True),
        sa.Column('retry_count', sa.Integer, default=0),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), index=True),
    )
    
    op.create_table(
        'api_keys',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('key_hash', sa.String(64), nullable=False, unique=True),
        sa.Column('key_prefix', sa.String(15), nullable=False),
        sa.Column('scopes', postgresql.ARRAY(sa.String(50)), server_default='{}'),
        sa.Column('owner_id', sa.Integer, sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('org_id', sa.Integer, sa.ForeignKey('organizations.id'), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean, default=True, index=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    
    op.create_table(
        'integrations',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('type', sa.String(30), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('config', postgresql.JSONB, nullable=False),
        sa.Column('events', postgresql.ARRAY(sa.String(50)), server_default='{}'),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('owner_id', sa.Integer, sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('org_id', sa.Integer, sa.ForeignKey('organizations.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    
    # ══════════════════════════════════════════════
    # 注: audit_logs 已在 001_initial 中创建
    # ══════════════════════════════════════════════

    # ══════════════════════════════════════════════
    # 5. 数据分析报表表
    # ══════════════════════════════════════════════
    op.create_table(
        'report_configs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('widgets_config', postgresql.JSONB, nullable=False),
        sa.Column('filters', postgresql.JSONB, server_default='{}'),
        sa.Column('schedule', postgresql.JSONB, nullable=True),
        sa.Column('export_format', sa.String(10), default='excel'),
        sa.Column('created_by', sa.Integer, sa.ForeignKey('users.id'), nullable=False),
        sa.Column('is_public', sa.Boolean, default=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    
    # ══════════════════════════════════════════════
    # 索引优化 (仅含本迁移创建的表)
    # ══════════════════════════════════════════════
    op.create_index('idx_webhook_deliveries_webhook_time', 'webhook_deliveries', ['webhook_id', 'created_at'])


def downgrade():
    # 按依赖关系逆序删除 (仅删除本迁移创建的表)
    op.drop_table('report_configs')
    # audit_logs 由 001_initial 的 downgrade 处理
    op.drop_table('integrations')
    op.drop_table('api_keys')
    op.drop_table('webhook_deliveries')
    op.drop_table('webhooks')
    op.drop_table('teams')
    op.drop_table('organization_members')
    op.drop_table('organizations')
    op.drop_table('notification_preferences')
    op.drop_table('notifications')
