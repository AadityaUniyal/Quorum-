"""
Tier 2 Boundary & Corner Cases Test Suite for Feature 2: Refresh Token Rotation.

Tests boundary conditions, edge cases, token tampering, token reuse detection,
expiration thresholds, and consecutive token lifecycle rotation.
"""

import sys
import unittest
import time
from pathlib import Path

# Ensure workspace root is on sys.path
root_dir = Path(__file__).resolve().parents[3]
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from tests.e2e.infra.client import E2EClient
from tests.e2e.infra.fixtures import E2ETestContext


class TestFeature2TokenRotationBoundary(unittest.TestCase):
    """Boundary & Corner Cases for Feature 2 (Refresh Token Rotation)."""

    def setUp(self):
        self.context = E2ETestContext()
        self.client = E2EClient(base_url=self.context.base_url, force_mock=self.context.force_mock)
        self.username = f"rot_bva_user_{int(time.time()*1000)}"
        self.password = "Str0ngP@ssw0rd2026!#TokenRot"
        self.email = "rot_bva@docintel.ai"
        self.client.register(username=self.username, email=self.email, password=self.password)

    def test_f2_bva_01_expired_or_invalid_refresh_token_rejected(self):
        """Verify invalid or expired refresh tokens return 401 Unauthorized."""
        bogus_tokens = [
            "invalid_token_string",
            "refresh_token_expired_1000000000",
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.payload",
            ""
        ]
        for token in bogus_tokens:
            resp = self.client.send_refresh_token_request(refresh_token=token)
            self.assertEqual(resp.status_code, 401, f"Expected 401 for token: '{token}'")
            self.assertIn("detail", resp.json_data)

    def test_f2_bva_02_tampered_signature_refresh_token(self):
        """Verify refresh tokens with tampered signatures or altered payloads are rejected."""
        login_resp = self.client.login(username=self.username, password=self.password)
        self.assertEqual(login_resp.status_code, 200)
        valid_ref_token = login_resp.cookies["refresh_token"].value

        # Tamper token by appending trailing characters
        tampered_token = valid_ref_token + "_TAMPERED_SIG"
        resp = self.client.send_refresh_token_request(refresh_token=tampered_token)
        self.assertEqual(resp.status_code, 401)

    def test_f2_bva_03_reused_refresh_token_detection_and_revocation(self):
        """Verify token reuse attack detection: second use of a refresh token must fail with 401."""
        login_resp = self.client.login(username=self.username, password=self.password)
        self.assertEqual(login_resp.status_code, 200)
        orig_refresh_token = login_resp.cookies["refresh_token"].value

        # First refresh attempt - must succeed
        ref1_resp = self.client.send_refresh_token_request(refresh_token=orig_refresh_token)
        self.assertEqual(ref1_resp.status_code, 200)
        new_refresh_token = ref1_resp.cookies["refresh_token"].value
        self.assertNotEqual(orig_refresh_token, new_refresh_token)

        # Reuse attack: attempt to use old refresh token a second time - must fail!
        reuse_resp = self.client.send_refresh_token_request(refresh_token=orig_refresh_token)
        self.assertEqual(reuse_resp.status_code, 401)
        self.assertIn("revoked", reuse_resp.json_data.get("detail", "").lower())

    def test_f2_bva_04_multiple_consecutive_rotations_lifecycle(self):
        """Verify 5 consecutive refresh cycles properly rotate tokens without state corruption."""
        login_resp = self.client.login(username=self.username, password=self.password)
        self.assertEqual(login_resp.status_code, 200)
        current_refresh_token = login_resp.cookies["refresh_token"].value

        seen_refresh_tokens = {current_refresh_token}

        for i in range(5):
            ref_resp = self.client.send_refresh_token_request(refresh_token=current_refresh_token)
            self.assertEqual(ref_resp.status_code, 200, f"Rotation iteration {i+1} failed")
            new_access = ref_resp.cookies.get("access_token")
            new_refresh = ref_resp.cookies.get("refresh_token")
            
            self.assertIsNotNone(new_access)
            self.assertIsNotNone(new_refresh)
            self.assertNotIn(new_refresh.value, seen_refresh_tokens)
            
            seen_refresh_tokens.add(new_refresh.value)
            current_refresh_token = new_refresh.value

        self.assertEqual(len(seen_refresh_tokens), 6)  # Initial + 5 rotated

    def test_f2_bva_05_refresh_token_with_invalid_cookie_format(self):
        """Verify refresh endpoint handles broken/malformed cookie strings gracefully."""
        headers = {"Cookie": "refresh_token; broken_cookie_without_value"}
        resp = self.client._request("POST", "/api/auth/refresh", headers=headers)
        self.assertEqual(resp.status_code, 401)

    def test_f2_bva_06_clock_skew_edge_timestamp_refresh(self):
        """Verify token generation includes accurate timestamp boundaries."""
        t_before = int(time.time())
        login_resp = self.client.login(username=self.username, password=self.password)
        t_after = int(time.time())

        self.assertEqual(login_resp.status_code, 200)
        access_tok = login_resp.cookies["access_token"].value
        
        # Token string contains timestamp matching login window
        tok_parts = access_tok.split("_")
        tok_ts = int(tok_parts[-1])
        self.assertTrue(t_before <= tok_ts <= t_after + 2)


if __name__ == "__main__":
    unittest.main()
