"""add formula cases tables

Revision ID: 20260816_000000
Revises: 20260811_000000
Create Date: 2026-08-16

配方案例表：formula_cases, case_likes, case_comments
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = "20260816_000000"
down_revision = "20260811_000000_add_workflow_templates"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # formula_cases 表
    op.create_table(
        "formula_cases",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("formula_id", sa.BigInteger(), sa.ForeignKey("formulas.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("organization_id", sa.BigInteger(), index=True, comment="所属组织，None 表示全局公开"),
        sa.Column("created_by", sa.BigInteger(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("title", sa.String(length=200), nullable=False, index=True),
        sa.Column("category", sa.String(length=100), nullable=True, index=True),
        sa.Column("tags", sa.JSON(), default=list, comment="标签列表"),
        sa.Column("cover_image", sa.String(length=500), nullable=True),
        sa.Column("summary", sa.Text(), nullable=False, comment="案例简介"),
        sa.Column("content", sa.Text(), nullable=False, comment="案例详细内容 Markdown"),
        sa.Column("views", sa.Integer(), default=0, index=True),
        sa.Column("likes", sa.Integer(), default=0, index=True),
        sa.Column("is_featured", sa.Boolean(), default=False, index=True),
        sa.Column("generated_by_ai", sa.Boolean(), default=False),
        sa.Column("ai_prompt", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # case_likes 表
    op.create_table(
        "case_likes",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("case_id", sa.BigInteger(), sa.ForeignKey("formula_cases.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    # case_comments 表
    op.create_table(
        "case_comments",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("case_id", sa.BigInteger(), sa.ForeignKey("formula_cases.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("parent_id", sa.BigInteger(), sa.ForeignKey("case_comments.id", ondelete="CASCADE"), nullable=True, index=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("likes", sa.Integer(), default=0),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # 为 formula_cases 添加 organization_id 的索引（如果不存在）
    # 已在 create_table 中声明


def downgrade() -> None:
    op.drop_table("case_comments")
    op.drop_table("case_likes")
    op.drop_table("formula_cases")
