"""
Active Learning & Continual Human Feedback Memory Service.

Captures corrections made by human reviewers during review triage and indexes them
into vendor-specific exemplar memory. Subsequent document extractions query this memory
to inject few-shot prompts and apply learned correction rules.
"""

import json
import logging
import os
import threading
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)

_MEM_FILE_PATH = os.path.join(settings.UPLOAD_DIR, "active_learning_memory.json")
_mem_lock = threading.Lock()


@dataclass
class CorrectionExemplar:
    document_id: str
    organization_id: str | None
    category: str
    vendor_name: str | None
    field_key: str
    original_value: str | None
    corrected_value: str
    timestamp: str


class ActiveLearningService:
    """
    Manages human feedback exemplar storage and few-shot correction injection.
    """

    @classmethod
    def _load_store(cls) -> list[dict[str, Any]]:
        if not os.path.exists(_MEM_FILE_PATH):
            return []
        try:
            with open(_MEM_FILE_PATH, encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Failed to load active learning memory file: {e}")
            return []

    @classmethod
    def _save_store(cls, items: list[dict[str, Any]]) -> None:
        try:
            os.makedirs(os.path.dirname(_MEM_FILE_PATH), exist_ok=True)
            with open(_MEM_FILE_PATH, "w", encoding="utf-8") as f:
                json.dump(items, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save active learning memory file: {e}")

    @classmethod
    def record_corrections(
        cls,
        document_id: str,
        category: str,
        corrections: dict[str, dict[str, str]],
        organization_id: str | None = None,
        vendor_name: str | None = None,
    ) -> int:
        """
        Records human corrections:
        corrections format: { "field_key": { "before": "val1", "after": "val2" } }
        """
        if not corrections:
            return 0

        now_str = datetime.now(UTC).isoformat()
        new_exemplars = []

        for field_key, diff in corrections.items():
            ex = CorrectionExemplar(
                document_id=document_id,
                organization_id=organization_id,
                category=category,
                vendor_name=vendor_name,
                field_key=field_key,
                original_value=diff.get("before"),
                corrected_value=diff.get("after", ""),
                timestamp=now_str,
            )
            new_exemplars.append(asdict(ex))

        with _mem_lock:
            existing = cls._load_store()
            existing.extend(new_exemplars)
            # Keep latest 500 exemplars to bound memory
            if len(existing) > 500:
                existing = existing[-500:]
            cls._save_store(existing)

        logger.info(f"ActiveLearning: Recorded {len(new_exemplars)} human corrections for doc {document_id}")
        return len(new_exemplars)

    @classmethod
    def get_exemplars(
        cls,
        category: str | None = None,
        vendor_name: str | None = None,
        field_key: str | None = None,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """
        Retrieves relevant historical human corrections.
        """
        with _mem_lock:
            store = cls._load_store()

        matches = []
        for item in reversed(store):
            if category and item.get("category") != category:
                continue
            if vendor_name and item.get("vendor_name") and item.get("vendor_name").lower() != vendor_name.lower():
                continue
            if field_key and item.get("field_key") != field_key:
                continue
            matches.append(item)
            if len(matches) >= limit:
                break

        return matches

    @classmethod
    def apply_learned_corrections(
        cls,
        extracted_fields: dict[str, Any],
        category: str,
        vendor_name: str | None = None,
    ) -> tuple[dict[str, Any], list[str]]:
        """
        Applies learned high-confidence human corrections to current extracted fields.
        Returns the updated fields dict and an audit note of applied overrides.
        """
        exemplars = cls.get_exemplars(category=category, vendor_name=vendor_name, limit=50)
        if not exemplars:
            return extracted_fields, []

        updated = dict(extracted_fields)
        notes = []

        # Find most recent correction per field key
        field_corrections: dict[str, str] = {}
        for ex in exemplars:
            fk = ex.get("field_key")
            if fk and fk not in field_corrections:
                field_corrections[fk] = ex.get("corrected_value")

        for k, learned_val in field_corrections.items():
            curr_val = updated.get(k)
            # If currently missing or empty, auto-populate from exemplar
            if not curr_val and learned_val:
                updated[k] = learned_val
                notes.append(f"Auto-populated missing '{k}' from historical human feedback exemplar.")

        return updated, notes
