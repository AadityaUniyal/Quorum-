"""
Unit tests for search utilities — Roadmap 1.9
Tests: snippet generation, facet parsing, RRF formula, query expansion cache key
"""
import os
import pytest

os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key")


# ── Snippet Generation ────────────────────────────────────────────────────────

class TestSnippetGeneration:
    def _gen(self, text, query):
        from app.routes.search import generate_snippet
        return generate_snippet(text, query)

    def test_empty_text_returns_empty(self):
        assert self._gen("", "invoice") == ""

    def test_none_text_returns_empty(self):
        assert self._gen(None, "invoice") == ""

    def test_short_text_returned_as_is(self):
        snippet = self._gen("Short text.", "short")
        assert "Short text." in snippet or "short" in snippet.lower()

    def test_mark_tags_added_for_match(self):
        text = "The invoice total is $500. The invoice date is 2024-01-01."
        snippet = self._gen(text, "invoice")
        assert "<mark>" in snippet

    def test_no_match_returns_prefix(self):
        text = "A" * 200
        snippet = self._gen(text, "xyz_no_match_here")
        assert len(snippet) <= 155  # truncated

    def test_multiple_query_terms_highlighted(self):
        text = "The vendor sent a purchase order for titanium rods."
        snippet = self._gen(text, "vendor purchase")
        assert "<mark>" in snippet


# ── Facet Parsing ─────────────────────────────────────────────────────────────

class TestFacetParsing:
    def _parse(self, query):
        from app.routes.search import parse_facets
        return parse_facets(query)

    def test_no_facets_returns_query_unchanged(self):
        clean, facets = self._parse("invoice ACME corp")
        assert clean == "invoice ACME corp"
        assert facets == {}

    def test_type_facet_extracted(self):
        clean, facets = self._parse("ACME type:invoice")
        assert facets["type"] == "INVOICE"
        assert "type:invoice" not in clean

    def test_confidence_gt_extracted(self):
        clean, facets = self._parse("high quality confidence:>0.9")
        op, val = facets["confidence"]
        assert op == ">"
        assert val == pytest.approx(0.9)

    def test_vendor_facet_extracted(self):
        clean, facets = self._parse("parts vendor:acme")
        assert facets["vendor"] == "acme"
        assert "vendor:acme" not in clean

    def test_multiple_facets(self):
        clean, facets = self._parse("search type:invoice confidence:>0.8 vendor:acme")
        assert "type" in facets
        assert "confidence" in facets
        assert "vendor" in facets


# ── RRF Formula ───────────────────────────────────────────────────────────────

class TestRRFFormula:
    """Test the Reciprocal Rank Fusion math directly."""

    def _rrf_score(self, ranks: list[int], k: int = 60) -> float:
        return sum(1.0 / (k + r) for r in ranks)

    def test_rank_1_scores_highest(self):
        score_rank1 = self._rrf_score([1])
        score_rank10 = self._rrf_score([10])
        assert score_rank1 > score_rank10

    def test_three_rankers_beats_one(self):
        one_ranker = self._rrf_score([1])
        three_rankers = self._rrf_score([1, 1, 1])
        assert three_rankers > one_ranker

    def test_k60_default_formula(self):
        # RRF(d) = 1/(60+1) for rank 1
        expected = 1.0 / (60 + 1)
        assert self._rrf_score([1]) == pytest.approx(expected)

    def test_scores_decrease_with_rank(self):
        scores = [self._rrf_score([r]) for r in range(1, 11)]
        assert scores == sorted(scores, reverse=True)


# ── Query Expansion Cache Key ─────────────────────────────────────────────────

class TestQueryExpansionCacheKey:
    def test_same_query_same_key(self):
        import hashlib
        q = "invoice from ACME"
        k1 = f"qex:{hashlib.md5(q.encode()).hexdigest()[:12]}"
        k2 = f"qex:{hashlib.md5(q.encode()).hexdigest()[:12]}"
        assert k1 == k2

    def test_different_queries_different_keys(self):
        import hashlib
        k1 = f"qex:{hashlib.md5(b'query1').hexdigest()[:12]}"
        k2 = f"qex:{hashlib.md5(b'query2').hexdigest()[:12]}"
        assert k1 != k2

    def test_short_query_not_expanded(self):
        from app.routes.search import expand_query
        # Short queries (< 3 chars) should return as-is
        result = expand_query("ab")
        assert result == ["ab"]


# ── Query Expansion Routes & Integration ──────────────────────────────────────

class TestQueryExpansionRoutes:
    def test_expand_query_endpoint(self, client, auth_headers):
        response = client.post("/api/search/expand", json={"query": "titanium purchase order"}, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["original_query"] == "titanium purchase order"
        assert isinstance(data["expanded_queries"], list)
        assert isinstance(data["expansions"], list)
        assert len(data["expanded_queries"]) >= 1
        assert "titanium purchase order" in data["expanded_queries"]
        assert "titanium purchase order" in data["expansions"]

    def test_expand_query_endpoint_empty(self, client, auth_headers):
        response = client.post("/api/search/expand", json={"query": "  "}, headers=auth_headers)
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data

    def test_search_endpoint_with_expand_flag(self, client, auth_headers):
        res_false = client.get("/api/search?query=invoice&expand=false", headers=auth_headers)
        assert res_false.status_code == 200
        assert isinstance(res_false.json(), list)

        res_true = client.get("/api/search?query=invoice&expand=true", headers=auth_headers)
        assert res_true.status_code == 200
        assert isinstance(res_true.json(), list)

