"""teams 表 ORM 对齐迁移（Phase 2 收尾）

背景（reports/team-audit-tenant/COMPREHENSIVE_AUDIT_SUMMARY.md §6.5 + final-verify）:
- 迁移 20260502_001000 建 teams 用 org_id/lead_id/permissions（组织中心），
  但 ORM models/team.py 用 owner_id/settings/is_archived/updated_at（所有者中心）。
- 本环境 DB 双列集已共存（teams 实库含全部列，1 行），运行正常；
  但**全新 alembic 部署**仅得 org_id/lead_id/permissions，缺 ORM 列 → team CRUD 失败。
- 本迁移为防御式/幂等：用 inspector 检查，仅对缺失列补加（本库 no-op，全新部署补全）。
- 注意：teams.org_id 被 get_quota_usage（multi_tenant_service.py:695）用于团队配额计数，
  【不得】改名为 organization_id（会破坏计数）；此处仅补 ORM 列，不动 org_id。

Revision ID: 20261028_030000
Revises: 20261028_020000
Create Date: 2026-10-28
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '20261028_030000'
down_revision = '20261028_020000'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if 'teams' not in insp.get_table_names():
        return
    cols = [c['name'] for c in insp.get_columns('teams')]
    if 'owner_id' not in cols:
        op.add_column('teams', sa.Column('owner_id', sa.BigInteger, sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True))
    if 'settings' not in cols:
        op.add_column('teams', sa.Column('settings', postgresql.JSONB, server_default=sa.text("'{}'::jsonb")))
    if 'is_archived' not in cols:
        op.add_column('teams', sa.Column('is_archived', sa.Boolean, nullable=False, server_default=sa.text('false')))
    if 'updated_at' not in cols:
        op.add_column('teams', sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()))


def downgrade():
    # 防御式：仅删除本迁移新增的列（若存在）
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if 'teams' not in insp.get_table_names():
        return
    cols = [c['name'] for c in insp.get_columns('teams')]
    for c in ('updated_at', 'is_archived', 'settings', 'owner_id'):
        if c in cols:
            try:
                op.drop_column('teams', c)
            except Exception:
                pass
