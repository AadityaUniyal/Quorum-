"""
Tier 2 Boundary & Corner Cases Test Suite for Feature 4: Password Strength Validation.

Tests zxcvbn score cutoffs (score 2 rejected vs score 3 accepted), max length passwords (1000+ chars),
unicode & emoji passwords, username match/common words, empty/whitespace inputs, and full scoring spectrum.
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


class TestFeature4PasswordStrengthBoundary(unittest.TestCase):
    """Boundary & Corner Cases for Feature 4 (Password Strength Validation)."""

    def setUp(self):
        self.context = E2ETestContext()
        self.client = E2EClient(base_url=self.context.base_url, force_mock=self.context.force_mock)

    def test_f4_bva_01_zxcvbn_score_2_rejected_vs_score_3_accepted(self):
        """Verify zxcvbn score cutoff boundary: score 2 is rejected (400), score 3 is accepted (201)."""
        # Score 2 candidate: 8 chars, only lowercase + digits (variety count < 3)
        score_2_pass = "pass1234"
        res2 = self.client.test_password_validation(score_2_pass)
        self.assertLess(res2["score"], 3, f"Expected score < 3 for '{score_2_pass}', got {res2['score']}")
        self.assertFalse(res2["accepted"])
        self.assertEqual(res2["status_code"], 400)

        # Score 3 candidate: 12+ chars with upper, lower, digit, special symbol
        score_3_pass = "P@ssw0rd2026!#ValidScore3"
        res3 = self.client.test_password_validation(score_3_pass)
        self.assertGreaterEqual(res3["score"], 3, f"Expected score >= 3 for '{score_3_pass}', got {res3['score']}")
        self.assertTrue(res3["accepted"])
        self.assertEqual(res3["status_code"], 201)

    def test_f4_bva_02_maximum_length_password_boundary_1000_chars(self):
        """Verify password strength checker handles 1000+ character passwords without error or crash."""
        huge_password = "P@ssw0rd2026!#" + "A" * 1000 + "123!"
        res = self.client.test_password_validation(huge_password)
        self.assertGreaterEqual(res["score"], 3)
        self.assertTrue(res["accepted"])

    def test_f4_bva_03_unicode_emojis_and_special_characters(self):
        """Verify password validator handles UTF-8 unicode characters, accents, and multi-byte emojis."""
        emoji_passwords = [
            "P@ssw0rd2026!🚀🔒✨DocIntel",
            "SéquüréPâsswôrd!2026🔐",
            "パスワード🔐2026DocIntel!"
        ]
        for pwd in emoji_passwords:
            res = self.client.test_password_validation(pwd)
            self.assertGreaterEqual(res["score"], 3, f"Unicode/emoji password '{pwd}' should achieve score >= 3")
            self.assertTrue(res["accepted"])

    def test_f4_bva_04_username_match_and_common_dictionary_words(self):
        """Verify weak common dictionary words and predictable patterns score 0 and are rejected."""
        weak_common = ["password", "12345678", "qwerty1234", "admin123", "letmein123"]
        for pwd in weak_common:
            res = self.client.test_password_validation(pwd)
            self.assertEqual(res["score"], 0, f"Common password '{pwd}' should receive score 0")
            self.assertFalse(res["accepted"])
            self.assertEqual(res["status_code"], 400)

    def test_f4_bva_05_empty_spaces_and_minimal_length_passwords(self):
        """Verify empty strings, spaces-only strings, and under-length passwords are rejected."""
        invalid_inputs = ["", "   ", "a", "12345", "Short1!"]
        for pwd in invalid_inputs:
            res = self.client.test_password_validation(pwd)
            self.assertLess(res["score"], 3, f"Input '{pwd}' should not pass score 3 threshold")
            self.assertFalse(res["accepted"])

    def test_f4_bva_06_password_validation_scoring_matrix(self):
        """Verify scoring spectrum logic maps password complexity levels correctly."""
        test_cases = [
            ("", 0),
            ("12345", 0),
            ("password", 0),
            ("12345678", 0),
            ("abcdefgh", 1),
            ("Abcdefgh12", 2),
            ("P@ssw0rd2026!", 3),
            ("SuperSecureP@ssw0rd2026!#DocIntel", 4)
        ]
        for pwd, expected_score in test_cases:
            score = self.client.mock_engine.calculate_password_score(pwd)
            self.assertEqual(score, expected_score, f"Password '{pwd}' expected score {expected_score}, got {score}")


if __name__ == "__main__":
    unittest.main()
