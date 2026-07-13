"""OCR engine adapters (all conform to ``OcrEngineAdapter``)."""

from app.services.ocr.engines.base import (
    OcrEngineAdapter,
    PageInput,
    RawPageResult,
    RawWord,
)
from app.services.ocr.engines.paddle import PaddleEngine
from app.services.ocr.engines.tesseract import TesseractEngine
from app.services.ocr.engines.textlayer import TextLayerEngine

__all__ = [
    "OcrEngineAdapter",
    "PageInput",
    "RawPageResult",
    "RawWord",
    "PaddleEngine",
    "TesseractEngine",
    "TextLayerEngine",
]
