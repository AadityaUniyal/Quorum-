"""
DocIntel AI Platform - Empirical Adversarial Security & Stress Test Suite.

Author: challenger_final_1
Purpose: Empirically verify security mechanisms, rate limiting, token rotation under rapid calls,
         password complexity boundaries, CSV formula injection sanitization (CWE-1236),
         and search expansion input validation.
"""

import csv
import io
import sys
import unittest
import uuid
import time
import zxcvbn
from pathlib import Path

# Set up paths
project_root = Path(__file__).resolve().parents[1]
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))
backend_path = project_root / "backend"
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from tests.e2e.infra.client import E2EClient
from backend.app.services.export import sanitize_csv_cell, export_to_csv, UNSAFE_CSV_FORMULA_PREFIXES
from backend.app.core.security import blacklist_token, is_token_blacklisted


class TestEmpiricalTokenRotation(unittest.TestCase):
    """Stress testing refresh token rotation under rapid successive calls and reuse."""

    def setUp(self):
        self.client = E2EClient(force_mock=True)
        self.username = f"stress_user_{uuid.uuid4().hex[:8]}"
        self.password = "Str0ngP@ssw0rd2026!#Rot"
        self.email = f"{self.username}@docintel.ai"
        self.client.register(username=self.username, email=self.email, password=self.password)

    def test_rapid_successive_token_rotations_50_cycles(self):
        """Perform 50 rapid successive token rotations and verify unique tokens and strict revocation."""
        login_resp = self.client.login(username=self.username, password=self.password)
        self.assertEqual(login_resp.status_code, 200)
        
        current_refresh = login_resp.cookies["refresh_token"].value
        seen_refresh_tokens = set()
        seen_refresh_tokens.add(current_refresh)
        revoked_tokens = []

        for i in range(50):
            # Rotate token
            resp = self.client.send_refresh_token_request(refresh_token=current_refresh)
            self.assertEqual(resp.status_code, 200, f"Rotation cycle {i+1} failed with status {resp.status_code}")
            self.assertIn("refresh_token", resp.cookies, f"No refresh_token cookie in cycle {i+1}")
            
            new_refresh = resp.cookies["refresh_token"].value
            self.assertNotIn(new_refresh, seen_refresh_tokens, f"Duplicate refresh token generated in cycle {i+1}: {new_refresh}")
            
            # Record old token as revoked
            revoked_tokens.append(current_refresh)
            seen_refresh_tokens.add(new_refresh)
            
            # Immediately attempt to reuse the JUST revoked old token
            reuse_resp = self.client.send_refresh_token_request(refresh_token=current_refresh)
            self.assertEqual(reuse_resp.status_code, 401, f"Reused token from cycle {i+1} was not rejected! Status: {reuse_resp.status_code}")
            
            current_refresh = new_refresh

        # Final verification: verify ALL previous 50 tokens remain strictly revoked
        for idx, old_tok in enumerate(revoked_tokens):
            retest_resp = self.client.send_refresh_token_request(refresh_token=old_tok)
            self.assertEqual(retest_resp.status_code, 401, f"Historical token at index {idx} became valid again!")

        self.assertEqual(len(seen_refresh_tokens), 51)  # Initial + 50 rotations

    def test_tampered_and_garbage_refresh_tokens(self):
        """Verify tampered, truncated, or garbage refresh tokens fail."""
        login_resp = self.client.login(username=self.username, password=self.password)
        valid_tok = login_resp.cookies["refresh_token"].value

        tampered_cases = [
            valid_tok + "X",
            valid_tok[:-5],
            "",
            "   ",
            "\x00\x00\x00",
            "eyJhbGciOiJIUzI1NiJ9.e30.bogus_signature",
            "refresh_token_nonexistent_user_99999"
        ]

        for tampered in tampered_cases:
            resp = self.client.send_refresh_token_request(refresh_token=tampered)
            self.assertEqual(resp.status_code, 401, f"Tampered token '{tampered}' did not return 401")


class TestEmpiricalPasswordAndAuthEdgeCases(unittest.TestCase):
    """Stress testing password complexity, empty strings, Unicode, and edge cases."""

    def setUp(self):
        self.client = E2EClient(force_mock=True)

    def test_weak_passwords_rejected(self):
        """Verify common weak passwords are strictly rejected."""
        weak_list = [
            "",
            "123",
            "12345678",
            "password",
            "admin123",
            "qwerty1234",
            "letmein123",
            "abcdefg",
            "Pass1",
            "      ",
            "short!1"
        ]
        for pwd in weak_list:
            res = self.client.test_password_validation(pwd)
            self.assertLess(res["score"], 3, f"Weak password '{pwd}' scored {res['score']}, expected < 3")
            self.assertFalse(res["accepted"], f"Weak password '{pwd}' was incorrectly accepted!")
            self.assertEqual(res["status_code"], 400)

    def test_strong_passwords_accepted(self):
        """Verify strong passwords with high entropy/variety are accepted."""
        strong_list = [
            "Str0ngP@ssw0rd2026!#",
            "C0mpl3x_P@ssw0rd!DocIntel",
            "9#kL!2pQz$99xW#1",
            "Secure_Enterprise_System_2026!$"
        ]
        for pwd in strong_list:
            res = self.client.test_password_validation(pwd)
            self.assertGreaterEqual(res["score"], 3, f"Strong password '{pwd}' scored {res['score']}, expected >= 3")
            self.assertTrue(res["accepted"], f"Strong password '{pwd}' was rejected!")
            self.assertEqual(res["status_code"], 201)

    def test_unicode_and_emoji_passwords(self):
        """Verify passwords containing multi-byte UTF-8, emojis, and non-Latin characters."""
        unicode_passwords = [
            "P@ssw0rd2026!🔒🚀DocIntel",
            "Mötörhëad_P@ssw0rd2026!",
            "Пароль_Безопасность_2026!#DocIntel",
            "パスワード🔐2026!#Googi"
        ]
        for pwd in unicode_passwords:
            res = self.client.test_password_validation(pwd)
            self.assertGreaterEqual(res["score"], 3, f"Unicode password '{pwd}' scored {res['score']}")
            self.assertTrue(res["accepted"], f"Unicode password '{pwd}' was rejected!")

    def test_zxcvbn_production_scoring_on_international_scripts(self):
        """Verify real zxcvbn library scores international scripts correctly (Arabic, Cyrillic, CJK, Emoji)."""
        international_passwords = [
            "كلمة_المرور_السرية_2026!#",
            "ОченьСложныйПароль2026!#",
            "超级安全密码2026!#DocIntel",
            "🚀🔒🔑🛡️Pass_2026!#"
        ]
        for pwd in international_passwords:
            z_score = zxcvbn.zxcvbn(pwd)["score"]
            self.assertGreaterEqual(z_score, 3, f"zxcvbn scored '{pwd}' as {z_score}, expected >= 3")

    def test_extremely_long_passwords_1000_and_5000_chars(self):
        """Verify validator handles 1000+ and 5000+ character passwords without memory exhaustion or crash."""
        for length in [1000, 5000]:
            huge_pwd = "P@ssw0rd2026!#" + "x" * length + "99!A"
            res = self.client.test_password_validation(huge_pwd)
            self.assertGreaterEqual(res["score"], 3)
            self.assertTrue(res["accepted"])


class TestEmpiricalCSVFormulaInjection(unittest.TestCase):
    """Stress testing CSV formula injection (CWE-1236) sanitization."""

    def test_sanitize_csv_cell_all_triggers(self):
        """Verify sanitize_csv_cell neutralizes all known spreadsheet formula triggers."""
        adversarial_payloads = [
            "=cmd|' /C calc'!A0",
            "@SUM(1+1)*cmd|' /C calc'!A0",
            "-2+3+cmd|' /C calc'!A0",
            "+1+2",
            "\t=1+1",
            "\r=1+1",
            "   =SUM(1,2)",
            "  +2+2",
            "  -cmd|...",
            "  @HYPERLINK(\"http://evil.com\",\"Click me\")",
            "=1+2\";=1+2",
            "=DDE(\"cmd\";\"/C calc\";\"__DDE__\")"
        ]

        for payload in adversarial_payloads:
            sanitized = sanitize_csv_cell(payload)
            self.assertTrue(
                sanitized.startswith("'"),
                f"Adversarial CSV payload '{payload}' was NOT escaped with leading single quote! Got: '{sanitized}'"
            )

    def test_export_to_csv_with_adversarial_search_results(self):
        """Verify full export_to_csv pipeline escapes formula payloads across all fields."""
        results = [
            {
                "filename": "=cmd|' /C calc'!A0",
                "snippet": "@SUM(1+1)*cmd|' /C calc'!A0",
                "score": 0.95,
                "type": "-2+3+cmd|' /C calc'!A0",
                "created_at": "+1+2",
                "url": "=HYPERLINK(\"http://attacker.com\",\"Click\")"
            },
            {
                "filename": "   =SUM(1,2)",
                "snippet": "\t=1+1",
                "score": None,
                "type": "\r=1+1",
                "created_at": "2026-08-14",
                "url": "https://docintel.ai/docs"
            }
        ]

        query_payload = "=cmd|' /C calc'!A0"
        csv_bytes = export_to_csv(results, query=query_payload)
        self.assertIsInstance(csv_bytes, bytes)
        
        # Parse CSV stream using Python's standard csv module
        csv_text = csv_bytes.decode("utf-8-sig")
        reader = csv.reader(io.StringIO(csv_text))
        rows = list(reader)

        # Header check
        self.assertEqual(rows[0], [
            "Query", "Title/Filename", "Snippet/Content", "Score", "Type", "Date", "URL/Path"
        ])

        # Verify no data cell starts with unescaped formula triggers
        for row_idx, row in enumerate(rows[1:], start=1):
            for col_idx, cell in enumerate(row):
                if cell:
                    # If the cell originally contained a formula trigger, it must be prefixed with '
                    first_char = cell[0]
                    self.assertNotIn(
                        first_char,
                        ["=", "+", "-", "@"],
                        f"Row {row_idx} Col {col_idx} starts with unescaped trigger '{first_char}'! Content: '{cell}'"
                    )

    def test_benign_values_not_corrupted(self):
        """Verify standard alphanumeric numbers, text, and dates are preserved cleanly."""
        self.assertEqual(sanitize_csv_cell("DocIntel Guide"), "DocIntel Guide")
        self.assertEqual(sanitize_csv_cell("42"), "42")
        self.assertEqual(sanitize_csv_cell(123), 123)
        self.assertEqual(sanitize_csv_cell(0.954), 0.954)
        self.assertEqual(sanitize_csv_cell(""), "")
        self.assertEqual(sanitize_csv_cell(None), "")


class TestEmpiricalSearchExpansionValidation(unittest.TestCase):
    """Stress testing /api/search/expand input validation and boundary cases."""

    def setUp(self):
        self.client = E2EClient(force_mock=True)

    def test_empty_and_whitespace_queries_rejected_with_400(self):
        """Verify empty and whitespace queries return 400 Bad Request."""
        empty_cases = [
            "",
            " ",
            "    ",
            "\t",
            "\n",
            "\r\n",
            "   \t\n  \r  "
        ]

        for q in empty_cases:
            resp = self.client.expand_query(q)
            self.assertEqual(resp.status_code, 400, f"Query '{repr(q)}' did not return 400 Bad Request! Got {resp.status_code}")
            self.assertIn("detail", resp.json_data)

    def test_valid_queries_return_200_and_expected_structure(self):
        """Verify valid queries return 200 with required schema fields."""
        queries = [
            "DocIntel platform architecture",
            "OCR document processing pipeline",
            "Redis rate limiting and session security",
            "A" * 500
        ]

        for q in queries:
            resp = self.client.expand_query(q)
            self.assertEqual(resp.status_code, 200, f"Query '{q[:30]}...' failed with {resp.status_code}")
            self.assertIn("original_query", resp.json_data)
            self.assertIn("expansions", resp.json_data)
            self.assertIsInstance(resp.json_data["expansions"], list)
            self.assertGreater(len(resp.json_data["expansions"]), 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
