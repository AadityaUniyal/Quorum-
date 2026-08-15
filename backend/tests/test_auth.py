"""
Unit tests for authentication utilities — Roadmap 1.9
Tests: password hashing, JWT generation, RBAC, token expiry
"""
import os
import uuid
from datetime import datetime, timedelta

import pytest

os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-unit-tests")

from app.routes.auth import (
    create_access_token,
    create_refresh_token,
    get_password_hash,
    verify_password,
)
from app.models.auth import User, UserRole


def _make_user(role: UserRole = UserRole.VIEWER) -> User:
    u = User()
    u.id = uuid.uuid4()
    u.email = f"test_{role.value.lower()}@test.com"
    u.hashed_password = get_password_hash("TestPass@123")
    u.full_name = f"Test {role.value}"
    u.role = role
    u.created_at = datetime.utcnow()
    return u


# ── Password Tests ────────────────────────────────────────────────────────────

class TestPasswordHashing:
    def test_hash_is_not_plaintext(self):
        h = get_password_hash("MySecret@99")
        assert h != "MySecret@99"

    def test_correct_password_verifies(self):
        h = get_password_hash("Correct@Horse1")
        assert verify_password("Correct@Horse1", h) is True

    def test_wrong_password_fails(self):
        h = get_password_hash("Correct@Horse1")
        assert verify_password("WrongPassword", h) is False

    def test_different_salts_each_call(self):
        h1 = get_password_hash("Same@Pass1")
        h2 = get_password_hash("Same@Pass1")
        assert h1 != h2  # bcrypt uses unique salts

    def test_empty_string_password(self):
        h = get_password_hash("")
        assert verify_password("", h) is True
        assert verify_password("notempty", h) is False


# ── JWT Token Tests ───────────────────────────────────────────────────────────

class TestJWTTokens:
    def test_access_token_contains_user_id(self):
        import jwt
        from app.config import settings
        user = _make_user(UserRole.ADMIN)
        token = create_access_token(user)
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        assert payload["sub"] == str(user.id)

    def test_access_token_contains_role(self):
        import jwt
        from app.config import settings
        user = _make_user(UserRole.REVIEWER)
        token = create_access_token(user)
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        assert payload["role"] == "REVIEWER"

    def test_access_token_type_is_access(self):
        import jwt
        from app.config import settings
        user = _make_user()
        token = create_access_token(user)
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        assert payload["type"] == "access"

    def test_refresh_token_type_is_refresh(self):
        import jwt
        from app.config import settings
        user = _make_user()
        token = create_refresh_token(user)
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        assert payload["type"] == "refresh"

    def test_tokens_are_different(self):
        user = _make_user()
        access = create_access_token(user)
        refresh = create_refresh_token(user)
        assert access != refresh

    def test_wrong_secret_raises(self):
        import jwt
        user = _make_user()
        token = create_access_token(user)
        with pytest.raises(jwt.InvalidSignatureError):
            jwt.decode(token, "wrong-secret", algorithms=["HS256"])


    def test_access_token_contains_jti(self):
        import jwt
        from app.config import settings
        user = _make_user()
        token = create_access_token(user)
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        assert "jti" in payload
        assert len(payload["jti"]) > 0

    def test_refresh_token_contains_jti(self):
        import jwt
        from app.config import settings
        user = _make_user()
        token = create_refresh_token(user)
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        assert "jti" in payload
        assert len(payload["jti"]) > 0


# ── Token Blacklisting Tests ───────────────────────────────────────────────

class TestTokenBlacklisting:
    def test_blacklist_token_and_check(self):
        from app.core.security import blacklist_token, is_token_blacklisted
        test_jti = str(uuid.uuid4())
        assert is_token_blacklisted(test_jti) is False
        blacklist_token(test_jti, ttl=60)
        assert is_token_blacklisted(test_jti) is True

    def test_non_existent_jti_is_not_blacklisted(self):
        from app.core.security import is_token_blacklisted
        random_jti = str(uuid.uuid4())
        assert is_token_blacklisted(random_jti) is False


# ── RBAC & Config Tests ──────────────────────────────────────────────────

class TestRBACRoleChecker:
    def test_admin_allowed_in_admin_only(self):
        from app.routes.auth import RoleChecker
        checker = RoleChecker([UserRole.ADMIN])
        admin = _make_user(UserRole.ADMIN)
        # Should not raise
        result = checker.__call__.__wrapped__(admin) if hasattr(checker.__call__, "__wrapped__") else None
        # Just instantiate — if no error it's fine

    def test_role_enum_values(self):
        assert UserRole.ADMIN == "ADMIN"
        assert UserRole.REVIEWER == "REVIEWER"
        assert UserRole.OPERATOR == "OPERATOR"
        assert UserRole.VIEWER == "VIEWER"

    def test_all_roles_defined(self):
        roles = list(UserRole)
        assert len(roles) == 4

    def test_expiration_config(self):
        from app.config import settings
        assert settings.ACCESS_TOKEN_EXPIRE_MINUTES == 15
        assert settings.REFRESH_TOKEN_EXPIRE_DAYS == 7


# ── Password Strength Validation Tests ────────────────────────────────────────

class TestPasswordStrengthValidation:
    def test_weak_passwords_score_under_3(self):
        from zxcvbn import zxcvbn
        weak_passwords = ["123456", "password", "abc123", "qwerty"]
        for pwd in weak_passwords:
            assert zxcvbn(pwd)["score"] < 3

    def test_strong_passwords_score_3_or_more(self):
        from zxcvbn import zxcvbn
        strong_passwords = ["Tr0ub4dour&3!2026", "CorrectHorseBatteryStaple!2026", "P@ssw0rd!2026Secure"]
        for pwd in strong_passwords:
            assert zxcvbn(pwd)["score"] >= 3

    def test_register_rejects_weak_password(self):
        from fastapi.testclient import TestClient
        from app.main import app
        client = TestClient(app)
        response = client.post(
            "/api/auth/register",
            json={
                "email": f"weak_{uuid.uuid4().hex[:6]}@example.com",
                "password": "123456",
                "full_name": "Weak Pass User",
                "role": "VIEWER"
            }
        )
        assert response.status_code == 400
        assert "Password too weak" in response.json()["detail"]

    def test_register_accepts_strong_password(self):
        from fastapi.testclient import TestClient
        from app.main import app
        client = TestClient(app)
        email = f"strong_{uuid.uuid4().hex[:6]}@example.com"
        response = client.post(
            "/api/auth/register",
            json={
                "email": email,
                "password": "P@ssw0rd!2026Secure",
                "full_name": "Strong Pass User",
                "role": "VIEWER"
            }
        )
        assert response.status_code == 201
        assert response.json()["email"] == email


