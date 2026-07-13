"""Evaluation scaffolding for procurement document intelligence."""

from .benchmark import BenchmarkResult, BenchmarkRunner
from .compare_models import compare_models
from .datasets import BenchmarkDataset
from .metrics import EvaluationMetrics, calculate_metrics

__all__ = [
    "BenchmarkDataset",
    "BenchmarkResult",
    "BenchmarkRunner",
    "EvaluationMetrics",
    "calculate_metrics",
    "compare_models",
]
