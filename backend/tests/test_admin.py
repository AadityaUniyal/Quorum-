"""
Tests for Admin API endpoints (/admin/users, /admin/logs) covering:
- Authentication and authorization security gates (401 unauthenticated, 403 non-admin)
- Secure dynamic log retrieval with pagination (HTTP 200)
- Path traversal protection (HTTP 400)
- Missing log file graceful response (HTTP 200 with empty list)
- Invalid parameter validation (HTTP 422)
"""

from pathlib import Path
import pytest
from fastapi import status

from app.core.security import create_access_token, get_password_hash
from app.limiter import limiter
from app.models.auth import User, UserRole
from app.routes.admin import BASE_LOGS_DIR


@pytest.fixture(autouse=True)
def disable_rate_limiting():
    """Disables SlowAPI rate limiter during test execution."""
    prev = limiter.enabled
    limiter.enabled = False
    yield
    limiter.enabled = prev


@pytest.fixture
def test_viewer_user(db_session):
    """Creates a regular viewer user without admin privileges."""
    user = User(
        email="viewer@docintel.test",
        hashed_password=get_password_hash("ViewerPass123!"),
        full_name="Regular Viewer",
        role=UserRole.VIEWER,
        is_verified=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    token = create_access_token(user)
    headers = {"Authorization": f"Bearer {token}"}
    return {"user": user, "token": token, "headers": headers}


def test_admin_logs_unauthenticated_blocked(client):
    """Unauthenticated requests to /admin/logs must return HTTP 401 Unauthorized."""
    response = client.get("/admin/logs")
    assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)


def test_admin_logs_non_admin_forbidden(client, test_viewer_user):
    """Authenticated non-admin users must receive HTTP 403 Forbidden."""
    response = client.get("/admin/logs", headers=test_viewer_user["headers"])
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert "Admin privileges required" in response.json().get("detail", "")


def test_admin_logs_admin_empty_when_missing(client, test_admin_user):
    """Admin requesting a non-existent log file receives HTTP 200 with empty list."""
    response = client.get("/admin/logs?file=nonexistent_test.log", headers=test_admin_user["headers"])
    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {"logs": []}


def test_admin_logs_admin_default_app_log(client, test_admin_user):
    """Admin calling /admin/logs with default parameters succeeds with HTTP 200."""
    response = client.get("/admin/logs", headers=test_admin_user["headers"])
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "logs" in data
    assert isinstance(data["logs"], list)


def test_admin_logs_dynamic_file_and_lines(client, test_admin_user):
    """Admin can dynamically read a specific log file and limit tail lines."""
    test_log_file = BASE_LOGS_DIR / "custom_test_audit.log"
    try:
        # Write 10 lines of sample logs
        sample_lines = [f"2026-09-20 10:00:0{i} INFO [audit] Event entry {i}" for i in range(10)]
        test_log_file.write_text("\n".join(sample_lines) + "\n", encoding="utf-8")

        # Request only last 4 lines
        response = client.get(
            "/admin/logs?file=custom_test_audit.log&lines=4",
            headers=test_admin_user["headers"],
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["logs"]) == 4
        assert data["logs"] == sample_lines[-4:]
    finally:
        if test_log_file.exists():
            test_log_file.unlink()


@pytest.mark.parametrize(
    "auth_header",
    [
        {},
        {"Authorization": ""},
        {"Authorization": "Bearer "},
        {"Authorization": "Bearer invalid.jwt.token"},
        {"Authorization": "Basic dXNlcjpwYXNz"},
    ],
)
def test_admin_logs_unauthenticated_variations_blocked(client, auth_header):
    """Unauthenticated requests with missing, empty, or malformed credentials return HTTP 401."""
    response = client.get("/admin/logs", headers=auth_header)
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_admin_logs_editor_role_forbidden(client, db_session):
    """User with non-admin VIEWER role must receive HTTP 403 Forbidden."""
    editor = User(
        email="editor@docintel.test",
        hashed_password=get_password_hash("EditorPass123!"),
        full_name="Document Editor",
        role=UserRole.VIEWER,
        is_verified=True,
    )
    db_session.add(editor)
    db_session.commit()
    db_session.refresh(editor)

    token = create_access_token(editor)
    headers = {"Authorization": f"Bearer {token}"}

    response = client.get("/admin/logs", headers=headers)
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert "Admin privileges required" in response.json().get("detail", "")


@pytest.mark.parametrize(
    "payload",
    [
        "../",
        "..%2F",
        "..\\",
        "../../etc/passwd",
        "../../secret.log",
        "..%2F..%2Fapp.log",
        "..\\..\\app.log",
        "/etc/passwd",
        "/app.log",
        "C:\\Windows",
        "C:\\Windows\\System32\\cmd.exe",
        "C:/boot.ini",
        "app.py",
        "worker.py",
        "../../app.py",
        ".env",
        "../../.env",
        "%00",
        "app.log%00.txt",
        "",
        "sub/nested.log",
        "test.txt",
        ".log",
        "invalid*file.log",
        "semi;colon.log",
    ],
)
def test_admin_logs_path_traversal_and_invalid_filenames_blocked(client, test_admin_user, payload):
    """Path traversal attempts and invalid file names must be rejected with HTTP 400 Bad Request."""
    response = client.get(f"/admin/logs?file={payload}", headers=test_admin_user["headers"])
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.parametrize("invalid_lines", [0, -1, -500, 5001, 10000, "invalid_str"])
def test_admin_logs_lines_validation_boundaries(client, test_admin_user, invalid_lines):
    """Line count bounds validation (ge=1, le=5000) returns 422 for out-of-range or invalid values."""
    res = client.get(f"/admin/logs?lines={invalid_lines}", headers=test_admin_user["headers"])
    assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


@pytest.mark.parametrize("valid_lines", [1, 500, 5000])
def test_admin_logs_lines_valid_boundaries(client, test_admin_user, valid_lines):
    """Valid boundary line counts (1, 500, 5000) are accepted with HTTP 200."""
    res = client.get(f"/admin/logs?lines={valid_lines}", headers=test_admin_user["headers"])
    assert res.status_code == status.HTTP_200_OK


def test_admin_users_endpoints_security(client, test_admin_user, test_viewer_user):
    """Verify /admin/users security gate works for admin and rejects non-admin."""
    # Unauthenticated
    unauth = client.get("/admin/users")
    assert unauth.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)

    # Viewer
    forbidden = client.get("/admin/users", headers=test_viewer_user["headers"])
    assert forbidden.status_code == status.HTTP_403_FORBIDDEN

    # Admin
    success = client.get("/admin/users", headers=test_admin_user["headers"])
    assert success.status_code == status.HTTP_200_OK
    users = success.json()
    assert isinstance(users, list)
    assert any(u["email"] == "admin@docintel.test" for u in users)
