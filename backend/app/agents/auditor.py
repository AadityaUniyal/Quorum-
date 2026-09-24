import logging
import re
from decimal import Decimal, InvalidOperation
from typing import Any

from app.models.document import DocumentCategory

logger = logging.getLogger(__name__)

# Tolerance threshold: differences below 0.5% of the total are treated as minor rounding
TOLERANCE_THRESHOLD = Decimal("0.005")


def _parse_decimal(val: Any) -> Decimal:
    """Safely parse a string/numeric value into a Decimal, handling US/UK and European number formats."""
    if val is None:
        raise InvalidOperation("Value is None")
    s = str(val).strip()
    if not s:
        raise InvalidOperation("Value is empty")

    # If comma is decimal separator (e.g. 1.234,50 or 1234,50)
    if "," in s and ("." not in s or s.rfind(",") > s.rfind(".")):
        s = s.replace(".", "").replace(",", ".")

    s = re.sub(r"[^\d.-]", "", s)
    if not s or s in ("-", "."):
        raise InvalidOperation(f"Cannot parse decimal from '{val}'")
    return Decimal(s)


def run_auditor_agent(category: DocumentCategory, extracted_fields: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """
    Auditor Agent: Performs deterministic mathematical auditing and logical checks
    using high-precision Decimal arithmetic.
    Uses graduated scoring instead of binary pass/fail.
    Returns: { field_key: { "score": float, "notes": str } }
    """
    audits = {}

    # Pre-populate all fields with 1.0 (Passed audit)
    for key in extracted_fields.keys():
        audits[key] = {
            "score": 1.0,
            "notes": "Passed general logical audit."
        }

    # Perform category-specific mathematical audits
    if category == DocumentCategory.INVOICE:
        try:
            subtotal = _parse_decimal(extracted_fields.get("subtotal", 0))
            tax = _parse_decimal(extracted_fields.get("tax", 0))
            shipping = _parse_decimal(extracted_fields.get("shipping", 0))
            discount = Decimal("0")
            if "discount" in extracted_fields and extracted_fields["discount"]:
                try:
                    discount = _parse_decimal(extracted_fields["discount"])
                except (InvalidOperation, ValueError):
                    discount = Decimal("0")

            total = _parse_decimal(extracted_fields.get("total_amount", 0))

            calculated_total = subtotal + tax + shipping - discount
            difference = abs(calculated_total - total)

            # Calculate the percentage delta relative to the stated total
            pct_delta = (difference / total) if total != Decimal("0") else Decimal("999.0")

            math_fields = ["subtotal", "tax", "shipping", "discount", "total_amount"]

            if difference <= Decimal("0.05"):
                # Perfect match (within penny rounding)
                disc_str = f" - {discount}" if discount > Decimal("0") else ""
                success_msg = f"Audit Verified: {subtotal} + {tax} + {shipping}{disc_str} matches total of {total}"
                for f in math_fields:
                    if f in audits:
                        audits[f]["notes"] = success_msg
            elif pct_delta < TOLERANCE_THRESHOLD:
                # Minor rounding discrepancy (< 0.5% of total)
                warn_msg = (
                    f"WARNING: Minor rounding discrepancy — calculated {calculated_total:.2f} vs stated {total} "
                    f"(delta: ${difference:.2f}, {float(pct_delta):.3%} of total)"
                )
                logger.info(warn_msg)
                for f in math_fields:
                    if f in audits:
                        audits[f] = {"score": 0.95, "notes": warn_msg}
            elif pct_delta < Decimal("0.05"):
                # Moderate arithmetic error (< 5% of total)
                err_msg = (
                    f"ERROR: Moderate arithmetic discrepancy — calculated {calculated_total:.2f} vs stated {total} "
                    f"(delta: ${difference:.2f}, {float(pct_delta):.3%} of total)"
                )
                logger.warning(err_msg)
                for f in math_fields:
                    if f in audits:
                        audits[f] = {"score": 0.50, "notes": err_msg}
            else:
                # Severe arithmetic failure (>= 5% of total)
                crit_msg = (
                    f"CRITICAL: Major arithmetic failure — calculated {calculated_total:.2f} vs stated {total} "
                    f"(delta: ${difference:.2f}, {float(pct_delta):.3%} of total)"
                )
                logger.warning(crit_msg)
                for f in math_fields:
                    if f in audits:
                        audits[f] = {"score": 0.0, "notes": crit_msg}
        except (InvalidOperation, ValueError) as e:
            err_msg = f"Invalid numeric format for calculation: {str(e)}"
            for f in ["subtotal", "tax", "shipping", "discount", "total_amount"]:
                if f in audits:
                    audits[f] = {
                        "score": 0.0,
                        "notes": err_msg
                    }

    elif category == DocumentCategory.PURCHASE_ORDER:
        try:
            total = _parse_decimal(extracted_fields.get("total_amount", 0))
            subtotal = _parse_decimal(extracted_fields.get("subtotal", total))
            tax = _parse_decimal(extracted_fields.get("tax", 0)) if "tax" in extracted_fields else Decimal("0")
            shipping = _parse_decimal(extracted_fields.get("shipping", 0)) if "shipping" in extracted_fields else Decimal("0")
            discount = Decimal("0")
            if "discount" in extracted_fields and extracted_fields["discount"]:
                try:
                    discount = _parse_decimal(extracted_fields["discount"])
                except (InvalidOperation, ValueError):
                    discount = Decimal("0")

            calculated_total = subtotal + tax + shipping - discount
            difference = abs(calculated_total - total)
            pct_delta = (difference / total) if total != Decimal("0") else Decimal("0")
            po_math_fields = [f for f in ["subtotal", "tax", "shipping", "discount", "total_amount"] if f in audits]

            if difference <= Decimal("0.05"):
                for f in po_math_fields:
                    audits[f]["notes"] = f"PO arithmetic verified: {calculated_total} matches total of {total}"
            elif pct_delta < TOLERANCE_THRESHOLD:
                for f in po_math_fields:
                    audits[f] = {"score": 0.95, "notes": f"PO minor rounding variance: {float(pct_delta):.2%}"}
            elif pct_delta < Decimal("0.05"):
                for f in po_math_fields:
                    audits[f] = {"score": 0.50, "notes": f"PO arithmetic discrepancy: {float(pct_delta):.2%}"}
            else:
                for f in po_math_fields:
                    audits[f] = {"score": 0.0, "notes": f"PO arithmetic failure: {float(pct_delta):.2%}"}
        except (InvalidOperation, ValueError) as e:
            for f in ["subtotal", "total_amount"]:
                if f in audits:
                    audits[f] = {"score": 0.50, "notes": f"PO calculation note: {e}"}

    elif category == DocumentCategory.RFQ:
        # Verify quantity is a valid positive integer
        qty_str = str(extracted_fields.get("quantity", "0"))
        try:
            qty = int(qty_str)
            if qty <= 0:
                audits["quantity"] = {
                    "score": 0.0,
                    "notes": f"Quantity must be a positive integer, found: {qty}"
                }
            elif qty > 1_000_000:
                audits["quantity"] = {
                    "score": 0.75,
                    "notes": f"WARNING: Unusually large quantity ({qty:,}). Verify this is correct."
                }
            else:
                audits["quantity"] = {
                    "score": 1.0,
                    "notes": f"Quantity verified as positive integer: {qty}"
                }
        except ValueError:
            audits["quantity"] = {
                "score": 0.0,
                "notes": f"Failed to parse quantity as integer: {qty_str}"
            }

    # Audit line items table if present
    if "line_items" in extracted_fields and isinstance(extracted_fields["line_items"], list):
        items = extracted_fields["line_items"]
        if items:
            from app.services.local_engine import LocalTableReconstructor
            line_audits = LocalTableReconstructor.audit_line_items(items)
            all_valid = all(a.get("is_valid", False) for a in line_audits)
            if all_valid:
                audits["line_items"] = {
                    "score": 1.0,
                    "notes": f"All {len(items)} line item calculations verified (Qty x Unit Price == Total)."
                }
            else:
                invalid_cnt = sum(1 for a in line_audits if not a.get("is_valid", False))
                audits["line_items"] = {
                    "score": 0.50,
                    "notes": f"Line item arithmetic discrepancy detected in {invalid_cnt}/{len(items)} items."
                }
        else:
            audits["line_items"] = {
                "score": 1.0,
                "notes": "Passed general logical audit (no line items to calculate)."
            }

    return audits
