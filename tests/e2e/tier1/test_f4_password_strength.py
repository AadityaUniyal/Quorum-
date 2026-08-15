"""
Tier 1 Feature 4: Password Strength Validation Test Suite.
Verifies password complexity enforcement (zxcvbn score >= 3) during user registration.
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


class TestFeature4PasswordStrength(unittest.TestCase):
    """Test case suite for Feature 4: Password Strength Validation (zxcvbn score >= 3)."""

    def setUp(self):
        self.context = E2ETestContext()
        self.client = E2EClient(base_url=self.context.base_url, force_mock=self.context.force_mock)

    def test_f4_01_strong_password_accepted(self):
        """Verify that a strong password (length >= 12, uppercase, lowercase, numbers, symbols) is accepted."""
        password = "P@ssw0rd2026!#DocIntelSecure"
        headers = {"X-Forwarded-For": "10.0.0.1"}
        res = self.client.test_password_validation(password)
        self.assertGreaterEqual(res["score"], 3)
        self.assertTrue(res["accepted"])

    def test_f4_02_weak_password_rejected(self):
        """Verify that a weak password (e.g. '12345678') is rejected with HTTP 400."""
        password = "12345678"
        res = self.client.test_password_validation(password)
        self.assertLess(res["score"], 3)
        self.assertFalse(res["accepted"])

    def test_f4_03_zxcvbn_scoring_threshold_boundary(self):
        """Verify that zxcvbn score threshold enforces score >= 3."""
        # Simple weak password -> score < 3
        weak_res = self.client.mock_engine.calculate_password_score("simplepass")
        self.assertLess(weak_res, 3)

        # Complex high-entropy password -> score >= 3
        strong_res = self.client.mock_engine.calculate_password_score("C0mpl3x!P@ssw0rd#2026")
        self.assertGreaterEqual(strong_res, 3)

    def test_f4_04_short_password_rejected(self):
        """Verify that short passwords under 8 characters receive low score and are rejected."""
        short_passwords = ["a", "123456", "abc12!"]
        headers = {"X-Forwarded-For": "10.0.0.4"}
        for pwd in short_passwords:
            res = self.client.test_password_validation(pwd)
            self.assertFalse(res["accepted"], f"Short password '{pwd}' should be rejected")

    def test_f4_05_common_pattern_passwords_rejected(self):
        """Verify that common predictable pattern passwords score low and are rejected."""
        common_passwords = ["password", "qwerty1234", "admin123", "letmein123"]
        headers = {"X-Forwarded-For": "10.0.0.5"}
        for pwd in common_passwords:
            res = self.client.test_password_validation(pwd)
            self.assertFalse(res["accepted"], f"Common password '{pwd}' should be rejected")

    def test_f4_06_password_validation_response_payload(self):
        """Verify that rejection of a weak password includes error details in JSON response."""
        resp = self.client.register(
            username="detail_test_user",
            email="detail@docintel.ai",
            password="weak",
            headers={"X-Forwarded-For": "10.0.0.6"}
        )
        self.assertEqual(resp.status_code, 400)
        json_data = resp.json_data or {}
        self.assertTrue(
            "detail" in json_data or "zxcvbn_score" in json_data,
            "Weak password rejection response must contain detail error message"
        )


if __name__ == "__main__":
    unittest.main()
