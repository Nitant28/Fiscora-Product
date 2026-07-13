from __future__ import annotations

from typing import Any


class OCRMetrics:
    """Basic OCR metrics used by the benchmark runner."""

    @staticmethod
    def word_accuracy(predicted: str, expected: str) -> float:
        if not predicted or not expected:
            return 0.0
        predicted_tokens = set(predicted.lower().split())
        expected_tokens = set(expected.lower().split())
        if not expected_tokens:
            return 0.0
        overlap = predicted_tokens & expected_tokens
        return round(len(overlap) / len(expected_tokens), 4)

    @staticmethod
    def latency_ms(duration_ms: float) -> float:
        return round(duration_ms, 3)
