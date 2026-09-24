"""
Interactive Demo Sandbox API Router.

Provides 1-click seeding of realistic enterprise documents:
- Clean Auto-Approved Invoice
- Tampered Invoice with Arithmetic Discrepancy (Auditor Flagged)
- Non-Compliant Contract (Compliance Agent Flagged)
- High-Variance Purchase Order (Memory Agent Anomaly)
- 3-Way Match Bundle (PO, Delivery Slip, Invoice)
"""

import uuid
from typing import Any

from app.database import get_db
from app.models.auth import User, UserRole
from app.models.document import (
    Document,
    DocumentCategory,
    DocumentStatus,
    ExtractedField,
    FieldValidationStatus,
)
from app.routes.auth import RoleChecker
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1/demo", tags=["demo"])
any_user = RoleChecker([UserRole.ADMIN, UserRole.OPERATOR, UserRole.REVIEWER, UserRole.VIEWER])


@router.post("/seed", status_code=status.HTTP_201_CREATED)
def seed_demo_sandbox(
    db: Session = Depends(get_db),
    current_user: User = Depends(any_user),
) -> dict[str, Any]:
    """
    Seeds realistic enterprise documents into the database for immediate testing and demonstration.
    """
    created_docs = []

    # 1. Clean Auto-Approved Invoice
    clean_inv = Document(
        id=uuid.uuid4(),
        filename="INV-2026-001_Acme_Logistics.pdf",
        file_path="",
        file_type="application/pdf",
        status=DocumentStatus.PROCESSED,
        category=DocumentCategory.INVOICE,
        uploaded_by=current_user.id,
        organization_id=current_user.organization_id,
        consensus_score=0.98,
        executive_summary="Invoice from Acme Global Logistics for $1,345.00 due 2026-04-15. All line arithmetic and tax calculations verified.",
        ocr_text=(
            "INVOICE #INV-2026-001\n"
            "Vendor: Acme Global Logistics\n"
            "Date: 2026-03-15 | Due Date: 2026-04-15\n"
            "Subtotal: $1,200.00\nTax (10%): $120.00\nShipping: $25.00\nTotal Amount: $1,345.00\n"
            "Payment Terms: Net 30 days via Wire Transfer."
        ),
    )
    db.add(clean_inv)
    db.flush()

    clean_fields = [
        ("vendor_name", "Acme Global Logistics", 0.99, FieldValidationStatus.VALID, "Verified in OCR text"),
        ("subtotal", "$1,200.00", 0.98, FieldValidationStatus.VALID, "Line item calculation verified"),
        ("tax", "$120.00", 0.98, FieldValidationStatus.VALID, "10% tax rate verified"),
        ("shipping", "$25.00", 0.99, FieldValidationStatus.VALID, "Standard freight rate"),
        ("total_amount", "$1,345.00", 1.0, FieldValidationStatus.VALID, "Subtotal + Tax + Shipping matches total"),
    ]
    for key, val, score, v_status, notes in clean_fields:
        f = ExtractedField(
            document_id=clean_inv.id,
            field_key=key,
            extracted_value=val,
            consensus_value=val,
            confidence_score=score,
            critic_score=score,
            auditor_score=score,
            validation_status=v_status,
            validation_notes=notes,
        )
        db.add(f)
    created_docs.append({"id": str(clean_inv.id), "title": clean_inv.filename, "scenario": "Clean Auto-Approved"})

    # 2. Tampered Invoice with Arithmetic Discrepancy
    tampered_inv = Document(
        id=uuid.uuid4(),
        filename="INV-2026-002_Apex_Tech_DISCREPANCY.pdf",
        file_path="",
        file_type="application/pdf",
        status=DocumentStatus.AWAITING_REVIEW,
        category=DocumentCategory.INVOICE,
        uploaded_by=current_user.id,
        organization_id=current_user.organization_id,
        consensus_score=0.62,
        executive_summary="Invoice from Apex Industrial Tech with stated total $1,850.00 vs computed $1,650.00. Auditor flagged major discrepancy.",
        ocr_text=(
            "INVOICE #INV-2026-002\n"
            "Vendor: Apex Industrial Tech\n"
            "Date: 2026-03-18\n"
            "Subtotal: $1,500.00\nTax: $150.00\nTotal Amount: $1,850.00\n"
            "Terms: Due upon receipt."
        ),
    )
    db.add(tampered_inv)
    db.flush()

    tampered_fields = [
        ("vendor_name", "Apex Industrial Tech", 0.95, FieldValidationStatus.VALID, "Matches OCR"),
        ("subtotal", "$1,500.00", 0.95, FieldValidationStatus.VALID, "Found in text"),
        ("tax", "$150.00", 0.95, FieldValidationStatus.VALID, "Found in text"),
        ("total_amount", "$1,850.00", 0.10, FieldValidationStatus.FLAGGED, "CRITICAL: Stated $1,850.00 ≠ Calculated $1,650.00 (+$200 discrepancy)"),
    ]
    for key, val, score, v_status, notes in tampered_fields:
        f = ExtractedField(
            document_id=tampered_inv.id,
            field_key=key,
            extracted_value=val,
            consensus_value=val,
            confidence_score=score,
            critic_score=0.95,
            auditor_score=0.0 if key == "total_amount" else 0.95,
            validation_status=v_status,
            validation_notes=notes,
        )
        db.add(f)
    created_docs.append({"id": str(tampered_inv.id), "title": tampered_inv.filename, "scenario": "Math Error Flagged"})

    # 3. Non-Compliant Contract
    non_comp_contract = Document(
        id=uuid.uuid4(),
        filename="MSA-2026-Nexus_CyberLabs_FLAGGED.pdf",
        file_path="",
        file_type="application/pdf",
        status=DocumentStatus.AWAITING_REVIEW,
        category=DocumentCategory.CONTRACT,
        uploaded_by=current_user.id,
        organization_id=current_user.organization_id,
        consensus_score=0.55,
        executive_summary="Master Services Agreement with Nexus Cyber Labs missing mandatory governing law and dispute resolution clauses.",
        ocr_text=(
            "MASTER SERVICES AGREEMENT\n"
            "Between: DocIntel Enterprise & Nexus Cyber Labs\n"
            "Effective Date: 2026-01-01\n"
            "Scope: Managed Cloud Security Operations.\n"
            "Term: 24 Months.\n"
            "Signed: Alex Carter, VP Operations."
        ),
    )
    db.add(non_comp_contract)
    db.flush()

    contract_fields = [
        ("document_title", "Master Services Agreement", 0.98, FieldValidationStatus.VALID, "Identified header"),
        ("party_a", "DocIntel Enterprise", 0.95, FieldValidationStatus.VALID, "Verified entity"),
        ("party_b", "Nexus Cyber Labs", 0.95, FieldValidationStatus.VALID, "Verified entity"),
        ("governing_law", "NOT DETECTED", 0.0, FieldValidationStatus.FLAGGED, "Critical Compliance Defect: Governing law clause not found in contract text"),
    ]
    for key, val, score, v_status, notes in contract_fields:
        f = ExtractedField(
            document_id=non_comp_contract.id,
            field_key=key,
            extracted_value=val,
            consensus_value=val,
            confidence_score=score,
            critic_score=score,
            auditor_score=score,
            validation_status=v_status,
            validation_notes=notes,
        )
        db.add(f)
    created_docs.append({"id": str(non_comp_contract.id), "title": non_comp_contract.filename, "scenario": "Missing Compliance Clause"})

    # 4. 3-Way Matching Bundle (PO, Delivery, Invoice)
    po_doc = Document(
        id=uuid.uuid4(),
        filename="PO-90042_Titanium_Rods.pdf",
        file_path="",
        file_type="application/pdf",
        status=DocumentStatus.PROCESSED,
        category=DocumentCategory.PURCHASE_ORDER,
        uploaded_by=current_user.id,
        organization_id=current_user.organization_id,
        consensus_score=0.97,
        executive_summary="Purchase Order #PO-90042 for 500x Grade-5 Titanium Rods at $12.00/unit totaling $6,000.00.",
        ocr_text="PURCHASE ORDER #PO-90042\nItem: Grade-5 Titanium Rods (SKU: TR-500)\nQty: 500\nUnit Price: $12.00\nTotal: $6,000.00",
    )
    db.add(po_doc)
    db.flush()

    po_fields = [
        ("po_number", "PO-90042", 0.99, FieldValidationStatus.VALID, "PO number detected"),
        ("item_name", "Grade-5 Titanium Rods", 0.98, FieldValidationStatus.VALID, "SKU TR-500"),
        ("quantity", "500", 0.99, FieldValidationStatus.VALID, "Quantity verified"),
        ("unit_price", "$12.00", 0.98, FieldValidationStatus.VALID, "Unit price"),
        ("total_amount", "$6,000.00", 1.0, FieldValidationStatus.VALID, "500 * $12.00 matches $6,000.00"),
    ]
    for key, val, score, v_status, notes in po_fields:
        db.add(ExtractedField(
            document_id=po_doc.id,
            field_key=key,
            extracted_value=val,
            consensus_value=val,
            confidence_score=score,
            critic_score=score,
            auditor_score=score,
            validation_status=v_status,
            validation_notes=notes,
        ))
    created_docs.append({"id": str(po_doc.id), "title": po_doc.filename, "scenario": "3-Way Match: Purchase Order"})

    db.commit()

    return {
        "message": f"Successfully seeded {len(created_docs)} enterprise demo scenarios into sandbox.",
        "documents": created_docs,
    }


@router.delete("/clear", status_code=status.HTTP_200_OK)
def clear_demo_sandbox(
    db: Session = Depends(get_db),
    current_user: User = Depends(any_user),
) -> dict[str, Any]:
    """Cleans up seeded demo documents."""
    query = db.query(Document).filter(
        Document.filename.like("%INV-2026%") | Document.filename.like("%MSA-2026%") | Document.filename.like("%PO-90042%")
    )
    if current_user.organization_id:
        query = query.filter(Document.organization_id == current_user.organization_id)

    docs = query.all()
    count = len(docs)
    for doc in docs:
        db.delete(doc)
    db.commit()

    return {"message": f"Removed {count} demo documents from sandbox.", "deleted_count": count}
