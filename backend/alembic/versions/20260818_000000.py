"""add herb_food_homology knowledge graph tables

Revision ID: 20260818_000000
Revises: 20260816_000000
Create Date: 2026-08-18

药食同源知识图谱表
"""
from alembic import op
import sqlalchemy as sa

revision = "20260818_000000"
down_revision = "20260816_000000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "herb_food_herbs",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("source_id", sa.String(50), unique=True, nullable=True),
        sa.Column("name_cn", sa.String(100), nullable=False),
        sa.Column("name_en", sa.String(200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_hfh_name_cn", "herb_food_herbs", ["name_cn"])
    op.create_index("ix_hfh_name_en", "herb_food_herbs", ["name_en"])

    op.create_table(
        "herb_food_compounds",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("source_id", sa.String(50), unique=True, nullable=True),
        sa.Column("name_cn", sa.String(200), nullable=True),
        sa.Column("name_en", sa.String(300), nullable=True),
        sa.Column("molecular_formula", sa.String(100), nullable=True),
        sa.Column("smiles", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_hfc_name_en", "herb_food_compounds", ["name_en"])

    op.create_table(
        "herb_food_targets",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("source_id", sa.String(50), unique=True, nullable=True),
        sa.Column("gene_symbol", sa.String(50), nullable=True),
        sa.Column("protein_name", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_hft_gene", "herb_food_targets", ["gene_symbol"])

    op.create_table(
        "herb_food_diseases",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("source_id", sa.String(50), unique=True, nullable=True),
        sa.Column("name_en", sa.String(300), nullable=False),
        sa.Column("name_cn", sa.String(100), nullable=True),
        sa.Column("umls_type", sa.String(100), nullable=True),
        sa.Column("disgenet_type", sa.String(100), nullable=True),
        sa.Column("pubmed_id", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_hfd_name_en", "herb_food_diseases", ["name_en"])
    op.create_index("ix_hfd_name_cn", "herb_food_diseases", ["name_cn"])

    op.create_table(
        "herb_food_herb_compound",
        sa.Column("herb_id", sa.BigInteger(), sa.ForeignKey("herb_food_herbs.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("compound_id", sa.BigInteger(), sa.ForeignKey("herb_food_compounds.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "herb_food_compound_target",
        sa.Column("compound_id", sa.BigInteger(), sa.ForeignKey("herb_food_compounds.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("target_id", sa.BigInteger(), sa.ForeignKey("herb_food_targets.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("evidence_source", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_hfct_target", "herb_food_compound_target", ["target_id"])

    op.create_table(
        "herb_food_target_disease",
        sa.Column("target_id", sa.BigInteger(), sa.ForeignKey("herb_food_targets.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("disease_id", sa.BigInteger(), sa.ForeignKey("herb_food_diseases.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_hftd_disease", "herb_food_target_disease", ["disease_id"])


def downgrade() -> None:
    op.drop_table("herb_food_target_disease")
    op.drop_table("herb_food_compound_target")
    op.drop_table("herb_food_herb_compound")
    op.drop_table("herb_food_diseases")
    op.drop_table("herb_food_targets")
    op.drop_table("herb_food_compounds")
    op.drop_table("herb_food_herbs")
