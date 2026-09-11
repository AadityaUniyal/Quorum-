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
            total = _parse_decimal(extracted_fields.get("total_amount", 0))

            calculated_total = subtotal + tax + shipping
            difference = abs(calculated_total - total)

            # Calculate the percentage delta relative to the stated total
            pct_delta = (difference / total) if total != Decimal("0") else Decimal("999.0")

            math_fields = ["subtotal", "tax", "shipping", "total_amount"]

            if difference <= Decimal("0.05"):
                # Perfect match (within penny rounding)
                success_msg = f"Audit Verified: {subtotal} + {tax} + {shipping} matches total of {total}"
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
            for f in ["subtotal", "tax", "shipping", "total_amount"]:
                if f in audits:
                    audits[f] = {
                        "score": 0.0,
                        "notes": err_msg
                    }

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

    return audits
