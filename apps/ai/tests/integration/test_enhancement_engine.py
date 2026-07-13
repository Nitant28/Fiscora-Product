"""Integration tests for the end-to-end Enhancement Engine."""

from __future__ import annotations

import pytest

from app.contracts.enhancement import EnhancementContract
from app.services.enhancement.engine import EnhancementEngine
from app.services.enhancement.exceptions import EmptyDocumentError
from app.contracts.document import DocumentContract
from app.telemetry.metrics import TelemetryRecorder
from evaluation.synthetic_documents import degrade, make_clean_page, make_document


def test_engine_skips_clean_document() -> None:
    engine = EnhancementEngine()
    doc = make_document([make_clean_page()])
    result = engine.process(doc)

    assert isinstance(result, EnhancementContract)
    assert result.skipped is True
    assert result.applied_transforms == []
    assert result.quality_before is not None
    assert result.processing_time_ms >= 0.0


def test_engine_enhances_degraded_document() -> None:
    engine = EnhancementEngine()
    degraded = degrade(
        make_clean_page(), rotate=5.0, noise=20.0, low_contrast=True, shadow=True
    )
    doc = make_document([degraded])
    result = engine.process(doc)

    assert result.skipped is False
    assert result.applied_transforms  # at least one repair ran
    assert result.quality_after is not None
    # Enhancement must never make quality materially worse.
    assert result.score_delta >= -2.0
    assert len(result.document.pages) == 1


def test_engine_records_telemetry() -> None:
    telemetry = TelemetryRecorder()
    engine = EnhancementEngine(telemetry=telemetry)
    doc = make_document([degrade(make_clean_page(), noise=22.0, low_contrast=True)])
    engine.process(doc)

    stages = {e.stage for e in telemetry.events}
    assert "enhancement" in stages


def test_engine_preserves_page_count() -> None:
    engine = EnhancementEngine()
    doc = make_document([make_clean_page(), degrade(make_clean_page(), blur=9)])
    result = engine.process(doc)
    assert len(result.document.pages) == 2


def test_engine_raises_on_empty_document() -> None:
    engine = EnhancementEngine()
    with pytest.raises(EmptyDocumentError):
        engine.process(DocumentContract(pages=[]))
