# googi-crawler 🕷️

An ethical, robust, BeautifulSoup-based web crawler with XML sitemap parsing, directed link-graph extraction, and iterative PageRank calculation.

Originally designed as the core crawling and link-analysis engine for the **Googi Cognitive Search Engine & Distributed AI Document Intelligence Platform**.

---

## Features

- **XML Sitemap Parsing & Auto-Discovery**: Automatically discovers and parses `sitemap.xml` files (`<urlset>` and `<sitemapindex>`), supporting standard and custom XML namespaces.
- **Ethical & Polite Crawling**: Respects `robots.txt` exclusion standards using a built-in rate-limited parser.
- **Canonical Normalization**: Standardizes paths, lowercases netloc/scheme, strips fragments, and sorts query parameters to avoid crawl loop duplication.
- **Breadth-First Search (BFS)**: Custom limits on depth (`max_depth`) to prevent run-away scraping.
- **Domain Locking**: Restricts crawls to the seed URL domain by default.
- **Link Graph PageRank**: Runs power iteration convergence calculation over the crawled link structure (handling dangling nodes and damping factors) to produce search engine authority weights.

---

## Installation

```bash
pip install -e packages/googi-crawler
```

---

## Quick Start

### 1. Crawling a Website (with Sitemap Auto-Discovery)

The crawler uses `httpx` and `BeautifulSoup` under the hood to fetch pages, discover sitemaps, and extract out-links.

```python
from googi_crawler import GoogiCrawler

# Initialize crawler with sitemap parsing enabled (default)
crawler = GoogiCrawler(
    user_agent="GoogiBot/1.0",
    request_delay=0.5,
    stay_on_domain=True,
    parse_sitemap=True
)

# Start crawling from a seed URL up to depth 2
crawled_pages = crawler.crawl("https://example.com", max_depth=2)

for url, data in crawled_pages.items():
    print(f"URL: {url}")
    print(f"Title: {data.title}")
    print(f"Extracted Text: {data.text[:100]}...")
    print(f"Outlinks: {len(data.links)}")
    print("-" * 40)
```

### 2. Standalone Sitemap Parsing

You can also use `SitemapParser` directly to fetch and parse XML sitemaps:

```python
from googi_crawler import SitemapParser

parser = SitemapParser(user_agent="GoogiBot/1.0", timeout=5.0)

# Parse XML content directly (string or bytes)
xml_data = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
   <url><loc>https://example.com/page1</loc></url>
   <url><loc>https://example.com/page2</loc></url>
</urlset>"""

urls = parser.parse_content(xml_data)
print("Parsed URLs:", urls)

# Or fetch and parse directly from a URL
urls = parser.fetch_and_parse("https://example.com/sitemap.xml")
```

### 3. Computing PageRank over the Crawl Graph

Once crawled, extract the link graph and calculate PageRank authority weights:

```python
from googi_crawler import compute_pagerank

# 1. Build link graph dictionary (URL -> Outlinks list)
link_graph = {url: data.links for url, data in crawled_pages.items()}

# 2. Compute PageRank scores (summing to 1.0)
pageranks = compute_pagerank(link_graph, damping_factor=0.85)

# Sort pages by authority rank
sorted_ranks = sorted(pageranks.items(), key=lambda x: x[1], reverse=True)

print("PageRank Authority Scores:")
for url, score in sorted_ranks[:10]:
    print(f"- {url}: {score:.4f}")
```

---

## License

This project is licensed under the MIT License - see the LICENSE file for details.
