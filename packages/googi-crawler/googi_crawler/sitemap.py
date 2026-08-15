import logging
import xml.etree.ElementTree as ET
from urllib.parse import urlparse
import httpx

logger = logging.getLogger("googi_crawler.sitemap")

class SitemapParser:
    """
    Parser for XML sitemaps (<urlset> and <sitemapindex>).
    Extracts location URLs regardless of namespace definitions.
    """

    def __init__(self, user_agent: str = "GoogiBot/1.0", timeout: float = 5.0):
        self.user_agent = user_agent
        self.timeout = timeout

    def parse_content(self, xml_content: str | bytes) -> list[str]:
        """
        Parses XML string or bytes content and extracts all <loc> text elements.
        Handles <urlset>, <sitemapindex>, namespaces, and namespace-free XML.
        Returns a list of unique, non-empty, whitespace-trimmed URLs.
        Safely ignores non-string tags like XML comments and processing instructions.
        """
        if not xml_content:
            return []

        if isinstance(xml_content, str):
            xml_bytes = xml_content.encode("utf-8")
        else:
            xml_bytes = xml_content

        try:
            root = ET.fromstring(xml_bytes)
            urls: list[str] = []
            seen: set[str] = set()

            for elem in root.iter():
                if not isinstance(elem.tag, str):
                    continue
                # Check if tag ends with 'loc' (handles {namespace}loc and loc)
                tag_name = elem.tag.split("}")[-1] if "}" in elem.tag else elem.tag
                if tag_name.lower() == "loc" and elem.text:
                    url = elem.text.strip()
                    if url and url not in seen:
                        seen.add(url)
                        urls.append(url)

            return urls
        except (ET.ParseError, Exception) as e:
            logger.warning(f"Failed to parse XML sitemap content: {e}")
            return []

    def fetch_and_parse(self, sitemap_url: str, depth: int = 0, max_depth: int = 2) -> list[str]:
        """
        Fetches a sitemap from sitemap_url via HTTP GET and parses its location URLs.
        Recursively resolves child sitemaps if <sitemapindex> is encountered up to max_depth.
        Returns empty list on HTTP or XML errors.
        """
        if depth > max_depth:
            logger.warning(f"Exceeded max sitemap depth ({max_depth}) at {sitemap_url}")
            return []

        try:
            logger.info(f"Fetching sitemap from: {sitemap_url}")
            resp = httpx.get(
                sitemap_url,
                timeout=self.timeout,
                headers={"User-Agent": self.user_agent},
                follow_redirects=True,
            )
            if resp.status_code != 200:
                logger.warning(f"Sitemap HTTP fetch failed for {sitemap_url}: status {resp.status_code}")
                return []

            xml_bytes = resp.content if isinstance(resp.content, bytes) else resp.text.encode("utf-8")
            try:
                root = ET.fromstring(xml_bytes)
            except Exception as pe:
                logger.warning(f"Failed to parse XML from {sitemap_url}: {pe}")
                return []

            root_tag = root.tag.split("}")[-1] if isinstance(root.tag, str) and "}" in root.tag else (root.tag if isinstance(root.tag, str) else "")

            child_urls = self.parse_content(xml_bytes)

            if root_tag.lower() == "sitemapindex":
                logger.info(f"Sitemap index detected at {sitemap_url} with {len(child_urls)} child sitemaps")
                resolved_page_urls: list[str] = []
                seen_pages: set[str] = set()
                for child_sitemap_url in child_urls:
                    sub_urls = self.fetch_and_parse(child_sitemap_url, depth=depth + 1, max_depth=max_depth)
                    for page_url in sub_urls:
                        if page_url not in seen_pages:
                            seen_pages.add(page_url)
                            resolved_page_urls.append(page_url)
                return resolved_page_urls
            else:
                return child_urls

        except Exception as e:
            logger.warning(f"Error fetching sitemap {sitemap_url}: {e}")
            return []

    def discover_sitemap_urls(self, seed_url: str) -> list[str]:
        """
        Derives default sitemap.xml URL from a seed URL and fetches/parses it.
        """
        try:
            parsed = urlparse(seed_url)
            if not parsed.scheme or not parsed.netloc:
                return []
            sitemap_url = f"{parsed.scheme}://{parsed.netloc}/sitemap.xml"
            return self.fetch_and_parse(sitemap_url)
        except Exception as e:
            logger.warning(f"Error discovering sitemap for seed {seed_url}: {e}")
            return []
