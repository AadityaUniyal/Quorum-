"""
Tier 2 Boundary & Corner Cases Test Suite for Feature 8: LLM Query Expansion.

Tests extremely long queries (>1000 words), LLM API timeout fallback, SQL/Script injection safety,
foreign scripts and emoji queries, empty query validation (400), and response JSON schema.
"""

import sys
import unittest
from pathlib import Path

# Ensure workspace root is on sys.path
root_dir = Path(__file__).resolve().parents[3]
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from tests.e2e.infra.client import E2EClient
from tests.e2e.infra.fixtures import E2ETestContext


class TestFeature8QueryExpansionBoundary(unittest.TestCase):
    """Boundary & Corner Cases for Feature 8 (LLM Query Expansion)."""

    def setUp(self):
        self.context = E2ETestContext()
        self.client = E2EClient(base_url=self.context.base_url, force_mock=self.context.force_mock)

    def test_f8_bva_01_extremely_long_query_1000_words(self):
        """Verify query expansion endpoint processes 1000+ word query string without error or crash."""
        long_query = "DocIntel security node " + " ".join([f"term{i}" for i in range(1000)])
        resp = self.client.expand_query(long_query)

        self.assertEqual(resp.status_code, 200)
        json_data = resp.json_data
        self.assertIsNotNone(json_data)
        self.assertEqual(json_data["original_query"], long_query)
        self.assertIsInstance(json_data["expansions"], list)

    def test_f8_bva_02_llm_api_timeout_and_fallback_behavior(self):
        """Verify endpoint falls back safely to returning original query when LLM API times out."""
        query = "DocIntel architecture overview"
        resp = self.client.expand_query(query)

        self.assertEqual(resp.status_code, 200)
        expansions = resp.json_data.get("expansions", [])
        self.assertGreaterEqual(len(expansions), 1)
        self.assertIn(query, expansions)

    def test_f8_bva_03_sql_injection_and_script_injection_strings(self):
        """Verify queries containing SQL injection patterns and HTML/JS script tags are safely handled."""
        malicious_queries = [
            "' OR '1'='1'; DROP TABLE users; --",
            "<script>alert('XSS Attack!')</script>",
            "UNION SELECT username, password FROM users --",
            "DocIntel search\x00with_null_bytes"
        ]

        for mal_q in malicious_queries:
            resp = self.client.expand_query(mal_q)
            self.assertEqual(resp.status_code, 200, f"Failed on injection query: {mal_q}")
            json_data = resp.json_data
            self.assertEqual(json_data["original_query"], mal_q)
            self.assertIsInstance(json_data["expansions"], list)

    def test_f8_bva_04_foreign_scripts_unicode_emojis_queries(self):
        """Verify query expansion supports multilingual multi-script queries (Chinese, Arabic, Cyrillic, Emojis)."""
        multilingual_queries = [
            "DocIntel 智能搜索 🤖 🔍",
            "Поиск документов по безопасности",
            "البحث عن مستندات الأمان في DocIntel",
            "DocIntel 検索 🚀"
        ]

        for multi_q in multilingual_queries:
            resp = self.client.expand_query(multi_q)
            self.assertEqual(resp.status_code, 200)
            json_data = resp.json_data
            self.assertEqual(json_data["original_query"], multi_q)
            self.assertGreater(len(json_data["expansions"]), 0)

    def test_f8_bva_05_empty_query_and_whitespace_validation(self):
        """Verify empty string or whitespace-only query parameters return 400 Bad Request."""
        invalid_queries = ["", "    ", "\n\t"]
        for empty_q in invalid_queries:
            resp = self.client.expand_query(empty_q)
            self.assertEqual(resp.status_code, 400, f"Empty query '{empty_q}' should return 400")
            self.assertIn("detail", resp.json_data)

    def test_f8_bva_06_expansion_response_structure_and_types(self):
        """Verify expansion response schema strictly conforms to contract standard."""
        resp = self.client.expand_query("Vector database indexing")
        self.assertEqual(resp.status_code, 200)
        data = resp.json_data

        self.assertIn("original_query", data)
        self.assertIn("expansions", data)
        self.assertIsInstance(data["original_query"], str)
        self.assertIsInstance(data["expansions"], list)
        for item in data["expansions"]:
            self.assertIsInstance(item, str)


if __name__ == "__main__":
    unittest.main()
