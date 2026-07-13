"""Unit tests for the composed Quality Engine."""

from __future__ import annotations

import pytest

from app.services.enhancement.config import get_enhancement_config
from app.services.enhancement.quality import QualityAnalyzer
from evaluation.synthetic_documents import degrade, make_clean_page


@pytest.fixture()
def analyzer() -> QualityAnalyzer:
    return QualityAnalyzer(get_enhancement_config())


def test_clean_page_scores_higher_than_degraded(analyzer: QualityAnalyzer) -> None:
    clean = analyzer.analyze(make_clean_page())
    degraded = analyzer.analyze(
        degrade(make_clean_page(), blur=15, noise=20.0, darken=0.4)
    )
    assert clean.score > degraded.score


def test_score_and_subscores_are_bounded(analyzer: QualityAnalyzer) -> None:
    metrics = analyzer.analyze(make_clean_page())
    assert 0.0 <= metrics.score <= 100.0
    for name, value in metrics.subscores.items():
        assert 0.0 <= value <= 100.0, name


def test_grade_assigned_and_serialisable(analyzer: QualityAnalyzer) -> None:
    metrics = analyzer.analyze(make_clean_page())
    assert metrics.grade in {"excellent", "good", "fair", "poor"}
    payload = metrics.as_dict()
    assert payload["grade"] == metrics.grade
    assert "subscores" in payload


def test_empty_image_raises(analyzer: QualityAnalyzer) -> None:
    import numpy as np

    with pytest.raises(ValueError):
        analyzer.analyze(np.empty((0, 0, 3), dtype=np.uint8))
