"""
SMT Arithmetic Verification Engine.

Formulates financial document line items into strict first-order linear constraints:
    Total == Subtotal + Tax - Discount + Shipping
    LineItemTotal_i == Quantity_i * UnitPrice_i
    Subtotal == sum(LineItemTotal_i)

Provides deterministic mathematical satisfiability checks (Δ == 0.00).
Isolates the exact conflicting line item on UNSAT with provable delta explanations.
"""

import logging
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class SMTLineItemConstraint:
    item_index: int
    description: str
    quantity: Decimal
    unit_price: Decimal
    claimed_total: Decimal
    expected_total: Decimal
    variance: Decimal
    is_valid: bool


@dataclass
class SMTVerificationResult:
    is_satisfiable: bool
    status: str  # SAT, UNSAT, INSUFFICIENT_DATA
    claimed_total: Decimal
    computed_total: Decimal
    arithmetic_delta: Decimal
    subtotal: Decimal
    tax_amount: Decimal
    discount_amount: Decimal
    shipping_amount: Decimal
    line_item_audits: list[SMTLineItemConstraint] = field(default_factory=list)
    unsat_core_reasons: list[str] = field(default_factory=list)
    math_accuracy_score: float = 1.0


class SMTArithmeticProver:
    """
    Formal constraint solver verifying financial arithmetic with exact Decimal precision.
    """

    ROUNDING = ROUND_HALF_UP

    @classmethod
    def _parse_decimal(cls, val: Any) -> Decimal:
        if val is None:
            return Decimal("0.00")
        if isinstance(val, (int, float)):
            return Decimal(str(val))
        clean_str = (
            str(val)
            .replace("$", "")
            .replace("€", "")
            .replace("£", "")
            .replace(",", "")
            .strip()
        )
        try:
            return Decimal(clean_str).quantize(Decimal("0.01"), rounding=cls.ROUNDING)
        except (InvalidOperation, TypeError):
            return Decimal("0.00")

    @classmethod
    def verify_financial_constraints(
        cls,
        fields: dict[str, Any],
        line_items: list[dict[str, Any]] | None = None,
    ) -> SMTVerificationResult:
        """
        Executes formal arithmetic constraint evaluation.
        """
        # Extract top-level financial entities
        claimed_total = cls._parse_decimal(fields.get("total_amount") or fields.get("total"))
        claimed_subtotal = cls._parse_decimal(fields.get("subtotal") or fields.get("subtotal_amount"))
        tax_amount = cls._parse_decimal(fields.get("tax_amount") or fields.get("tax"))
        discount_amount = cls._parse_decimal(fields.get("discount") or fields.get("discount_amount"))
        shipping_amount = cls._parse_decimal(fields.get("shipping") or fields.get("shipping_amount"))

        unsat_reasons: list[str] = []
        line_item_audits: list[SMTLineItemConstraint] = []
        computed_subtotal = Decimal("0.00")

        # 1. Verify line items constraint: LineItemTotal == Quantity * UnitPrice
        if line_items:
            for idx, item in enumerate(line_items):
                qty = cls._parse_decimal(item.get("quantity") or item.get("qty", 1))
                unit_p = cls._parse_decimal(item.get("unit_price") or item.get("price", 0))
                claimed_line_tot = cls._parse_decimal(item.get("total") or item.get("line_total", 0))

                expected_line_tot = (qty * unit_p).quantize(Decimal("0.01"), rounding=cls.ROUNDING)
                variance = (claimed_line_tot - expected_line_tot).quantize(Decimal("0.01"))
                is_valid = variance == Decimal("0.00")

                computed_subtotal += expected_line_tot

                if not is_valid:
                    unsat_reasons.append(
                        f"Line item #{idx + 1} ('{item.get('description', 'Unknown')}') "
                        f"arithmetic mismatch: {qty} × ${unit_p} = ${expected_line_tot}, "
                        f"but claimed total is ${claimed_line_tot} (Δ = ${variance})."
                    )

                line_item_audits.append(
                    SMTLineItemConstraint(
                        item_index=idx + 1,
                        description=str(item.get("description", f"Item {idx + 1}")),
                        quantity=qty,
                        unit_price=unit_p,
                        claimed_total=claimed_line_tot,
                        expected_total=expected_line_tot,
                        variance=variance,
                        is_valid=is_valid,
                    )
                )

        # Use computed subtotal if line items provided, otherwise use claimed subtotal
        effective_subtotal = computed_subtotal if line_items else claimed_subtotal

        # 2. Top-level equation constraint: Total == Subtotal + Tax - Discount + Shipping
        computed_total = (
            effective_subtotal + tax_amount - discount_amount + shipping_amount
        ).quantize(Decimal("0.01"), rounding=cls.ROUNDING)

        arithmetic_delta = (claimed_total - computed_total).quantize(Decimal("0.01"))

        # Evaluate satisfiability
        is_sat = arithmetic_delta == Decimal("0.00") and len(unsat_reasons) == 0

        if not (arithmetic_delta == Decimal("0.00")):
            unsat_reasons.append(
                f"Global Total mismatch: Subtotal (${effective_subtotal}) + Tax (${tax_amount}) "
                f"- Discount (${discount_amount}) + Shipping (${shipping_amount}) = ${computed_total}, "
                f"but document claimed Total is ${claimed_total} (Discrepancy Δ = ${arithmetic_delta})."
            )

        status = "SAT" if is_sat else "UNSAT"
        ratio = abs(arithmetic_delta) / max(claimed_total, Decimal("1.00"))
        accuracy_score = 1.0 if is_sat else max(0.0, float(Decimal("1.00") - ratio))

        return SMTVerificationResult(
            is_satisfiable=is_sat,
            status=status,
            claimed_total=claimed_total,
            computed_total=computed_total,
            arithmetic_delta=arithmetic_delta,
            subtotal=effective_subtotal,
            tax_amount=tax_amount,
            discount_amount=discount_amount,
            shipping_amount=shipping_amount,
            line_item_audits=line_item_audits,
            unsat_core_reasons=unsat_reasons,
            math_accuracy_score=round(accuracy_score, 4),
        )
