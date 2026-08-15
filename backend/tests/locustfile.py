from locust import HttpUser, task, between
import io

class GoogiUser(HttpUser):
    wait_time = between(1, 5)

    @task(4)
    def search_query(self):
        self.client.get("/api/search?query=ACME")

    @task(2)
    def upload_document(self):
        # Simulate uploading a small text document
        data = ("test.txt", io.BytesIO(b"sample invoice content"), "text/plain")
        self.client.post("/api/documents/upload", files={"file": data})

    @task(1)
    def review_heartbeat(self):
        # Placeholder IDs; in real load test these would be set dynamically
        doc_id = getattr(self, "doc_id", "placeholder")
        token = getattr(self, "lock_token", "placeholder")
        self.client.post(f"/api/review/{doc_id}/heartbeat?lock_token={token}")
