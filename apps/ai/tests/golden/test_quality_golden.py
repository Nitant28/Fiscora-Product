"""
Golden tests — pin the Quality Engine's behaviour on deterministic reference
documents so accidental regressions in thresholds or scoring are caught. Ranges
(not exact values) keep the tests robust to minor OpenCV/scikit-image changes.
"""

from __future__ import annotations

from app.services.enhancement.quality import QualityAnalyzer
from evaluation.synthetic_documents import degrade, make_clean_page


def test_golden_clean_page_is_high_quality() -> None:
    metrics = QualityAnalyzer().analyze(make_clean_page())
    assert metrics.grade in {"excellent", "good"}
    assert metrics.subscores["sharpness"] >= 60.0
    assert metrics.subscores["contrast"] >= 60.0
    assert metrics.subscores["skew"] >= 90.0
    assert metrics.score >= 60.0


def test_golden_blurred_page_is_low_sharpness() -> None:
    metrics = QualityAnalyzer().analyze(degrade(make_clean_page(), blur=17))
    assert metrics.subscores["sharpness"] <= 40.0


def test_golden_rotated_page_reports_skew() -> None:
    metrics = QualityAnalyzer().analyze(degrade(make_clean_page(), rotate=6.0))
    assert abs(metrics.skew) >= 2.0
    assert metrics.subscores["skew"] <= 80.0


def test_golden_dark_page_low_brightness_subscore() -> None:
    metrics = QualityAnalyzer().analyze(degrade(make_clean_page(), darken=0.25))
    assert metrics.subscores["brightness"] <= 60.0
