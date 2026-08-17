from unittest.mock import MagicMock, patch

from googi_crawler.sitemap import SitemapParser


def test_sitemap_parser_xml_comments_and_pis_extensive():
    """
    Test XML comments and PIs at all possible locations:
    - Before declaration
    - Before root element
    - Inside root element
    - Inside <url> element
    - Surrounding <loc> element
    - Inside <sitemapindex> element
    """
    xml_content = """<?xml version="1.0" encoding="UTF-8"?>
    <?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
    <?custom-pi action="ignore"?>
    <!-- Top-level comment 1 -->
    <!-- Top-level comment 2 -->
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <!-- Comment inside urlset -->
        <url>
            <!-- Comment inside url -->
            <loc>https://example.com/page1</loc>
            <!-- Comment after loc -->
        </url>
        <?pi-inside-urlset?>
        <url>
            <loc>https://example.com/page2</loc>
        </url>
        <!-- Final comment -->
    </urlset>"""
    
    parser = SitemapParser()
    urls = parser.parse_content(xml_content)
    assert urls == ["https://example.com/page1", "https://example.com/page2"]


def test_sitemap_parser_cdata_locations():
    """
    Test CDATA sections inside <loc> elements.
    """
    xml_content = """<urlset>
        <url><loc><![CDATA[https://example.com/cdata-page]]></loc></url>
        <url><loc>https://example.com/normal-page</loc></url>
    </urlset>"""
    parser = SitemapParser()
    urls = parser.parse_content(xml_content)
    assert "https://example.com/cdata-page" in urls
    assert "https://example.com/normal-page" in urls


@patch("httpx.get")
def test_sitemapindex_deep_recursive_resolution(mock_get):
    """
    Test multi-level recursive sitemapindex resolution (sitemapindex -> sitemapindex -> urlset).
    """
    def side_effect(url, **kwargs):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        if url == "https://example.com/root_sitemap.xml":
            mock_resp.content = b"""<?xml version="1.0" encoding="UTF-8"?>
            <!-- Root index -->
            <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                <sitemap><loc>https://example.com/sub_index.xml</loc></sitemap>
                <sitemap><loc>https://example.com/leaf_sitemap1.xml</loc></sitemap>
            </sitemapindex>"""
        elif url == "https://example.com/sub_index.xml":
            mock_resp.content = b"""<?xml version="1.0" encoding="UTF-8"?>
            <!-- Sub index -->
            <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                <sitemap><loc>https://example.com/leaf_sitemap2.xml</loc></sitemap>
            </sitemapindex>"""
        elif url == "https://example.com/leaf_sitemap1.xml":
            mock_resp.content = b"""<?xml version="1.0" encoding="UTF-8"?>
            <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                <url><loc>https://example.com/page-1</loc></url>
                <url><loc>https://example.com/page-2</loc></url>
            </urlset>"""
        elif url == "https://example.com/leaf_sitemap2.xml":
            mock_resp.content = b"""<?xml version="1.0" encoding="UTF-8"?>
            <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                <url><loc>https://example.com/page-3</loc></url>
                <url><loc>https://example.com/page-1</loc></url> <!-- Duplicate -->
            </urlset>"""
        else:
            mock_resp.status_code = 404
        return mock_resp

    mock_get.side_effect = side_effect

    parser = SitemapParser()
    urls = parser.fetch_and_parse("https://example.com/root_sitemap.xml", max_depth=3)
    assert set(urls) == {"https://example.com/page-1", "https://example.com/page-2", "https://example.com/page-3"}


@patch("httpx.get")
def test_sitemapindex_circular_reference(mock_get):
    """
    Test circular references in sitemap index (index A -> index B -> index A).
    Should terminate gracefully when max_depth is reached.
    """
    def side_effect(url, **kwargs):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        if url == "https://example.com/index_a.xml":
            mock_resp.content = b"""<sitemapindex>
                <sitemap><loc>https://example.com/index_b.xml</loc></sitemap>
                <sitemap><loc>https://example.com/leaf.xml</loc></sitemap>
            </sitemapindex>"""
        elif url == "https://example.com/index_b.xml":
            mock_resp.content = b"""<sitemapindex>
                <sitemap><loc>https://example.com/index_a.xml</loc></sitemap>
            </sitemapindex>"""
        elif url == "https://example.com/leaf.xml":
            mock_resp.content = b"""<urlset>
                <url><loc>https://example.com/final-page</loc></url>
            </urlset>"""
        return mock_resp

    mock_get.side_effect = side_effect

    parser = SitemapParser()
    urls = parser.fetch_and_parse("https://example.com/index_a.xml", max_depth=2)
    assert "https://example.com/final-page" in urls


@patch("httpx.get")
def test_sitemapindex_partial_failure(mock_get):
    """
    Test sitemapindex where one child sitemap returns 500 error or network error, but others succeed.
    """
    def side_effect(url, **kwargs):
        mock_resp = MagicMock()
        if url == "https://example.com/index.xml":
            mock_resp.status_code = 200
            mock_resp.content = b"""<sitemapindex>
                <sitemap><loc>https://example.com/good_sitemap.xml</loc></sitemap>
                <sitemap><loc>https://example.com/bad_sitemap.xml</loc></sitemap>
            </sitemapindex>"""
        elif url == "https://example.com/good_sitemap.xml":
            mock_resp.status_code = 200
            mock_resp.content = b"""<urlset>
                <url><loc>https://example.com/good-page</loc></url>
            </urlset>"""
        elif url == "https://example.com/bad_sitemap.xml":
            mock_resp.status_code = 500
            mock_resp.content = b"Internal Server Error"
        return mock_resp

    mock_get.side_effect = side_effect

    parser = SitemapParser()
    urls = parser.fetch_and_parse("https://example.com/index.xml")
    assert urls == ["https://example.com/good-page"]
