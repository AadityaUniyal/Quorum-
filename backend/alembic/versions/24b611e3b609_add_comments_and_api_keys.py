"""add_comments_and_api_keys

Revision ID: 24b611e3b609
Revises: 139dd4fc19e7
Create Date: 2026-06-25 00:38:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import app.database

# revision identifiers, used by Alembic.
revision: str = '24b611e3b609'
down_revision: Union[str, None] = '139dd4fc19e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. create api_keys table
    op.create_table('api_keys',
    sa.Column('id', app.database.GUID(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('hashed_key', sa.String(), nullable=False),
    sa.Column('prefix', sa.String(), nullable=False),
    sa.Column('user_id', app.database.GUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('expires_at', sa.DateTime(), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_api_keys_hashed_key'), 'api_keys', ['hashed_key'], unique=True)

    # 2. create comments table
    op.create_table('comments',
    sa.Column('id', app.database.GUID(), nullable=False),
    sa.Column('document_id', app.database.GUID(), nullable=False),
    sa.Column('field_key', sa.String(), nullable=True),
    sa.Column('user_id', app.database.GUID(), nullable=True),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('comments')
    op.drop_index(op.f('ix_api_keys_hashed_key'), table_name='api_keys')
    op.drop_table('api_keys')
