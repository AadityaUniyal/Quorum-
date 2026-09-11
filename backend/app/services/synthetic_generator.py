"""
Synthetic Document & Anomaly Generator

Generates realistic benchmark documents with controlled anomalies (arithmetic errors,
date discrepancies, vendor mismatches) for continuous evaluation and testing.
"""

from dataclasses import dataclass
from decimal import Decimal
import random
from typing import Any


@dataclass
class SyntheticDocument:
    doc_type: str
    ocr_text: str
    ground_truth: dict[str, Any]
    has_anomaly: bool
    anomaly_type: str = "NONE"


class SyntheticDocumentGenerator:
    """
    Generates synthetic invoices and contracts with known ground truth and injected errors.
    """

    VENDORS = ["Acme Global Logistics", "Apex Industrial Tech", "Nexus Cyber Labs", "Global Trade Partners"]
    ITEMS = [
        ("Server Infrastructure Rack", Decimal("1200.00")),
        ("Enterprise Software License", Decimal("450.00")),
        ("Consulting Hours (Senior)", Decimal("150.00")),
        ("Managed Security Operations", Decimal("800.00")),
    ]

    @classmethod
    def generate_invoice(cls, inject_arithmetic_error: bool = False, invoice_num: int = 1001) -> SyntheticDocument:
        vendor = random.choice(cls.VENDORS)
        item1_name, item1_price = random.choice(cls.ITEMS)
        qty = random.randint(1, 4)
        subtotal = item1_price * qty
        tax = round(subtotal * Decimal("0.10"), 2)
        shipping = Decimal("25.00")
        correct_total = subtotal + tax + shipping

        stated_total = correct_total
        anomaly_type = "NONE"
        if inject_arithmetic_error:
            stated_total = correct_total + Decimal("150.00")
            anomaly_type = "ARITHMETIC_MISMATCH"

        ocr_text = f"""
        ============================================================
        INVOICE #{invoice_num}
        Vendor: {vendor}
        Date: 2026-03-15
        Due Date: 2026-04-15
        Currency: USD
        ------------------------------------------------------------
        Description: {item1_name}
        Qty: {qty}  Unit Price: ${item1_price:.2f}  Amount: ${subtotal:.2f}
        ------------------------------------------------------------
        Subtotal: ${subtotal:.2f}
        Tax (10%): ${tax:.2f}
        Shipping: ${shipping:.2f}
        TOTAL DUE: ${stated_total:.2f}
        ============================================================
        """

        ground_truth = {
            "invoice_number": f"INV-{invoice_num}",
            "vendor_name": vendor,
            "subtotal": str(subtotal),
            "tax": str(tax),
            "shipping": str(shipping),
            "total_amount": str(stated_total),
            "expected_correct_total": str(correct_total),
            "currency": "USD"
        }

        return SyntheticDocument(
            doc_type="INVOICE",
            ocr_text=ocr_text.strip(),
            ground_truth=ground_truth,
            has_anomaly=inject_arithmetic_error,
            anomaly_type=anomaly_type
        )
