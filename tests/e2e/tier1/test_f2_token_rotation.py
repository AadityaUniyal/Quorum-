"""
Tier 1 Feature 2: Refresh Token Rotation Test Suite.
Verifies short-lived access token and longer-lived refresh token rotation and revocation.
"""

import sys
import unittest
from pathlib import Path

# Ensure workspace root is in sys.path
root_dir = Path(__file__).resolve().parents[3]
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from tests.e2e.infra.client import E2EClient
from tests.e2e.infra.fixtures import E2ETestContext


class TestFeature2TokenRotation(unittest.TestCase):
    """Test case suite for Feature 2: Refresh Token Rotation."""

    def setUp(self):
        self.context = E2ETestContext()
        self.client = E2EClient(base_url=self.context.base_url, force_mock=self.context.force_mock)
        self.username = f"rotation_user_{int(self.context.metadata.get('ts', 2000))}"
        self.password = "P@ssw0rd2026!#TokenRotation"
        self.email = "rotation_user@docintel.ai"
        self.client.register(username=self.username, email=self.email, password=self.password)
        login_resp = self.client.login(username=self.username, password=self.password)
        self.initial_refresh_token = login_resp.cookies["refresh_token"].value
        self.initial_access_token = login_resp.cookies["access_token"].value

    def test_f2_01_successful_token_refresh(self):
        """Verify that sending a valid refresh token returns 200 OK."""
        resp = self.client.send_refresh_token_request(refresh_token=self.initial_refresh_token)
        self.assertEqual(resp.status_code, 200)

    def test_f2_02_refresh_issues_new_tokens(self):
        """Verify that token refresh issues new access and refresh tokens."""
        resp = self.client.send_refresh_token_request(refresh_token=self.initial_refresh_token)
        self.assertEqual(resp.status_code, 200)
        self.assertIn("access_token", resp.cookies)
        self.assertIn("refresh_token", resp.cookies)
        new_refresh = resp.cookies["refresh_token"].value
        self.assertNotEqual(new_refresh, self.initial_refresh_token, "New refresh token must differ from rotated token")

    def test_f2_03_old_refresh_token_revoked_after_use(self):
        """Verify that a used refresh token is revoked and cannot be reused."""
        # First refresh succeeds and invalidates initial_refresh_token
        resp1 = self.client.send_refresh_token_request(refresh_token=self.initial_refresh_token)
        self.assertEqual(resp1.status_code, 200)

        # Reusing initial_refresh_token must be rejected with 401 Unauthorized
        resp2 = self.client.send_refresh_token_request(refresh_token=self.initial_refresh_token)
        self.assertEqual(resp2.status_code, 401, "Reused refresh token must be rejected")

    def test_f2_04_missing_refresh_token_fails(self):
        """Verify that a refresh request without a refresh token returns 401."""
        clean_client = E2EClient(base_url=self.context.base_url, force_mock=self.context.force_mock)
        resp = clean_client.send_refresh_token_request(refresh_token=None)
        self.assertEqual(resp.status_code, 401)

    def test_f2_05_invalid_refresh_token_fails(self):
        """Verify that an invalid or forged refresh token string returns 401."""
        resp = self.client.send_refresh_token_request(refresh_token="invalid_forged_token_string_12345")
        self.assertEqual(resp.status_code, 401)

    def test_f2_06_sequential_token_rotations(self):
        """Verify that sequential token rotations can be performed continuously."""
        current_refresh = self.initial_refresh_token
        for i in range(3):
            resp = self.client.send_refresh_token_request(refresh_token=current_refresh)
            self.assertEqual(resp.status_code, 200, f"Rotation step {i+1} failed")
            new_refresh = resp.cookies["refresh_token"].value
            self.assertNotEqual(new_refresh, current_refresh)
            current_refresh = new_refresh


if __name__ == "__main__":
    unittest.main()
