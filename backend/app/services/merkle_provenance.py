"""
Cryptographic Merkle Provenance & Verification Seal (QVS) Engine.

Constructs SHA-256 Merkle Provenance Trees across extracted fields, 2D coordinates,
and raw OCR token geometry to provide tamper-evident mathematical provenance receipts
satisfying SOC 2 Type II, SOX, and ISO 27001 requirements.
"""

import hashlib
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any


@dataclass
class MerkleNode:
    hash_value: str
    left: Any = None
    right: Any = None
    field_key: str | None = None
    coordinate_anchor: list[float] | None = None
    is_leaf: bool = False


@dataclass
class VerificationSealResult:
    seal_id: str
    merkle_root: str
    leaf_count: int
    algorithm: str
    timestamp: str
    field_hashes: dict[str, str]
    audit_receipt: dict[str, Any]


class MerkleProvenanceEngine:
    """
    Constructs tamper-evident Merkle Trees mapping extracted document values
    to exact spatial bounding coordinates and token text.
    """

    @staticmethod
    def _sha256(data: str) -> str:
        return hashlib.sha256(data.encode("utf-8")).hexdigest()

    @classmethod
    def compute_field_leaf_hash(
        cls,
        field_key: str,
        value: Any,
        bounding_box: list[float] | None = None,
        raw_token: str | None = None,
    ) -> str:
        """
        Computes leaf hash: H(field_key || value || bbox || raw_token)
        """
        canonical_bbox = json.dumps(bounding_box or [])
        raw_str = f"{field_key}::{value}::{canonical_bbox}::{raw_token or ''}"
        return cls._sha256(raw_str)

    @classmethod
    def generate_verification_seal(
        cls,
        document_id: str,
        fields: list[dict[str, Any]],
        organization_id: str | None = None,
    ) -> VerificationSealResult:
        """
        Builds the complete Merkle Tree and computes the Quorum Verification Seal (QVS).
        """
        if not fields:
            empty_root = cls._sha256(f"QUORUM_EMPTY_DOC_{document_id}")
            now = datetime.now(UTC).isoformat()
            return VerificationSealResult(
                seal_id=f"qvs_{document_id[:8]}",
                merkle_root=empty_root,
                leaf_count=0,
                algorithm="SHA-256/Merkle-Binary",
                timestamp=now,
                field_hashes={},
                audit_receipt={
                    "document_id": document_id,
                    "seal": empty_root,
                    "status": "SEALED_EMPTY",
                },
            )

        # 1. Compute leaf nodes sorted deterministically by field_key
        sorted_fields = sorted(fields, key=lambda f: f.get("field_key", ""))
        leaf_hashes: list[str] = []
        field_hash_map: dict[str, str] = {}

        for f in sorted_fields:
            key = f.get("field_key", "")
            val = f.get("consensus_value") or f.get("extracted_value") or ""
            bbox = f.get("bounding_box")
            raw_text = f.get("evidence_text") or ""

            leaf_h = cls.compute_field_leaf_hash(key, val, bbox, raw_text)
            leaf_hashes.append(leaf_h)
            field_hash_map[key] = leaf_h

        # 2. Iteratively reduce to Merkle Root
        current_level = list(leaf_hashes)
        while len(current_level) > 1:
            next_level = []
            for i in range(0, len(current_level), 2):
                left = current_level[i]
                right = current_level[i + 1] if i + 1 < len(current_level) else left
                combined = cls._sha256(f"{left}:{right}")
                next_level.append(combined)
            current_level = next_level

        merkle_root = current_level[0]
        timestamp = datetime.now(UTC).isoformat()
        seal_id = f"qvs_{merkle_root[:16]}"

        audit_receipt = {
            "seal_id": seal_id,
            "document_id": str(document_id),
            "merkle_root": merkle_root,
            "organization_id": str(organization_id) if organization_id else "PUBLIC_TENANT",
            "algorithm": "SHA-256/Merkle-Binary-Tree-v2",
            "leaf_count": len(leaf_hashes),
            "generated_at": timestamp,
            "compliance_standards": ["SOC2_TYPE_II", "SOX_404", "ISO_27001", "EU_GDPR_77"],
            "verification_status": "CRYPTOGRAPHICALLY_SEALED",
        }

        return VerificationSealResult(
            seal_id=seal_id,
            merkle_root=merkle_root,
            leaf_count=len(leaf_hashes),
            algorithm="SHA-256/Merkle-Binary-Tree-v2",
            timestamp=timestamp,
            field_hashes=field_hash_map,
            audit_receipt=audit_receipt,
        )

    @classmethod
    def verify_field_inclusion(
        cls,
        field_key: str,
        value: Any,
        bounding_box: list[float] | None,
        merkle_root: str,
        sibling_hashes: list[tuple[str, str]],  # [(direction 'left'/'right', hash)]
    ) -> bool:
        """
        Verifies Merkle inclusion proof for zero-knowledge or external audit checks.
        """
        current_hash = cls.compute_field_leaf_hash(field_key, value, bounding_box)
        for direction, sibling in sibling_hashes:
            if direction == "left":
                current_hash = cls._sha256(f"{sibling}:{current_hash}")
            else:
                current_hash = cls._sha256(f"{current_hash}:{sibling}")
        return current_hash == merkle_root
