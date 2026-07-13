"""Contrast — CLAHE (Contrast Limited Adaptive Histogram Equalisation) on the L
channel, which lifts faded text without blowing out already-bright regions."""

from __future__ import annotations

import cv2
import numpy as np

from app.services.enhancement.transforms.base import ImageTransform


class ContrastTransform(ImageTransform):
    name = "contrast"

    def __init__(self, clip_limit: float = 2.0, tile_grid: int = 8) -> None:
        self.clip_limit = clip_limit
        self.tile_grid = tile_grid

    def apply(self, image: np.ndarray) -> np.ndarray:
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(
            clipLimit=self.clip_limit,
            tileGridSize=(self.tile_grid, self.tile_grid),
        )
        l = clahe.apply(l)
        return cv2.cvtColor(cv2.merge((l, a, b)), cv2.COLOR_LAB2BGR)
