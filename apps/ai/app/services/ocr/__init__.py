"""OCR Intelligence layer.

Engine-agnostic, fusion-based OCR. Downstream stages depend only on
``app.contracts.ocr.OcrContract``; engines plug in behind ``OcrEngineAdapter``.
"""

from app.services.ocr.config import OcrConfig, get_ocr_config
from app.services.ocr.engine import OCREngine, OCRService

__all__ = ["OCREngine", "OCRService", "OcrConfig", "get_ocr_config"]
