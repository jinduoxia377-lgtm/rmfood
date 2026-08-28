"""add experiment share fields

Revision ID: 20260821_000000_add_experiment_share
Revises: 20260819_010000
Create Date: 2026-08-21
"""
from alembic import op
import sqlalchemy as sa

revision = '20260821_000000_add_experiment_share'
down_revision = '20260819_010000'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('experiments', sa.Column('share_code', sa.String(length=32), nullable=True))
    op.add_column('experiments', sa.Column('is_shared', sa.Boolean(), nullable=False, server_default='f'))
    op.create_index(op.f('ix_experiments_share_code'), 'experiments', ['share_code'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_experiments_share_code'), table_name='experiments')
    op.drop_column('experiments', 'is_shared')
    op.drop_column('experiments', 'share_code')
