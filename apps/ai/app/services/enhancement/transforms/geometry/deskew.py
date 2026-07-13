"""Deskew — rotate a page so its text baselines are horizontal."""

from __future__ import annotations

import cv2
import numpy as np

from app.services.enhancement.quality_metrics import skew_angle, to_gray
from app.services.enhancement.transforms.base import ImageTransform


class DeskewTransform(ImageTransform):
    name = "deskew"

    def __init__(self, min_angle: float = 1.0, max_angle: float = 15.0) -> None:
        self.min_angle = min_angle
        self.max_angle = max_angle

    def apply(self, image: np.ndarray) -> np.ndarray:
        angle = skew_angle(to_gray(image))
        if not (self.min_angle <= abs(angle) <= self.max_angle):
            return image

        h, w = image.shape[:2]
        center = (w / 2.0, h / 2.0)
        matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
        return cv2.warpAffine(
            image,
            matrix,
            (w, h),
            flags=cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_REPLICATE,
        )
