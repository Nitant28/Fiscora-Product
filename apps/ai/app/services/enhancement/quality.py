"""
Quality Engine (Layer 3).

Composes the pure measurements from ``quality_metrics`` into normalised 0-100
sub-scores and a single weighted overall score + human grade, driven entirely by
``EnhancementConfig``. This is the object the rest of the pipeline reasons about.
"""

from __future__ import annotations

import math

import numpy as np

from app.contracts.quality import QualityMetrics
from app.services.enhancement import quality_metrics as qm
from app.services.enhancement.config import (
    EnhancementConfig,
    get_enhancement_config,
)


class QualityAnalyzer:
    def __init__(self, config: EnhancementConfig | None = None) -> None:
        self.config = config or get_enhancement_config()

    def analyze(
        self,
        image: np.ndarray,
        dpi: int = 300,
    ) -> QualityMetrics:
        if image is None or getattr(image, "size", 0) == 0:
            raise ValueError("QualityAnalyzer.analyze received an empty image")

        cfg = self.config
        gray = qm.to_gray(image)
        height, width = gray.shape[:2]

        # --- Raw measurements ------------------------------------------------
        blur = qm.blur_variance(gray)
        sharpness = qm.sharpness_tenengrad(gray)
        brightness = qm.brightness_mean(gray)
        contrast = qm.contrast_std(gray)
        noise = qm.noise_sigma(gray)
        skew = qm.skew_angle(gray)
        exposure = qm.exposure_clip_fraction(gray)
        shadow = qm.shadow_unevenness(gray)
        megapixels = (width * height) / 1_000_000

        # --- Normalised sub-scores (0-100, higher = better) ------------------
        subscores = {
            "sharpness": cfg.sharpness_band.score(blur),
            "contrast": cfg.contrast_band.score(contrast),
            "noise": cfg.noise_band.score(noise),
            "skew": cfg.skew_band.score(abs(skew)),
            "brightness": self._brightness_score(brightness, cfg),
            "shadow": cfg.shadow_band.score(shadow),
            "exposure": cfg.exposure_band.score(exposure),
            "resolution": cfg.resolution_band.score(megapixels),
        }

        # --- Weighted overall score -----------------------------------------
        score = sum(subscores[k] * w for k, w in cfg.weights.items())
        score = float(max(0.0, min(100.0, score)))

        return QualityMetrics(
            blur=blur,
            brightness=brightness,
            contrast=contrast,
            noise=noise,
            dpi=int(dpi),
            rotation=0.0,
            score=score,
            sharpness=sharpness,
            skew=skew,
            exposure=exposure,
            shadow=shadow,
            width=int(width),
            height=int(height),
            is_grayscale=qm.is_grayscale(image),
            subscores=subscores,
            grade=cfg.grade_for(score),
        )

    @staticmethod
    def _brightness_score(brightness: float, cfg: EnhancementConfig) -> float:
        """Gaussian falloff around the ideal page luminance (both too-dark and
        too-bright are penalised symmetrically)."""
        z = (brightness - cfg.brightness_lo) / cfg.brightness_sigma
        return float(100.0 * math.exp(-0.5 * z * z))
