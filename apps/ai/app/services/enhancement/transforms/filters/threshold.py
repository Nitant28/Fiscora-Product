"""
Adaptive threshold / binarisation.

Only selected for badly degraded, low-contrast, noisy text pages where a clean
bi-tonal image helps classic OCR. Produces a 3-channel image (grayscale copied
across channels) so the transform contract (BGR in -> BGR out) is preserved.
"""

from __future__ import annotations

import cv2
import numpy as np

from app.services.enhancement.quality_metrics import to_gray
from app.services.enhancement.transforms.base import ImageTransform


class AdaptiveThresholdTransform(ImageTransform):
    name = "threshold"

    def __init__(self, block_size: int = 35, c: int = 15) -> None:
        self.block_size = block_size if block_size % 2 == 1 else block_size + 1
        self.c = c

    def apply(self, image: np.ndarray) -> np.ndarray:
        gray = to_gray(image)
        binary = cv2.adaptiveThreshold(
            gray,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            self.block_size,
            self.c,
        )
        return cv2.cvtColor(binary, cv2.COLOR_GRAY2BGR)
