"""
PaddleOCR adapter — the primary high-accuracy engine.

Strengths: fast, strong on printed text, invoices, and tables; good multilingual
support. Heavy (paddlepaddle + models), so both the import and model construction
are lazy and the built instance is cached by the caller via the ModelRegistry.
"""

from __future__ import annotations

from app.contracts.ocr import BoundingBox
from app.core.logger import logger
from app.services.ocr.engines.base import (
    OcrEngineAdapter,
    PageInput,
    RawPageResult,
    RawWord,
)
from app.services.ocr.exceptions import OcrEngineError


class PaddleEngine(OcrEngineAdapter):
    name = "paddle"

    def __init__(self, lang: str = "en", use_gpu: bool = False) -> None:
        self.lang = lang
        self.use_gpu = use_gpu
        self._ocr = None  # constructed on first use (expensive)

    def is_available(self) -> bool:
        try:
            import paddleocr  # noqa: F401
        except Exception:
            return False
        return True

    def _engine(self):
        if self._ocr is None:
            from paddleocr import PaddleOCR

            self._ocr = PaddleOCR(
                use_angle_cls=True,
                lang=self.lang,
                use_gpu=self.use_gpu,
                show_log=False,
            )
        return self._ocr

    @staticmethod
    def _quad_to_box(quad) -> BoundingBox:
        xs = [float(p[0]) for p in quad]
        ys = [float(p[1]) for p in quad]
        x1, y1 = min(xs), min(ys)
        x2, y2 = max(xs), max(ys)
        return BoundingBox(int(x1), int(y1), int(x2 - x1), int(y2 - y1))

    def recognize(self, page: PageInput) -> RawPageResult:
        try:
            engine = self._engine()
            raw = engine.ocr(page.image, cls=True)
        except Exception as exc:  # pragma: no cover - env dependent
            raise OcrEngineError(self.name, str(exc)) from exc

        words: list[RawWord] = []
        # PaddleOCR returns [ [ [quad, (text, conf)], ... ] ] (one list per image).
        page_lines = raw[0] if raw and isinstance(raw, list) else []
        for entry in page_lines or []:
            try:
                quad, (text, conf) = entry[0], entry[1]
            except (ValueError, TypeError, IndexError):
                continue
            text = (text or "").strip()
            if not text:
                continue
            # Paddle yields a line string; split into word tokens sharing the
            # line box so fusion/reading-order operate at word granularity.
            box = self._quad_to_box(quad)
            tokens = text.split()
            if not tokens:
                continue
            step = max(1, box.w // len(tokens))
            for idx, tok in enumerate(tokens):
                words.append(
                    RawWord(
                        text=tok,
                        confidence=max(0.0, min(1.0, float(conf))),
                        box=BoundingBox(
                            x=box.x + idx * step,
                            y=box.y,
                            w=step,
                            h=box.h,
                        ),
                    )
                )

        logger.info("ocr.paddle", words=len(words))
        return RawPageResult(words=words)
