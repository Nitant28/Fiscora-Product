"""
Reading order + line assembly.

Fusion yields an unordered bag of words. Downstream extraction and vision models
need human reading order (top-to-bottom, left-to-right) grouped into lines. We
cluster words into lines by vertical proximity relative to the median word
height (robust to varying font sizes), then order lines by their top edge and
words within a line by their left edge.
"""

from __future__ import annotations

from statistics import median

from app.contracts.ocr import BoundingBox, OcrLine, OcrWord
from app.services.ocr.config import OcrConfig


class ReadingOrder:
    def __init__(self, config: OcrConfig) -> None:
        self.config = config

    def assemble(self, words: list[OcrWord]) -> list[OcrLine]:
        if not words:
            return []

        heights = [w.box.h for w in words if w.box.h > 0]
        med_h = median(heights) if heights else 12
        tolerance = max(4.0, med_h * self.config.line_overlap_ratio)

        # Sort by vertical centre, then horizontal, to seed stable grouping.
        ordered = sorted(words, key=lambda w: (w.box.cy, w.box.x))

        lines: list[list[OcrWord]] = []
        current: list[OcrWord] = []
        current_cy = None

        for word in ordered:
            if current_cy is None or abs(word.box.cy - current_cy) <= tolerance:
                current.append(word)
                # Running mean keeps the band centred as the line grows.
                current_cy = sum(w.box.cy for w in current) / len(current)
            else:
                lines.append(current)
                current = [word]
                current_cy = word.box.cy
        if current:
            lines.append(current)

        assembled: list[OcrLine] = []
        for line_id, line_words in enumerate(lines):
            line_words.sort(key=lambda w: w.box.x)
            for w in line_words:
                w.line_id = line_id
            text = " ".join(w.text for w in line_words)
            box = BoundingBox.union([w.box for w in line_words])
            assembled.append(
                OcrLine(
                    text=text,
                    confidence=_weighted_conf(line_words),
                    box=box,
                    words=line_words,
                )
            )

        # Final ordering by line top edge (median centre already ~sorted).
        assembled.sort(key=lambda ln: ln.box.y)
        for line_id, line in enumerate(assembled):
            for w in line.words:
                w.line_id = line_id
        return assembled


def _weighted_conf(words: list[OcrWord]) -> float:
    """Length-weighted mean confidence (long tokens dominate short ones)."""
    total = sum(len(w.text) for w in words)
    if total == 0:
        return 0.0
    return sum(w.confidence * len(w.text) for w in words) / total
