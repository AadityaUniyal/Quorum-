"""
Test configuration and shared fixtures.

Provides a test database (SQLite in-memory), mock settings,
FastAPI test client, and authenticated user fixtures.
"""

import os
import tempfile
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Override settings BEFORE importing app modules
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-testing-only"
os.environ["GEMINI_API_KEY"] = ""
os.environ["RABBITMQ_HOST"] = "localhost"
os.environ["REDIS_HOST"] = "localhost"
os.environ["DEBUG"] = "true"

TEST_TEMP_DIR = str(Path(__file__).resolve().parents[2] / ".tmp" / "pytest")
Path(TEST_TEMP_DIR).mkdir(parents=True, exist_ok=True)
os.environ["TMPDIR"] = TEST_TEMP_DIR
os.environ["TEMP"] = TEST_TEMP_DIR
os.environ["TMP"] = TEST_TEMP_DIR
tempfile.tempdir = TEST_TEMP_DIR

# Import using the shim package to ensure a single module namespace
import app.database as app_db
from app.database import Base, get_db
from app.main import app

# In-memory SQLite for tests
TEST_ENGINE = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=TEST_ENGINE)
app_db.SessionLocal = TestSessionLocal


def override_get_db():
    """Dependency override for test database. Ensure tables exist on the test engine before yielding a session."""
    from app.database import Base
    Base.metadata.create_all(bind=TEST_ENGINE)
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    """Create all tables once for the test session and reset ChromaDB collection."""
    # Reset ChromaDB collection for tests to prevent dimension mismatches (768 vs 384)
    try:
        from app.services.vector_store import chroma_client
        chroma_client.delete_collection(name="document_intelligence")
    except Exception:
        pass
    Base.metadata.create_all(bind=TEST_ENGINE)
    yield
    Base.metadata.drop_all(bind=TEST_ENGINE)


@pytest.fixture(autouse=True)
def override_dependencies():
    """Override FastAPI dependencies for testing."""
    # Ensure tables are created on the test engine before handling any request
    from app.database import Base
    Base.metadata.create_all(bind=TEST_ENGINE)
    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    """FastAPI test client."""
    return TestClient(app)


@pytest.fixture
def db_session():
    """Direct database session for test setup/assertions."""
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture
def mock_redis():
    """Mock Redis client that simulates SET NX EX behavior."""
    mock = MagicMock()
    _store = {}

    def mock_set(key, value, nx=False, ex=None):
        if nx and key in _store:
            return False
        _store[key] = value
        return True

    def mock_get(key):
        return _store.get(key)

    def mock_delete(key):
        _store.pop(key, None)
        return 1

    mock.set = mock_set
    mock.get = mock_get
    mock.delete = mock_delete
    return mock


from app.core.security import create_access_token, get_password_hash
from app.limiter import limiter
from app.models.auth import User, UserRole

# Disable rate limiting for test suite
limiter.enabled = False

@pytest.fixture
def registered_user(db_session):
    """Register and return a test user with credentials."""
    user = db_session.query(User).filter(User.email == "test@docintel.ai").first()
    if not user:
        user = User(
            email="test@docintel.ai",
            hashed_password=get_password_hash("TestPassword123!"),
            full_name="Test Engineer",
            role=UserRole.ADMIN,
            is_verified=True,
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
    return {
        "id": str(user.id),
        "user_obj": user,
        "email": user.email,
        "password": "TestPassword123!",
        "full_name": user.full_name,
        "role": "ADMIN"
    }


@pytest.fixture
def auth_token(registered_user):
    """Get a valid auth token for the test user."""
    return create_access_token(registered_user["user_obj"])


@pytest.fixture
def auth_headers(auth_token):
    """Authorization headers for authenticated requests."""
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture
def sample_document_text():
    """Sample OCR text for testing."""
    return """APEX MANUFACTURING CORP.
Invoice Number: INV-2026-00847
Date: June 18, 2026
Bill To: Stellar Dynamics Inc.

Item Description         Qty    Unit Price    Total
Titanium Alloy Rods      50     $75.50        $3,775.00

Subtotal: $3,775.00
Tax (8.25%): $311.44
Shipping: $50.00
Total Amount Due: $4,136.44

Payment Terms: Net 30 via Wire Transfer
"""


@pytest.fixture
def sample_upload_file(tmp_path):
    """Create a temporary text file for upload testing."""
    file_path = tmp_path / "test_invoice.txt"
    file_path.write_text("""APEX MANUFACTURING CORP.
Invoice Number: INV-2026-00847
Date: June 18, 2026
Subtotal: $3,775.00
Tax (8.25%): $311.44
Shipping: $50.00
Total Amount Due: $4,136.44
Payment Terms: Net 30 via Wire Transfer
""")
    return file_path
