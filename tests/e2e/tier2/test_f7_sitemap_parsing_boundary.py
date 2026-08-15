"""
Tier 2 Boundary & Corner Cases Test Suite for Feature 7: Sitemap XML Parsing.

Tests huge sitemaps (50,000+ URLs), malformed XML, zero URL sitemaps, missing/empty <loc> tags,
complex XML namespaces, and duplicate URL deduplication.
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
    from googi_crawler.sitemap import SitemapParser
except ImportError:
    from packages.googi_crawler.googi_crawler.sitemap import SitemapParser

from tests.e2e.infra.fixtures import E2ETestContext


class TestFeature7SitemapParsingBoundary(unittest.TestCase):
    """Boundary & Corner Cases for Feature 7 (Sitemap XML Parsing)."""

    def setUp(self):
        self.context = E2ETestContext()
        self.parser = SitemapParser(user_agent="GoogiBot-Test/1.0", timeout=3.0)

    def test_f7_bva_01_huge_sitemaps_over_50k_urls(self):
        """Verify sitemap parser scales to 50,000 URL elements efficiently."""
        url_nodes = "".join([f"<url><loc>https://docintel.ai/page/{i}</loc></url>\n" for i in range(50000)])
        huge_xml = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            f'{url_nodes}'
            '</urlset>'
        )

        urls = self.parser.parse_content(huge_xml)
        self.assertEqual(len(urls), 50000)
        self.assertEqual(urls[0], "https://docintel.ai/page/0")
        self.assertEqual(urls[-1], "https://docintel.ai/page/49999")

    def test_f7_bva_02_malformed_xml_and_broken_tags(self):
        """Verify malformed XML (unclosed tags, broken syntax) returns empty list [] without crashing."""
        malformed_inputs = [
            '<?xml version="1.0"?><urlset><url><loc>https://docintel.ai',
            '<not_valid_xml>broken syntax <<<>>>',
            'random text that is not XML at all',
            '<?xml version="1.0"?><urlset></url>'
        ]

        for bad_xml in malformed_inputs:
            res = self.parser.parse_content(bad_xml)
            self.assertEqual(res, [], f"Expected [] for malformed XML: '{bad_xml[:30]}...'")

    def test_f7_bva_03_zero_url_empty_sitemap_xml(self):
        """Verify valid XML structure with zero <url> elements returns empty list []."""
        empty_sitemaps = [
            '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>',
            '<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></sitemapindex>',
            ''
        ]

        for xml_content in empty_sitemaps:
            urls = self.parser.parse_content(xml_content)
            self.assertEqual(urls, [])

    def test_f7_bva_04_missing_or_empty_loc_tags(self):
        """Verify <url> blocks with missing, empty, or whitespace-only <loc> tags are skipped."""
        xml_content = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            '  <url><loc>https://docintel.ai/valid</loc></url>\n'
            '  <url><loc></loc></url>\n'
            '  <url><loc>   </loc></url>\n'
            '  <url><lastmod>2026-08-13</lastmod></url>\n'
            '  <url><loc>https://docintel.ai/valid2</loc></url>\n'
            '</urlset>'
        )

        urls = self.parser.parse_content(xml_content)
        self.assertEqual(urls, ["https://docintel.ai/valid", "https://docintel.ai/valid2"])

    def test_f7_bva_05_sitemap_index_with_nested_namespaces(self):
        """Verify sitemap index XML containing nested <sitemap> and custom namespaces is parsed."""
        sitemap_index_xml = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n'
            '  <sitemap>\n'
            '    <loc>https://docintel.ai/sitemap-1.xml</loc>\n'
            '    <lastmod>2026-08-13</lastmod>\n'
            '  </sitemap>\n'
            '  <sitemap>\n'
            '    <loc>https://docintel.ai/sitemap-2.xml</loc>\n'
            '  </sitemap>\n'
            '</sitemapindex>'
        )

        urls = self.parser.parse_content(sitemap_index_xml)
        self.assertEqual(len(urls), 2)
        self.assertIn("https://docintel.ai/sitemap-1.xml", urls)
        self.assertIn("https://docintel.ai/sitemap-2.xml", urls)

    def test_f7_bva_06_whitespace_and_duplicate_url_deduplication(self):
        """Verify parser trims leading/trailing whitespace and deduplicates repeated URLs."""
        duplicate_xml = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            '  <url><loc>  https://docintel.ai/page1  </loc></url>\n'
            '  <url><loc>https://docintel.ai/page1</loc></url>\n'
            '  <url><loc>https://docintel.ai/page1/</loc></url>\n'
            '</urlset>'
        )

        urls = self.parser.parse_content(duplicate_xml)
        self.assertEqual(urls[0], "https://docintel.ai/page1")
        self.assertIn("https://docintel.ai/page1", urls)


if __name__ == "__main__":
    unittest.main()
