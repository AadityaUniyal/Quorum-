from unittest.mock import MagicMock, patch

import httpx
from googi_crawler.crawler import GoogiCrawler
from googi_crawler.sitemap import SitemapParser

# ============================================================================
# 1. SitemapParser Adversarial & Stress Tests
# ============================================================================

def test_sitemap_parser_xml_comments_crash():
    """
    Stress test XML with comments <!-- comment -->.
    Bug check: elem.tag in ElementTree for comments is a function, not a string.
    """
    xml_content = """<?xml version="1.0" encoding="UTF-8"?>
    <!-- This is an XML comment at the top -->
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <!-- Comment inside urlset -->
        <url>
            <!-- Comment inside url -->
            <loc>https://example.com/page1</loc>
        </url>
    </urlset>"""
    parser = SitemapParser()
    # Expecting this to handle comments without raising TypeError
    urls = parser.parse_content(xml_content)
    assert urls == ["https://example.com/page1"]


def test_sitemap_parser_processing_instruction():
    """
    Stress test XML with Processing Instructions <?xml-stylesheet ...?>
    """
    xml_content = """<?xml version="1.0" encoding="UTF-8"?>
    <?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://example.com/page-pi</loc></url>
    </urlset>"""
    parser = SitemapParser()
    urls = parser.parse_content(xml_content)
    assert urls == ["https://example.com/page-pi"]


def test_sitemap_parser_malformed_xml():
    """
    Stress test malformed XML: empty, unclosed tags, non-XML text, binary garbage.
    """
    parser = SitemapParser()
    assert parser.parse_content("") == []
    assert parser.parse_content("<urlset><url><loc>https://example.com") == []
    assert parser.parse_content("Not XML at all!") == []
    assert parser.parse_content(b"\x80\x81\x82\xff\xfe") == []


def test_sitemap_parser_missing_and_empty_loc():
    """
    Stress test sitemaps with missing <loc>, empty <loc>, and whitespace <loc>.
    """
    xml_content = """<urlset>
        <url><lastmod>2026-01-01</lastmod></url>
        <url><loc></loc></url>
        <url><loc>   \n\t  </loc></url>
        <url><loc>  https://example.com/valid  </loc></url>
    </urlset>"""
    parser = SitemapParser()
    urls = parser.parse_content(xml_content)
    assert urls == ["https://example.com/valid"]


def test_sitemap_parser_namespaces():
    """
    Stress test namespace variations: default, prefixed, uppercase tags.
    """
    xml_content = """<g:urlset xmlns:g="http://www.google.com/schemas/sitemap/0.84">
        <g:url><g:loc>https://example.com/prefixed</g:loc></g:url>
        <URL><LOC>https://example.com/uppercase</LOC></URL>
    </g:urlset>"""
    parser = SitemapParser()
    urls = parser.parse_content(xml_content)
    assert "https://example.com/prefixed" in urls
    assert "https://example.com/uppercase" in urls


def test_sitemap_parser_sitemapindex():
    """
    Stress test sitemapindex extraction.
    """
    xml_content = """<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap><loc>https://example.com/sub_sitemap1.xml</loc></sitemap>
        <sitemap><loc>https://example.com/sub_sitemap2.xml</loc></sitemap>
    </sitemapindex>"""
    parser = SitemapParser()
    urls = parser.parse_content(xml_content)
    assert urls == ["https://example.com/sub_sitemap1.xml", "https://example.com/sub_sitemap2.xml"]


@patch("httpx.get")
def test_sitemap_parser_http_timeouts_and_network_errors(mock_get):
    """
    Stress test network failures and HTTP timeouts.
    """
    parser = SitemapParser()

    # Simulate timeout
    mock_get.side_effect = httpx.ReadTimeout("Timeout reading from server")
    assert parser.fetch_and_parse("https://example.com/sitemap.xml") == []

    # Simulate connection error
    mock_get.side_effect = httpx.ConnectError("Connection refused")
    assert parser.fetch_and_parse("https://example.com/sitemap.xml") == []

    # Simulate HTTP 404
    mock_resp = MagicMock()
    mock_resp.status_code = 404
    mock_get.side_effect = None
    mock_get.return_value = mock_resp
    assert parser.fetch_and_parse("https://example.com/sitemap.xml") == []


# ============================================================================
# 2. GoogiCrawler Adversarial & Stress Tests
# ============================================================================

@patch("httpx.get")
def test_crawler_robots_disallow(mock_get):
    """
    Stress test robots.txt compliance.
    """
    def side_effect(url, **kwargs):
        mock_resp = MagicMock()
        if "robots.txt" in url:
            mock_resp.status_code = 200
            mock_resp.text = "User-agent: *\nDisallow: /private/\nAllow: /public/"
        elif "sitemap.xml" in url:
            mock_resp.status_code = 404
        elif url == "https://example.com/public/page":
            mock_resp.status_code = 200
            mock_resp.headers = {"content-type": "text/html"}
            mock_resp.text = "<html><head><title>Public</title></head><body><a href='https://example.com/private/secret'>Secret</a></body></html>"
        elif url == "https://example.com/private/secret":
            mock_resp.status_code = 200
            mock_resp.headers = {"content-type": "text/html"}
            mock_resp.text = "<html><head><title>Secret</title></head><body>Secret</body></html>"
        else:
            mock_resp.status_code = 404
        return mock_resp

    mock_get.side_effect = side_effect

    crawler = GoogiCrawler(request_delay=0.0, parse_sitemap=False)
    results = crawler.crawl("https://example.com/public/page", max_depth=2)

    assert "https://example.com/public/page" in results
    assert "https://example.com/private/secret" not in results


@patch("httpx.get")
def test_crawler_depth_limits(mock_get):
    """
    Stress test depth limits: 0, 1, 2.
    """
    def side_effect(url, **kwargs):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.headers = {"content-type": "text/html"}
        if "robots.txt" in url or "sitemap.xml" in url:
            mock_resp.status_code = 404
        elif url == "https://example.com/d0":
            mock_resp.text = "<html><body><a href='https://example.com/d1'>d1</a></body></html>"
        elif url == "https://example.com/d1":
            mock_resp.text = "<html><body><a href='https://example.com/d2'>d2</a></body></html>"
        elif url == "https://example.com/d2":
            mock_resp.text = "<html><body><a href='https://example.com/d3'>d3</a></body></html>"
        elif url == "https://example.com/d3":
            mock_resp.text = "<html><body>End</body></html>"
        return mock_resp

    mock_get.side_effect = side_effect

    # Test depth 0
    crawler0 = GoogiCrawler(request_delay=0.0, parse_sitemap=False)
    res0 = crawler0.crawl("https://example.com/d0", max_depth=0)
    assert set(res0.keys()) == {"https://example.com/d0"}

    # Test depth 1
    crawler1 = GoogiCrawler(request_delay=0.0, parse_sitemap=False)
    res1 = crawler1.crawl("https://example.com/d0", max_depth=1)
    assert set(res1.keys()) == {"https://example.com/d0", "https://example.com/d1"}

    # Test depth 2
    crawler2 = GoogiCrawler(request_delay=0.0, parse_sitemap=False)
    res2 = crawler2.crawl("https://example.com/d0", max_depth=2)
    assert set(res2.keys()) == {"https://example.com/d0", "https://example.com/d1", "https://example.com/d2"}


@patch("httpx.get")
def test_crawler_stay_on_domain(mock_get):
    """
    Stress test stay_on_domain restriction.
    """
    def side_effect(url, **kwargs):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.headers = {"content-type": "text/html"}
        if "robots.txt" in url or "sitemap.xml" in url:
            mock_resp.status_code = 404
        elif url == "https://example.com/start":
            mock_resp.text = """<html><body>
                <a href='https://example.com/internal'>Internal</a>
                <a href='https://otherdomain.com/external'>External</a>
                <a href='https://sub.example.com/subdomain'>Subdomain</a>
            </body></html>"""
        else:
            mock_resp.text = "<html><body>Page</body></html>"
        return mock_resp

    mock_get.side_effect = side_effect

    # stay_on_domain = True
    crawler_strict = GoogiCrawler(request_delay=0.0, stay_on_domain=True, parse_sitemap=False)
    res_strict = crawler_strict.crawl("https://example.com/start", max_depth=1)
    assert "https://example.com/start" in res_strict
    assert "https://example.com/internal" in res_strict
    assert "https://otherdomain.com/external" not in res_strict

    # stay_on_domain = False
    crawler_permissive = GoogiCrawler(request_delay=0.0, stay_on_domain=False, parse_sitemap=False)
    res_permissive = crawler_permissive.crawl("https://example.com/start", max_depth=1)
    assert "https://example.com/start" in res_permissive
    assert "https://example.com/internal" in res_permissive
    assert "https://otherdomain.com/external" in res_permissive
