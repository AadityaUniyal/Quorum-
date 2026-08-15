"""Full schema migration matching all current SQLAlchemy models.

This migration creates all tables needed by the DocIntel AI platform.
It supersedes the outdated 20240623_initial migration.

Revision ID: 20260813_full_schema
Revises: 20240623_initial
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260813_full_schema"
down_revision = "20240623_initial"
branch_labels = None
depends_on = None


def upgrade():
    # ── Drop old tables created by the outdated initial migration ──
    # These have the wrong schema and need to be recreated
    op.execute("DROP TABLE IF EXISTS search_logs CASCADE")
    op.execute("DROP TABLE IF EXISTS documents CASCADE")
    op.execute("DROP TABLE IF EXISTS users CASCADE")

    # ── Create ENUM types ──
    userrole_enum = postgresql.ENUM(
        "ADMIN", "REVIEWER", "OPERATOR", "VIEWER",
        name="userrole", create_type=False,
    )
    documentstatus_enum = postgresql.ENUM(
        "INGESTED", "PROCESSING", "FAILED", "AWAITING_REVIEW", "PROCESSED",
        name="documentstatus", create_type=False,
    )
    documentcategory_enum = postgresql.ENUM(
        "INVOICE", "RFQ", "PURCHASE_ORDER", "CONTRACT", "COMPLIANCE", "UNKNOWN",
        name="documentcategory", create_type=False,
    )
    fieldvalidationstatus_enum = postgresql.ENUM(
        "VALID", "FLAGGED", "MANUAL_CORRECTION",
        name="fieldvalidationstatus", create_type=False,
    )

    # Create enums explicitly
    op.execute("DO $$ BEGIN CREATE TYPE userrole AS ENUM ('ADMIN','REVIEWER','OPERATOR','VIEWER'); EXCEPTION WHEN duplicate_object THEN null; END $$;")
    op.execute("DO $$ BEGIN CREATE TYPE documentstatus AS ENUM ('INGESTED','PROCESSING','FAILED','AWAITING_REVIEW','PROCESSED'); EXCEPTION WHEN duplicate_object THEN null; END $$;")
    op.execute("DO $$ BEGIN CREATE TYPE documentcategory AS ENUM ('INVOICE','RFQ','PURCHASE_ORDER','CONTRACT','COMPLIANCE','UNKNOWN'); EXCEPTION WHEN duplicate_object THEN null; END $$;")
    op.execute("DO $$ BEGIN CREATE TYPE fieldvalidationstatus AS ENUM ('VALID','FLAGGED','MANUAL_CORRECTION'); EXCEPTION WHEN duplicate_object THEN null; END $$;")

    # ── 1. Users ──
    op.create_table(
        "users",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("email", sa.String(), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("full_name", sa.String(), nullable=False),
        sa.Column("role", sa.Enum("ADMIN", "REVIEWER", "OPERATOR", "VIEWER", name="userrole", create_type=False), nullable=False, server_default="VIEWER"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        # 2FA / TOTP fields
        sa.Column("totp_secret", sa.String(), nullable=True),
        sa.Column("totp_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        # Email Verification fields
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("verification_token", sa.String(), nullable=True),
        sa.Column("verification_token_expires_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # ── 2. Documents ──
    op.create_table(
        "documents",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("filename", sa.String(), nullable=False),
        sa.Column("file_path", sa.String(), nullable=False),
        sa.Column("file_type", sa.String(), nullable=False),
        sa.Column("category", sa.Enum("INVOICE", "RFQ", "PURCHASE_ORDER", "CONTRACT", "COMPLIANCE", "UNKNOWN", name="documentcategory", create_type=False), nullable=False, server_default="UNKNOWN"),
        sa.Column("status", sa.Enum("INGESTED", "PROCESSING", "FAILED", "AWAITING_REVIEW", "PROCESSED", name="documentstatus", create_type=False), nullable=False, server_default="INGESTED"),
        sa.Column("ocr_text", sa.Text(), nullable=True),
        sa.Column("executive_summary", sa.Text(), nullable=True),
        sa.Column("consensus_score", sa.Float(), nullable=True),
        sa.Column("content_hash", sa.String(64), nullable=True),
        sa.Column("uploaded_by", sa.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("assigned_to_id", sa.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("due_date", sa.DateTime(), nullable=True),
        sa.Column("approval_stage", sa.String(), nullable=False, server_default="OPERATOR_REVIEW"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_documents_content_hash", "documents", ["content_hash"])

    # ── 3. Extracted Fields ──
    op.create_table(
        "extracted_fields",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("document_id", sa.UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("field_key", sa.String(), nullable=False),
        sa.Column("extracted_value", sa.String(), nullable=True),
        sa.Column("critic_score", sa.Float(), server_default="1.0"),
        sa.Column("auditor_score", sa.Float(), server_default="1.0"),
        sa.Column("consensus_value", sa.String(), nullable=True),
        sa.Column("confidence_score", sa.Float(), server_default="1.0"),
        sa.Column("is_modified", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("validation_status", sa.Enum("VALID", "FLAGGED", "MANUAL_CORRECTION", name="fieldvalidationstatus", create_type=False), nullable=False, server_default="VALID"),
        sa.Column("validation_notes", sa.Text(), nullable=True),
    )

    # ── 4. Audit Logs ──
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("document_id", sa.UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="SET NULL"), nullable=True),
        sa.Column("user_id", sa.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("timestamp", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── 5. Search Logs ──
    op.create_table(
        "search_logs",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("query_text", sa.String(), nullable=False),
        sa.Column("results_count", sa.Integer(), server_default="0"),
        sa.Column("latency_ms", sa.Integer(), server_default="0"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_search_logs_query_text", "search_logs", ["query_text"])

    # ── 6. Crawled Pages ──
    op.create_table(
        "crawled_pages",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("url", sa.String(), nullable=False, unique=True),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("page_content", sa.Text(), nullable=True),
        sa.Column("page_hash", sa.String(64), nullable=True),
        sa.Column("pagerank", sa.Float(), nullable=False, server_default="1.0"),
        sa.Column("last_crawled_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_crawled_pages_url", "crawled_pages", ["url"], unique=True)

    # ── 7. Page Links ──
    op.create_table(
        "page_links",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("source_url", sa.String(), nullable=False),
        sa.Column("target_url", sa.String(), nullable=False),
    )
    op.create_index("ix_page_links_source_url", "page_links", ["source_url"])
    op.create_index("ix_page_links_target_url", "page_links", ["target_url"])

    # ── 8. API Keys ──
    op.create_table(
        "api_keys",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("hashed_key", sa.String(), nullable=False, unique=True),
        sa.Column("prefix", sa.String(), nullable=False),
        sa.Column("user_id", sa.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.create_index("ix_api_keys_hashed_key", "api_keys", ["hashed_key"], unique=True)

    # ── 9. Comments ──
    op.create_table(
        "comments",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("document_id", sa.UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("field_key", sa.String(), nullable=True),
        sa.Column("user_id", sa.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── 10. Notifications ──
    op.create_table(
        "notifications",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("message", sa.String(), nullable=False),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])

    # ── 11. Webhook Configs ──
    op.create_table(
        "webhook_configs",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("url", sa.String(), nullable=False),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_webhook_configs_event_type", "webhook_configs", ["event_type"])

    # ── 12. Webhook Logs ──
    op.create_table(
        "webhook_logs",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("webhook_config_id", sa.UUID(as_uuid=True), nullable=True),
        sa.Column("url", sa.String(), nullable=False),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("idempotency_key", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("error_message", sa.String(), nullable=True),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_webhook_logs_idempotency_key", "webhook_logs", ["idempotency_key"])


def downgrade():
    op.drop_table("webhook_logs")
    op.drop_table("webhook_configs")
    op.drop_table("notifications")
    op.drop_table("comments")
    op.drop_table("api_keys")
    op.drop_table("page_links")
    op.drop_table("crawled_pages")
    op.drop_table("search_logs")
    op.drop_table("audit_logs")
    op.drop_table("extracted_fields")
    op.drop_table("documents")
    op.drop_table("users")

    # Drop ENUM types
    op.execute("DROP TYPE IF EXISTS fieldvalidationstatus")
    op.execute("DROP TYPE IF EXISTS documentcategory")
    op.execute("DROP TYPE IF EXISTS documentstatus")
    op.execute("DROP TYPE IF EXISTS userrole")
