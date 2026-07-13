"""
Confidence aggregation.

Per-token confidence already encodes cross-engine agreement (the fusion engine
boosts corroborated tokens and penalises uncorroborated ones), so aggregation
here is a pure roll-up: length-weighted at the page level so long, information-
rich tokens dominate, and word-count-weighted at the document level. Downstream
stages use these scores to route low-confidence fields to human review.
"""

from __future__ import annotations

from app.contracts.ocr import OcrLine, OcrWord, PageOcr
from app.services.ocr.config import OcrConfig


class ConfidenceEngine:
    def __init__(self, config: OcrConfig) -> None:
        self.config = config

    def page_confidence(self, lines: list[OcrLine]) -> float:
        words = [w for line in lines for w in line.words]
        return self._aggregate(words)

    def document_confidence(self, pages: list[PageOcr]) -> float:
        total_words = sum(p.word_count for p in pages)
        if total_words == 0:
            return 0.0
        return sum(p.confidence * p.word_count for p in pages) / total_words

    @staticmethod
    def _aggregate(words: list[OcrWord]) -> float:
        total = sum(len(w.text) for w in words)
        if total == 0:
            return 0.0
        return sum(w.confidence * len(w.text) for w in words) / total
