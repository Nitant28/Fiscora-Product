"""
Quality contract for the Image Intelligence layer.

`QualityMetrics` is the immutable, typed output of the Quality Engine. It carries
both the raw physical measurements (so downstream stages can reason about them)
and normalised 0-100 sub-scores (so humans and the decision engine can compare
apples to apples). The overall `score` is a weighted blend of the sub-scores.

Field ordering keeps the original seven fields first for backward compatibility
with any caller that constructs `QualityMetrics(blur=..., brightness=...)`.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(slots=True)
class QualityMetrics:
    # --- Raw measurements (physical units) -----------------------------------
    blur: float          # Laplacian variance — higher = sharper
    brightness: float    # mean luminance 0-255
    contrast: float      # luminance std 0-255
    noise: float         # estimated gaussian sigma (0-255 scale)
    dpi: int             # effective dots-per-inch
    rotation: float      # coarse orientation in degrees (0/90/180/270)
    score: float         # overall quality, 0-100 (higher = better)

    # --- Extended measurements (defaulted for backward compatibility) --------
    sharpness: float = 0.0     # Tenengrad gradient energy
    skew: float = 0.0          # fine skew angle in degrees (signed)
    exposure: float = 0.0      # clipped-pixel fraction 0-1 (lower = better)
    shadow: float = 0.0        # illumination unevenness 0-1 (lower = better)
    width: int = 0
    height: int = 0
    is_grayscale: bool = False

    # --- Normalised 0-100 sub-scores (higher = better) -----------------------
    subscores: dict[str, float] = field(default_factory=dict)

    # --- Human-readable grade: excellent | good | fair | poor ----------------
    grade: str = "unknown"

    @property
    def resolution(self) -> tuple[int, int]:
        return (self.width, self.height)

    @property
    def megapixels(self) -> float:
        return round((self.width * self.height) / 1_000_000, 2)

    def as_dict(self) -> dict[str, object]:
        """Flat, JSON-serialisable view for telemetry / API responses."""
        return {
            "score": round(self.score, 2),
            "grade": self.grade,
            "blur": round(self.blur, 2),
            "sharpness": round(self.sharpness, 2),
            "brightness": round(self.brightness, 2),
            "contrast": round(self.contrast, 2),
            "noise": round(self.noise, 3),
            "skew": round(self.skew, 3),
            "exposure": round(self.exposure, 4),
            "shadow": round(self.shadow, 4),
            "rotation": self.rotation,
            "dpi": self.dpi,
            "width": self.width,
            "height": self.height,
            "megapixels": self.megapixels,
            "is_grayscale": self.is_grayscale,
            "subscores": {k: round(v, 2) for k, v in self.subscores.items()},
        }
