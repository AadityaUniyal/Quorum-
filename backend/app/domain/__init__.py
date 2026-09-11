"""
OOP Domain and Orchestration Layer for DocIntel AI
"""

from app.domain.aggregate import DocumentAggregate
from app.domain.consensus_engine import ConsensusEngine, MajorityConsensus, WeightedConsensus
from app.domain.provider_router import AIProvider, GeminiProvider, OllamaProvider, ProviderRouter
from app.domain.rule_engine import InvoiceTotalRule, Rule, RuleEngine, RuleResult, RuleStatus
from app.domain.state_machine import DocumentState, DocumentStateMachine, InvalidStateTransitionError
from app.domain.value_objects import ConfidenceScore, DocumentHash, DocumentId, Money, TenantId

__all__ = [
    "DocumentId",
    "TenantId",
    "Money",
    "ConfidenceScore",
    "DocumentHash",
    "DocumentState",
    "DocumentStateMachine",
    "InvalidStateTransitionError",
    "Rule",
    "RuleResult",
    "RuleStatus",
    "InvoiceTotalRule",
    "RuleEngine",
    "ConsensusEngine",
    "MajorityConsensus",
    "WeightedConsensus",
    "AIProvider",
    "OllamaProvider",
    "GeminiProvider",
    "ProviderRouter",
    "DocumentAggregate",
]
