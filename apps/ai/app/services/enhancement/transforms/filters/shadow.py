"""
Shadow / uneven-illumination removal.

Estimates the low-frequency background of each channel (dilate + median blur),
then divides it out so the page is flattened to a uniform white with crisp dark
text. This is the standard trick for phone-captured documents with gradients.
"""

from __future__ import annotations

import cv2
import numpy as np

from app.services.enhancement.transforms.base import ImageTransform


class ShadowRemovalTransform(ImageTransform):
    name = "shadow"

    def __init__(self, dilate_kernel: int = 7, blur_kernel: int = 21) -> None:
        self.dilate_kernel = dilate_kernel
        self.blur_kernel = blur_kernel if blur_kernel % 2 == 1 else blur_kernel + 1

    def apply(self, image: np.ndarray) -> np.ndarray:
        kernel = np.ones((self.dilate_kernel, self.dilate_kernel), np.uint8)
        planes = cv2.split(image)
        result = []
        for plane in planes:
            dilated = cv2.dilate(plane, kernel)
            background = cv2.medianBlur(dilated, self.blur_kernel)
            diff = 255 - cv2.absdiff(plane, background)
            normalised = cv2.normalize(
                diff, None, 0, 255, cv2.NORM_MINMAX, dtype=cv2.CV_8U
            )
            result.append(normalised)
        return cv2.merge(result)
