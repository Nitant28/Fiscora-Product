"""
Orientation — coarse 0/90/180/270 correction.

EXIF-based rotation is handled at document load; true content-based orientation
(upside-down detection) requires a model (Surya) and lands with the OCR layer.
Until then this is an explicit, named no-op so the pipeline slot exists and is
testable rather than silently missing.
"""

from __future__ import annotations

import numpy as np

from app.services.enhancement.transforms.base import ImageTransform


class OrientationTransform(ImageTransform):
    name = "orientation"

    def apply(self, image: np.ndarray) -> np.ndarray:
        return image
