"""Resize — downscale oversized captures so downstream models get consistent
input, and gently upscale very small pages toward an OCR-friendly resolution."""

from __future__ import annotations

import cv2
import numpy as np

from app.services.enhancement.transforms.base import ImageTransform


class ResizeTransform(ImageTransform):
    name = "resize"

    def __init__(self, max_width: int = 2480, min_width: int = 1000) -> None:
        self.max_width = max_width
        self.min_width = min_width

    def apply(self, image: np.ndarray) -> np.ndarray:
        h, w = image.shape[:2]

        if w > self.max_width:
            scale = self.max_width / w
            return cv2.resize(
                image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA
            )

        if w < self.min_width:
            scale = self.min_width / w
            return cv2.resize(
                image, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC
            )

        return image
