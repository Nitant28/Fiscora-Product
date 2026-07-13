"""
Tesseract adapter — the always-installable fallback engine.

Strengths: offline, wide language coverage, decent on clean printed text and old
scans. Used as a fallback and as a fusion voter. Requires the `tesseract` binary
plus the `pytesseract` wrapper; both are imported lazily.
"""

from __future__ import annotations

import shutil

from app.contracts.ocr import BoundingBox
from app.core.logger import logger
from app.services.ocr.engines.base import (
    OcrEngineAdapter,
    PageInput,
    RawPageResult,
    RawWord,
)
from app.services.ocr.exceptions import OcrEngineError


class TesseractEngine(OcrEngineAdapter):
    name = "tesseract"

    def __init__(self, lang: str = "eng") -> None:
        self.lang = lang
        self._pytesseract = None

    def is_available(self) -> bool:
        if shutil.which("tesseract") is None:
            return False
        try:
            import pytesseract  # noqa: F401
        except Exception:
            return False
        return True

    def _lib(self):
        if self._pytesseract is None:
            import pytesseract

            self._pytesseract = pytesseract
        return self._pytesseract

    def recognize(self, page: PageInput) -> RawPageResult:
        try:
            import cv2

            pytesseract = self._lib()
            # Tesseract prefers grayscale; TSV output gives per-word conf+boxes.
            gray = cv2.cvtColor(page.image, cv2.COLOR_BGR2GRAY)
            data = pytesseract.image_to_data(
                gray,
                lang=self.lang,
                output_type=pytesseract.Output.DICT,
            )
        except Exception as exc:  # pragma: no cover - env dependent
            raise OcrEngineError(self.name, str(exc)) from exc

        words: list[RawWord] = []
        n = len(data.get("text", []))
        for i in range(n):
            text = (data["text"][i] or "").strip()
            if not text:
                continue
            try:
                conf = float(data["conf"][i])
            except (TypeError, ValueError):
                conf = -1.0
            if conf < 0:  # tesseract uses -1 for non-text blocks
                continue
            words.append(
                RawWord(
                    text=text,
                    confidence=max(0.0, min(1.0, conf / 100.0)),
                    box=BoundingBox(
                        x=int(data["left"][i]),
                        y=int(data["top"][i]),
                        w=int(data["width"][i]),
                        h=int(data["height"][i]),
                    ),
                )
            )

        logger.info("ocr.tesseract", words=len(words))
        return RawPageResult(words=words)
