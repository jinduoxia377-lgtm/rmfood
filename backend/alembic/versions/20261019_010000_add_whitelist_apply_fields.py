"""add whitelist apply fields to pre_register_requests

为「白名单申请流程页」扩展 pre_register_requests 表：
- 新增申请来源/申请理由/邮箱验证码/冷却/状态 token/审核截止等字段
- 新增同一邮箱 active(pending) 唯一的部分唯一索引
- 历史重复 pending 数据清洗：同邮箱仅保留最新一条，其余置 rejected

Revision ID: 20261019_010000
Revises: 20261015_020000
Create Date: 2026-10-19
"""
from alembic import op
import sqlalchemy as sa


revision = "20261019_010000"
down_revision = "20261015_020000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 0. 历史数据清洗：同邮箱多条 pending 仅保留最新，其余置 rejected ──
    op.execute("""
        UPDATE pre_register_requests SET status = 'rejected'
        WHERE id IN (
            SELECT id FROM (
                SELECT id,
                       ROW_NUMBER() OVER (
                           PARTITION BY email ORDER BY created_at DESC, id DESC
                       ) AS rn
                FROM pre_register_requests
                WHERE status = 'pending'
            ) t
            WHERE rn > 1
        )
    """)

    # ── 1. 新增字段 ──
    op.add_column("pre_register_requests", sa.Column("apply_reason", sa.Text(), nullable=True))
    op.add_column(
        "pre_register_requests",
        sa.Column("source", sa.String(length=16), nullable=False, server_default="legacy"),
    )
    op.add_column("pre_register_requests", sa.Column("verify_code_hash", sa.String(length=128), nullable=True))
    op.add_column("pre_register_requests", sa.Column("verify_code_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("pre_register_requests", sa.Column("verify_code_sent_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("pre_register_requests", sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "pre_register_requests",
        sa.Column("verify_attempts", sa.SmallInteger(), nullable=False, server_default="0"),
    )
    op.add_column("pre_register_requests", sa.Column("cooldown_until", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "pre_register_requests",
        sa.Column("attempt_count", sa.SmallInteger(), nullable=False, server_default="1"),
    )
    op.add_column("pre_register_requests", sa.Column("status_token_hash", sa.String(length=128), nullable=True))
    op.add_column("pre_register_requests", sa.Column("review_deadline", sa.DateTime(timezone=True), nullable=True))
    op.add_column("pre_register_requests", sa.Column("review_note", sa.Text(), nullable=True))
    op.add_column("pre_register_requests", sa.Column("expired_at", sa.DateTime(timezone=True), nullable=True))

    # ── 2. 索引 ──
    op.create_index(
        "uq_pre_register_active_email",
        "pre_register_requests",
        ["email"],
        unique=True,
        postgresql_where=sa.text("status = 'pending'"),
    )
    op.create_index(
        "idx_pre_register_status_deadline",
        "pre_register_requests",
        ["status", "review_deadline"],
    )
    op.create_index(
        "idx_pre_register_email_status",
        "pre_register_requests",
        ["email", "status"],
    )


def downgrade() -> None:
    op.drop_index("idx_pre_register_email_status", table_name="pre_register_requests")
    op.drop_index("idx_pre_register_status_deadline", table_name="pre_register_requests")
    op.drop_index("uq_pre_register_active_email", table_name="pre_register_requests")

    op.drop_column("pre_register_requests", "expired_at")
    op.drop_column("pre_register_requests", "review_note")
    op.drop_column("pre_register_requests", "review_deadline")
    op.drop_column("pre_register_requests", "status_token_hash")
    op.drop_column("pre_register_requests", "attempt_count")
    op.drop_column("pre_register_requests", "cooldown_until")
    op.drop_column("pre_register_requests", "verify_attempts")
    op.drop_column("pre_register_requests", "email_verified_at")
    op.drop_column("pre_register_requests", "verify_code_sent_at")
    op.drop_column("pre_register_requests", "verify_code_expires_at")
    op.drop_column("pre_register_requests", "verify_code_hash")
    op.drop_column("pre_register_requests", "source")
    op.drop_column("pre_register_requests", "apply_reason")