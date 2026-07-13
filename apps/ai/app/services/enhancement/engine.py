"""
Enhancement Engine — the public entry point of the Image Intelligence layer.

Flow:
    measure quality (before)
        -> decide a targeted transform plan
            -> apply only the needed transforms (or skip)
                -> measure quality (after)
                    -> emit typed EnhancementContract + telemetry

Downstream stages consume only ``EnhancementContract``; they never import the
transforms or analyser, so this layer can evolve independently.
"""

from __future__ import annotations

from time import perf_counter

import cv2
import numpy as np

from app.contracts.document import DocumentContract
from app.contracts.enhancement import EnhancementContract
from app.contracts.quality import QualityMetrics
from app.core.logger import logger
from app.services.enhancement.config import (
    EnhancementConfig,
    get_enhancement_config,
)
from app.services.enhancement.decision import EnhancementDecision
from app.services.enhancement.exceptions import EmptyDocumentError, InvalidImageError
from app.services.enhancement.pipeline import EnhancementPipeline
from app.services.enhancement.processor import ImageProcessor
from app.services.enhancement.quality import QualityAnalyzer


class EnhancementEngine:
    def __init__(
        self,
        config: EnhancementConfig | None = None,
        telemetry=None,
    ) -> None:
        self.config = config or get_enhancement_config()
        self.telemetry = telemetry
        self.analyzer = QualityAnalyzer(self.config)
        self.decision = EnhancementDecision(self.config)
        self.pipeline = EnhancementPipeline(self.config)
        self.processor = ImageProcessor(telemetry=telemetry)

    def process(self, document: DocumentContract) -> EnhancementContract:
        start = perf_counter()

        if not document.pages:
            raise EmptyDocumentError("Document has no pages to enhance")

        first_page = document.pages[0]
        if first_page.image is None:
            raise InvalidImageError("First page has no image")

        dpi = first_page.dpi or self.config.min_ocr_dpi
        before = self.analyzer.analyze(self._first_page_bgr(document), dpi=dpi)

        plan = self.decision.plan(before)

        if not plan:
            elapsed = (perf_counter() - start) * 1000.0
            self._emit(before, [], elapsed, skipped=True)
            return EnhancementContract(
                document=document,
                quality=before,
                processing_time_ms=elapsed,
                applied_transforms=[],
                skipped=True,
                quality_before=before,
                quality_after=before,
            )

        transforms = self.pipeline.build_from_plan(plan)
        processed = self.processor.process(document, transforms)
        after = self.analyzer.analyze(self._first_page_bgr(processed), dpi=dpi)

        elapsed = (perf_counter() - start) * 1000.0
        self._emit(after, plan, elapsed, skipped=False)

        return EnhancementContract(
            document=processed,
            quality=after,
            processing_time_ms=elapsed,
            applied_transforms=plan,
            skipped=False,
            quality_before=before,
            quality_after=after,
        )

    @staticmethod
    def _first_page_bgr(document: DocumentContract) -> np.ndarray:
        arr = np.array(document.pages[0].image)
        if arr.ndim == 2:
            return cv2.cvtColor(arr, cv2.COLOR_GRAY2BGR)
        if arr.shape[2] == 4:
            return cv2.cvtColor(arr, cv2.COLOR_RGBA2BGR)
        return cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)

    def _emit(
        self,
        quality: QualityMetrics,
        plan: list[str],
        elapsed_ms: float,
        skipped: bool,
    ) -> None:
        logger.info(
            "enhancement.complete",
            skipped=skipped,
            applied=plan,
            score=round(quality.score, 2),
            grade=quality.grade,
            ms=round(elapsed_ms, 2),
        )
        if self.telemetry is not None:
            self.telemetry.record(
                "enhancement",
                elapsed_ms,
                confidence=quality.score / 100.0,
                metadata={"applied": plan, "skipped": skipped, "grade": quality.grade},
            )
