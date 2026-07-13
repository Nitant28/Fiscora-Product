"""Integration: OCR inference is served through the AI Runtime (not directly)."""

from __future__ import annotations

from app.runtime.contracts import ModelStatus, Task
from app.runtime.engine import AIRuntime
from app.runtime.registry import ModelRegistry
from app.services.ocr.config import OcrConfig
from app.services.ocr.engine import OCREngine
from app.telemetry.metrics import TelemetryRecorder
from evaluation.synthetic_documents import make_clean_page, make_document

_TEXT = "Invoice #INV-1024\nAcme Corp Pvt Ltd\nAmount Due: 1250.00\nINR"


def _doc(text: str):
    doc = make_document([make_clean_page()])
    doc.raw["page_texts"] = [text]
    return doc


def _engine_with_isolated_runtime(telemetry=None) -> OCREngine:
    # Isolated runtime/registry so the test is hermetic w.r.t. the singleton.
    runtime = AIRuntime(registry=ModelRegistry(), telemetry=telemetry)
    return OCREngine(config=OcrConfig(), telemetry=telemetry, runtime=runtime)


def test_ocr_registers_models_in_runtime() -> None:
    engine = _engine_with_isolated_runtime()
    names = {d.name for d in engine.runtime.registry.find(Task.OCR, only_available=False)}
    assert {"textlayer", "paddle", "tesseract"} <= names


def test_ocr_runs_through_runtime_and_records_health() -> None:
    telemetry = TelemetryRecorder()
    engine = _engine_with_isolated_runtime(telemetry=telemetry)

    result = engine.run_document(_doc(_TEXT))

    assert "INV-1024" in result.text
    assert result.engines_used == ("textlayer",)

    # Runtime executed the model → health + runtime telemetry are populated.
    health = engine.runtime.health.get("textlayer")
    assert health is not None and health.status == ModelStatus.HEALTHY
    assert any(e.stage == "runtime.ocr" for e in telemetry.events)


def test_textlayer_model_is_warm_cached_across_pages() -> None:
    engine = _engine_with_isolated_runtime()
    doc = make_document([make_clean_page(), make_clean_page()])
    doc.raw["page_texts"] = [_TEXT, _TEXT]

    engine.run_document(doc)

    # One load, many calls → proves the runtime reused the warm instance.
    health = engine.runtime.health.get("textlayer")
    assert health is not None
    assert health.loads == 1
    assert health.calls >= 2
