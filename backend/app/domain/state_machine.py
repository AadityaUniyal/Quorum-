"""
Document Lifecycle State Machine

Enforces valid lifecycle transitions for documents and prevents invalid state progressions.
"""

import logging
from collections.abc import Callable
from enum import StrEnum

logger = logging.getLogger(__name__)


class DocumentState(StrEnum):
    UPLOADED = "UPLOADED"
    VALIDATING = "VALIDATING"
    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    EXTRACTED = "EXTRACTED"
    VALIDATED = "VALIDATED"
    APPROVED = "APPROVED"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    REJECTED = "REJECTED"
    FAILED = "FAILED"
    ARCHIVED = "ARCHIVED"


class InvalidStateTransitionError(Exception):
    """Raised when an illegal state transition is attempted."""
    def __init__(self, from_state: DocumentState, to_state: DocumentState, reason: str = ""):
        msg = f"Illegal transition from {from_state} to {to_state}."
        if reason:
            msg += f" Reason: {reason}"
        super().__init__(msg)
        self.from_state = from_state
        self.to_state = to_state


class DocumentStateMachine:
    """
    State machine governing document lifecycle progression.
    """

    ALLOWED_TRANSITIONS: dict[DocumentState, set[DocumentState]] = {
        DocumentState.UPLOADED: {DocumentState.VALIDATING, DocumentState.FAILED},
        DocumentState.VALIDATING: {DocumentState.QUEUED, DocumentState.FAILED, DocumentState.REJECTED},
        DocumentState.QUEUED: {DocumentState.PROCESSING, DocumentState.FAILED},
        DocumentState.PROCESSING: {DocumentState.EXTRACTED, DocumentState.FAILED},
        DocumentState.EXTRACTED: {DocumentState.VALIDATED, DocumentState.FAILED},
        DocumentState.VALIDATED: {DocumentState.APPROVED, DocumentState.REVIEW_REQUIRED, DocumentState.FAILED},
        DocumentState.REVIEW_REQUIRED: {DocumentState.APPROVED, DocumentState.REJECTED, DocumentState.PROCESSING},
        DocumentState.APPROVED: {DocumentState.ARCHIVED, DocumentState.PROCESSING},
        DocumentState.REJECTED: {DocumentState.ARCHIVED, DocumentState.PROCESSING},
        DocumentState.FAILED: {DocumentState.QUEUED, DocumentState.ARCHIVED},
        DocumentState.ARCHIVED: set(),  # Terminal state
    }

    def __init__(self, initial_state: DocumentState = DocumentState.UPLOADED):
        self._state = initial_state
        self._history: list[tuple[DocumentState, DocumentState, str]] = []
        self._listeners: list[Callable[[DocumentState, DocumentState], None]] = []

    @property
    def current_state(self) -> DocumentState:
        return self._state

    def add_listener(self, callback: Callable[[DocumentState, DocumentState], None]) -> None:
        self._listeners.append(callback)

    def can_transition_to(self, target_state: DocumentState) -> bool:
        return target_state in self.ALLOWED_TRANSITIONS.get(self._state, set())

    def transition_to(self, target_state: DocumentState, reason: str = "") -> None:
        if not self.can_transition_to(target_state):
            raise InvalidStateTransitionError(self._state, target_state, reason)

        prev_state = self._state
        self._state = target_state
        self._history.append((prev_state, target_state, reason))
        logger.info(f"Document transition: {prev_state} -> {target_state} (reason: '{reason}')")

        for listener in self._listeners:
            try:
                listener(prev_state, target_state)
            except Exception as e:
                logger.error(f"Error in state transition listener: {e}")

    def get_history(self) -> list[tuple[DocumentState, DocumentState, str]]:
        return list(self._history)
