# -*- coding: utf-8 -*-
"""add share fields to formulas table

Revision ID: 020_add_share_fields
Revises: 018_split_tcm_herbs_mmid
Create Date: 2026-07-02

Adds share_code, share_password_hash, and view_count columns to the
formulas table to support password-protected formula sharing.
"""
from alembic import op
import sqlalchemy as sa

revision = '20260702_010000'
down_revision = "20260630_020000_add_json_gin_indexes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # share_code — unique identifier for public sharing
    op.add_column(
        "formulas",
        sa.Column("share_code", sa.String(64), nullable=True, index=True),
    )

    # share_password_hash — SHA-256 hash of the share password
    op.add_column(
        "formulas",
        sa.Column("share_password_hash", sa.String(256), nullable=True),
    )

    # view_count — tracks how many times the shared formula has been viewed
    op.add_column(
        "formulas",
        sa.Column("view_count", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("formulas", "view_count")
    op.drop_column("formulas", "share_password_hash")
    op.drop_column("formulas", "share_code")
