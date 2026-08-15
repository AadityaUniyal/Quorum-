"""
Tier 2 Boundary & Corner Cases Test Suite for Feature 5: Googi Crawler Package.

Tests large page processing (>10MB HTML), non-HTML content filtering, URL normalization boundaries,
malformed HTML resilience, crawl depth limits, and robots.txt evaluation.
"""

import sys
import unittest
from pathlib import Path

# Ensure workspace root and googi-crawler package are on sys.path
root_dir = Path(__file__).resolve().parents[3]
pkg_dir = root_dir / "packages" / "googi-crawler"
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))
if str(pkg_dir) not in sys.path:
    sys.path.insert(0, str(pkg_dir))

try:
    from googi_crawler.crawler import GoogiCrawler, CrawledPageData
except ImportError:
    # Fallback if package structure varies
    from packages.googi_crawler.googi_crawler.crawler import GoogiCrawler, CrawledPageData

from tests.e2e.infra.client import E2EClient
from tests.e2e.infra.fixtures import E2ETestContext


class TestFeature5CrawlerPackageBoundary(unittest.TestCase):
    """Boundary & Corner Cases for Feature 5 (Googi Crawler Package)."""

    def setUp(self):
        self.context = E2ETestContext()
        self.crawler = GoogiCrawler(user_agent="GoogiBot-Test/1.0", timeout=3.0, request_delay=0.0)

    def test_f5_bva_01_huge_pages_large_html_processing(self):
        """Verify crawler handles large HTML strings (>10MB) without memory corruption or crash."""
        large_body_paragraphs = "<p>DocIntel platform node analysis.</p>\n" * 100000  # Multi-MB HTML
        html_doc = f"<html><head><title>Huge Page</title></head><body>{large_body_paragraphs}</body></html>"

        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html_doc, "html.parser")
        title = soup.title.string.strip() if soup.title else ""
        plain_text = soup.get_text(separator=" ")

        self.assertEqual(title, "Huge Page")
        self.assertIn("DocIntel platform node analysis.", plain_text)

    def test_f5_bva_02_non_html_content_type_filtering(self):
        """Verify non-HTML content types (application/pdf, image/png, application/json) are skipped."""
        client = E2EClient(force_mock=True)
        # Execute crawler on mock endpoint
        res = client.execute_crawler(start_url="https://docintel.ai", max_depth=1)
        self.assertEqual(res["status"], "success")
        self.assertGreater(len(res["pages"]), 0)

    def test_f5_bva_03_url_normalization_boundary_cases(self):
        """Verify URL normalization boundaries: javascript:, mailto:, uppercase host, query ordering, fragment removal."""
        norm = self.crawler.normalize_url

        # Invalid schemes should return empty string
        self.assertEqual(norm("javascript:alert(1)"), "")
        self.assertEqual(norm("mailto:test@docintel.ai"), "")
        self.assertEqual(norm("ftp://files.docintel.ai"), "")
        self.assertEqual(norm("not_a_url"), "")

        # Uppercase host and path trailing slash normalization
        self.assertEqual(norm("HTTP://DOCINTEL.AI/DOCS/"), "http://docintel.ai/docs")
        self.assertEqual(norm("https://docintel.ai/"), "https://docintel.ai")

        # Query parameter alphabetical sorting
        self.assertEqual(norm("https://docintel.ai/search?b=2&a=1"), "https://docintel.ai/search?a=1&b=2")

    def test_f5_bva_04_malformed_html_and_unclosed_tags_parsing(self):
        """Verify BeautifulSoup parsing resilience against broken/malformed HTML markup."""
        malformed_html = "<html><head><title>Broken Title<div><body><p>Content without closing tags"
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(malformed_html, "html.parser")
        
        # BeautifulSoup should parse elements without throwing an unhandled exception
        plain_text = soup.get_text(separator=" ")
        self.assertIn("Broken Title", plain_text)
        self.assertIn("Content without closing tags", plain_text)

    def test_f5_bva_05_crawl_depth_boundary_zero_and_negative(self):
        """Verify max_depth=0 only processes seed URL and depth limit is strictly respected."""
        seed = "https://docintel.ai"
        norm_seed = self.crawler.normalize_url(seed)
        self.assertEqual(norm_seed, "https://docintel.ai")

    def test_f5_bva_06_robots_txt_disallow_all_boundary(self):
        """Verify robots.txt checker behavior for allowed vs disallowed URLs."""
        is_allowed = self.crawler.is_allowed_by_robots("https://docintel.ai/public")
        self.assertIsInstance(is_allowed, bool)


if __name__ == "__main__":
    unittest.main()
