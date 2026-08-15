from unittest.mock import MagicMock, patch
import pytest
from googi_crawler.sitemap import SitemapParser
from googi_crawler.crawler import GoogiCrawler

def test_sitemap_parser_urlset_with_namespace():
    xml_content = """<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
            <loc>https://example.com/page1</loc>
            <lastmod>2026-01-01</lastmod>
        </url>
        <url>
            <loc>  https://example.com/page2  </loc>
        </url>
    </urlset>"""
    parser = SitemapParser()
    urls = parser.parse_content(xml_content)
    assert urls == ["https://example.com/page1", "https://example.com/page2"]


def test_sitemap_parser_sitemapindex():
    xml_content = """<?xml version="1.0" encoding="UTF-8"?>
    <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap>
            <loc>https://example.com/sitemap1.xml</loc>
        </sitemap>
        <sitemap>
            <loc>https://example.com/sitemap2.xml</loc>
        </sitemap>
    </sitemapindex>"""
    parser = SitemapParser()
    urls = parser.parse_content(xml_content)
    assert urls == ["https://example.com/sitemap1.xml", "https://example.com/sitemap2.xml"]


def test_sitemap_parser_no_namespace():
    xml_content = """<urlset>
        <url><loc>http://test.com/a</loc></url>
        <url><loc>http://test.com/b</loc></url>
        <url><loc>http://test.com/a</loc></url>
    </urlset>"""
    parser = SitemapParser()
    urls = parser.parse_content(xml_content)
    assert urls == ["http://test.com/a", "http://test.com/b"]


def test_sitemap_parser_invalid_xml():
    parser = SitemapParser()
    assert parser.parse_content("") == []
    assert parser.parse_content("Not XML content <><") == []


@patch("httpx.get")
def test_sitemap_fetch_and_parse(mock_get):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.text = """<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://example.com/fetched</loc></url>
    </urlset>"""
    mock_get.return_value = mock_resp

    parser = SitemapParser()
    urls = parser.fetch_and_parse("https://example.com/sitemap.xml")
    assert urls == ["https://example.com/fetched"]
    mock_get.assert_called_once()


@patch("httpx.get")
def test_sitemap_discover_urls(mock_get):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.text = """<urlset><url><loc>https://seed-domain.com/discovered</loc></url></urlset>"""
    mock_get.return_value = mock_resp

    parser = SitemapParser()
    urls = parser.discover_sitemap_urls("https://seed-domain.com/start")
    assert urls == ["https://seed-domain.com/discovered"]


@patch("httpx.get")
def test_crawler_sitemap_integration(mock_get):
    def side_effect(url, **kwargs):
        mock_resp = MagicMock()
        if "sitemap.xml" in url:
            mock_resp.status_code = 200
            mock_resp.text = """<urlset><url><loc>https://example.com/sitemap-page</loc></url></urlset>"""
        elif "robots.txt" in url:
            mock_resp.status_code = 200
            mock_resp.text = "User-agent: *\nAllow: /"
        elif url == "https://example.com/sitemap-page":
            mock_resp.status_code = 200
            mock_resp.headers = {"content-type": "text/html"}
            mock_resp.text = "<html><head><title>Sitemap Page</title></head><body><p>Content</p></body></html>"
        else:
            mock_resp.status_code = 200
            mock_resp.headers = {"content-type": "text/html"}
            mock_resp.text = "<html><head><title>Seed Page</title></head><body><p>Seed Content</p></body></html>"
        return mock_resp

    mock_get.side_effect = side_effect

    crawler = GoogiCrawler(request_delay=0.0, parse_sitemap=True)
    results = crawler.crawl("https://example.com", max_depth=1)
    assert "https://example.com" in results
    assert "https://example.com/sitemap-page" in results


def test_sitemap_parser_xml_comments_and_pi():
    xml_content = """<?xml version="1.0" encoding="UTF-8"?>
    <?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
    <!-- This is a top level XML comment -->
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <!-- Comment inside urlset -->
        <url>
            <!-- Comment inside url -->
            <loc>https://example.com/commented-page</loc>
        </url>
    </urlset>"""
    parser = SitemapParser()
    urls = parser.parse_content(xml_content)
    assert urls == ["https://example.com/commented-page"]


@patch("httpx.get")
def test_sitemap_fetch_and_parse_sitemapindex_recursive(mock_get):
    def side_effect(url, **kwargs):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        if url == "https://example.com/sitemapindex.xml":
            mock_resp.content = b"""<?xml version="1.0" encoding="UTF-8"?>
            <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                <sitemap><loc>https://example.com/sub_sitemap1.xml</loc></sitemap>
                <sitemap><loc>https://example.com/sub_sitemap2.xml</loc></sitemap>
            </sitemapindex>"""
        elif url == "https://example.com/sub_sitemap1.xml":
            mock_resp.content = b"""<?xml version="1.0" encoding="UTF-8"?>
            <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                <url><loc>https://example.com/page-a</loc></url>
            </urlset>"""
        elif url == "https://example.com/sub_sitemap2.xml":
            mock_resp.content = b"""<?xml version="1.0" encoding="UTF-8"?>
            <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                <url><loc>https://example.com/page-b</loc></url>
            </urlset>"""
        else:
            mock_resp.status_code = 404
        return mock_resp

    mock_get.side_effect = side_effect

    parser = SitemapParser()
    urls = parser.fetch_and_parse("https://example.com/sitemapindex.xml")
    assert urls == ["https://example.com/page-a", "https://example.com/page-b"]

