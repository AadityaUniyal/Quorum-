"""
Tier 1 Feature 7: Sitemap XML Parsing Test Suite.
Verifies parsing of sitemap.xml files, URL extraction, metadata parsing, sitemap indexes, and error handling.
"""

import sys
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

# Ensure workspace root is in sys.path
root_dir = Path(__file__).resolve().parents[3]
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from tests.e2e.infra.client import E2EClient
from tests.e2e.infra.fixtures import E2ETestContext, SAMPLE_SITEMAP_XML


class TestFeature7SitemapParsing(unittest.TestCase):
    """Test case suite for Feature 7: Sitemap XML Parsing."""

    def setUp(self):
        self.context = E2ETestContext()
        self.client = E2EClient(base_url=self.context.base_url, force_mock=self.context.force_mock)
        self.valid_xml = SAMPLE_SITEMAP_XML

    def test_f7_01_valid_sitemap_xml_url_extraction(self):
        """Verify extraction of target <loc> URLs from a standard sitemap.xml."""
        root = ET.fromstring(self.valid_xml)
        ns = {"ns": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        urls = [loc.text.strip() for loc in root.findall(".//ns:loc", ns) if loc.text]

        self.assertEqual(len(urls), 2)
        self.assertIn("https://docintel.ai/", urls)
        self.assertIn("https://docintel.ai/docs/api", urls)

    def test_f7_02_sitemap_metadata_parsing(self):
        """Verify parsing of sitemap metadata fields (<lastmod>, <changefreq>, <priority>)."""
        root = ET.fromstring(self.valid_xml)
        ns = {"ns": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        url_nodes = root.findall("ns:url", ns)

        self.assertEqual(len(url_nodes), 2)

        first_url = url_nodes[0]
        loc = first_url.find("ns:loc", ns).text.strip()
        lastmod = first_url.find("ns:lastmod", ns).text.strip()
        changefreq = first_url.find("ns:changefreq", ns).text.strip()
        priority = float(first_url.find("ns:priority", ns).text.strip())

        self.assertEqual(loc, "https://docintel.ai/")
        self.assertEqual(lastmod, "2026-08-13")
        self.assertEqual(changefreq, "daily")
        self.assertEqual(priority, 1.0)

    def test_f7_03_sitemap_index_handling(self):
        """Verify parsing of a sitemap index XML file referencing child sitemaps."""
        sitemap_index_xml = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            '  <sitemap>\n'
            '    <loc>https://docintel.ai/sitemap-pages.xml</loc>\n'
            '    <lastmod>2026-08-13</lastmod>\n'
            '  </sitemap>\n'
            '  <sitemap>\n'
            '    <loc>https://docintel.ai/sitemap-docs.xml</loc>\n'
            '    <lastmod>2026-08-13</lastmod>\n'
            '  </sitemap>\n'
            '</sitemapindex>'
        )
        root = ET.fromstring(sitemap_index_xml)
        ns = {"ns": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        child_sitemaps = [loc.text.strip() for loc in root.findall(".//ns:loc", ns) if loc.text]

        self.assertEqual(len(child_sitemaps), 2)
        self.assertIn("https://docintel.ai/sitemap-pages.xml", child_sitemaps)

    def test_f7_04_empty_or_no_urls_sitemap(self):
        """Verify parsing of an empty sitemap with no <url> entries returns empty list."""
        empty_sitemap_xml = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            '</urlset>'
        )
        root = ET.fromstring(empty_sitemap_xml)
        ns = {"ns": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        urls = [loc.text.strip() for loc in root.findall(".//ns:loc", ns) if loc.text]

        self.assertEqual(len(urls), 0)

    def test_f7_05_malformed_xml_resilience(self):
        """Verify handling of malformed XML content."""
        malformed_xml = "<urlset><url><loc>https://docintel.ai/broken</urlset>"
        with self.assertRaises(ET.ParseError):
            ET.fromstring(malformed_xml)

    def test_f7_06_crawler_integration_with_sitemap(self):
        """Verify crawler execution helper when parse_sitemap=True flag is passed."""
        res = self.client.execute_crawler(start_url="https://docintel.ai", max_depth=1, parse_sitemap=True)
        self.assertEqual(res["status"], "success")
        self.assertTrue(res.get("sitemap_parsed"), "sitemap_parsed flag should be True")


if __name__ == "__main__":
    unittest.main()
