"""
Immutable Domain Value Objects
"""

import re
import uuid
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation


@dataclass(frozen=True)
class DocumentId:
    value: uuid.UUID

    @classmethod
    def generate(cls) -> "DocumentId":
        return cls(uuid.uuid4())

    @classmethod
    def from_str(cls, val: str) -> "DocumentId":
        return cls(uuid.UUID(str(val)))

    def __str__(self) -> str:
        return str(self.value)


@dataclass(frozen=True)
class TenantId:
    value: uuid.UUID

    @classmethod
    def generate(cls) -> "TenantId":
        return cls(uuid.uuid4())

    @classmethod
    def from_str(cls, val: str) -> "TenantId":
        return cls(uuid.UUID(str(val)))

    def __str__(self) -> str:
        return str(self.value)


@dataclass(frozen=True)
class Money:
    amount: Decimal
    currency: str = "USD"

    def __post_init__(self):
        if not isinstance(self.amount, Decimal):
            try:
                object.__setattr__(self, "amount", Decimal(str(self.amount)))
            except (InvalidOperation, ValueError) as err:
                raise ValueError(f"Invalid monetary amount: {self.amount}") from err
        curr = self.currency.strip().upper()
        if len(curr) != 3:
            raise ValueError(f"Currency code must be a 3-letter ISO code: '{curr}'")
        object.__setattr__(self, "currency", curr)

    @classmethod
    def of(cls, amount: float | int | str | Decimal, currency: str = "USD") -> "Money":
        clean_amount = re.sub(r"[^\d.-]", "", str(amount)) if isinstance(amount, str) else amount
        return cls(amount=Decimal(str(clean_amount)), currency=currency)

    def __add__(self, other: "Money") -> "Money":
        if self.currency != other.currency:
            raise ValueError(f"Cannot add different currencies: {self.currency} and {other.currency}")
        return Money(amount=self.amount + other.amount, currency=self.currency)

    def __sub__(self, other: "Money") -> "Money":
        if self.currency != other.currency:
            raise ValueError(f"Cannot subtract different currencies: {self.currency} and {other.currency}")
        return Money(amount=self.amount - other.amount, currency=self.currency)

    def __mul__(self, factor: int | float | Decimal) -> "Money":
        return Money(amount=self.amount * Decimal(str(factor)), currency=self.currency)

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Money):
            return False
        return self.amount == other.amount and self.currency == other.currency

    def __lt__(self, other: "Money") -> bool:
        if self.currency != other.currency:
            raise ValueError(f"Cannot compare different currencies: {self.currency} and {other.currency}")
        return self.amount < other.amount

    def __le__(self, other: "Money") -> bool:
        return self < other or self == other

    def __gt__(self, other: "Money") -> bool:
        if self.currency != other.currency:
            raise ValueError(f"Cannot compare different currencies: {self.currency} and {other.currency}")
        return self.amount > other.amount

    def __ge__(self, other: "Money") -> bool:
        return self > other or self == other

    def __str__(self) -> str:
        return f"{self.amount:.2f} {self.currency}"


@dataclass(frozen=True)
class ConfidenceScore:
    value: float

    def __post_init__(self):
        val = float(self.value)
        if not (0.0 <= val <= 1.0):
            raise ValueError(f"Confidence score must be between 0.0 and 1.0, got: {val}")
        object.__setattr__(self, "value", round(val, 4))

    def is_high_confidence(self, threshold: float = 0.85) -> bool:
        return self.value >= threshold

    def is_flagged(self, threshold: float = 0.60) -> bool:
        return self.value < threshold

    def __str__(self) -> str:
        return f"{self.value:.2%}"


@dataclass(frozen=True)
class DocumentHash:
    value: str

    def __post_init__(self):
        val = self.value.strip().lower()
        if not re.fullmatch(r"^[a-f0-9]{64}$", val):
            raise ValueError(f"Invalid SHA-256 document hash: '{self.value}'")
        object.__setattr__(self, "value", val)

    def __str__(self) -> str:
        return self.value
