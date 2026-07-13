"""Unit tests for the quality-driven decision engine."""

from __future__ import annotations

from app.services.enhancement.decision import CANONICAL_ORDER, EnhancementDecision
from app.services.enhancement.quality import QualityAnalyzer
from evaluation.synthetic_documents import degrade, make_clean_page


def test_clean_page_skips_enhancement() -> None:
    analyzer = QualityAnalyzer()
    decision = EnhancementDecision()
    metrics = analyzer.analyze(make_clean_page())
    plan = decision.plan(metrics)
    # A clean page should require no illumination/noise repairs.
    assert "contrast" not in plan
    assert "denoise" not in plan
    assert "shadow" not in plan


def test_rotated_page_gets_deskew() -> None:
    analyzer = QualityAnalyzer()
    decision = EnhancementDecision()
    metrics = analyzer.analyze(degrade(make_clean_page(), rotate=6.0))
    assert "deskew" in decision.plan(metrics)


def test_degraded_page_triggers_repairs() -> None:
    analyzer = QualityAnalyzer()
    decision = EnhancementDecision()
    metrics = analyzer.analyze(
        degrade(make_clean_page(), noise=22.0, low_contrast=True, shadow=True)
    )
    plan = decision.plan(metrics)
    assert plan  # non-empty
    assert set(plan).issubset(set(CANONICAL_ORDER))


def test_plan_is_canonically_ordered() -> None:
    decision = EnhancementDecision()
    metrics = QualityAnalyzer().analyze(
        degrade(make_clean_page(), rotate=5.0, noise=22.0, low_contrast=True)
    )
    plan = decision.plan(metrics)
    indices = [CANONICAL_ORDER.index(t) for t in plan]
    assert indices == sorted(indices)
