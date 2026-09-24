"""
Reconciliation API routes for Enterprise 3-Way Cross-Document Matching.
"""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.auth import User, UserRole
from app.models.document import Document
from app.routes.auth import RoleChecker
from app.services.auth_access import require_document_read
from app.services.reconciliation_3way import ThreeWayReconciliationEngine

router = APIRouter(prefix="/api/v1/reconciliation", tags=["reconciliation"])

operator_or_admin = RoleChecker([UserRole.ADMIN, UserRole.REVIEWER, UserRole.OPERATOR])


class ThreeWayPayloadRequest(BaseModel):
    po_document_id: UUID | None = None
    delivery_document_id: UUID | None = None
    invoice_document_id: UUID | None = None
    tolerance_pct: float = Field(default=0.5, description="Allowed price variance tolerance percentage")
    # Alternatively provide inline JSON payloads:
    po_data: dict[str, Any] | None = None
    delivery_data: dict[str, Any] | None = None
    invoice_data: dict[str, Any] | None = None


def _doc_to_payload(doc: Document) -> dict[str, Any]:
    """Extracts structured line items and totals from document fields."""
    import json
    items = []
    total_val = None
    doc_id = str(doc.id)

    item_name = None
    item_qty = None
    item_price = None

    # Inspect extracted fields
    for field in doc.fields:
        val = field.consensus_value or field.extracted_value or ""
        clean_str = val.replace("$", "").replace(",", "").strip()

        if field.field_key == "total_amount":
            try:
                total_val = float(clean_str)
            except ValueError:
                pass
        elif field.field_key == "line_items":
            try:
                parsed = json.loads(val)
                if isinstance(parsed, list):
                    items.extend(parsed)
            except Exception:
                pass
        elif field.field_key in ("item_name", "description", "part_name"):
            item_name = val
        elif field.field_key in ("quantity", "qty"):
            try:
                item_qty = float(clean_str)
            except ValueError:
                pass
        elif field.field_key in ("unit_price", "price"):
            try:
                item_price = float(clean_str)
            except ValueError:
                pass

    if not items and item_name:
        items.append({
            "name": item_name,
            "qty": item_qty or 1.0,
            "unit_price": item_price or total_val or 0.0,
            "total": (item_qty or 1.0) * (item_price or total_val or 0.0),
        })

    return {
        "document_id": doc_id,
        "filename": doc.filename,
        "items": items,
        "total_amount": total_val,
    }


@router.post("/3way", status_code=status.HTTP_200_OK)
def perform_3way_reconciliation(
    req: ThreeWayPayloadRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(operator_or_admin),
):
    """
    Executes a 3-way cross-document reconciliation between PO, Delivery Slip, and Invoice.
    Accepts either document IDs or direct structured payload dicts.
    """
    po_dict = req.po_data or {}
    dn_dict = req.delivery_data or {}
    inv_dict = req.invoice_data or {}

    # If document IDs are provided, load from database with multi-tenant permission check
    if req.po_document_id:
        doc = db.query(Document).filter(Document.id == req.po_document_id).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Purchase Order document not found")
        require_document_read(current_user, doc)
        po_dict = _doc_to_payload(doc)

    if req.delivery_document_id:
        doc = db.query(Document).filter(Document.id == req.delivery_document_id).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Delivery Slip document not found")
        require_document_read(current_user, doc)
        dn_dict = _doc_to_payload(doc)

    if req.invoice_document_id:
        doc = db.query(Document).filter(Document.id == req.invoice_document_id).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Invoice document not found")
        require_document_read(current_user, doc)
        inv_dict = _doc_to_payload(doc)

    engine = ThreeWayReconciliationEngine(price_tolerance_pct=req.tolerance_pct)
    report = engine.reconcile(po_dict, dn_dict, inv_dict)

    return {
        "po_reference": report.po_reference,
        "delivery_reference": report.delivery_reference,
        "invoice_reference": report.invoice_reference,
        "decision": report.decision.value,
        "total_po_amount": report.total_po_amount,
        "total_invoice_amount": report.total_invoice_amount,
        "net_variance": report.net_variance,
        "net_variance_pct": report.net_variance_pct,
        "items_matched": report.items_matched,
        "items_flagged": report.items_flagged,
        "line_details": report.line_details,
        "audit_trail": report.audit_trail,
    }
