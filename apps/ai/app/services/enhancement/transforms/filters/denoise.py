"""Denoise — edge-preserving denoising.

Uses a bilateral filter by default: it suppresses sensor/compression noise while
keeping the sharp glyph edges OCR depends on (unlike a plain gaussian/median blur
which smears text). Non-local-means is available for heavier noise.
"""

from __future__ import annotations

import cv2
import numpy as np

from app.services.enhancement.transforms.base import ImageTransform


class DenoiseTransform(ImageTransform):
    name = "denoise"

    def __init__(self, mode: str = "bilateral", strength: int = 7) -> None:
        self.mode = mode
        self.strength = strength

    def apply(self, image: np.ndarray) -> np.ndarray:
        if self.mode == "nlmeans":
            return cv2.fastNlMeansDenoisingColored(
                image, None, self.strength, self.strength, 7, 21
            )
        return cv2.bilateralFilter(image, d=5, sigmaColor=self.strength * 10, sigmaSpace=7)
