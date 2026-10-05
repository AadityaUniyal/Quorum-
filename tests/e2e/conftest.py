"""
Quorum OS — E2E Test Suite Pytest Configuration & Fixtures
Provides isolated database sessions, FastAPI TestClient instances,
role-based authentication headers, and filesystem paths.
"""

import os
import pathlib
import sys
from typing import Generator

# Ensure backend root is on sys.path
root_dir = pathlib.Path(__file__).resolve().parents[2]
backend_dir = root_dir / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

# Set test environment variables
os.environ["ENVIRONMENT"] = "testing"
os.environ["DEBUG"] = "false"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["JWT_SECRET_KEY"] = "quorum_e2e_super_secret_test_key_32_chars_min"
os.environ["LLM_PREFERRED_PROVIDER"] = "local"
os.environ["OUTBOX_RELAY_ENABLED"] = "false"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import create_access_token, get_password_hash
from app.database import Base, get_db
from app.main import app
from app.models.auth import Organization, User, UserRole

# In-memory SQLite engine isolated for E2E tests
e2e_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
E2ESessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=e2e_engine)


@pytest.fixture(scope="session", autouse=True)
def setup_e2e_database():
    """Create all database schema tables for the E2E test session."""
    Base.metadata.create_all(bind=e2e_engine)
    yield
    Base.metadata.drop_all(bind=e2e_engine)


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    """Provides a transactional database session rolled back after each test."""
    connection = e2e_engine.connect()
    transaction = connection.begin()
    session = E2ESessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """FastAPI TestClient with overridden get_db dependency."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def test_organization(db_session: Session) -> Organization:
    """Creates a dedicated test organization."""
    org = Organization(
        name="Acme Financial Corp",
        slug="acme-financial",
    )
    db_session.add(org)
    db_session.commit()
    db_session.refresh(org)
    return org


@pytest.fixture
def admin_user(db_session: Session, test_organization: Organization) -> dict:
    """Creates and returns an ADMIN user with auth token and headers."""
    user = User(
        email="admin@quorum-audit.test",
        hashed_password=get_password_hash("AdminPass123!"),
        full_name="Sarah Connor (Chief Auditor)",
        role=UserRole.ADMIN,
        is_verified=True,
        organization_id=test_organization.id,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    token = create_access_token(user)
    return {
        "user": user,
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"},
    }


@pytest.fixture
def auditor_user(db_session: Session, test_organization: Organization) -> dict:
    """Creates and returns an AUDITOR user with auth token and headers."""
    user = User(
        email="auditor@quorum-audit.test",
        hashed_password=get_password_hash("AuditorPass123!"),
        full_name="Alex Vance (Auditor)",
        role=UserRole.AUDITOR if hasattr(UserRole, "AUDITOR") else UserRole.ADMIN,
        is_verified=True,
        organization_id=test_organization.id,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    token = create_access_token(user)
    return {
        "user": user,
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"},
    }


@pytest.fixture
def viewer_user(db_session: Session, test_organization: Organization) -> dict:
    """Creates and returns a VIEWER user with auth token and headers."""
    user = User(
        email="viewer@quorum-audit.test",
        hashed_password=get_password_hash("ViewerPass123!"),
        full_name="John Doe (Observer)",
        role=UserRole.VIEWER if hasattr(UserRole, "VIEWER") else UserRole.ADMIN,
        is_verified=True,
        organization_id=test_organization.id,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    token = create_access_token(user)
    return {
        "user": user,
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"},
    }


@pytest.fixture
def admin_headers(admin_user: dict) -> dict:
    return admin_user["headers"]


@pytest.fixture
def viewer_headers(viewer_user: dict) -> dict:
    return viewer_user["headers"]
