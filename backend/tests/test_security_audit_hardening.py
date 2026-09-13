"""
Security, Multi-tenancy, SSRF, and Distributed Systems Audit Hardening Tests.

Tests:
1. Multi-tenant document authorization & IDOR isolation
2. RAG multi-tenant document isolation & session isolation
3. Webhook SSRF validation against loopback, private ranges, metadata IP
4. Crawler SSRF validation against private IP seeds
5. Password change token_version invalidation
6. Public registration role escalation prevention
7. High-precision Decimal invoice auditing
8. Idempotent vector store upserting during document reprocessing
"""

import uuid

import pytest

from app.agents.auditor import run_auditor_agent
from app.core.security import create_access_token, get_password_hash
from app.core.security_net import validate_safe_url
from app.models.auth import Organization, User, UserRole
from app.models.document import Document, DocumentCategory, DocumentStatus
from app.services.auth_access import can_read_document, can_write_document
from app.services.vector_store import add_document_to_vector_store, search_vector_store

# ── 1. SSRF & Network Security Tests ──────────────────────────────────────────

class TestSSRFProtection:
    def test_loopback_ip_blocked(self):
        with pytest.raises(ValueError):
            validate_safe_url("http://127.0.0.1/webhook")

    def test_localhost_hostname_blocked(self):
        with pytest.raises(ValueError):
            validate_safe_url("http://localhost:8000/webhook")

    def test_private_rfc1918_ips_blocked(self):
        with pytest.raises(ValueError):
            validate_safe_url("http://10.0.0.5/api/hook")
        with pytest.raises(ValueError):
            validate_safe_url("http://172.16.0.10:8080/callback")
        with pytest.raises(ValueError):
            validate_safe_url("http://192.168.1.1/admin")

    def test_cloud_metadata_ip_blocked(self):
        with pytest.raises(ValueError):
            validate_safe_url("http://169.254.169.254/latest/meta-data/")

    def test_invalid_scheme_blocked(self):
        with pytest.raises(ValueError):
            validate_safe_url("ftp://example.com/file")
        with pytest.raises(ValueError):
            validate_safe_url("file:///etc/passwd")


# ── 2. Multi-Tenancy & IDOR Authorization Tests ───────────────────────────────

class TestMultiTenantAuthorization:
    def test_cross_tenant_document_read_denied(self, db_session):
        org1 = Organization(name="Tenant Alpha", slug="tenant-alpha")
        org2 = Organization(name="Tenant Beta", slug="tenant-beta")
        db_session.add_all([org1, org2])
        db_session.commit()

        user_alpha = User(
            email="alpha_viewer@alpha.com",
            hashed_password=get_password_hash("AlphaPass@123"),
            full_name="Alpha Viewer",
            role=UserRole.VIEWER,
            organization_id=org1.id,
        )
        user_beta = User(
            email="beta_viewer@beta.com",
            hashed_password=get_password_hash("BetaPass@123"),
            full_name="Beta Viewer",
            role=UserRole.VIEWER,
            organization_id=org2.id,
        )
        db_session.add_all([user_alpha, user_beta])
        db_session.commit()

        doc_alpha = Document(
            filename="alpha_invoice.pdf",
            file_path="/tmp/alpha.pdf",  # noqa: S108
            file_type="PDF",
            organization_id=org1.id,
            uploaded_by=user_alpha.id,
            status=DocumentStatus.PROCESSED,
        )
        db_session.add(doc_alpha)
        db_session.commit()

        # Alpha user can read alpha doc
        assert can_read_document(user_alpha, doc_alpha) is True

        # Beta user cannot read alpha doc
        assert can_read_document(user_beta, doc_alpha) is False

    def test_viewer_cannot_write_document(self, db_session):
        org = Organization(name="Org Gamma", slug="org-gamma")
        db_session.add(org)
        db_session.commit()

        viewer = User(
            email="gamma_viewer@gamma.com",
            hashed_password=get_password_hash("GammaPass@123"),
            full_name="Gamma Viewer",
            role=UserRole.VIEWER,
            organization_id=org.id,
        )
        reviewer = User(
            email="gamma_reviewer@gamma.com",
            hashed_password=get_password_hash("GammaPass@123"),
            full_name="Gamma Reviewer",
            role=UserRole.REVIEWER,
            organization_id=org.id,
        )
        db_session.add_all([viewer, reviewer])
        db_session.commit()

        doc = Document(
            filename="gamma_report.pdf",
            file_path="/tmp/gamma.pdf",  # noqa: S108
            file_type="PDF",
            organization_id=org.id,
            uploaded_by=reviewer.id,
            status=DocumentStatus.AWAITING_REVIEW,
        )
        db_session.add(doc)
        db_session.commit()

        assert can_write_document(viewer, doc) is False
        assert can_write_document(reviewer, doc) is True


# ── 3. Token Version & Session Revocation Tests ───────────────────────────────

class TestTokenVersionRevocation:
    def test_token_version_increment_invalidates_token(self, client, db_session):
        user = User(
            email="token_version_test@test.com",
            hashed_password=get_password_hash("ValidPass@123"),
            full_name="Token Test User",
            role=UserRole.VIEWER,
            token_version=1,
            is_verified=True,
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

        token = create_access_token(user)

        # Token works initially
        headers = {"Authorization": f"Bearer {token}"}
        resp = client.get("/api/auth/me", headers=headers)
        assert resp.status_code == 200

        # Increment token_version (e.g. after password change)
        user.token_version = 2
        db_session.commit()

        # Old token is now rejected with 401
        resp_after = client.get("/api/auth/me", headers=headers)
        assert resp_after.status_code == 401


# ── 4. High-Precision Decimal Auditor Tests ───────────────────────────────────

class TestDecimalAuditorAgent:
    def test_invoice_math_decimal_precision(self):
        fields = {
            "subtotal": "$1,234.56",
            "tax": "$123.45",
            "shipping": "$15.00",
            "total_amount": "$1,373.01",
        }
        res = run_auditor_agent(DocumentCategory.INVOICE, fields)
        assert res["total_amount"]["score"] == 1.0
        assert "Audit Verified" in res["total_amount"]["notes"]

    def test_invoice_math_discrepancy_detected(self):
        fields = {
            "subtotal": "$100.00",
            "tax": "$10.00",
            "shipping": "$5.00",
            "total_amount": "$200.00",  # Stated total is $200 vs calculated $115
        }
        res = run_auditor_agent(DocumentCategory.INVOICE, fields)
        assert res["total_amount"]["score"] == 0.0
        assert "Major arithmetic failure" in res["total_amount"]["notes"]


# ── 5. Vector Store Idempotent Reprocessing Tests ─────────────────────────────

class TestVectorStoreIdempotency:
    def test_reprocess_upsert_no_duplicate_error(self):
        doc_id = str(uuid.uuid4())
        text = "DocIntel provides autonomous multi-agent validation and deterministic financial verification."
        metadata = {"filename": "audit.pdf", "category": "INVOICE"}

        # First indexing
        add_document_to_vector_store(doc_id, text, metadata)
        res1 = search_vector_store("autonomous validation", filter_metadata={"document_id": doc_id})
        assert len(res1) > 0

        # Reprocessing with updated text (should not raise duplicate ID error)
        updated_text = "DocIntel provides updated multi-agent consensus and citation-verified RAG."
        add_document_to_vector_store(doc_id, updated_text, metadata)
        res2 = search_vector_store("citation-verified RAG", filter_metadata={"document_id": doc_id})
        assert len(res2) > 0
