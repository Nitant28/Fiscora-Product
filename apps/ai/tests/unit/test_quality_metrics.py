"""Unit tests for the pure quality-measurement functions."""

from __future__ import annotations

from app.services.enhancement import quality_metrics as qm
from evaluation.synthetic_documents import degrade, make_clean_page


def test_sharpness_drops_when_blurred() -> None:
    clean = qm.to_gray(make_clean_page())
    blurred = qm.to_gray(degrade(make_clean_page(), blur=15))
    assert qm.blur_variance(clean) > qm.blur_variance(blurred)


def test_brightness_drops_when_darkened() -> None:
    clean = qm.to_gray(make_clean_page())
    dark = qm.to_gray(degrade(make_clean_page(), darken=0.3))
    assert qm.brightness_mean(dark) < qm.brightness_mean(clean)


def test_noise_estimate_rises_with_noise() -> None:
    clean = qm.to_gray(make_clean_page())
    noisy = qm.to_gray(degrade(make_clean_page(), noise=25.0))
    assert qm.noise_sigma(noisy) > qm.noise_sigma(clean)


def test_contrast_drops_when_flattened() -> None:
    clean = qm.to_gray(make_clean_page())
    flat = qm.to_gray(degrade(make_clean_page(), low_contrast=True))
    assert qm.contrast_std(flat) < qm.contrast_std(clean)


def test_skew_angle_detected_on_rotation() -> None:
    rotated = qm.to_gray(degrade(make_clean_page(), rotate=6.0))
    detected = qm.skew_angle(rotated)
    assert abs(detected) > 2.0  # meaningful skew is picked up


def test_shadow_unevenness_rises_with_gradient() -> None:
    clean = qm.to_gray(make_clean_page())
    shadowed = qm.to_gray(degrade(make_clean_page(), shadow=True))
    assert qm.shadow_unevenness(shadowed) > qm.shadow_unevenness(clean)


def test_grayscale_detection() -> None:
    assert qm.is_grayscale(make_clean_page()) is True
