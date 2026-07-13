"""Utilities for comparing benchmark results across model variants."""

from typing import Dict, Sequence

from .benchmark import BenchmarkResult


def compare_models(results: Sequence[BenchmarkResult]) -> Dict[str, Dict[str, float]]:
    """Return a compact summary of model performance for comparison."""

    summary: Dict[str, Dict[str, float]] = {}
    for result in results:
        summary[result.name] = {
            "field_f1": result.metrics.field_f1,
            "field_precision": result.metrics.field_precision,
            "field_recall": result.metrics.field_recall,
            "average_processing_time_ms": result.metrics.average_processing_time_ms,
            "memory_usage_mb": result.metrics.memory_usage_mb,
        }
    return summary
