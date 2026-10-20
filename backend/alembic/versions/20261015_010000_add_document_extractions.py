"""add document_extractions table

文档提取备案表：持久化 CoA/PDS/SDS 提取结果，实现备案与调用
Revision ID: 20261015_010000
Revises: 20261015_000000
Create Date: 2026-10-15
"""
from alembic import op
import sqlalchemy as sa


revision = "20261015_010000"
down_revision = "20261015_000000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "document_extractions",
        sa.Column("organization_id", sa.BigInteger(), nullable=True),
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("document_type", sa.String(length=10), nullable=False),
        sa.Column("ingredient_id", sa.BigInteger(), nullable=True),
        sa.Column("extracted_fields", sa.JSON(), nullable=True),
        sa.Column("confidence_scores", sa.JSON(), nullable=True),
        sa.Column("overall_confidence", sa.Float(), nullable=True),
        sa.Column("requires_review", sa.Boolean(), nullable=True),
        sa.Column("raw_text_preview", sa.Text(), nullable=True),
        sa.Column("source_file_name", sa.String(length=255), nullable=True),
        sa.Column("source_hash", sa.String(length=64), nullable=True),
        sa.Column("created_by", sa.BigInteger(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_document_extractions_document_type",
        "document_extractions",
        ["document_type"],
        unique=False,
    )
    op.create_index(
        "ix_document_extractions_ingredient_id",
        "document_extractions",
        ["ingredient_id"],
        unique=False,
    )
    op.create_index(
        "ix_document_extractions_organization_id",
        "document_extractions",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        "ix_document_extractions_source_hash",
        "document_extractions",
        ["source_hash"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_document_extractions_ingredient_id_food_materials",
        "document_extractions",
        "food_materials",
        ["ingredient_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_document_extractions_ingredient_id_food_materials",
        "document_extractions",
        type_="foreignkey",
    )
    op.drop_index("ix_document_extractions_source_hash", table_name="document_extractions")
    op.drop_index("ix_document_extractions_organization_id", table_name="document_extractions")
    op.drop_index("ix_document_extractions_ingredient_id", table_name="document_extractions")
    op.drop_index("ix_document_extractions_document_type", table_name="document_extractions")
    op.drop_table("document_extractions")