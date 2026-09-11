"""
Multi-Agent Consensus Engine

Implements pluggable consensus strategies: MajorityConsensus, WeightedConsensus,
and ConfidenceThresholdConsensus for reliable multi-agent agreement.
"""

from abc import ABC, abstractmethod
from collections import Counter
from dataclasses import dataclass, field
import logging
from typing import Any

from app.domain.value_objects import ConfidenceScore

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AgentVote:
    agent_name: str
    field_key: str
    value: Any
    confidence: float
    reason: str = ""


@dataclass(frozen=True)
class ConsensusDecision:
    field_key: str
    consensus_value: Any
    confidence: ConfidenceScore
    agreement_ratio: float
    strategy_used: str
    participating_agents: list[str]
    notes: str = ""


class ConsensusStrategy(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        pass

    @abstractmethod
    def reach_consensus(self, field_key: str, votes: list[AgentVote]) -> ConsensusDecision:
        pass


class MajorityConsensus(ConsensusStrategy):
    """Majority voting consensus strategy."""

    @property
    def name(self) -> str:
        return "MajorityConsensus"

    def reach_consensus(self, field_key: str, votes: list[AgentVote]) -> ConsensusDecision:
        if not votes:
            return ConsensusDecision(
                field_key=field_key,
                consensus_value=None,
                confidence=ConfidenceScore(0.0),
                agreement_ratio=0.0,
                strategy_used=self.name,
                participating_agents=[],
                notes="No votes submitted."
            )

        value_counts = Counter(v.value for v in votes if v.value is not None)
        if not value_counts:
            return ConsensusDecision(
                field_key=field_key,
                consensus_value=None,
                confidence=ConfidenceScore(0.0),
                agreement_ratio=0.0,
                strategy_used=self.name,
                participating_agents=[v.agent_name for v in votes],
                notes="All agent votes returned None."
            )

        winner_value, win_count = value_counts.most_common(1)[0]
        total_votes = len(votes)
        ratio = win_count / total_votes

        # Compute average confidence among matching votes
        matching_confidences = [v.confidence for v in votes if v.value == winner_value]
        avg_conf = sum(matching_confidences) / len(matching_confidences) if matching_confidences else 0.5
        final_conf = round(min(avg_conf * ratio + 0.1, 1.0), 4)

        return ConsensusDecision(
            field_key=field_key,
            consensus_value=winner_value,
            confidence=ConfidenceScore(final_conf),
            agreement_ratio=round(ratio, 3),
            strategy_used=self.name,
            participating_agents=[v.agent_name for v in votes],
            notes=f"Majority winner with {win_count}/{total_votes} votes."
        )


class WeightedConsensus(ConsensusStrategy):
    """
    Weighted consensus strategy where votes are weighted by each agent's reliability weight and confidence.
    """

    DEFAULT_WEIGHTS = {
        "Auditor": 1.5,
        "Critic": 1.2,
        "Extractor": 1.0,
        "Reconciler": 1.3,
        "Compliance": 1.1,
    }

    def __init__(self, agent_weights: dict[str, float] | None = None):
        self.weights = agent_weights or self.DEFAULT_WEIGHTS

    @property
    def name(self) -> str:
        return "WeightedConsensus"

    def reach_consensus(self, field_key: str, votes: list[AgentVote]) -> ConsensusDecision:
        if not votes:
            return ConsensusDecision(
                field_key=field_key,
                consensus_value=None,
                confidence=ConfidenceScore(0.0),
                agreement_ratio=0.0,
                strategy_used=self.name,
                participating_agents=[],
                notes="No votes submitted."
            )

        weighted_scores: dict[Any, float] = {}
        total_weight = 0.0

        for vote in votes:
            if vote.value is None:
                continue
            w = self.weights.get(vote.agent_name, 1.0) * vote.confidence
            weighted_scores[vote.value] = weighted_scores.get(vote.value, 0.0) + w
            total_weight += w

        if not weighted_scores:
            return ConsensusDecision(
                field_key=field_key,
                consensus_value=None,
                confidence=ConfidenceScore(0.0),
                agreement_ratio=0.0,
                strategy_used=self.name,
                participating_agents=[v.agent_name for v in votes],
                notes="All agent votes returned None."
            )

        winner_value = max(weighted_scores.keys(), key=lambda k: weighted_scores[k])
        winner_weight = weighted_scores[winner_value]
        ratio = winner_weight / total_weight if total_weight > 0 else 1.0
        final_conf = round(min(ratio, 1.0), 4)

        return ConsensusDecision(
            field_key=field_key,
            consensus_value=winner_value,
            confidence=ConfidenceScore(final_conf),
            agreement_ratio=round(ratio, 3),
            strategy_used=self.name,
            participating_agents=[v.agent_name for v in votes],
            notes=f"Weighted consensus chosen ({winner_weight:.2f}/{total_weight:.2f} total weight)."
        )


class ConsensusEngine:
    """
    Orchestrates multi-agent consensus evaluation across all extracted fields.
    """

    def __init__(self, strategy: ConsensusStrategy | None = None):
        self.strategy = strategy or WeightedConsensus()

    def resolve_all_fields(self, votes_by_field: dict[str, list[AgentVote]]) -> dict[str, ConsensusDecision]:
        decisions: dict[str, ConsensusDecision] = {}
        for field_key, votes in votes_by_field.items():
            decisions[field_key] = self.strategy.reach_consensus(field_key, votes)
        return decisions

    def compute_overall_score(self, decisions: dict[str, ConsensusDecision]) -> float:
        if not decisions:
            return 1.0
        scores = [d.confidence.value for d in decisions.values()]
        return round(sum(scores) / len(scores), 4)
