"""Unit tests for the OCR fusion engine (voting + agreement boosting)."""

from __future__ import annotations

from app.contracts.ocr import BoundingBox
from app.services.ocr.config import OcrConfig
from app.services.ocr.engines.base import RawWord
from app.services.ocr.fusion import FusionEngine


def _fusion() -> FusionEngine:
    return FusionEngine(OcrConfig())


def _word(text: str, conf: float, box: BoundingBox) -> RawWord:
    return RawWord(text=text, confidence=conf, box=box)


def test_single_engine_passthrough_unchanged() -> None:
    box = BoundingBox(10, 10, 40, 12)
    fused = _fusion().fuse({"paddle": [_word("INVOICE", 0.8, box)]})
    assert len(fused) == 1
    assert fused[0].text == "INVOICE"
    assert fused[0].confidence == 0.8
    assert fused[0].agreed_by == ("paddle",)


def test_agreeing_engines_boost_confidence() -> None:
    box = BoundingBox(10, 10, 40, 12)
    fused = _fusion().fuse(
        {
            "paddle": [_word("INVOICE", 0.80, box)],
            "tesseract": [_word("INVOICE", 0.85, box)],
        }
    )
    assert len(fused) == 1
    word = fused[0]
    assert word.text == "INVOICE"
    # base (0.85) boosted by one agreeing engine.
    assert word.confidence > 0.85
    assert word.agreed_by == ("paddle", "tesseract")


def test_disagreement_resolves_to_higher_confidence_spelling() -> None:
    box = BoundingBox(10, 10, 40, 12)
    fused = _fusion().fuse(
        {
            "paddle": [_word("INVO1CE", 0.70, box)],  # misread digit-one
            "tesseract": [_word("INVOICE", 0.88, box)],
        }
    )
    assert len(fused) == 1
    assert fused[0].text == "INVOICE"
    assert fused[0].engine == "tesseract"


def test_non_overlapping_tokens_are_both_kept() -> None:
    fused = _fusion().fuse(
        {
            "paddle": [_word("Acme", 0.9, BoundingBox(0, 0, 30, 12))],
            "tesseract": [_word("Corp", 0.9, BoundingBox(200, 0, 30, 12))],
        }
    )
    texts = sorted(w.text for w in fused)
    assert texts == ["Acme", "Corp"]


def test_singleton_penalised_when_other_engine_running() -> None:
    cfg = OcrConfig()
    # "seen" is only detected by paddle although tesseract also ran elsewhere.
    fused = FusionEngine(cfg).fuse(
        {
            "paddle": [
                _word("shared", 0.9, BoundingBox(0, 0, 30, 12)),
                _word("solo", 0.9, BoundingBox(300, 0, 30, 12)),
            ],
            "tesseract": [_word("shared", 0.9, BoundingBox(0, 0, 30, 12))],
        }
    )
    solo = next(w for w in fused if w.text == "solo")
    assert solo.confidence < 0.9  # penalised for lack of corroboration
    shared = next(w for w in fused if w.text == "shared")
    assert shared.confidence >= 0.9  # corroborated → boosted
