"""
Tier 1 Feature 6: Distributed Crawl Queue Test Suite.
Verifies RabbitMQ distributed crawl queue payload structure, task submission, worker deserialization, and status tracking.
"""

import sys
import unittest
from pathlib import Path

# Ensure workspace root is in sys.path
root_dir = Path(__file__).resolve().parents[3]
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from tests.e2e.tier1.test_f6_distributed_crawling import TestFeature6DistributedCrawling


class TestFeature6DistributedCrawlQueue(TestFeature6DistributedCrawling):
    """Test suite alias for Feature 6: Distributed Crawl Queue."""
    pass


if __name__ == "__main__":
    unittest.main()
