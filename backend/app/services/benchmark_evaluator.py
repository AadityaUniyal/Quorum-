"""
AI Pipeline Benchmark Evaluator

Evaluates precision, recall, F1, citation accuracy, and hallucination rate across a dataset.
"""

import logging
from dataclasses import dataclass
from typing import Any

from app.domain.rule_engine import InvoiceTotalRule, RuleStatus

logger = logging.getLogger(__name__)


@dataclass
class BenchmarkReport:
    total_samples: int
    precision: float
    recall: float
    f1_score: float
    rule_validation_accuracy: float
    hallucination_rate: float
    details: list[dict[str, Any]]


class BenchmarkEvaluator:
    """
    Runs automated quality evaluations on document extraction pipelines.
    """

    @classmethod
    def evaluate_synthetic_dataset(cls, synthetic_docs: list[Any]) -> BenchmarkReport:
        rule = InvoiceTotalRule()
        rule_eval_correct = 0
        details = []

        total_predicted = 0
        total_ground_truth = 0
        true_positives = 0
        hallucinations = 0

        for doc in synthetic_docs:
            gt = getattr(doc, "ground_truth", {}) or {}
            predicted = getattr(doc, "extracted_fields", {}) or {}

            # Math rule evaluation check
            res = rule.evaluate({
                "subtotal": predicted.get("subtotal"),
                "tax": predicted.get("tax"),
                "shipping": predicted.get("shipping"),
                "discount": predicted.get("discount", 0),
                "total_amount": predicted.get("total_amount"),
                "currency": predicted.get("currency", gt.get("currency", "USD"))
            })

            expected_pass = not getattr(doc, "has_anomaly", False)
            actual_pass = res.status in {RuleStatus.PASS, RuleStatus.WARNING}

            if expected_pass == actual_pass:
                rule_eval_correct += 1

            # Field-level evaluation metrics
            for key, gt_val in gt.items():
                total_ground_truth += 1
                if key in predicted:
                    total_predicted += 1
                    pred_val = predicted[key]
                    if str(gt_val).strip().lower() == str(pred_val).strip().lower():
                        true_positives += 1
                    else:
                        hallucinations += 1
                else:
                    # Missed field
                    pass

            details.append({
                "doc_type": getattr(doc, "doc_type", "INVOICE"),
                "has_anomaly": getattr(doc, "has_anomaly", False),
                "rule_status": res.status.value,
                "rule_pass_match": (expected_pass == actual_pass)
            })

        total_samples = len(synthetic_docs)
        precision = (true_positives / total_predicted) if total_predicted > 0 else 1.0
        recall = (true_positives / total_ground_truth) if total_ground_truth > 0 else 1.0
        f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0
        rule_acc = (rule_eval_correct / total_samples) if total_samples > 0 else 1.0
        hallucination_rate = (hallucinations / total_predicted) if total_predicted > 0 else 0.0

        return BenchmarkReport(
            total_samples=total_samples,
            precision=round(precision, 3),
            recall=round(recall, 3),
            f1_score=round(f1, 3),
            rule_validation_accuracy=round(rule_acc, 3),
            hallucination_rate=round(hallucination_rate, 3),
            details=details
        )
