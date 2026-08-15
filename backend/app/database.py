import uuid

from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.types import CHAR, TypeDecorator

from app.config import settings


class GUID(TypeDecorator):
    """Platform-independent GUID type.
    Uses PostgreSQL's UUID type, otherwise uses CHAR(36), storing as stringified UUID.
    """
    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        else:
            return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        elif dialect.name == 'postgresql':
            return value
        else:
            if not isinstance(value, uuid.UUID):
                try:
                    return str(uuid.UUID(value))
                except ValueError:
                    return str(value)
            return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        else:
            if not isinstance(value, uuid.UUID):
                try:
                    return uuid.UUID(value)
                except ValueError:
                    return value
            return value


class Base(DeclarativeBase):
    """SQLAlchemy 2.x declarative base class for all ORM models."""
    pass



# Engine with connection pool tuning for production workloads
if settings.DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False},
    )
else:
    # Neon PostgreSQL: clean URL and configure SSL
    db_url = settings.DATABASE_URL
    connect_args = {}

    # Strip channel_binding param (not supported by psycopg2)
    if "channel_binding" in db_url:
        import re
        db_url = re.sub(r'[&?]channel_binding=[^&]*', '', db_url)
        # Clean up leftover ? at end or double &&
        db_url = db_url.replace('&&', '&').rstrip('&').rstrip('?')

    # Pass sslmode via connect_args for reliable SSL
    if "sslmode=require" in db_url:
        connect_args["sslmode"] = "require"

    engine = create_engine(
        db_url,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=5,
        pool_timeout=30,
        pool_recycle=1800,
        connect_args=connect_args,
    )


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
