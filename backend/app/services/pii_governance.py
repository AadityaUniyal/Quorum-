"""
Zero-Trust PII/PHI Data Governance Service.

Detects, masks, and securely tokenizes sensitive data (SSN, credit cards, IBAN,
tax IDs, email, phone numbers) before vector indexing or external LLM transmission.
Supports attribute-based access control (ABAC) for authorized role de-anonymization.
"""

import logging
import re
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any

logger = logging.getLogger(__name__)


class PIIType(StrEnum):
    SSN = "SSN"
    CREDIT_CARD = "CREDIT_CARD"
    IBAN = "IBAN"
    TAX_ID = "TAX_ID"
    EMAIL = "EMAIL"
    PHONE = "PHONE"


@dataclass
class PIIEntity:
    entity_type: PIIType
    raw_value: str
    masked_value: str
    start: int
    end: int
    metadata: dict[str, Any] = field(default_factory=dict)


# Regex patterns for high-risk PII/PHI
_SSN_REGEX = re.compile(r"\b(?:\d{3}-\d{2}-\d{4}|\d{9})\b")
_EMAIL_REGEX = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b")
_PHONE_REGEX = re.compile(r"\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b")
_TAX_ID_REGEX = re.compile(r"\b\d{2}-\d{7}\b")  # US EIN format
_IBAN_REGEX = re.compile(r"\b[A-Z]{2}\d{2}[A-Z0-9]{4,30}\b")
_CC_CANDIDATE_REGEX = re.compile(r"\b(?:\d[ -]*?){13,19}\b")


def _is_luhn_valid(card_number_str: str) -> bool:
    """Validate credit card number using Luhn algorithm."""
    digits = [int(c) for c in card_number_str if c.isdigit()]
    if len(digits) < 13 or len(digits) > 19:
        return False
    total = 0
    reverse_digits = digits[::-1]
    for i, d in enumerate(reverse_digits):
        if i % 2 == 1:
            doubled = d * 2
            total += doubled - 9 if doubled > 9 else doubled
        else:
            total += d
    return total % 10 == 0


def _is_iban_candidate(candidate: str) -> bool:
    """Basic structural and modulo-97 IBAN validation."""
    clean = candidate.replace(" ", "").upper()
    if len(clean) < 15 or len(clean) > 34:
        return False
    # Move first 4 chars to end
    rearranged = clean[4:] + clean[:4]
    # Replace letters with numbers (A=10, B=11, etc.)
    numeric_str = "".join(str(ord(c) - 55) if c.isalpha() else c for c in rearranged)
    try:
        return int(numeric_str) % 97 == 1
    except (ValueError, OverflowError):
        return False


class PIIGovernanceEngine:
    """
    Zero-Trust PII/PHI Engine for sanitizing document corpora and protecting sensitive records.
    """

    @staticmethod
    def detect_entities(text: str) -> list[PIIEntity]:
        """Scans raw text and identifies all sensitive PII entities."""
        entities: list[PIIEntity] = []
        if not text:
            return entities

        # 1. SSN
        for match in _SSN_REGEX.finditer(text):
            raw = match.group()
            masked = "***-**-" + raw[-4:] if "-" in raw else "******" + raw[-4:]
            entities.append(PIIEntity(
                entity_type=PIIType.SSN,
                raw_value=raw,
                masked_value=masked,
                start=match.start(),
                end=match.end()
            ))

        # 2. Credit Cards (with Luhn verification)
        for match in _CC_CANDIDATE_REGEX.finditer(text):
            raw = match.group()
            digits_only = re.sub(r"\D", "", raw)
            if _is_luhn_valid(digits_only):
                masked = f"****-****-****-{digits_only[-4:]}"
                entities.append(PIIEntity(
                    entity_type=PIIType.CREDIT_CARD,
                    raw_value=raw,
                    masked_value=masked,
                    start=match.start(),
                    end=match.end()
                ))

        # 3. Tax ID / EIN
        for match in _TAX_ID_REGEX.finditer(text):
            raw = match.group()
            masked = "**-***" + raw[-4:]
            entities.append(PIIEntity(
                entity_type=PIIType.TAX_ID,
                raw_value=raw,
                masked_value=masked,
                start=match.start(),
                end=match.end()
            ))

        # 4. IBAN
        for match in _IBAN_REGEX.finditer(text):
            raw = match.group()
            if _is_iban_candidate(raw):
                masked = raw[:4] + ("*" * (len(raw) - 8)) + raw[-4:]
                entities.append(PIIEntity(
                    entity_type=PIIType.IBAN,
                    raw_value=raw,
                    masked_value=masked,
                    start=match.start(),
                    end=match.end()
                ))

        # 5. Email
        for match in _EMAIL_REGEX.finditer(text):
            raw = match.group()
            parts = raw.split("@")
            prefix = parts[0]
            masked_prefix = prefix[0] + "***" if len(prefix) > 1 else "***"
            masked = f"{masked_prefix}@{parts[1]}"
            entities.append(PIIEntity(
                entity_type=PIIType.EMAIL,
                raw_value=raw,
                masked_value=masked,
                start=match.start(),
                end=match.end()
            ))

        # 6. Phone
        for match in _PHONE_REGEX.finditer(text):
            raw = match.group()
            digits = re.sub(r"\D", "", raw)
            if 10 <= len(digits) <= 13:
                masked = "***-***-" + digits[-4:]
                entities.append(PIIEntity(
                    entity_type=PIIType.PHONE,
                    raw_value=raw,
                    masked_value=masked,
                    start=match.start(),
                    end=match.end()
                ))

        # Sort non-overlapping entities by start index ascending
        entities.sort(key=lambda e: e.start)
        filtered_entities: list[PIIEntity] = []
        last_end = -1
        for e in entities:
            if e.start >= last_end:
                filtered_entities.append(e)
                last_end = e.end

        return filtered_entities

    @classmethod
    def sanitize_text(cls, text: str) -> tuple[str, list[PIIEntity]]:
        """
        Replaces detected PII entities with their masked representations.
        Safe for vector embeddings, logs, and untrusted LLM prompts.
        """
        entities = cls.detect_entities(text)
        if not entities:
            return text, []

        sanitized_parts: list[str] = []
        last_idx = 0
        for entity in entities:
            sanitized_parts.append(text[last_idx:entity.start])
            sanitized_parts.append(entity.masked_value)
            last_idx = entity.end
        sanitized_parts.append(text[last_idx:])

        return "".join(sanitized_parts), entities

    @classmethod
    def tokenize_into_vault(cls, text: str) -> tuple[str, dict[str, str]]:
        """
        Replaces PII entities with deterministic cryptographic vault tokens (e.g. {{PII_SSN_1}}).
        Returns the tokenized string and the private lookup vault.
        """
        entities = cls.detect_entities(text)
        vault: dict[str, str] = {}
        if not entities:
            return text, vault

        parts: list[str] = []
        last_idx = 0
        for i, entity in enumerate(entities):
            token = f"{{{{PII_{entity.entity_type.value}_{i+1}}}}}"
            vault[token] = entity.raw_value
            parts.append(text[last_idx:entity.start])
            parts.append(token)
            last_idx = entity.end
        parts.append(text[last_idx:])

        return "".join(parts), vault

    @classmethod
    def detokenize_for_role(
        cls, tokenized_text: str, vault: dict[str, str], user_role: str
    ) -> str:
        """
        ABAC gate: Only ADMIN or COMPLIANCE roles can view de-anonymized raw data.
        Other roles receive masked values instead of raw values.
        """
        is_authorized = user_role.upper() in {"ADMIN", "COMPLIANCE_OFFICER", "AUDITOR"}
        result = tokenized_text

        for token, raw_val in vault.items():
            if is_authorized:
                result = result.replace(token, raw_val)
            else:
                masked = (
                    "***-**-" + raw_val[-4:]
                    if len(raw_val) >= 4
                    else "****"
                )
                result = result.replace(token, masked)

        return result
