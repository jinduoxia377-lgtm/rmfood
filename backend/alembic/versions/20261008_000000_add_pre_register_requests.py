"""新增 pre_register_requests 表 — 账号申请（预注册）持久化队列

背景:
- 登录页"账号申请"通道（POST /auth/pre-register）原先仅写结构化审计日志，
  不入库 → 管理员无法在"用户管理"中集中审核/通过/拒绝申请
- 本次迁移建立独立申请队列表，支持:
  1. 管理员分页查看 pending/approved/rejected 申请
  2. 通过 → 自动创建 User（系统生成临时密码）+ 回填 user_id + status=approved
  3. 拒绝 → 标记 status=rejected + reject_reason
  4. 幂等: 同一邮箱重复申请时返回已有记录，不产生重复行

本次迁移:
- 新建 pre_register_requests 表（12 列 + 1 复合索引）
- down_revision 指向最新 head (20260927_000000)

Revision ID: 20261008_000000
Revises: 20260927_000000
Create Date: 2026-10-08
"""
from alembic import op
import sqlalchemy as sa


revision = "20261008_000000"
down_revision = "20260927_000000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pre_register_requests",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False, primary_key=True),
        # ── 申请信息 ──
        sa.Column("email", sa.String(length=100), nullable=False),
        sa.Column("full_name", sa.String(length=100), nullable=True),
        sa.Column("department", sa.String(length=100), nullable=True),
        # ── 状态机 ──
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        # ── 审核信息 ──
        sa.Column("reviewed_by", sa.BigInteger(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reject_reason", sa.Text(), nullable=True),
        # ── 通过时回填 ──
        sa.Column("user_id", sa.BigInteger(), nullable=True),
        # ── 审计 ──
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_pre_register_requests_email", "pre_register_requests", ["email"], unique=False)
    op.create_index("ix_pre_register_requests_status", "pre_register_requests", ["status"], unique=False)
    op.create_index("ix_pre_register_requests_user_id", "pre_register_requests", ["user_id"], unique=False)
    op.create_index(
        "idx_pre_register_status_created",
        "pre_register_requests",
        ["status", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("idx_pre_register_status_created", table_name="pre_register_requests")
    op.drop_index("ix_pre_register_requests_user_id", table_name="pre_register_requests")
    op.drop_index("ix_pre_register_requests_status", table_name="pre_register_requests")
    op.drop_index("ix_pre_register_requests_email", table_name="pre_register_requests")
    op.drop_table("pre_register_requests")
