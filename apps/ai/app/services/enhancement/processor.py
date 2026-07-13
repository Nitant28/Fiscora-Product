"""
Image processor — applies an ordered list of transforms to every page of a
document, with per-transform error isolation and optional telemetry.

A failing transform is logged and skipped (the page keeps the last good image)
so one bad filter never aborts the whole document.
"""

from __future__ import annotations

import cv2
import numpy as np
from PIL import Image
from time import perf_counter

from app.contracts.document import DocumentContract
from app.core.logger import logger
from app.services.enhancement.transforms.base import ImageTransform


class ImageProcessor:
    def __init__(self, telemetry=None) -> None:
        self.telemetry = telemetry

    def process(
        self,
        document: DocumentContract,
        transforms: list[ImageTransform],
    ) -> DocumentContract:
        if not transforms:
            return document

        for page in document.pages:
            image = self._to_bgr(page.image)

            for transform in transforms:
                started = perf_counter()
                try:
                    result = transform.apply(image)
                    if result is not None and getattr(result, "size", 0) > 0:
                        image = result
                except Exception as exc:  # graceful degradation
                    logger.warning(
                        "enhancement.transform_failed",
                        transform=transform.name,
                        page=page.page_number,
                        error=str(exc),
                    )
                finally:
                    if self.telemetry is not None:
                        self.telemetry.record(
                            f"enhancement.{transform.name}",
                            (perf_counter() - started) * 1000.0,
                            metadata={"page": page.page_number},
                        )

            page.image = self._to_pil(image)

        return document

    @staticmethod
    def _to_bgr(pil_image: Image.Image) -> np.ndarray:
        arr = np.array(pil_image)
        if arr.ndim == 2:
            return cv2.cvtColor(arr, cv2.COLOR_GRAY2BGR)
        if arr.shape[2] == 4:
            return cv2.cvtColor(arr, cv2.COLOR_RGBA2BGR)
        return cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)

    @staticmethod
    def _to_pil(bgr: np.ndarray) -> Image.Image:
        return Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
