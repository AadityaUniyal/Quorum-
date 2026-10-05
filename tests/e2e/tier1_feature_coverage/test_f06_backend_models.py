"""
Tier 1 Feature Coverage: Feature 6 — Backend Model Alignment
Verifies that Document SQLAlchemy model in backend/app/models/document.py
contains `vendor_name` and `total_amount` columns and supports database persistence and queries.
"""

import uuid
import pytest
from sqlalchemy.orm import Session
from app.models.document import Document, DocumentCategory, DocumentStatus


@pytest.mark.tier(1)
@pytest.mark.feature(6)
@pytest.mark.milestone("M2")
class TestFeature06BackendModelAlignment:
    """Verifies that Document model columns and database mappings align with financial schema specifications."""

    def test_f06_01_document_model_has_vendor_name_attribute(self):
        """Verify Document model class defines vendor_name column."""
        assert hasattr(Document, "vendor_name"), "Document model must define 'vendor_name' attribute"

    def test_f06_02_document_model_has_total_amount_attribute(self):
        """Verify Document model class defines total_amount column."""
        assert hasattr(Document, "total_amount"), "Document model must define 'total_amount' attribute"

    def test_f06_03_persist_and_retrieve_document_with_vendor_and_amount(self, db_session: Session):
        """Verify saving a Document with vendor_name and total_amount stores and reloads values accurately."""
        doc_id = uuid.uuid4()
        doc = Document(
            id=doc_id,
            filename="Vendor_Invoice_981.pdf",
            file_path="/uploads/test_invoice.pdf",
            file_type="pdf",
            category=DocumentCategory.INVOICE,
            status=DocumentStatus.PROCESSED,
            vendor_name="Apex Global Logistics",
            total_amount=15750.80,
        )
        db_session.add(doc)
        db_session.commit()

        # Query back from database session
        loaded = db_session.query(Document).filter(Document.id == doc_id).first()
        assert loaded is not None
        assert loaded.vendor_name == "Apex Global Logistics"
        assert abs(loaded.total_amount - 15750.80) < 0.01

    def test_f06_04_spend_by_vendor_analytics_endpoint(self, client, admin_headers: dict, db_session: Session):
        """Verify GET /api/analytics/spend-by-vendor aggregates spend by vendor without SQL error."""
        doc = Document(
            id=uuid.uuid4(),
            filename="Test_Vendor_Doc.pdf",
            file_path="/uploads/test_vendor.pdf",
            file_type="pdf",
            category=DocumentCategory.INVOICE,
            status=DocumentStatus.PROCESSED,
            vendor_name="CrowdStrike Corp",
            total_amount=95000.0,
        )
        db_session.add(doc)
        db_session.commit()

        response = client.get("/api/analytics/spend-by-vendor", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        vendors = [item.get("vendor") for item in data]
        assert "CrowdStrike Corp" in vendors

    def test_f06_05_document_api_response_contains_financial_fields(self, client, admin_headers: dict, db_session: Session):
        """Verify GET /api/documents/:id serialization returns financial fields."""
        doc = Document(
            id=uuid.uuid4(),
            filename="Serialized_Invoice.pdf",
            file_path="/uploads/serialized.pdf",
            file_type="pdf",
            category=DocumentCategory.INVOICE,
            status=DocumentStatus.PROCESSED,
            vendor_name="SAP Systems LLC",
            total_amount=45000.0,
        )
        db_session.add(doc)
        db_session.commit()

        response = client.get(f"/api/documents/{doc.id}", headers=admin_headers)
        assert response.status_code == 200
        payload = response.json()
        assert payload.get("vendor_name") == "SAP Systems LLC"
        assert abs(payload.get("total_amount") - 45000.0) < 0.01
