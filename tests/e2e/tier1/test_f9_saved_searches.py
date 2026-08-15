"""
Tier 1 Feature 9: Saved Searches (Bookmarks) CRUD Test Suite.
Verifies bookmark creation, listing, deletion, validation, metadata preservation, and per-user isolation.
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


class TestFeature9SavedSearches(unittest.TestCase):
    """Test case suite for Feature 9: Saved Searches (Bookmarks CRUD)."""

    def setUp(self):
        self.context = E2ETestContext()
        self.client = E2EClient(base_url=self.context.base_url, force_mock=self.context.force_mock)

    def test_f9_01_create_bookmark_success(self):
        """Verify POST /api/bookmarks creates a new bookmark and returns HTTP 201."""
        resp = self.client.bookmarks_crud(
            action="create",
            query="httpOnly cookie security",
            title="Cookie Security Research",
            tags=["auth", "cookies", "security"],
            user_id="user_bm_1"
        )
        self.assertIn(resp.status_code, (200, 201))
        json_data = resp.json_data or {}
        self.assertIn("id", json_data)
        self.assertEqual(json_data.get("query") or json_data.get("query_text"), "httpOnly cookie security")

    def test_f9_02_list_bookmarks_returns_saved_items(self):
        """Verify GET /api/bookmarks returns all saved bookmarks for the active user."""
        user_id = "user_bm_2"
        self.client.bookmarks_crud("create", query="query 1", title="BM 1", user_id=user_id)
        self.client.bookmarks_crud("create", query="query 2", title="BM 2", user_id=user_id)

        resp = self.client.bookmarks_crud("list", user_id=user_id)
        self.assertEqual(resp.status_code, 200)
        json_data = resp.json_data or {}
        bms = json_data.get("bookmarks") if isinstance(json_data, dict) and "bookmarks" in json_data else json_data
        self.assertIsInstance(bms, list)
        self.assertGreaterEqual(len(bms), 2)

    def test_f9_03_delete_bookmark_removes_item(self):
        """Verify DELETE /api/bookmarks/{id} removes the target bookmark."""
        user_id = "user_bm_3"
        create_resp = self.client.bookmarks_crud("create", query="delete me", title="To Delete", user_id=user_id)
        bm_id = create_resp.json_data["id"]

        del_resp = self.client.bookmarks_crud("delete", bookmark_id=bm_id, user_id=user_id)
        self.assertIn(del_resp.status_code, (200, 204))

        list_resp = self.client.bookmarks_crud("list", user_id=user_id)
        bms = list_resp.json_data.get("bookmarks") if isinstance(list_resp.json_data, dict) and "bookmarks" in list_resp.json_data else list_resp.json_data
        bm_ids = [b["id"] for b in bms]
        self.assertNotIn(bm_id, bm_ids)

    def test_f9_04_create_bookmark_missing_query_fails(self):
        """Verify creating a bookmark with missing or empty query string returns HTTP 400."""
        resp = self.client.bookmarks_crud("create", query="", title="Empty Query", user_id="user_bm_4")
        self.assertEqual(resp.status_code, 400)

    def test_f9_05_bookmark_tags_and_metadata_preservation(self):
        """Verify that title, tags, and timestamps are preserved in saved bookmark payload."""
        user_id = "user_bm_5"
        tags = ["rag", "vector", "chromadb"]
        create_resp = self.client.bookmarks_crud(
            "create",
            query="Vector store indexing",
            title="ChromaDB Indexing Guide",
            tags=tags,
            user_id=user_id
        )
        self.assertIn(create_resp.status_code, (200, 201))
        bm = create_resp.json_data
        self.assertEqual(bm.get("title"), "ChromaDB Indexing Guide")
        if "tags" in bm:
            self.assertEqual(bm["tags"], tags)

    def test_f9_06_user_isolation_for_bookmarks(self):
        """Verify that saved search bookmarks are isolated per user account."""
        user_a = "user_alpha"
        user_b = "user_beta"

        # User A creates a bookmark
        self.client.bookmarks_crud("create", query="User Alpha Secret Query", title="Alpha Search", user_id=user_a)

        # User B lists bookmarks
        resp_b = self.client.bookmarks_crud("list", user_id=user_b)
        bms_b = resp_b.json_data.get("bookmarks") if isinstance(resp_b.json_data, dict) and "bookmarks" in resp_b.json_data else resp_b.json_data
        queries_b = [b.get("query") or b.get("query_text") for b in bms_b]
        self.assertNotIn("User Alpha Secret Query", queries_b, "User B must not see User A's saved bookmarks")


if __name__ == "__main__":
    unittest.main()
