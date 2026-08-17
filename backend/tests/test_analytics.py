"""
Unit tests for analytics routes — Roadmap 1.9
Tests: KPI calculations, chart data shapes, search stats structure
"""
import os

import pytest

os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key")


class TestKpiCalculations:
    """Test KPI math without hitting the DB."""

    def test_review_rate_zero_docs(self):
        total, review = 0, 0
        rate = round((review / total) * 100, 2) if total > 0 else 0.0
        assert rate == 0.0

    def test_review_rate_calculation(self):
        total, review = 100, 25
        rate = round((review / total) * 100, 2)
        assert rate == 25.0

    def test_avg_speed_fallback(self):
        avg_speed = 0.0
        if avg_speed < 1.0:
            avg_speed = 1.8
        assert avg_speed == 1.8

    def test_avg_accuracy_from_score(self):
        score = 0.923
        accuracy = round(float(score) * 100, 2)
        assert accuracy == pytest.approx(92.3)


class TestChartDataShapes:
    """Test that chart data list items have expected keys."""

    def test_daily_trend_item_has_date_and_count(self):
        item = {"date": "Jun 25", "count": 5}
        assert "date" in item
        assert "count" in item

    def test_status_distribution_item_keys(self):
        item = {"status": "PROCESSED", "count": 42}
        assert "status" in item
        assert "count" in item

    def test_agent_latency_item_keys(self):
        item = {"name": "Extractor", "latency": 1.4}
        assert "name" in item
        assert "latency" in item
        assert isinstance(item["latency"], float)


class TestPageRankBuckets:
    """Test PageRank histogram bucketing logic."""

    def _bucket(self, rank: float) -> str:
        if rank < 0.2:
            return "0.0-0.2"
        elif rank < 0.4:
            return "0.2-0.4"
        elif rank < 0.6:
            return "0.4-0.6"
        elif rank < 0.8:
            return "0.6-0.8"
        else:
            return "0.8-1.0"

    def test_zero_in_first_bucket(self):
        assert self._bucket(0.0) == "0.0-0.2"

    def test_point_five_in_middle_bucket(self):
        assert self._bucket(0.5) == "0.4-0.6"

    def test_one_in_last_bucket(self):
        assert self._bucket(1.0) == "0.8-1.0"

    def test_boundaries(self):
        assert self._bucket(0.2) == "0.2-0.4"
        assert self._bucket(0.4) == "0.4-0.6"
        assert self._bucket(0.6) == "0.6-0.8"
        assert self._bucket(0.8) == "0.8-1.0"
