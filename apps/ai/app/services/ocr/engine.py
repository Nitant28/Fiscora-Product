"""
OCR Engine — the public entry point of the OCR Intelligence layer.

Flow (per page):
    select engines (text layer preferred; else image engines, fusion-capable)
        -> recognise with each engine (isolated failures)
            -> fuse detections (vote + agreement boost)
                -> assemble reading order into lines
                    -> aggregate confidence
    -> emit a typed OcrContract + telemetry, and populate the document text layer
       so downstream extraction consumes fused text without touching OCR internals.

Downstream stages depend ONLY on ``OcrContract``. Engines are resolved through
the ModelRegistry so heavy runtimes (PaddleOCR) load once and are reused.
"""

from __future__ import annotations

from time import perf_counter

import cv2
import numpy as np

from app.contracts.document import DocumentContract, DocumentPage
from app.contracts.enhancement import EnhancementContract
from app.contracts.ocr import OcrContract, PageOcr
from app.core.logger import logger
from app.runtime.contracts import Task
from app.runtime.engine import AIRuntime, get_ai_runtime
from app.runtime.exceptions import ExecutionExhausted, NoModelForTask
from app.services.ocr.config import OcrConfig, get_ocr_config
from app.services.ocr.confidence import ConfidenceEngine
from app.services.ocr.engines.base import PageInput, RawPageResult
from app.services.ocr.exceptions import NoEngineAvailableError
from app.services.ocr.fusion import FusionEngine
from app.services.ocr.reading_order import ReadingOrder
from app.services.ocr.runtime_models import register_ocr_models

_TEXTLAYER = "textlayer"


class OCREngine:
    def __init__(
        self,
        config: OcrConfig | None = None,
        telemetry=None,
        runtime: AIRuntime | None = None,
    ) -> None:
        self.config = config or get_ocr_config()
        self.telemetry = telemetry
        self.fusion = FusionEngine(self.config)
        self.reading_order = ReadingOrder(self.config)
        self.confidence = ConfidenceEngine(self.config)
        # All OCR inference flows through the AI Runtime (never called directly).
        self.runtime = runtime or get_ai_runtime()
        register_ocr_models(self.runtime.registry)

    # ------------------------------------------------------------------ public
    def run(self, enhancement: EnhancementContract) -> OcrContract:
        return self.run_document(enhancement.document)

    def run_document(self, document: DocumentContract) -> OcrContract:
        start = perf_counter()
        if not document.pages:
            raise NoEngineAvailableError("Document has no pages to OCR")

        pages: list[PageOcr] = []
        engines_used: set[str] = set()
        fusion_applied = False
        per_engine_conf: dict[str, list[float]] = {}
        any_engine_ran = False

        for page in document.pages:
            page_input = self._page_input(document, page)
            active = self._select_engines(page_input)

            raw: dict[str, list] = {}
            for name in active:
                try:
                    execution = self.runtime.execute(
                        Task.OCR, page_input, model=name
                    )
                except (ExecutionExhausted, NoModelForTask) as exc:
                    logger.warning("ocr.engine_failed", engine=name, error=str(exc))
                    continue
                result: RawPageResult = execution.output
                raw[name] = result.words
                engines_used.add(name)
                any_engine_ran = True
                per_engine_conf.setdefault(name, []).append(result.mean_confidence)

            if len([e for e in raw if raw[e]]) >= 2:
                fusion_applied = True

            fused = self.fusion.fuse(raw)
            lines = self.reading_order.assemble(fused)
            page_conf = self.confidence.page_confidence(lines)
            page_text = "\n".join(line.text for line in lines)

            pages.append(
                PageOcr(
                    page_number=page.page_number,
                    text=page_text,
                    confidence=page_conf,
                    width=page.width,
                    height=page.height,
                    lines=lines,
                    engines=tuple(sorted(raw.keys())),
                )
            )

        if not any_engine_ran:
            raise NoEngineAvailableError(
                "No OCR engine available (install paddleocr/tesseract or supply "
                "a document text layer)"
            )

        doc_conf = self.confidence.document_confidence(pages)
        full_text = "\n\n".join(p.text for p in pages)
        elapsed = (perf_counter() - start) * 1000.0

        contract = OcrContract(
            pages=pages,
            text=full_text,
            confidence=doc_conf,
            engines_used=tuple(sorted(engines_used)),
            processing_time_ms=elapsed,
            fusion_applied=fusion_applied,
            per_engine_confidence={
                name: sum(vals) / len(vals)
                for name, vals in per_engine_conf.items()
                if vals
            },
        )

        # Publish fused text back onto the document so extraction (which reads
        # ``raw['text']``) benefits without any coupling to the OCR layer.
        document.raw["text"] = full_text
        document.raw["ocr"] = contract.as_dict()

        self._emit(contract)
        return contract

    # --------------------------------------------------------------- internals
    def _select_engines(self, page: PageInput) -> list[str]:
        """Route: pick engine *names*; the runtime performs the inference.

        Preference order comes from ``engine_order``, gated by each model's
        availability probe in the runtime registry.
        """
        registry = self.runtime.registry
        available = [
            name
            for name in self.config.engine_order
            if registry.has(name) and registry.get(name).is_available()
        ]

        has_text_layer = bool(
            page.text_layer
            and len(page.text_layer.strip()) >= self.config.text_layer_min_chars
        )

        if (
            has_text_layer
            and self.config.prefer_text_layer
            and not self.config.force_ocr
        ):
            return [n for n in available if n == _TEXTLAYER][:1]

        image_engines = [n for n in available if n != _TEXTLAYER]
        if image_engines:
            return image_engines[: self.config.max_engines_per_page]

        # No pixel engine installed → fall back to any text layer we do have.
        if page.text_layer and page.text_layer.strip():
            return [n for n in available if n == _TEXTLAYER][:1]
        return []

    def _page_input(
        self, document: DocumentContract, page: DocumentPage
    ) -> PageInput:
        text_layer = self._page_text(document, page)
        image = self._to_bgr(page)
        return PageInput(
            image=image,
            width=page.width,
            height=page.height,
            dpi=page.dpi or 300,
            text_layer=text_layer,
        )

    @staticmethod
    def _page_text(document: DocumentContract, page: DocumentPage) -> str | None:
        page_texts = document.raw.get("page_texts")
        if isinstance(page_texts, list):
            idx = page.page_number - 1
            if 0 <= idx < len(page_texts) and page_texts[idx]:
                return str(page_texts[idx])
        # Single-page fallback: whole-document text layer belongs to page 1.
        if page.page_number == 1 and document.raw.get("text"):
            return str(document.raw["text"])
        return None

    @staticmethod
    def _to_bgr(page: DocumentPage) -> np.ndarray:
        if page.image is None:
            return np.zeros((max(1, page.height), max(1, page.width), 3), np.uint8)
        arr = np.array(page.image)
        if arr.ndim == 2:
            return cv2.cvtColor(arr, cv2.COLOR_GRAY2BGR)
        if arr.shape[2] == 4:
            return cv2.cvtColor(arr, cv2.COLOR_RGBA2BGR)
        return cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)

    def _emit(self, contract: OcrContract) -> None:
        logger.info(
            "ocr.complete",
            engines=list(contract.engines_used),
            fusion=contract.fusion_applied,
            confidence=round(contract.confidence, 3),
            words=contract.word_count,
            ms=round(contract.processing_time_ms, 2),
        )
        if self.telemetry is not None:
            self.telemetry.record(
                "ocr",
                contract.processing_time_ms,
                confidence=contract.confidence,
                model="+".join(contract.engines_used) or "none",
                metadata={
                    "fusion": contract.fusion_applied,
                    "words": contract.word_count,
                    "per_engine": contract.per_engine_confidence,
                },
            )


class OCRService:
    """Backward-compatible thin wrapper over :class:`OCREngine`.

    Kept so existing imports keep working; new code should use ``OCREngine``.
    """

    def __init__(self) -> None:
        self._engine = OCREngine()

    def run_document(self, document: DocumentContract) -> OcrContract:
        return self._engine.run_document(document)
