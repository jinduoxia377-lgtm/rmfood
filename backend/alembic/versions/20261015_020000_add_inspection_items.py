"""add inspection_items to document_extractions

备案记录增加检验明细 JSON 列，用于生成食源性多肽质检档案
Revision ID: 20261015_020000
Revises: 20261015_010000
Create Date: 2026-10-15
"""
from alembic import op
import sqlalchemy as sa


revision = "20261015_020000"
down_revision = "20261015_010000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("document_extractions", sa.Column("inspection_items", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("document_extractions", "inspection_items")