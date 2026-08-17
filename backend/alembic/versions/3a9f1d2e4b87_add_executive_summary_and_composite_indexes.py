"""add_executive_summary_and_composite_indexes

Revision ID: 3a9f1d2e4b87
Revises: 24b611e3b609
Create Date: 2026-06-26 00:00:00.000000
"""
from typing import Union
from collections.abc import Sequence
from alembic import op
import sqlalchemy as sa

revision: str = '3a9f1d2e4b87'
down_revision: str | None = '24b611e3b609'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add executive_summary column to documents
    op.add_column(
        'documents',
        sa.Column('executive_summary', sa.Text(), nullable=True)
    )

    # Composite indexes for common query patterns (roadmap 1.7)
    op.create_index(
        'ix_documents_status_created_at',
        'documents',
        ['status', 'created_at'],
        unique=False
    )
    op.create_index(
        'ix_documents_category_uploaded_by',
        'documents',
        ['category', 'uploaded_by'],
        unique=False
    )
    # Composite index on search_logs for autocomplete performance
    op.create_index(
        'ix_search_logs_query_created',
        'search_logs',
        ['query_text', 'created_at'],
        unique=False
    )


def downgrade() -> None:
    op.drop_index('ix_search_logs_query_created', table_name='search_logs')
    op.drop_index('ix_documents_category_uploaded_by', table_name='documents')
    op.drop_index('ix_documents_status_created_at', table_name='documents')
    op.drop_column('documents', 'executive_summary')
