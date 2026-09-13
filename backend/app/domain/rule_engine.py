"""
Polymorphic Business Rule Engine

Provides composable, typed validation rules for document domain contexts.
"""

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Any, Generic, TypeVar

from app.domain.value_objects import Money

logger = logging.getLogger(__name__)


class RuleStatus(StrEnum):
    PASS = "PASS"
    FAIL = "FAIL"
    WARNING = "WARNING"
    NOT_APPLICABLE = "NOT_APPLICABLE"


@dataclass(frozen=True)
class RuleResult:
    rule_name: str
    status: RuleStatus
    message: str
    score: float = 1.0
    field_keys: list[str] = field(default_factory=list)
    details: dict[str, Any] = field(default_factory=dict)


T = TypeVar("T")


class Rule(ABC, Generic[T]):
    """Abstract Rule Interface"""

    @property
    @abstractmethod
    def name(self) -> str:
        pass

    @abstractmethod
    def evaluate(self, context: T) -> RuleResult:
        pass


class InvoiceTotalRule(Rule[dict[str, Any]]):
    """
    Validates arithmetic invariant:
    subtotal + tax + shipping - discount == total_amount
    """

    @property
    def name(self) -> str:
        return "InvoiceTotalRule"

    def evaluate(self, context: dict[str, Any]) -> RuleResult:
        if "total_amount" not in context and "subtotal" not in context:
            return RuleResult(
                rule_name=self.name,
                status=RuleStatus.NOT_APPLICABLE,
                message="Invoice financial fields not present.",
                score=1.0
            )

        try:
            curr = str(context.get("currency", "USD")).upper()
            subtotal = Money.of(context.get("subtotal", 0), curr)
            tax = Money.of(context.get("tax", 0), curr)
            shipping = Money.of(context.get("shipping", 0), curr)
            discount = Money.of(context.get("discount", 0), curr)
            stated_total = Money.of(context.get("total_amount", 0), curr)

            calculated_total = subtotal + tax + shipping - discount
            diff = abs(calculated_total.amount - stated_total.amount)

            if diff <= Decimal("0.05"):
                return RuleResult(
                    rule_name=self.name,
                    status=RuleStatus.PASS,
                    message=f"Arithmetic match: {subtotal} + {tax} + {shipping} - {discount} == {stated_total}",
                    score=1.0,
                    field_keys=["subtotal", "tax", "shipping", "discount", "total_amount"],
                    details={"calculated": str(calculated_total), "stated": str(stated_total), "diff": str(diff)}
                )
            elif diff <= Decimal("1.00") or (stated_total.amount > 0 and (diff / stated_total.amount) < Decimal("0.01")):
                return RuleResult(
                    rule_name=self.name,
                    status=RuleStatus.WARNING,
                    message=f"Minor rounding variance: calculated {calculated_total} vs stated {stated_total} (diff: {diff})",
                    score=0.85,
                    field_keys=["subtotal", "tax", "shipping", "discount", "total_amount"],
                    details={"calculated": str(calculated_total), "stated": str(stated_total), "diff": str(diff)}
                )
            else:
                return RuleResult(
                    rule_name=self.name,
                    status=RuleStatus.FAIL,
                    message=f"Arithmetic mismatch: calculated {calculated_total} vs stated {stated_total} (diff: {diff})",
                    score=0.0,
                    field_keys=["subtotal", "tax", "shipping", "discount", "total_amount"],
                    details={"calculated": str(calculated_total), "stated": str(stated_total), "diff": str(diff)}
                )
        except Exception as e:
            return RuleResult(
                rule_name=self.name,
                status=RuleStatus.FAIL,
                message=f"Error evaluating invoice total rule: {e}",
                score=0.0,
                field_keys=["subtotal", "tax", "shipping", "discount", "total_amount"]
            )


class CurrencyValidationRule(Rule[dict[str, Any]]):
    """Validates that extracted currency code is a valid ISO 4217 3-letter code."""

    VALID_CURRENCIES = {
        "USD", "EUR", "GBP", "INR", "JPY", "CAD", "AUD", "CHF", "CNY", "SGD", "NZD", "AED", "SEK"
    }

    @property
    def name(self) -> str:
        return "CurrencyValidationRule"

    def evaluate(self, context: dict[str, Any]) -> RuleResult:
        currency = context.get("currency")
        if not currency:
            return RuleResult(
                rule_name=self.name,
                status=RuleStatus.NOT_APPLICABLE,
                message="No currency specified",
                score=1.0
            )
        curr_clean = str(currency).strip().upper()
        if curr_clean in self.VALID_CURRENCIES:
            return RuleResult(
                rule_name=self.name,
                status=RuleStatus.PASS,
                message=f"Valid currency code: {curr_clean}",
                score=1.0,
                field_keys=["currency"]
            )
        return RuleResult(
            rule_name=self.name,
            status=RuleStatus.WARNING,
            message=f"Unrecognized currency code: '{currency}'",
            score=0.5,
            field_keys=["currency"]
        )


class DateValidationRule(Rule[dict[str, Any]]):
    """Validates that due_date >= invoice_date / effective_date."""

    @property
    def name(self) -> str:
        return "DateValidationRule"

    def _parse_date(self, val: Any) -> date | None:
        if not val:
            return None
        if isinstance(val, date):
            return val
        if isinstance(val, datetime):
            return val.date()
        s = str(val).strip()
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d", "%d-%m-%Y"):
            try:
                return datetime.strptime(s, fmt).date()
            except ValueError:
                continue
        return None

    def evaluate(self, context: dict[str, Any]) -> RuleResult:
        issue_raw = context.get("invoice_date") or context.get("issue_date") or context.get("effective_date")
        due_raw = context.get("due_date") or context.get("expiry_date")

        if not issue_raw or not due_raw:
            return RuleResult(
                rule_name=self.name,
                status=RuleStatus.NOT_APPLICABLE,
                message="Dates not both present for comparison",
                score=1.0
            )

        d_issue = self._parse_date(issue_raw)
        d_due = self._parse_date(due_raw)

        if not d_issue or not d_due:
            return RuleResult(
                rule_name=self.name,
                status=RuleStatus.WARNING,
                message="Could not parse date formats reliably",
                score=0.7
            )

        if d_due >= d_issue:
            return RuleResult(
                rule_name=self.name,
                status=RuleStatus.PASS,
                message=f"Valid date sequence: issue ({d_issue}) <= due ({d_due})",
                score=1.0,
                field_keys=["invoice_date", "due_date"]
            )
        return RuleResult(
            rule_name=self.name,
            status=RuleStatus.FAIL,
            message=f"Due date ({d_due}) is before issue date ({d_issue})",
            score=0.0,
            field_keys=["invoice_date", "due_date"]
        )


class RuleEngine:
    """
    Executes a collection of polymorphic validation rules over a document context.
    """

    def __init__(self, rules: list[Rule[dict[str, Any]]] | None = None):
        self._rules: list[Rule[dict[str, Any]]] = rules or [
            InvoiceTotalRule(),
            CurrencyValidationRule(),
            DateValidationRule(),
        ]

    def add_rule(self, rule: Rule[dict[str, Any]]) -> None:
        self._rules.append(rule)

    def evaluate_all(self, context: dict[str, Any]) -> list[RuleResult]:
        results = []
        for rule in self._rules:
            try:
                res = rule.evaluate(context)
                results.append(res)
            except Exception as e:
                logger.error(f"Rule {rule.name} failed with unhandled exception: {e}")
                results.append(RuleResult(
                    rule_name=rule.name,
                    status=RuleStatus.FAIL,
                    message=f"Execution error: {e}",
                    score=0.0
                ))
        return results

    def is_valid(self, context: dict[str, Any]) -> tuple[bool, float, list[RuleResult]]:
        results = self.evaluate_all(context)
        active_results = [r for r in results if r.status != RuleStatus.NOT_APPLICABLE]
        if not active_results:
            return True, 1.0, results

        has_fail = any(r.status == RuleStatus.FAIL for r in active_results)
        scores = [r.score for r in active_results]
        avg_score = sum(scores) / len(scores) if scores else 1.0

        return (not has_fail and avg_score >= 0.80), round(avg_score, 3), results
