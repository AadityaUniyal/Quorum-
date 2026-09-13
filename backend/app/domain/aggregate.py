"""
Document Domain Aggregate Root

Encapsulates document metadata, extracted fields, validation results,
lifecycle transitions, and domain events.
"""

import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from app.domain.rule_engine import RuleEngine, RuleResult
from app.domain.state_machine import DocumentState, DocumentStateMachine
from app.domain.value_objects import ConfidenceScore, DocumentHash, DocumentId, TenantId


@dataclass
class DomainExtractedField:
    field_key: str
    value: Any
    confidence: ConfidenceScore
    page_number: int | None = None
    bounding_box: dict[str, Any] | None = None
    evidence_text: str | None = None
    chunk_id: str | None = None
    validation_status: str = "VALID"
    notes: str = ""


@dataclass
class DocumentAggregate:
    id: DocumentId
    filename: str
    file_path: str
    file_type: str
    content_hash: DocumentHash
    organization_id: TenantId | None = None
    category: str = "UNKNOWN"
    ocr_text: str = ""
    executive_summary: str = ""
    fields: dict[str, DomainExtractedField] = field(default_factory=dict)
    rule_results: list[RuleResult] = field(default_factory=list)
    state_machine: DocumentStateMachine = field(default_factory=DocumentStateMachine)
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = field(default_factory=lambda: datetime.now(UTC))

    @classmethod
    def create(
        cls,
        filename: str,
        file_path: str,
        file_type: str,
        content_hash: str,
        organization_id: str | uuid.UUID | None = None,
    ) -> "DocumentAggregate":
        doc_id = DocumentId.generate()
        tenant = TenantId.from_str(str(organization_id)) if organization_id else None
        return cls(
            id=doc_id,
            filename=filename,
            file_path=file_path,
            file_type=file_type.upper(),
            content_hash=DocumentHash(content_hash),
            organization_id=tenant,
            state_machine=DocumentStateMachine(DocumentState.UPLOADED)
        )

    @property
    def current_state(self) -> DocumentState:
        return self.state_machine.current_state

    def start_processing(self) -> None:
        if self.state_machine.current_state == DocumentState.UPLOADED:
            self.state_machine.transition_to(DocumentState.VALIDATING, "Beginning document validation")
        if self.state_machine.current_state == DocumentState.VALIDATING:
            self.state_machine.transition_to(DocumentState.QUEUED, "Queued for worker extraction")
        if self.state_machine.current_state == DocumentState.QUEUED:
            self.state_machine.transition_to(DocumentState.PROCESSING, "Worker OCR and extraction started")
        self.updated_at = datetime.now(UTC)

    def set_extracted_fields(self, fields: list[DomainExtractedField], ocr_text: str = "", category: str = "") -> None:
        self.ocr_text = ocr_text
        if category:
            self.category = category
        for f in fields:
            self.fields[f.field_key] = f
        self.state_machine.transition_to(DocumentState.EXTRACTED, f"Extracted {len(fields)} fields")
        self.updated_at = datetime.now(UTC)

    def validate_rules(self, rule_engine: RuleEngine | None = None) -> bool:
        engine = rule_engine or RuleEngine()
        context = {k: v.value for k, v in self.fields.items()}
        context["category"] = self.category
        is_valid, score, results = engine.is_valid(context)
        self.rule_results = results

        if self.state_machine.can_transition_to(DocumentState.VALIDATED):
            self.state_machine.transition_to(DocumentState.VALIDATED, f"Rule audit score: {score}")

        if is_valid and score >= 0.85:
            self.state_machine.transition_to(DocumentState.APPROVED, "Auto-approved via deterministic validation")
        else:
            self.state_machine.transition_to(DocumentState.REVIEW_REQUIRED, "Flagged for human operator review")

        self.updated_at = datetime.now(UTC)
        return is_valid

    def get_overall_confidence(self) -> float:
        if not self.fields:
            return 1.0
        scores = [f.confidence.value for f in self.fields.values()]
        return round(sum(scores) / len(scores), 4)
