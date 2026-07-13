"""
Transform registry + pipeline builder.

The registry maps stable transform names to factories, so the decision engine can
express a plan as ``["deskew", "contrast"]`` and the pipeline materialises the
concrete, configured transform instances in canonical order.
"""

from __future__ import annotations

from typing import Callable

from app.services.enhancement.config import (
    EnhancementConfig,
    get_enhancement_config,
)
from app.services.enhancement.decision import CANONICAL_ORDER
from app.services.enhancement.transforms.base import ImageTransform
from app.services.enhancement.transforms.filters.contrast import ContrastTransform
from app.services.enhancement.transforms.filters.denoise import DenoiseTransform
from app.services.enhancement.transforms.filters.shadow import ShadowRemovalTransform
from app.services.enhancement.transforms.filters.threshold import (
    AdaptiveThresholdTransform,
)
from app.services.enhancement.transforms.geometry.deskew import DeskewTransform
from app.services.enhancement.transforms.geometry.orientation import (
    OrientationTransform,
)
from app.services.enhancement.transforms.geometry.resize import ResizeTransform


class EnhancementPipeline:
    def __init__(self, config: EnhancementConfig | None = None) -> None:
        self.config = config or get_enhancement_config()
        cfg = self.config
        self._factories: dict[str, Callable[[], ImageTransform]] = {
            "orientation": OrientationTransform,
            "deskew": lambda: DeskewTransform(
                min_angle=cfg.deskew_min_angle_deg,
                max_angle=cfg.deskew_max_angle_deg,
            ),
            "resize": lambda: ResizeTransform(max_width=cfg.max_width_px),
            "shadow": ShadowRemovalTransform,
            "contrast": ContrastTransform,
            "denoise": DenoiseTransform,
            "threshold": AdaptiveThresholdTransform,
        }

    @property
    def available(self) -> list[str]:
        return list(self._factories.keys())

    def build_from_plan(self, plan: list[str]) -> list[ImageTransform]:
        ordered = [t for t in CANONICAL_ORDER if t in plan]
        # Preserve any extra (non-canonical) names the caller explicitly asked for.
        ordered += [t for t in plan if t not in CANONICAL_ORDER]
        transforms: list[ImageTransform] = []
        for name in ordered:
            factory = self._factories.get(name)
            if factory is None:
                raise KeyError(f"Unknown transform: {name!r}")
            transforms.append(factory())
        return transforms

    def build(self) -> list[ImageTransform]:
        """Default full pipeline (used when no quality-driven plan is supplied)."""
        return self.build_from_plan(["deskew", "resize", "contrast", "denoise"])
