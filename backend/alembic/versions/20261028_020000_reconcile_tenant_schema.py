"""
租户隔离 Schema 调和迁移（Phase 2）

背景（审计 reports/team-audit-tenant/COMPREHENSIVE_AUDIT_SUMMARY.md）:
- 20260502_001000 建 organization_members 用 org_id 列，但 ORM/服务统一用
  organization_id（无调和迁移）→ 生产 alembic 建库下成员/配额 SQL 报错。
- subscriptions / billing_orders 被 ORM 与 upgrade_subscription 原生 SQL 使用，
  但 76 个 alembic 版本中无任何迁移创建这两张表 → 升级订阅端点运行时表不存在。

本迁移为防御式/幂等：用 inspector 检查实际状态，仅对缺失/不一致项执行，
兼容「alembic 建库（含 org_id）」与「create_all 建库（含 organization_id）」两种现状。

Revision ID: 20261028_020000
Revises: 20261028_010000_add_user_plan
Create Date: 2026-10-28
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '20261028_020000'
down_revision = '20261028_010000_add_user_plan'
branch_labels = None
depends_on = None


def _columns(bind, table: str):
    insp = sa.inspect(bind)
    if table not in insp.get_table_names():
        return []
    return [c['name'] for c in insp.get_columns(table)]


def upgrade():
    bind = op.get_bind()

    # ── 1. organization_members: org_id → organization_id（仅当 org_id 存在且 organization_id 缺失）──
    cols = _columns(bind, 'organization_members')
    if 'org_id' in cols and 'organization_id' not in cols:
        op.alter_column('organization_members', 'org_id', new_column_name='organization_id')
        # 依赖该列的索引/约束名（uq_org_member 引用 org_id）在 PG 的 RENAME COLUMN 下自动更新

    # ── 2. organizations: 补齐 plan/settings/logo_url（若缺失，防御）──
    ocols = _columns(bind, 'organizations')
    if 'plan' not in ocols:
        op.add_column('organizations', sa.Column('plan', sa.String(20), nullable=False, server_default='free'))
    if 'settings' not in ocols:
        op.add_column('organizations', sa.Column('settings', postgresql.JSONB, server_default='{}'))
    if 'logo_url' not in ocols:
        op.add_column('organizations', sa.Column('logo_url', sa.String(500), nullable=True))

    # ── 3. subscriptions（若不存在则创建，列与 ORM models/organization.py:72 对齐）──
    if 'subscriptions' not in sa.inspect(bind).get_table_names():
        op.create_table(
            'subscriptions',
            sa.Column('id', sa.BigInteger, sa.Sequence('subscriptions_id_seq'), primary_key=True, autoincrement=True),
            sa.Column('organization_id', sa.BigInteger, nullable=False, index=True),
            sa.Column('plan', sa.String(20), nullable=False, server_default='free'),
            sa.Column('status', sa.String(20), nullable=False, server_default='active'),
            sa.Column('billing_cycle', sa.String(10), server_default='monthly'),
            sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('payment_provider', sa.String(30), server_default='mock'),
            sa.Column('external_id', sa.String(128), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        )

    # ── 4. billing_orders（若不存在则创建，列与 ORM models/organization.py:99 对齐）──
    if 'billing_orders' not in sa.inspect(bind).get_table_names():
        op.create_table(
            'billing_orders',
            sa.Column('id', sa.BigInteger, sa.Sequence('billing_orders_id_seq'), primary_key=True, autoincrement=True),
            sa.Column('organization_id', sa.BigInteger, nullable=False, index=True),
            sa.Column('plan', sa.String(20), nullable=False),
            sa.Column('billing_cycle', sa.String(10), server_default='monthly'),
            sa.Column('amount_cents', sa.Integer, server_default='0'),
            sa.Column('currency', sa.String(3), server_default='CNY'),
            sa.Column('status', sa.String(20), server_default='pending'),
            sa.Column('provider_order_id', sa.String(128), nullable=True),
            sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        )


def downgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if 'billing_orders' in insp.get_table_names():
        op.drop_table('billing_orders')
    if 'subscriptions' in insp.get_table_names():
        op.drop_table('subscriptions')

    # 反向：organization_id → org_id（仅当 organization_id 存在且 org_id 缺失）
    cols = _columns(bind, 'organization_members')
    if 'organization_id' in cols and 'org_id' not in cols:
        op.alter_column('organization_members', 'organization_id', new_column_name='org_id')
