"""
Tier 1 Feature 8: LLM Query Expansion Test Suite.
Verifies search query expansion endpoint (/api/search/expand), original query preservation, paraphrasing, and error handling.
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


class TestFeature8QueryExpansion(unittest.TestCase):
    """Test case suite for Feature 8: LLM Query Expansion."""

    def setUp(self):
        self.context = E2ETestContext()
        self.client = E2EClient(base_url=self.context.base_url, force_mock=self.context.force_mock)

    def test_f8_01_query_expansion_endpoint_success(self):
        """Verify POST /api/search/expand returns 200 OK for valid query."""
        resp = self.client.expand_query("DocIntel AI architecture")
        self.assertEqual(resp.status_code, 200)
        self.assertIsNotNone(resp.json_data)

    def test_f8_02_query_expansion_contains_paraphrases(self):
        """Verify that expansion response contains multiple query variations."""
        resp = self.client.expand_query("vector database search")
        self.assertEqual(resp.status_code, 200)
        json_data = resp.json_data or {}
        expansions = json_data.get("expansions") or json_data.get("expanded_queries") or []
        self.assertIsInstance(expansions, list)
        self.assertGreater(len(expansions), 1, "Expanded queries list should contain at least 2 items")

    def test_f8_03_original_query_preserved(self):
        """Verify that original query string is preserved in response payload."""
        query_text = "distributed crawler queue integration"
        resp = self.client.expand_query(query_text)
        self.assertEqual(resp.status_code, 200)
        json_data = resp.json_data or {}
        self.assertEqual(json_data.get("original_query"), query_text)

    def test_f8_04_empty_query_rejected(self):
        """Verify that empty query string input returns 400 Bad Request or empty list."""
        resp = self.client.expand_query("")
        # Route accepts/rejects empty query cleanly
        if resp.status_code != 200:
            self.assertEqual(resp.status_code, 400)
        else:
            json_data = resp.json_data or {}
            expansions = json_data.get("expansions") or json_data.get("expanded_queries") or []
            self.assertEqual(len(expansions), 0)

    def test_f8_05_paraphrase_relevance_and_diversity(self):
        """Verify that returned paraphrases are non-empty distinct strings."""
        resp = self.client.expand_query("Redis rate limiting security")
        self.assertEqual(resp.status_code, 200)
        json_data = resp.json_data or {}
        expansions = json_data.get("expansions") or json_data.get("expanded_queries") or []
        for phrase in expansions:
            self.assertIsInstance(phrase, str)
            self.assertGreater(len(phrase.strip()), 0)

        # Check diversity (not all identical)
        unique_phrases = set(expansions)
        self.assertGreater(len(unique_phrases), 1)

    def test_f8_06_special_characters_in_query(self):
        """Verify expansion of queries containing symbols, punctuation, or boolean search terms."""
        special_query = "httpOnly & SameSite=Lax (security OR auth) + 2026!"
        resp = self.client.expand_query(special_query)
        self.assertEqual(resp.status_code, 200)
        json_data = resp.json_data or {}
        self.assertEqual(json_data.get("original_query"), special_query)


if __name__ == "__main__":
    unittest.main()
