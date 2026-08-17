"""
Tier 1 Feature 5: Googi Crawler Package Test Suite.
Verifies importability, URL normalization, PageRank computation, and execution of standalone googi-crawler package.
"""

import sys
import unittest
from pathlib import Path

# Ensure workspace root and packages are in sys.path
root_dir = Path(__file__).resolve().parents[3]
packages_dir = root_dir / "packages" / "googi-crawler"
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))
if str(packages_dir) not in sys.path:
    sys.path.insert(0, str(packages_dir))

from tests.e2e.infra.client import E2EClient
from tests.e2e.infra.fixtures import E2ETestContext


class TestFeature5CrawlerPackage(unittest.TestCase):
    """Test case suite for Feature 5: Standalone Googi Crawler Package."""

    def setUp(self):
        self.context = E2ETestContext()
        self.client = E2EClient(base_url=self.context.base_url, force_mock=self.context.force_mock)

    def test_f5_01_crawler_package_import(self):
        """Verify that GoogiCrawler and compute_pagerank modules can be imported cleanly."""
        try:
            from googi_crawler.crawler import CrawledPageData, GoogiCrawler
            from googi_crawler.pagerank import compute_pagerank
            self.assertTrue(callable(GoogiCrawler))
            self.assertTrue(callable(compute_pagerank))
        except ImportError as e:
            self.fail(f"Failed to import googi_crawler package components: {e}")

    def test_f5_02_crawler_instantiation(self):
        """Verify instantiation of GoogiCrawler with custom user-agent and settings."""
        from googi_crawler.crawler import GoogiCrawler
        crawler = GoogiCrawler(
            user_agent="TestRunner/1.0",
            timeout=3.0,
            request_delay=0.1,
            stay_on_domain=True
        )
        self.assertEqual(crawler.user_agent, "TestRunner/1.0")
        self.assertEqual(crawler.timeout, 3.0)
        self.assertTrue(crawler.stay_on_domain)

    def test_f5_03_crawler_url_normalization(self):
        """Verify canonical URL normalization in GoogiCrawler."""
        from googi_crawler.crawler import GoogiCrawler
        crawler = GoogiCrawler()
        raw_url = "HTTPS://DocIntel.AI:443/docs/../docs/index.html?b=2&a=1#section"
        normalized = crawler.normalize_url(raw_url)
        self.assertTrue(normalized.startswith("https://docintel.ai"))
        self.assertNotIn("#section", normalized, "Fragment should be stripped during normalization")

    def test_f5_04_pagerank_calculation(self):
        """Verify PageRank computation on a directed link graph."""
        from googi_crawler.pagerank import compute_pagerank
        link_graph = {
            "https://site.com/a": ["https://site.com/b", "https://site.com/c"],
            "https://site.com/b": ["https://site.com/c"],
            "https://site.com/c": ["https://site.com/a"],
        }
        ranks = compute_pagerank(link_graph, damping_factor=0.85, max_iterations=50)
        self.assertEqual(len(ranks), 3)
        total_rank = sum(ranks.values())
        self.assertAlmostEqual(total_rank, 1.0, places=4, msg="PageRank scores must sum to 1.0")
        # Page C receives links from A and B so its rank should be highest
        self.assertGreater(ranks["https://site.com/c"], ranks["https://site.com/b"])

    def test_f5_05_execute_crawler_helper_e2eclient(self):
        """Verify crawler execution using E2EClient helper."""
        res = self.client.execute_crawler(start_url="https://docintel.ai", max_depth=1)
        self.assertEqual(res["status"], "success")
        self.assertIn("pages", res)
        self.assertGreaterEqual(res["count"], 1)

    def test_f5_06_crawled_page_data_structure(self):
        """Verify CrawledPageData dataclass properties and defaults."""
        from googi_crawler.crawler import CrawledPageData
        page = CrawledPageData(
            url="https://docintel.ai",
            title="DocIntel AI",
            text="Content text body",
            links=["https://docintel.ai/docs"],
            content_hash="abc123hash",
            status_code=200
        )
        self.assertEqual(page.url, "https://docintel.ai")
        self.assertEqual(page.status_code, 200)
        self.assertEqual(len(page.links), 1)


if __name__ == "__main__":
    unittest.main()
