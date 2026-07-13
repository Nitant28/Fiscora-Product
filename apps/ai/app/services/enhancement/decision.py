"""
Enhancement decision engine.

Rather than a single global "enhance yes/no", this builds a *targeted plan*: the
minimal ordered list of transforms needed to fix the specific defects the Quality
Engine measured. Good pages get an empty plan (skipped), saving compute and never
degrading an already-clean scan.
"""

from __future__ import annotations

from app.contracts.quality import QualityMetrics
from app.services.enhancement.config import (
    EnhancementConfig,
    get_enhancement_config,
)

# Canonical execution order — geometry first, then illumination, then denoise,
# then (rarely) binarisation.
CANONICAL_ORDER = ["deskew", "resize", "shadow", "contrast", "denoise", "threshold"]


class EnhancementDecision:
    def __init__(self, config: EnhancementConfig | None = None) -> None:
        self.config = config or get_enhancement_config()

    def plan(self, metrics: QualityMetrics) -> list[str]:
        cfg = self.config
        sub = metrics.subscores
        selected: set[str] = set()

        # Geometry ------------------------------------------------------------
        if cfg.deskew_min_angle_deg <= abs(metrics.skew) <= cfg.deskew_max_angle_deg:
            selected.add("deskew")
        if metrics.width > cfg.max_width_px:
            selected.add("resize")

        # A globally clean page needs nothing but the cheap geometry fixes above
        # (skew/oversize are corrections, not quality repairs).
        if metrics.score >= cfg.skip_all_above_score:
            return [t for t in CANONICAL_ORDER if t in selected]

        # Illumination & noise repairs ---------------------------------------
        if sub.get("shadow", 100.0) < cfg.shadow_trigger:
            selected.add("shadow")
        if sub.get("contrast", 100.0) < cfg.contrast_trigger:
            selected.add("contrast")
        if sub.get("noise", 100.0) < cfg.denoise_trigger:
            selected.add("denoise")

        # Last resort: binarise only when contrast is very poor AND noisy.
        if (
            sub.get("contrast", 100.0) < cfg.threshold_contrast_trigger
            and sub.get("noise", 100.0) < cfg.threshold_noise_trigger
        ):
            selected.add("threshold")

        return [t for t in CANONICAL_ORDER if t in selected]

    def should_enhance(self, metrics: QualityMetrics) -> bool:
        """Backward-compatible boolean helper."""
        return len(self.plan(metrics)) > 0
