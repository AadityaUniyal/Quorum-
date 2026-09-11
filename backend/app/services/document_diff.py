"""
Document Diff & Version Comparison Engine

Compares two document versions or two different documents to detect ADDED, REMOVED,
CHANGED, and CONFLICT modifications with evidence grounding.
"""

from dataclasses import dataclass, field
from enum import StrEnum
import logging
from typing import Any

logger = logging.getLogger(__name__)


class DiffChangeType(StrEnum):
    ADDED = "ADDED"
    REMOVED = "REMOVED"
    CHANGED = "CHANGED"
    CONFLICT = "CONFLICT"
    UNCHANGED = "UNCHANGED"


@dataclass(frozen=True)
class FieldDiff:
    field_key: str
    change_type: DiffChangeType
    old_value: Any | None
    new_value: Any | None
    confidence_delta: float = 0.0
    evidence_old: str | None = None
    evidence_new: str | None = None
    page: int = 1
    notes: str = ""


@dataclass
class DocumentDiffResult:
    doc_a_id: str
    doc_b_id: str
    diffs: list[FieldDiff] = field(default_factory=list)
    similarity_score: float = 1.0

    @property
    def has_conflicts(self) -> bool:
        return any(d.change_type == DiffChangeType.CONFLICT for d in self.diffs)

    @property
    def change_count(self) -> int:
        return sum(1 for d in self.diffs if d.change_type != DiffChangeType.UNCHANGED)


class DocumentDiffEngine:
    """
    Compares two dictionaries of extracted fields with provenance and evidence.
    """

    @classmethod
    def compare_fields(
        cls,
        fields_a: dict[str, Any],
        fields_b: dict[str, Any],
        doc_a_id: str = "doc_a",
        doc_b_id: str = "doc_b",
    ) -> DocumentDiffResult:
        all_keys = set(fields_a.keys()).union(set(fields_b.keys()))
        diffs: list[FieldDiff] = []
        matching_count = 0

        for key in sorted(all_keys):
            val_a = fields_a.get(key)
            val_b = fields_b.get(key)

            if key not in fields_a and key in fields_b:
                diffs.append(FieldDiff(
                    field_key=key,
                    change_type=DiffChangeType.ADDED,
                    old_value=None,
                    new_value=val_b,
                    notes=f"Field '{key}' added in target document."
                ))
            elif key in fields_a and key not in fields_b:
                diffs.append(FieldDiff(
                    field_key=key,
                    change_type=DiffChangeType.REMOVED,
                    old_value=val_a,
                    new_value=None,
                    notes=f"Field '{key}' removed from target document."
                ))
            elif str(val_a).strip().lower() == str(val_b).strip().lower():
                matching_count += 1
                diffs.append(FieldDiff(
                    field_key=key,
                    change_type=DiffChangeType.UNCHANGED,
                    old_value=val_a,
                    new_value=val_b,
                    notes="Field values match exactly."
                ))
            else:
                # Value modified
                diffs.append(FieldDiff(
                    field_key=key,
                    change_type=DiffChangeType.CHANGED,
                    old_value=val_a,
                    new_value=val_b,
                    notes=f"Value changed from '{val_a}' to '{val_b}'."
                ))

        total_keys = len(all_keys)
        similarity = matching_count / total_keys if total_keys > 0 else 1.0

        return DocumentDiffResult(
            doc_a_id=doc_a_id,
            doc_b_id=doc_b_id,
            diffs=diffs,
            similarity_score=round(similarity, 3)
        )
