"""Unit tests for reading-order assembly and confidence aggregation."""

from __future__ import annotations

from app.contracts.ocr import BoundingBox, OcrWord
from app.services.ocr.config import OcrConfig
from app.services.ocr.confidence import ConfidenceEngine
from app.services.ocr.reading_order import ReadingOrder


def _w(text: str, x: int, y: int, conf: float = 0.9) -> OcrWord:
    return OcrWord(text=text, confidence=conf, box=BoundingBox(x, y, 30, 12), engine="t")


def test_words_group_into_lines_in_reading_order() -> None:
    ro = ReadingOrder(OcrConfig())
    # Intentionally shuffled input across two rows.
    words = [_w("world", 60, 0), _w("Second", 0, 40), _w("Hello", 0, 0), _w("line", 60, 40)]
    lines = ro.assemble(words)

    assert len(lines) == 2
    assert lines[0].text == "Hello world"
    assert lines[1].text == "Second line"
    # line_id is assigned top-to-bottom.
    assert all(w.line_id == 0 for w in lines[0].words)
    assert all(w.line_id == 1 for w in lines[1].words)


def test_line_confidence_is_length_weighted() -> None:
    ro = ReadingOrder(OcrConfig())
    lines = ro.assemble([_w("a", 0, 0, conf=0.2), _w("longtoken", 40, 0, conf=0.9)])
    assert len(lines) == 1
    # Long, high-confidence token should dominate the short low one.
    assert lines[0].confidence > 0.8


def test_page_confidence_is_length_weighted_rollup() -> None:
    ce = ConfidenceEngine(OcrConfig())
    ro = ReadingOrder(OcrConfig())
    lines = ro.assemble([_w("a", 0, 0, conf=0.2), _w("longtoken", 40, 0, conf=0.9)])
    # Long high-confidence token dominates → page score near the high value.
    assert ce.page_confidence(lines) > 0.8
