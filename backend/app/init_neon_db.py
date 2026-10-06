"""
Quorum High-Performance Neon PostgreSQL Schema & Database Initializer.
Sets up optimized tables, composite indexes, JSONB GIN indexes, and verifies connection resilience.
"""

import logging
import sys

from sqlalchemy import text

import app.models  # noqa: F401 - Ensure all models are registered in Base.metadata
from app.database import Base, engine

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("quorum.neon_init")

def init_neon_database():
    logger.info("Connecting to Neon PostgreSQL cluster...")
    try:
        # Create all tables defined in models
        Base.metadata.create_all(bind=engine)
        logger.info("✓ Core ORM tables verified / created successfully.")

        # Execute performance & indexing optimizations
        with engine.connect() as conn:
            # Check dialect
            dialect = engine.dialect.name
            logger.info(f"Database dialect: {dialect}")

            if dialect == "postgresql":
                logger.info("Applying PostgreSQL / Neon GIN indexes and performance tuning...")
                
                # Documents JSONB indexes
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_docs_extracted_fields_gin
                    ON documents USING gin ((extracted_fields::jsonb));
                """))
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_docs_reconciliation_gin
                    ON documents USING gin ((reconciliation_result::jsonb));
                """))
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_docs_audit_trail_gin
                    ON documents USING gin ((audit_trail::jsonb));
                """))

                # Composite query indexes for fast multi-tenant per-user filtering
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_docs_user_status_created
                    ON documents (user_id, status, created_at DESC);
                """))
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_audit_user_action_timestamp
                    ON audit_logs (user_id, action, timestamp DESC);
                """))
                
                conn.commit()
                logger.info("✓ Neon PostgreSQL GIN and Composite indexes created successfully.")
            else:
                logger.info("Non-PostgreSQL dialect detected (SQLite); skipping GIN indexes.")

        logger.info("🚀 Neon PostgreSQL initialization completed successfully.")
        return True
    except Exception as e:
        logger.error(f"Failed to initialize Neon Database: {e}", exc_info=True)
        return False

if __name__ == "__main__":
    success = init_neon_database()
    sys.exit(0 if success else 1)
