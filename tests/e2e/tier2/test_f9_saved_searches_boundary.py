"""
Tier 2 Boundary & Corner Cases Test Suite for Feature 9: Saved Searches (Bookmarks).

Tests maximum title/tag lengths, duplicate bookmark creation, cross-user isolation,
non-existent bookmark deletion, missing required parameters (400), and special characters in payloads.
"""

import sys
import time
import unittest
from pathlib import Path

# Ensure workspace root is on sys.path
root_dir = Path(__file__).resolve().parents[3]
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from tests.e2e.infra.client import E2EClient
from tests.e2e.infra.fixtures import E2ETestContext


class TestFeature9SavedSearchesBoundary(unittest.TestCase):
    """Boundary & Corner Cases for Feature 9 (Saved Searches / Bookmarks)."""

    def setUp(self):
        self.context = E2ETestContext()
        self.client = E2EClient(base_url=self.context.base_url, force_mock=self.context.force_mock)
        self.user_a = f"user_a_{int(time.time()*1000)}"
        self.user_b = f"user_b_{int(time.time()*1000)}"

    def test_f9_bva_01_maximum_title_and_tags_length(self):
        """Verify bookmark creation handles 500+ char titles and 100+ tags cleanly."""
        huge_title = "DocIntel Research Bookmark " + ("X" * 500)
        many_tags = [f"tag_{i}" for i in range(100)]

        resp = self.client.bookmarks_crud(
            "create",
            query="large bookmark payload test",
            title=huge_title,
            tags=many_tags,
            user_id=self.user_a
        )
        self.assertEqual(resp.status_code, 201)
        data = resp.json_data
        self.assertEqual(data["title"], huge_title)
        self.assertEqual(len(data["tags"]), 100)

    def test_f9_bva_02_duplicate_bookmark_creation(self):
        """Verify duplicate bookmark entries receive distinct IDs and are preserved in storage."""
        bm_payload = {
            "query": "duplicate query test",
            "title": "Duplicate Research Title",
            "tags": ["dup"]
        }

        resp1 = self.client.bookmarks_crud("create", user_id=self.user_a, **bm_payload)
        resp2 = self.client.bookmarks_crud("create", user_id=self.user_a, **bm_payload)

        self.assertEqual(resp1.status_code, 201)
        self.assertEqual(resp2.status_code, 201)
        self.assertNotEqual(resp1.json_data["id"], resp2.json_data["id"])

        list_resp = self.client.bookmarks_crud("list", user_id=self.user_a)
        self.assertEqual(len(list_resp.json_data["bookmarks"]), 2)

    def test_f9_bva_03_unauthorized_access_and_cross_user_isolation(self):
        """Verify cross-user isolation: User B cannot view User A's bookmarks."""
        # Create bookmark for User A
        c_resp = self.client.bookmarks_crud("create", query="user_a_query", title="User A Only", user_id=self.user_a)
        self.assertEqual(c_resp.status_code, 201)

        # User B lists bookmarks -> must return empty list for User B!
        list_b = self.client.bookmarks_crud("list", user_id=self.user_b)
        self.assertEqual(list_b.status_code, 200)
        self.assertEqual(len(list_b.json_data["bookmarks"]), 0)

    def test_f9_bva_04_deletion_of_non_existent_bookmark_id(self):
        """Verify deleting non-existent bookmark ID handled gracefully without error."""
        resp = self.client.bookmarks_crud("delete", bookmark_id="non_existent_id_99999", user_id=self.user_a)
        self.assertEqual(resp.status_code, 200)
        self.assertIn("message", resp.json_data)

    def test_f9_bva_05_missing_required_query_parameter(self):
        """Verify bookmark creation fails with 400 Bad Request when required 'query' parameter is missing."""
        resp = self.client._request(
            "POST",
            "/api/bookmarks",
            headers={"X-User-ID": self.user_a},
            body={"title": "Missing Query Title"}
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("detail", resp.json_data)

    def test_f9_bva_06_special_characters_in_bookmark_title_and_tags(self):
        """Verify titles and tags with quotes, special characters, and emojis are handled properly."""
        title = "DocIntel & 'Security' \"Analysis\" <v1.0> 🔒"
        tags = ["sec&auth", "tag'1", "tag\"2\""]

        resp = self.client.bookmarks_crud("create", query="special char query", title=title, tags=tags, user_id=self.user_a)
        self.assertEqual(resp.status_code, 201)
        data = resp.json_data
        self.assertEqual(data["title"], title)
        self.assertEqual(data["tags"], tags)


if __name__ == "__main__":
    unittest.main()
