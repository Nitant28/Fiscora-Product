"""Integration tests for the end-to-end OCR Engine (text-layer path)."""

from __future__ import annotations

import pytest

from app.contracts.ocr import OcrContract
from app.services.ocr.config import OcrConfig
from app.services.ocr.engine import OCREngine
from app.services.ocr.exceptions import NoEngineAvailableError
from app.telemetry.metrics import TelemetryRecorder
from evaluation.synthetic_documents import make_clean_page, make_document

_INVOICE_TEXT = "Invoice #INV-1024\nAcme Corp Pvt Ltd\nAmount Due: 1250.00\nINR"


def _doc_with_text(text: str, pages: int = 1):
    doc = make_document([make_clean_page() for _ in range(pages)])
    doc.raw["page_texts"] = [text for _ in range(pages)]
    return doc


def test_textlayer_ocr_produces_grounded_text() -> None:
    engine = OCREngine()
    doc = _doc_with_text(_INVOICE_TEXT)

    result = engine.run_document(doc)

    assert isinstance(result, OcrContract)
    assert result.engines_used == ("textlayer",)
    assert result.fusion_applied is False
    assert result.confidence > 0.9
    assert "INV-1024" in result.text
    assert "Acme" in result.text
    # Fused text is published back onto the document for extraction.
    assert doc.raw["text"] == result.text


def test_multi_page_document_yields_page_per_page() -> None:
    engine = OCREngine()
    doc = _doc_with_text(_INVOICE_TEXT, pages=3)

    result = engine.run_document(doc)

    assert len(result.pages) == 3
    assert all(p.confidence > 0.9 for p in result.pages)
    assert result.word_count > 0


def test_records_telemetry() -> None:
    telemetry = TelemetryRecorder()
    engine = OCREngine(telemetry=telemetry)
    engine.run_document(_doc_with_text(_INVOICE_TEXT))

    ocr_events = [e for e in telemetry.events if e.stage == "ocr"]
    assert len(ocr_events) == 1
    assert ocr_events[0].confidence is not None


def test_raises_when_no_engine_and_no_text_layer() -> None:
    # Only pixel engines allowed, none installed in CI, and no text layer.
    cfg = OcrConfig(engine_order=("paddle", "tesseract"))
    engine = OCREngine(config=cfg)
    doc = make_document([make_clean_page()])

    with pytest.raises(NoEngineAvailableError):
        engine.run_document(doc)


def test_low_confidence_words_helper() -> None:
    result = OCREngine().run_document(_doc_with_text(_INVOICE_TEXT))
    # Text-layer confidence is ~0.99, so nothing is below a 0.5 threshold.
    assert result.low_confidence_words(0.5) == []
