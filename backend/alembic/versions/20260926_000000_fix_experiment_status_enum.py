"""fix experiments status to enum type

Revision ID: 20260926_000000_fix_experiment_status_enum
Revises: 20260925_000000_add_batch_traceability
Create Date: 2026-09-26
"""
from alembic import op
import sqlalchemy as sa

revision = '20260926_000000_fix_experiment_status_enum'
down_revision = '20260925_000000_add_batch_traceability'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # The experimentstatus enum type already exists in the DB.
    # Convert the varchar column to the enum type.
    op.alter_column(
        'experiments', 'status',
        type_=sa.Enum(
            'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED',
            name='experimentstatus', create_type=False
        ),
        existing_type=sa.VARCHAR(length=20),
        existing_server_default=sa.text("'planned'::character varying"),
    )


def downgrade() -> None:
    op.alter_column(
        'experiments', 'status',
        type_=sa.VARCHAR(length=20),
        existing_type=sa.Enum(
            'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED',
            name='experimentstatus', create_type=False
        ),
        existing_server_default=sa.text("'planned'::character varying"),
    )
