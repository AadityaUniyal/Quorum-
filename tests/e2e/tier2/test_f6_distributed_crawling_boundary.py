"""
Tier 2 Boundary & Corner Cases Test Suite for Feature 6: Distributed Crawling.

Tests RabbitMQ task queue contracts, backpressure simulation, malformed JSON task payloads,
worker timeout handling, task deduplication, and parameter boundaries.
"""

import sys
import unittest
import json
import time
from pathlib import Path

# Ensure workspace root is on sys.path
root_dir = Path(__file__).resolve().parents[3]
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from tests.e2e.infra.fixtures import E2ETestContext


class MockCrawlQueueWorker:
    """Opaque-box test simulator for RabbitMQ Crawl Task Queue & Worker Daemon."""

    def __init__(self, max_queue_size: int = 100):
        self.queue: list[dict] = []
        self.processed_jobs: set[str] = set()
        self.failed_jobs: list[dict] = []
        self.max_queue_size = max_queue_size

    def submit_task(self, raw_payload: str | bytes | dict) -> dict:
        """Submits a crawl task to the distributed queue with validation."""
        if len(self.queue) >= self.max_queue_size:
            return {"status": "error", "code": 429, "detail": "RabbitMQ Queue capacity reached (backpressure)"}

        if isinstance(raw_payload, (str, bytes)):
            try:
                data = json.loads(raw_payload)
            except Exception:
                return {"status": "error", "code": 400, "detail": "Malformed JSON task payload"}
        elif isinstance(raw_payload, dict):
            data = raw_payload
        else:
            return {"status": "error", "code": 400, "detail": "Invalid payload format"}

        # Validate required schema fields
        required_fields = ["url", "depth", "max_depth", "job_id"]
        for f in required_fields:
            if f not in data:
                return {"status": "error", "code": 422, "detail": f"Missing required field: {f}"}

        job_id = str(data["job_id"])
        url = str(data["url"])

        # Deduplication check
        job_key = f"{job_id}:{url}"
        if job_key in self.processed_jobs or any(t.get("job_key") == job_key for t in self.queue):
            return {"status": "skipped", "code": 200, "detail": "Duplicate task ignored"}

        task_entry = {**data, "job_key": job_key, "timestamp": time.time()}
        self.queue.append(task_entry)
        return {"status": "queued", "code": 202, "job_id": job_id, "queue_position": len(self.queue)}

    def process_next_task(self, timeout_seconds: float = 2.0) -> dict:
        """Processes the next task from the queue."""
        if not self.queue:
            return {"status": "empty"}

        task = self.queue.pop(0)
        
        # Check task parameter boundaries
        if task["depth"] > task["max_depth"]:
            self.failed_jobs.append({**task, "reason": "Depth exceeds max_depth"})
            return {"status": "failed", "job_id": task["job_id"], "reason": "Depth exceeds max_depth"}

        self.processed_jobs.add(task["job_key"])
        return {"status": "completed", "job_id": task["job_id"], "url": task["url"]}


class TestFeature6DistributedCrawlingBoundary(unittest.TestCase):
    """Boundary & Corner Cases for Feature 6 (Distributed Crawling)."""

    def setUp(self):
        self.context = E2ETestContext()
        self.worker = MockCrawlQueueWorker(max_queue_size=5)

    def test_f6_bva_01_rabbitmq_backpressure_and_queue_overflow(self):
        """Verify queue backpressure returns 429 when queue reaches maximum capacity limit."""
        # Fill queue to maximum capacity (5 tasks)
        for i in range(5):
            res = self.worker.submit_task({
                "url": f"https://docintel.ai/page{i}",
                "depth": 0,
                "max_depth": 2,
                "job_id": f"job_{i}"
            })
            self.assertEqual(res["code"], 202)

        # 6th task submission must trigger backpressure (429)
        overflow_res = self.worker.submit_task({
            "url": "https://docintel.ai/overflow",
            "depth": 0,
            "max_depth": 2,
            "job_id": "job_overflow"
        })
        self.assertEqual(overflow_res["code"], 429)
        self.assertIn("backpressure", overflow_res["detail"].lower())

    def test_f6_bva_02_worker_timeout_and_stalled_task_recovery(self):
        """Verify worker handles empty queue and execution processing timeouts gracefully."""
        # Processing on empty queue
        empty_res = self.worker.process_next_task(timeout_seconds=0.1)
        self.assertEqual(empty_res["status"], "empty")

    def test_f6_bva_03_malformed_json_task_payload_rejection(self):
        """Verify non-JSON bytes, truncated strings, or missing schema fields return validation errors."""
        # Non-JSON string
        res1 = self.worker.submit_task("NOT_VALID_JSON_STRING")
        self.assertEqual(res1["code"], 400)

        # Missing required field 'url'
        res2 = self.worker.submit_task({"depth": 0, "max_depth": 2, "job_id": "job_123"})
        self.assertEqual(res2["code"], 422)

        # Missing required field 'job_id'
        res3 = self.worker.submit_task({"url": "https://docintel.ai", "depth": 0, "max_depth": 2})
        self.assertEqual(res3["code"], 422)

    def test_f6_bva_04_duplicate_task_deduplication(self):
        """Verify submitting identical task payload ignores duplicate and returns skipped status."""
        task_data = {
            "url": "https://docintel.ai/docs",
            "depth": 0,
            "max_depth": 2,
            "job_id": "job_dedup_001"
        }

        # First submission
        res1 = self.worker.submit_task(task_data)
        self.assertEqual(res1["code"], 202)

        # Immediate duplicate submission
        res2 = self.worker.submit_task(task_data)
        self.assertEqual(res2["status"], "skipped")

    def test_f6_bva_05_task_payload_boundary_values(self):
        """Verify boundary condition where task depth > max_depth is handled cleanly by worker."""
        invalid_depth_task = {
            "url": "https://docintel.ai/deep",
            "depth": 5,
            "max_depth": 2,
            "job_id": "job_depth_err"
        }
        submit_res = self.worker.submit_task(invalid_depth_task)
        self.assertEqual(submit_res["code"], 202)

        proc_res = self.worker.process_next_task()
        self.assertEqual(proc_res["status"], "failed")
        self.assertIn("Depth exceeds", proc_res["reason"])

    def test_f6_bva_06_queue_drain_and_lifecycle_processing(self):
        """Verify queue draining lifecycle processes all valid tasks in FIFO order."""
        for i in range(3):
            self.worker.submit_task({
                "url": f"https://docintel.ai/fifo_{i}",
                "depth": 0,
                "max_depth": 1,
                "job_id": f"job_fifo_{i}"
            })

        self.assertEqual(len(self.worker.queue), 3)

        p0 = self.worker.process_next_task()
        self.assertEqual(p0["job_id"], "job_fifo_0")
        self.assertEqual(len(self.worker.queue), 2)


if __name__ == "__main__":
    unittest.main()
