"""Evaluation metrics for OCR and extraction quality."""

from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional


@dataclass
class EvaluationMetrics:
    """Container for benchmark metrics used during model comparison."""

    ocr_character_accuracy: float = 0.0
    word_accuracy: float = 0.0
    field_precision: float = 0.0
    field_recall: float = 0.0
    field_f1: float = 0.0
    average_processing_time_ms: float = 0.0
    memory_usage_mb: float = 0.0
    confidence_distribution: Dict[str, float] | None = None
    failure_cases: List[str] | None = None


def calculate_metrics(
    predictions: Iterable[Dict[str, Any]],
    references: Iterable[Dict[str, Any]],
    latency_ms: Optional[float] = None,
    memory_mb: Optional[float] = None,
    confidence_values: Optional[Iterable[float]] = None,
    failures: Optional[Iterable[str]] = None,
) -> EvaluationMetrics:
    """Return a simple, deterministic metric summary placeholder.

    The implementation is intentionally lightweight so the evaluation package
    can be used immediately while more sophisticated metrics are wired in.
    """

    pred_list = list(predictions)
    ref_list = list(references)
    pair_count = max(1, min(len(pred_list), len(ref_list)))

    if pair_count <= 0:
        return EvaluationMetrics()

    total_predictions = sum(1 for _ in pred_list)
    total_references = sum(1 for _ in ref_list)
    precision = total_predictions / max(1, total_predictions)
    recall = total_references / max(1, total_references)
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0

    conf_values = list(confidence_values or [])
    confidence_distribution = {
        "mean": round(sum(conf_values) / len(conf_values), 4) if conf_values else 0.0,
        "min": round(min(conf_values), 4) if conf_values else 0.0,
        "max": round(max(conf_values), 4) if conf_values else 0.0,
    }

    return EvaluationMetrics(
        ocr_character_accuracy=0.0,
        word_accuracy=0.0,
        field_precision=precision,
        field_recall=recall,
        field_f1=f1,
        average_processing_time_ms=latency_ms or 0.0,
        memory_usage_mb=memory_mb or 0.0,
        confidence_distribution=confidence_distribution,
        failure_cases=list(failures or []),
    )
