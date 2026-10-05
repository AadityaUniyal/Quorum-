"""
Tier 1 Feature Coverage: Feature 8 — Typed API Client Synchronization
Verifies that frontend/src/lib/api.ts implements all missing typed methods matching backend FastAPI routes,
eliminates the silent getMockResponse fallback engine, and aligns endpoint paths.
"""

import pytest
from tests.e2e.helpers import read_frontend_file


@pytest.mark.tier(1)
@pytest.mark.feature(8)
@pytest.mark.milestone("M2")
class TestFeature08ApiClientSynchronization:
    """Verifies that api.ts satisfies the interface contracts defined in PROJECT.md."""

    def test_f08_01_crawler_methods_present(self):
        """Verify api.ts declares getCrawlStats, startCrawl, and stopCrawl methods."""
        content = read_frontend_file("src/lib/api.ts")
        for method in ["getCrawlStats", "startCrawl", "stopCrawl"]:
            assert method in content, f"api.ts must declare typed method '{method}'"

    def test_f08_02_analytics_and_reconciliation_methods_present(self):
        """Verify api.ts declares getReconciliationVariances, getDynamicAlerts, and getAgentStats."""
        content = read_frontend_file("src/lib/api.ts")
        for method in ["getReconciliationVariances", "getDynamicAlerts", "getAgentStats"]:
            assert method in content, f"api.ts must declare typed method '{method}'"

    def test_f08_03_search_and_review_methods_present(self):
        """Verify api.ts declares getSearchStats and submitReview."""
        content = read_frontend_file("src/lib/api.ts")
        for method in ["getSearchStats", "submitReview"]:
            assert method in content, f"api.ts must declare typed method '{method}'"

    def test_f08_04_bookmarks_and_notifications_methods_present(self):
        """Verify api.ts declares getBookmarks, getNotifications, and markNotificationRead."""
        content = read_frontend_file("src/lib/api.ts")
        for method in ["getBookmarks", "getNotifications", "markNotificationRead"]:
            assert method in content, f"api.ts must declare typed method '{method}'"

    def test_f08_05_mock_response_generator_eliminated(self):
        """Verify silent getMockResponse fallback engine is removed from api.ts."""
        content = read_frontend_file("src/lib/api.ts")
        assert (
            "function getMockResponse" not in content
            and "const getMockResponse" not in content
        ), "Silent getMockResponse fallback generator must be eliminated from api.ts"
