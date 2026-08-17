"""add_totp_fields

Revision ID: 4f8a2c9d1e03
Revises: 3a9f1d2e4b87
Create Date: 2026-06-26 12:00:00.000000
"""
from typing import Union
from collections.abc import Sequence
from alembic import op
import sqlalchemy as sa

revision: str = '4f8a2c9d1e03'
down_revision: str | None = '3a9f1d2e4b87'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add TOTP columns for 2FA support (Roadmap 1.2)
    op.add_column('users', sa.Column('totp_secret', sa.String(), nullable=True))
    op.add_column('users', sa.Column('totp_enabled', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    op.drop_column('users', 'totp_enabled')
    op.drop_column('users', 'totp_secret')
