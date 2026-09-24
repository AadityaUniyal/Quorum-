"""
Integration tests for FastAPI API routes:
- Health check endpoints
- Metrics endpoint
- Authentication security gates
"""

from fastapi import status


def test_health_root(client):
    """Verify root health endpoint returns 200 and healthy status."""
    response = client.get("/")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["status"] == "healthy"


def test_health_liveness(client):
    """Verify Kubernetes liveness probe returns 200 OK."""
    response = client.get("/health/live")
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["status"] == "alive"


def test_metrics_endpoint(client):
    """Verify Prometheus metrics collector endpoint returns system telemetry."""
    response = client.get("/metrics")
    assert response.status_code == status.HTTP_200_OK
    assert "googi_http_requests_total" in response.text


def test_protected_route_requires_auth(client):
    """Verify documents API blocks unauthenticated access with 401 Unauthorized."""
    response = client.get("/api/documents")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_authenticated_document_list(client, test_admin_user):
    """Verify authenticated admin can list documents."""
    response = client.get("/api/documents", headers=test_admin_user["headers"])
    assert response.status_code == status.HTTP_200_OK
    assert isinstance(response.json(), list)


def test_seed_demo_sandbox(client, test_admin_user):
    """Verify 1-click demo sandbox seeds enterprise benchmark documents."""
    response = client.post("/api/v1/demo/seed", headers=test_admin_user["headers"])
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert "Successfully seeded" in data["message"]
    assert len(data["documents"]) >= 4


def test_benchmarks_endpoint(client):
    """Verify public benchmark observatory returns empirical evaluation metrics."""
    response = client.get("/api/v1/benchmarks/latest")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "metrics" in data
    assert "competitor_comparison" in data
    assert data["metrics"]["math_rule_accuracy"] == 100.0


def test_batch_upload_documents(client, test_admin_user):
    """Verify batch document upload processes multiple files in single payload."""
    files = [
        ("files", ("invoice_batch_1.txt", b"INVOICE #9988\nTotal: $120.00\nVendor: Acme Corp", "text/plain")),
        ("files", ("po_batch_2.txt", b"PURCHASE ORDER #4433\nTotal: $450.00\nBuyer: Global Corp", "text/plain")),
    ]
    response = client.post("/api/documents/batch-upload", files=files, headers=test_admin_user["headers"])
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["total"] == 2
    assert data["successful"] == 2
    assert len(data["items"]) == 2
    assert data["items"][0]["status"] in ["INGESTED", "PROCESSED", "AWAITING_REVIEW"]


def test_document_export_formats(client, test_admin_user):
    """Verify document ERP exports for QuickBooks, Xero, SAP, and Universal JSON."""
    # Seed demo to ensure populated fields
    seed_res = client.post("/api/v1/demo/seed", headers=test_admin_user["headers"])
    assert seed_res.status_code == status.HTTP_201_CREATED
    doc_id = seed_res.json()["documents"][0]["id"]

    # Test QuickBooks JSON
    qb_res = client.get(f"/api/documents/{doc_id}/export/quickbooks", headers=test_admin_user["headers"])
    assert qb_res.status_code == status.HTTP_200_OK
    qb_data = qb_res.json()
    assert "Bill" in qb_data

    # Test Xero XML
    xero_res = client.get(f"/api/documents/{doc_id}/export/xero", headers=test_admin_user["headers"])
    assert xero_res.status_code == status.HTTP_200_OK
    assert "xml_payload" in xero_res.json()
    assert "<Invoice>" in xero_res.json()["xml_payload"]

    # Test SAP CSV
    sap_res = client.get(f"/api/documents/{doc_id}/export/sap", headers=test_admin_user["headers"])
    assert sap_res.status_code == status.HTTP_200_OK
    assert "csv_payload" in sap_res.json()
    assert "RecordType" in sap_res.json()["csv_payload"]

    # Test Universal JSON
    univ_res = client.get(f"/api/documents/{doc_id}/export/universal", headers=test_admin_user["headers"])
    assert univ_res.status_code == status.HTTP_200_OK
    assert "universal_schema_version" in univ_res.json()

