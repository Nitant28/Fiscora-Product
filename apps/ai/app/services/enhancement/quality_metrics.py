"""
Pure, independently-testable image-quality measurements.

Every function takes an OpenCV image (BGR uint8) or a grayscale array and returns
a single raw physical measurement. No normalisation, no scoring, no decisions —
those belong to the analyser and config. Keeping these pure makes them trivial to
unit-test with synthetic images and cheap to reuse in benchmarks.
"""

from __future__ import annotations

import cv2
import numpy as np

try:  # scikit-image is in requirements; degrade gracefully if unavailable.
    from skimage.restoration import estimate_sigma

    _HAS_SKIMAGE = True
except Exception:  # pragma: no cover - defensive import guard
    _HAS_SKIMAGE = False


def to_gray(image: np.ndarray) -> np.ndarray:
    """Return a single-channel uint8 grayscale view of any image."""
    if image.ndim == 2:
        return image
    if image.shape[2] == 4:
        image = cv2.cvtColor(image, cv2.COLOR_BGRA2BGR)
    return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)


def is_grayscale(image: np.ndarray, tolerance: int = 8) -> bool:
    """True when colour channels are near-identical (scanned B/W document)."""
    if image.ndim == 2:
        return True
    b, g, r = cv2.split(image[:, :, :3])
    return bool(
        np.mean(cv2.absdiff(b, g)) < tolerance
        and np.mean(cv2.absdiff(g, r)) < tolerance
    )


def blur_variance(gray: np.ndarray) -> float:
    """Laplacian variance — the classic focus/blur measure. Higher = sharper."""
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def sharpness_tenengrad(gray: np.ndarray) -> float:
    """Tenengrad gradient energy — a second, complementary sharpness signal."""
    gx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
    return float(np.mean(gx * gx + gy * gy))


def brightness_mean(gray: np.ndarray) -> float:
    """Mean luminance (0-255)."""
    return float(np.mean(gray))


def contrast_std(gray: np.ndarray) -> float:
    """Global contrast as luminance standard deviation (0-255)."""
    return float(np.std(gray))


def _noise_sigma_mad(gray: np.ndarray) -> float:
    """Dependency-free noise estimate: robust MAD of a high-pass residual
    (image minus its median-blurred self)."""
    residual = gray.astype(np.float32) - cv2.medianBlur(gray, 3).astype(np.float32)
    mad = float(np.median(np.abs(residual - np.median(residual))))
    return 1.4826 * mad


def noise_sigma(gray: np.ndarray) -> float:
    """Estimated gaussian noise sigma.

    Prefers scikit-image's wavelet estimator, but that optionally depends on
    PyWavelets; if it is unavailable at call time we fall back to a robust
    median-absolute-deviation estimate so the layer never hard-fails on a noise
    reading.
    """
    if _HAS_SKIMAGE:
        try:
            sigma = estimate_sigma(gray, average_sigmas=True)
            if sigma is not None:
                return float(sigma)
        except Exception:  # e.g. PyWavelets missing — degrade gracefully
            pass
    return _noise_sigma_mad(gray)


def skew_angle(gray: np.ndarray, min_pixels: int = 50) -> float:
    """Fine skew angle in degrees (signed) via the minimum-area rectangle of the
    dark (text) pixels. Returns 0.0 when there is too little foreground."""
    thresh = cv2.threshold(
        gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
    )[1]
    coords = np.column_stack(np.where(thresh > 0)).astype(np.float32)
    if coords.shape[0] < min_pixels:
        return 0.0
    # np.where yields (row, col); minAreaRect expects (x, y) = (col, row).
    coords = coords[:, ::-1]
    angle = cv2.minAreaRect(coords)[-1]
    # Normalise to a signed [-45, 45] skew. Rotating the image by this value
    # (as DeskewTransform does) undoes the skew.
    if angle > 45:
        angle -= 90
    elif angle < -45:
        angle += 90
    return float(angle)


def exposure_clip_fraction(gray: np.ndarray, low: int = 4, high: int = 251) -> float:
    """Fraction of pixels crushed to black or blown to white (0-1).

    Excludes the natural document extremes by using slightly inset thresholds, so
    a clean page (white bg + black text) scores low, while genuinely over/under
    exposed captures score high.
    """
    total = gray.size
    if total == 0:
        return 0.0
    crushed = int(np.count_nonzero(gray <= low))
    blown = int(np.count_nonzero(gray >= high))
    # A well-exposed page is mostly paper; only count clipping beyond ~35% white.
    blown_excess = max(0, blown - int(0.35 * total))
    return float((crushed + blown_excess) / total)


def shadow_unevenness(gray: np.ndarray, kernel: int = 51) -> float:
    """Illumination unevenness 0-1: std of the low-frequency background over its
    mean. High values indicate shadows / gradient lighting across the page."""
    k = kernel if kernel % 2 == 1 else kernel + 1
    background = cv2.GaussianBlur(gray.astype(np.float32), (k, k), 0)
    mean = float(np.mean(background))
    if mean <= 1e-6:
        return 1.0
    return float(np.clip(np.std(background) / mean, 0.0, 1.0))
