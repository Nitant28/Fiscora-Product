"""Unit tests for individual image transforms."""

from __future__ import annotations

import numpy as np

from app.services.enhancement.quality_metrics import (
    contrast_std,
    skew_angle,
    to_gray,
)
from app.services.enhancement.transforms.filters.contrast import ContrastTransform
from app.services.enhancement.transforms.filters.denoise import DenoiseTransform
from app.services.enhancement.transforms.filters.shadow import ShadowRemovalTransform
from app.services.enhancement.transforms.filters.threshold import (
    AdaptiveThresholdTransform,
)
from app.services.enhancement.transforms.geometry.deskew import DeskewTransform
from app.services.enhancement.transforms.geometry.resize import ResizeTransform
from evaluation.synthetic_documents import degrade, make_clean_page


def _same_shape_and_dtype(before: np.ndarray, after: np.ndarray) -> None:
    assert after.dtype == np.uint8
    assert after.ndim == 3 and after.shape[2] == 3


def test_deskew_reduces_skew_angle() -> None:
    rotated = degrade(make_clean_page(), rotate=6.0)
    corrected = DeskewTransform().apply(rotated)
    assert abs(skew_angle(to_gray(corrected))) < abs(skew_angle(to_gray(rotated)))


def test_resize_caps_max_width() -> None:
    wide = make_clean_page(width=4000, height=2000)
    out = ResizeTransform(max_width=2480).apply(wide)
    assert out.shape[1] <= 2480


def test_resize_upscales_small_pages() -> None:
    small = make_clean_page(width=600, height=800)
    out = ResizeTransform(max_width=2480, min_width=1000).apply(small)
    assert out.shape[1] >= 1000


def test_contrast_increases_on_flat_image() -> None:
    flat = degrade(make_clean_page(), low_contrast=True)
    out = ContrastTransform().apply(flat)
    assert contrast_std(to_gray(out)) >= contrast_std(to_gray(flat))


def test_denoise_preserves_shape() -> None:
    noisy = degrade(make_clean_page(), noise=20.0)
    _same_shape_and_dtype(noisy, DenoiseTransform().apply(noisy))


def test_shadow_removal_preserves_shape() -> None:
    shadowed = degrade(make_clean_page(), shadow=True)
    _same_shape_and_dtype(shadowed, ShadowRemovalTransform().apply(shadowed))


def test_threshold_outputs_binary_bgr() -> None:
    out = AdaptiveThresholdTransform().apply(make_clean_page())
    _same_shape_and_dtype(make_clean_page(), out)
    unique = np.unique(to_gray(out))
    assert set(unique.tolist()).issubset({0, 255})


def test_transforms_expose_stable_names() -> None:
    assert DeskewTransform().name == "deskew"
    assert ResizeTransform().name == "resize"
    assert ContrastTransform().name == "contrast"
    assert DenoiseTransform().name == "denoise"
    assert ShadowRemovalTransform().name == "shadow"
    assert AdaptiveThresholdTransform().name == "threshold"
