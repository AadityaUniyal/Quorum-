"""
Tier 2 Boundary & Corner Cases Test Suite for Feature 1: httpOnly Secure Cookies.

Tests boundary conditions, edge cases, malformed headers, attribute casing, and security scoping
for authentication cookies (access_token and refresh_token).
"""

import sys
import unittest
from pathlib import Path

# Ensure workspace root is on sys.path
root_dir = Path(__file__).resolve().parents[3]
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from tests.e2e.infra.client import CookieInfo, E2EClient
from tests.e2e.infra.fixtures import E2ETestContext


class TestFeature1CookiesBoundary(unittest.TestCase):
    """Boundary & Corner Cases for Feature 1 (httpOnly Secure Cookies)."""

    def setUp(self):
        self.context = E2ETestContext()
        self.client = E2EClient(base_url=self.context.base_url, force_mock=self.context.force_mock)
        self.username = f"bva_cookie_user_{int(self.context.metadata.get('ts', 1000))}"
        self.password = "Str0ngP@ssw0rd2026!#Cookie"
        self.email = "bva_cookie@docintel.ai"
        self.client.register(username=self.username, email=self.email, password=self.password)

    def test_f1_bva_01_missing_auth_cookie_request(self):
        """Verify request behavior when authentication cookies are completely missing."""
        clean_client = E2EClient(base_url=self.context.base_url, force_mock=self.context.force_mock)
        resp = clean_client.send_refresh_token_request(refresh_token=None)
        self.assertEqual(resp.status_code, 401)
        self.assertIn("detail", resp.json_data)

    def test_f1_bva_02_expired_or_malformed_cookie_string_parsing(self):
        """Verify cookie parser resilience against empty, truncated, or garbage headers."""
        # Empty string header
        cookies_empty = self.client.parse_cookies("")
        self.assertEqual(len(cookies_empty), 0)

        # Truncated / malformed header string
        raw_malformed = "invalid_cookie_format_without_equals_sign; HttpOnly; Secure"
        cookies_malformed = self.client.parse_cookies(raw_malformed)
        self.assertEqual(len(cookies_malformed), 0)

        # Cookie with missing value (e.g., 'access_token=')
        raw_empty_val = "access_token=; HttpOnly; Secure; SameSite=Lax"
        cookies_empty_val = self.client.parse_cookies(raw_empty_val)
        self.assertIn("access_token", cookies_empty_val)
        self.assertEqual(cookies_empty_val["access_token"].value, "")

    def test_f1_bva_03_cookie_attribute_case_insensitivity(self):
        """Verify attribute parsing tolerates case variations (HTTPONLY, secure, samesite=LAX)."""
        raw_header = "access_token=abc123xyz; HTTPONLY; SECURE; samesite=LAX; PATH=/"
        cookies = self.client.parse_cookies(raw_header)
        self.assertIn("access_token", cookies)
        c = cookies["access_token"]
        self.assertTrue(c.httponly)
        self.assertTrue(c.secure)
        self.assertEqual(c.samesite, "LAX")

        verif = self.client.verify_cookie_attributes(c, http_only=True, secure=True, samesite="Lax")
        self.assertTrue(verif["is_valid"])

    def test_f1_bva_04_path_scoping_isolation(self):
        """Verify that refresh token cookie path is scoped strictly to refresh endpoint."""
        resp = self.client.login(username=self.username, password=self.password)
        self.assertEqual(resp.status_code, 200)

        refresh_cookie = resp.cookies.get("refresh_token")
        self.assertIsNotNone(refresh_cookie)
        self.assertEqual(refresh_cookie.path, "/api/auth/refresh")

        access_cookie = resp.cookies.get("access_token")
        self.assertIsNotNone(access_cookie)
        self.assertEqual(access_cookie.path, "/")

    def test_f1_bva_05_extra_spaces_and_duplicate_delimiters(self):
        """Verify parser handles messy spacing and multiple semicolons gracefully."""
        raw_messy = "access_token=val123 ; ; HttpOnly ; Secure ; ; SameSite=Lax ; Path=/"
        cookies = self.client.parse_cookies(raw_messy)
        self.assertIn("access_token", cookies)
        c = cookies["access_token"]
        self.assertEqual(c.value, "val123")
        self.assertTrue(c.httponly)
        self.assertTrue(c.secure)

    def test_f1_bva_06_verify_cookie_attributes_helper_failure_cases(self):
        """Verify verify_cookie_attributes properly flags non-compliant cookies."""
        insecure_cookie = CookieInfo(name="access_token", value="val", httponly=False, secure=False, samesite=None)
        res = self.client.verify_cookie_attributes(insecure_cookie, http_only=True, secure=True, samesite="Lax")
        self.assertFalse(res["is_valid"])
        self.assertFalse(res["checks"]["httponly_valid"])
        self.assertFalse(res["checks"]["secure_valid"])
        self.assertFalse(res["checks"]["samesite_valid"])


if __name__ == "__main__":
    unittest.main()
