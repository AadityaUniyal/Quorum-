import math
import random
import time
import unittest
from unittest.mock import MagicMock, patch

from googi_crawler.pagerank import compute_pagerank
from googi_crawler.sitemap import SitemapParser


class TestPageRankEmpiricalConvergence(unittest.TestCase):
    def test_empty_graph(self):
        result = compute_pagerank({})
        self.assertEqual(result, {})

    def test_single_node_self_loop(self):
        result = compute_pagerank({"A": ["A"]})
        self.assertAlmostEqual(result["A"], 1.0, places=6)

    def test_single_dangling_node(self):
        result = compute_pagerank({"A": []})
        self.assertAlmostEqual(result["A"], 1.0, places=6)

    def test_disconnected_isolated_nodes(self):
        # 20 isolated nodes with 0 edges
        graph = {f"node_{i}": [] for i in range(20)}
        result = compute_pagerank(graph)
        self.assertEqual(len(result), 20)
        self.assertAlmostEqual(sum(result.values()), 1.0, places=6)
        for v in result.values():
            self.assertAlmostEqual(v, 1.0 / 20, places=6)

    def test_disconnected_multiple_subgraphs(self):
        # 3 isolated clusters: Cluster A (4 nodes clique), Cluster B (4 nodes clique), Cluster C (4 nodes clique)
        graph = {}
        for c in ["A", "B", "C"]:
            for i in range(4):
                node = f"{c}_{i}"
                graph[node] = [f"{c}_{j}" for j in range(4) if j != i]
        result = compute_pagerank(graph)
        self.assertEqual(len(result), 12)
        self.assertAlmostEqual(sum(result.values()), 1.0, places=6)
        for v in result.values():
            self.assertAlmostEqual(v, 1.0 / 12, places=6)

    def test_cyclic_simple_ring(self):
        # Ring: A -> B -> C -> D -> E -> A
        graph = {"A": ["B"], "B": ["C"], "C": ["D"], "D": ["E"], "E": ["A"]}
        result = compute_pagerank(graph)
        self.assertAlmostEqual(sum(result.values()), 1.0, places=6)
        for v in result.values():
            self.assertAlmostEqual(v, 0.2, places=6)

    def test_cyclic_spider_trap(self):
        # Spider trap: A -> B -> C -> Trap (self-loop)
        # Random teleports allow non-zero rank elsewhere, but Trap gets the highest rank
        graph = {"A": ["B"], "B": ["C"], "C": ["Trap"], "Trap": ["Trap"]}
        result = compute_pagerank(graph, damping_factor=0.85)
        self.assertAlmostEqual(sum(result.values()), 1.0, places=6)
        self.assertGreater(result["Trap"], result["C"])
        self.assertGreater(result["C"], result["B"])
        self.assertGreater(result["B"], result["A"])

    def test_cyclic_dense_interlocking(self):
        # Interlocking cycles: 1->2->3->1 and 3->4->5->3
        graph = {
            "1": ["2"],
            "2": ["3"],
            "3": ["1", "4"],
            "4": ["5"],
            "5": ["3"]
        }
        result = compute_pagerank(graph)
        self.assertAlmostEqual(sum(result.values()), 1.0, places=6)
        self.assertGreater(result["3"], result["1"])

    def test_large_graph_100_nodes(self):
        random.seed(42)
        N = 100
        graph = {f"n_{i}": [] for i in range(N)}
        for i in range(N):
            targets = random.sample(range(N), k=random.randint(1, 10))
            graph[f"n_{i}"] = [f"n_{t}" for t in targets if t != i]

        t0 = time.perf_counter()
        result = compute_pagerank(graph, max_iterations=100, tolerance=1e-6)
        duration_ms = (time.perf_counter() - t0) * 1000

        self.assertEqual(len(result), N)
        self.assertAlmostEqual(sum(result.values()), 1.0, places=5)
        self.assertFalse(any(math.isnan(v) or math.isinf(v) for v in result.values()))
        print(f"\n[PageRank 100 Nodes Benchmark] Time: {duration_ms:.2f}ms | Sum: {sum(result.values()):.8f} | Max: {max(result.values()):.6f} | Min: {min(result.values()):.6f}")

    def test_large_graph_500_nodes(self):
        random.seed(123)
        N = 500
        graph = {f"n_{i}": [] for i in range(N)}
        for i in range(N):
            targets = random.sample(range(N), k=random.randint(0, 15))
            graph[f"n_{i}"] = [f"n_{t}" for t in targets if t != i]

        t0 = time.perf_counter()
        result = compute_pagerank(graph, max_iterations=100, tolerance=1e-6)
        duration_ms = (time.perf_counter() - t0) * 1000

        self.assertEqual(len(result), N)
        self.assertAlmostEqual(sum(result.values()), 1.0, places=5)
        self.assertFalse(any(math.isnan(v) or math.isinf(v) for v in result.values()))
        print(f"[PageRank 500 Nodes Benchmark] Time: {duration_ms:.2f}ms | Sum: {sum(result.values()):.8f} | Max: {max(result.values()):.6f} | Min: {min(result.values()):.6f}")

    def test_large_graph_1000_nodes_with_dangling_chains(self):
        random.seed(999)
        N = 1000
        graph = {f"n_{i}": [] for i in range(N)}
        for i in range(N):
            if i % 5 == 0:  # 20% dangling nodes
                graph[f"n_{i}"] = []
            elif i % 2 == 0:  # Sparse
                graph[f"n_{i}"] = [f"n_{(i+1)%N}"]
            else:  # Dense cluster
                graph[f"n_{i}"] = [f"n_{random.randint(0, N-1)}" for _ in range(20)]

        t0 = time.perf_counter()
        result = compute_pagerank(graph, max_iterations=100, tolerance=1e-6)
        duration_ms = (time.perf_counter() - t0) * 1000

        self.assertEqual(len(result), N)
        self.assertAlmostEqual(sum(result.values()), 1.0, places=5)
        self.assertFalse(any(math.isnan(v) or math.isinf(v) for v in result.values()))
        print(f"[PageRank 1000 Nodes Benchmark] Time: {duration_ms:.2f}ms | Sum: {sum(result.values()):.8f} | Max: {max(result.values()):.6f} | Min: {min(result.values()):.6f}")


class TestSitemapParserEmpiricalStress(unittest.TestCase):
    def setUp(self):
        self.parser = SitemapParser(user_agent="GoogiStressBot/1.0", timeout=3.0)

    def test_xml_comments_everywhere(self):
        xml_with_comments = """<?xml version="1.0" encoding="UTF-8"?>
        <!-- Top Level XML Comment -->
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <!-- Interleaved comment before URL 1 -->
            <url>
                <!-- Loc comment -->
                <loc>https://example.com/page-1</loc>
                <!-- Priority comment -->
                <priority>0.8</priority>
            </url>
            <!-- Comment between URLs -->
            <url>
                <loc>https://example.com/page-2</loc>
            </url>
            <!-- Trailing comment -->
        </urlset>
        <!-- Footer XML Comment -->
        """
        urls = self.parser.parse_content(xml_with_comments)
        self.assertEqual(urls, ["https://example.com/page-1", "https://example.com/page-2"])

    def test_xml_processing_instructions(self):
        xml_with_pi = """<?xml version="1.0" encoding="UTF-8"?>
        <?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
        <?custom-pi data="test-processing-instruction"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url>
                <loc>https://example.com/pi-page-1</loc>
            </url>
            <?inline-pi inside-urlset?>
            <url>
                <loc>https://example.com/pi-page-2</loc>
            </url>
        </urlset>
        """
        urls = self.parser.parse_content(xml_with_pi)
        self.assertEqual(urls, ["https://example.com/pi-page-1", "https://example.com/pi-page-2"])

    def test_cdata_and_encoded_urls(self):
        xml_cdata = """<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url>
                <loc><![CDATA[https://example.com/search?q=machine+learning&lang=en]]></loc>
            </url>
            <url>
                <loc>https://example.com/article?id=123&amp;ref=sitemap</loc>
            </url>
        </urlset>
        """
        urls = self.parser.parse_content(xml_cdata)
        self.assertEqual(urls, [
            "https://example.com/search?q=machine+learning&lang=en",
            "https://example.com/article?id=123&ref=sitemap"
        ])

    def test_deep_sitemapindex_recursion_depth_1_to_3(self):
        # Mock hierarchy:
        # root sitemapindex -> sub_sitemap_1, sub_sitemap_2
        # sub_sitemap_1 -> leaf_1_a, leaf_1_b (urlsets)
        # sub_sitemap_2 -> leaf_2_a (urlset)
        # leaf_1_a -> urls: /a1, /a2
        # leaf_1_b -> urls: /b1
        # leaf_2_a -> urls: /c1, /c2

        root_index = """<?xml version="1.0" encoding="UTF-8"?>
        <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <sitemap><loc>https://example.com/sitemaps/sub1.xml</loc></sitemap>
            <sitemap><loc>https://example.com/sitemaps/sub2.xml</loc></sitemap>
        </sitemapindex>"""

        sub1 = """<?xml version="1.0" encoding="UTF-8"?>
        <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <sitemap><loc>https://example.com/sitemaps/leaf1a.xml</loc></sitemap>
            <sitemap><loc>https://example.com/sitemaps/leaf1b.xml</loc></sitemap>
        </sitemapindex>"""

        sub2 = """<?xml version="1.0" encoding="UTF-8"?>
        <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <sitemap><loc>https://example.com/sitemaps/leaf2a.xml</loc></sitemap>
        </sitemapindex>"""

        leaf1a = """<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url><loc>https://example.com/page-a1</loc></url>
            <url><loc>https://example.com/page-a2</loc></url>
        </urlset>"""

        leaf1b = """<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url><loc>https://example.com/page-b1</loc></url>
        </urlset>"""

        leaf2a = """<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url><loc>https://example.com/page-c1</loc></url>
            <url><loc>https://example.com/page-c2</loc></url>
        </urlset>"""

        mock_responses = {
            "https://example.com/sitemap.xml": root_index,
            "https://example.com/sitemaps/sub1.xml": sub1,
            "https://example.com/sitemaps/sub2.xml": sub2,
            "https://example.com/sitemaps/leaf1a.xml": leaf1a,
            "https://example.com/sitemaps/leaf1b.xml": leaf1b,
            "https://example.com/sitemaps/leaf2a.xml": leaf2a,
        }

        def mock_get(url, **kwargs):
            if url in mock_responses:
                mock_resp = MagicMock()
                mock_resp.status_code = 200
                mock_resp.text = mock_responses[url]
                mock_resp.content = mock_responses[url].encode("utf-8")
                return mock_resp
            mock_resp = MagicMock()
            mock_resp.status_code = 404
            return mock_resp

        with patch("httpx.get", side_effect=mock_get):
            # depth limit 2 (root is depth 0, sub1/sub2 is depth 1, leaf is depth 2)
            urls = self.parser.fetch_and_parse("https://example.com/sitemap.xml", max_depth=2)
            expected = [
                "https://example.com/page-a1",
                "https://example.com/page-a2",
                "https://example.com/page-b1",
                "https://example.com/page-c1",
                "https://example.com/page-c2",
            ]
            self.assertEqual(urls, expected)

    def test_sitemapindex_circular_reference_prevention(self):
        # A references B, B references A
        sitemap_a = """<?xml version="1.0" encoding="UTF-8"?>
        <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <sitemap><loc>https://example.com/sitemap_b.xml</loc></sitemap>
        </sitemapindex>"""

        sitemap_b = """<?xml version="1.0" encoding="UTF-8"?>
        <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <sitemap><loc>https://example.com/sitemap_a.xml</loc></sitemap>
        </sitemapindex>"""

        def mock_get(url, **kwargs):
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            if "sitemap_a" in url:
                mock_resp.text = sitemap_a
                mock_resp.content = sitemap_a.encode("utf-8")
            else:
                mock_resp.text = sitemap_b
                mock_resp.content = sitemap_b.encode("utf-8")
            return mock_resp

        with patch("httpx.get", side_effect=mock_get):
            # Should terminate cleanly due to max_depth limit without infinite recursion
            urls = self.parser.fetch_and_parse("https://example.com/sitemap_a.xml", max_depth=3)
            self.assertEqual(urls, [])

    def test_high_volume_sitemap_5000_urls(self):
        items = "".join(f"<url><loc>https://example.com/item-{i}</loc><changefreq>daily</changefreq></url>" for i in range(5000))
        big_xml = f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{items}</urlset>'
        
        t0 = time.perf_counter()
        urls = self.parser.parse_content(big_xml)
        duration_ms = (time.perf_counter() - t0) * 1000

        self.assertEqual(len(urls), 5000)
        self.assertEqual(urls[0], "https://example.com/item-0")
        self.assertEqual(urls[-1], "https://example.com/item-4999")
        print(f"\n[SitemapParser 5,000 URLs Parse Benchmark] Time: {duration_ms:.2f}ms ({5000 / (duration_ms/1000):.0f} URLs/sec)")


if __name__ == "__main__":
    unittest.main(verbosity=2)
