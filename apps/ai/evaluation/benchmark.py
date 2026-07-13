"""Benchmark runner and result container for document pipeline evaluation."""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from .metrics import EvaluationMetrics, calculate_metrics


@dataclass
class BenchmarkResult:
    """Serializable result for one model or pipeline run."""

    name: str
    metrics: EvaluationMetrics
    latency_ms: float
    memory_mb: float
    warnings: List[str] = field(default_factory=list)


class BenchmarkRunner:
    """Simple wrapper around the evaluation metrics module."""

    def run(
        self,
        name: str,
        predictions: List[Dict[str, Any]],
        references: List[Dict[str, Any]],
        latency_ms: Optional[float] = None,
        memory_mb: Optional[float] = None,
        confidence_values: Optional[List[float]] = None,
        failures: Optional[List[str]] = None,
        warnings: Optional[List[str]] = None,
    ) -> BenchmarkResult:
        metrics = calculate_metrics(
            predictions=predictions,
            references=references,
            latency_ms=latency_ms,
            memory_mb=memory_mb,
            confidence_values=confidence_values,
            failures=failures,
        )
        return BenchmarkResult(
            name=name,
            metrics=metrics,
            latency_ms=latency_ms or 0.0,
            memory_mb=memory_mb or 0.0,
            warnings=warnings or [],
        )
