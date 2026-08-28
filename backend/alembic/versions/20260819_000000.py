"""add organization_activities table and enhance organizations schema

Revision ID: 20260819_000000
Revises: 20260818_000000
Create Date: 2026-08-19

组织管理增强：活动日志表 + 计划/Logo/设置字段
"""
from alembic import op
import sqlalchemy as sa

revision = "20260819_000000"
down_revision = "20260818_000000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 为 organizations 表添加缺失字段
    op.add_column("organizations", sa.Column("plan", sa.String(20), nullable=True, server_default="free"))
    op.add_column("organizations", sa.Column("logo_url", sa.String(500), nullable=True))
    op.add_column("organizations", sa.Column("settings", sa.JSON(), nullable=True, server_default="{}"))

    # 为 organization_members 表添加缺失字段
    op.add_column("organization_members", sa.Column("team_ids", sa.JSON(), nullable=True, server_default="[]"))
    op.add_column("organization_members", sa.Column("invited_by", sa.BigInteger(), nullable=True))

    # 创建组织活动日志表
    op.create_table(
        "organization_activities",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("org_id", sa.BigInteger(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("action_type", sa.String(50), nullable=False, index=True),
        sa.Column("target_type", sa.String(50), nullable=True),
        sa.Column("target_id", sa.BigInteger(), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_org_activity_org_created", "organization_activities", ["org_id", "created_at"])
    op.create_index("ix_org_activity_action", "organization_activities", ["action_type"])

    # 迁移现有数据：将旧表中的 plan 字段设为默认值
    op.execute("UPDATE organizations SET plan = 'free' WHERE plan IS NULL")


def downgrade() -> None:
    op.drop_index("ix_org_activity_action", table_name="organization_activities")
    op.drop_index("ix_org_activity_org_created", table_name="organization_activities")
    op.drop_table("organization_activities")
    op.drop_column("organization_members", "invited_by")
    op.drop_column("organization_members", "team_ids")
    op.drop_column("organizations", "settings")
    op.drop_column("organizations", "logo_url")
    op.drop_column("organizations", "plan")
