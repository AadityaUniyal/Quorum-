"""add_organizations_and_bookmarks

Revision ID: 5e7f1a2b3c4d
Revises: 2609d3dbe6e4
Create Date: 2026-09-13 09:12:00.000000

"""
from typing import Union
from collections.abc import Sequence
from alembic import op
import sqlalchemy as sa
import app

revision: str = '5e7f1a2b3c4d'
down_revision: str | None = '2609d3dbe6e4'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Create organizations table if not exists
    op.create_table(
        'organizations',
        sa.Column('id', app.database.GUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('slug', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug')
    )

    # 2. Create organization_members table
    op.create_table(
        'organization_members',
        sa.Column('id', app.database.GUID(), nullable=False),
        sa.Column('organization_id', app.database.GUID(), nullable=False),
        sa.Column('user_id', app.database.GUID(), nullable=False),
        sa.Column('role', sa.String(length=50), nullable=False),
        sa.Column('joined_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # 3. Create bookmarks table
    op.create_table(
        'bookmarks',
        sa.Column('id', app.database.GUID(), nullable=False),
        sa.Column('user_id', app.database.GUID(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('query_text', sa.Text(), nullable=False),
        sa.Column('filters_json', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # 4. Add columns to users table
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(sa.Column('organization_id', app.database.GUID(), nullable=True))
        batch_op.add_column(sa.Column('token_version', sa.Integer(), server_default='1', nullable=False))

    # 5. Add organization_id column to documents table
    with op.batch_alter_table('documents') as batch_op:
        batch_op.add_column(sa.Column('organization_id', app.database.GUID(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('documents') as batch_op:
        batch_op.drop_column('organization_id')

    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_column('token_version')
        batch_op.drop_column('organization_id')

    op.drop_table('bookmarks')
    op.drop_table('organization_members')
    op.drop_table('organizations')
