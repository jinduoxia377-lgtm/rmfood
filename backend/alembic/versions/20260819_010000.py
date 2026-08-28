"""add case_bookmarks and case_reports tables

Revision ID: 20260819_010000
Revises: 20260819_000000
Create Date: 2026-08-19

配方案例增强：收藏表 + 举报表
"""
from alembic import op
import sqlalchemy as sa

revision = "20260819_010000"
down_revision = "20260819_000000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 收藏表
    op.create_table(
        "case_bookmarks",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("case_id", sa.BigInteger(), sa.ForeignKey("formula_cases.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_case_bookmark_case_user", "case_bookmarks", ["case_id", "user_id"], unique=True)

    # 举报表
    op.create_table(
        "case_reports",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("case_id", sa.BigInteger(), sa.ForeignKey("formula_cases.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("report_type", sa.String(50), nullable=False, comment="spam|inappropriate|wrong_content|copyright"),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    # 为 formula_cases 添加 bookmarks 列（如果不存在）
    try:
        op.add_column("formula_cases", sa.Column("bookmarks", sa.Integer(), nullable=True, server_default="0"))
    except Exception:
        pass


def downgrade() -> None:
    op.drop_table("case_reports")
    op.drop_table("case_bookmarks")
    try:
        op.drop_column("formula_cases", "bookmarks")
    except Exception:
        pass
