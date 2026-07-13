"""
Configuration for the Image Intelligence layer.

All thresholds, normalisation bands and score weights live here (never hard-coded
in the analysers) so behaviour is tunable per deployment and unit-testable. The
weights intentionally sum to 1.0; `_validate` enforces that at construction time.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache


@dataclass(frozen=True, slots=True)
class Band:
    """Linear normalisation band mapping a raw value to a 0-100 sub-score.

    `lo` maps to 0, `hi` maps to 100. When `higher_is_better` is False the mapping
    is inverted (values <= lo score 100, values >= hi score 0).
    """

    lo: float
    hi: float
    higher_is_better: bool = True

    def score(self, value: float) -> float:
        if self.hi == self.lo:
            return 100.0
        t = (value - self.lo) / (self.hi - self.lo)
        t = max(0.0, min(1.0, t))
        pct = t * 100.0
        return pct if self.higher_is_better else (100.0 - pct)


@dataclass(frozen=True, slots=True)
class EnhancementConfig:
    # --- Normalisation bands (raw measurement -> 0-100 sub-score) ------------
    sharpness_band: Band = Band(lo=15.0, hi=300.0, higher_is_better=True)
    brightness_lo: float = 200.0     # ideal mean luminance for a scanned page
    brightness_sigma: float = 55.0   # tolerance around the ideal (gaussian falloff)
    contrast_band: Band = Band(lo=20.0, hi=70.0, higher_is_better=True)
    noise_band: Band = Band(lo=1.0, hi=25.0, higher_is_better=False)
    skew_band: Band = Band(lo=0.2, hi=8.0, higher_is_better=False)
    shadow_band: Band = Band(lo=0.03, hi=0.35, higher_is_better=False)
    exposure_band: Band = Band(lo=0.0, hi=0.20, higher_is_better=False)
    resolution_band: Band = Band(lo=0.5, hi=4.0, higher_is_better=True)  # megapixels

    # --- Overall score weights (must sum to 1.0) -----------------------------
    weights: dict[str, float] = field(
        default_factory=lambda: {
            "sharpness": 0.30,
            "contrast": 0.20,
            "noise": 0.15,
            "skew": 0.12,
            "brightness": 0.10,
            "shadow": 0.08,
            "exposure": 0.05,
        }
    )

    # --- Grade cut-offs on the overall 0-100 score ---------------------------
    grade_excellent: float = 80.0
    grade_good: float = 65.0
    grade_fair: float = 45.0

    # --- Decision triggers: run a transform when a sub-score drops below -----
    skip_all_above_score: float = 85.0   # globally good -> touch nothing
    deskew_min_angle_deg: float = 1.0     # only correct meaningful skew
    deskew_max_angle_deg: float = 15.0    # refuse implausible rotations
    contrast_trigger: float = 55.0
    denoise_trigger: float = 55.0
    shadow_trigger: float = 55.0
    threshold_contrast_trigger: float = 30.0
    threshold_noise_trigger: float = 35.0

    # --- Transform bounds ----------------------------------------------------
    max_width_px: int = 2480              # ~A4 @ 300 DPI long edge
    min_ocr_dpi: int = 200

    def __post_init__(self) -> None:
        total = round(sum(self.weights.values()), 6)
        if total != 1.0:
            raise ValueError(f"Enhancement score weights must sum to 1.0, got {total}")

    def grade_for(self, score: float) -> str:
        if score >= self.grade_excellent:
            return "excellent"
        if score >= self.grade_good:
            return "good"
        if score >= self.grade_fair:
            return "fair"
        return "poor"


@lru_cache
def get_enhancement_config() -> EnhancementConfig:
    return EnhancementConfig()
