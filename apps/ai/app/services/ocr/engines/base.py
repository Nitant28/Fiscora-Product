"""
OCR engine adapter contract.

Every concrete engine (PaddleOCR, Tesseract, Surya, digital text layer, …)
implements this tiny interface and returns the same ``RawPageResult``. That
uniformity is what makes fusion, benchmarking, and hot-swapping possible.

Heavy engine dependencies (paddleocr, torch, pytesseract) must be imported
lazily inside ``is_available``/``recognize`` so importing this package never
pulls in multi-hundred-MB model runtimes.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field

import numpy as np

from app.contracts.ocr import BoundingBox


@dataclass(slots=True)
class RawWord:
    """A single token as produced by one engine (pre-fusion)."""

    text: str
    confidence: float
    box: BoundingBox


@dataclass(slots=True)
class RawPageResult:
    words: list[RawWord] = field(default_factory=list)

    @property
    def mean_confidence(self) -> float:
        if not self.words:
            return 0.0
        total = sum(len(w.text) for w in self.words)
        if total == 0:
            return 0.0
        return sum(w.confidence * len(w.text) for w in self.words) / total


@dataclass(slots=True)
class PageInput:
    """Everything an engine may need to read one page."""

    image: np.ndarray  # BGR uint8
    width: int
    height: int
    dpi: int = 300
    # Embedded digital-PDF text for this page, if any (used by TextLayerEngine).
    text_layer: str | None = None


class OcrEngineAdapter(ABC):
    """Base class for OCR engines. ``name`` must be stable (telemetry keys)."""

    name: str = "base"

    @abstractmethod
    def is_available(self) -> bool:
        """Whether this engine can run in the current environment."""

    @abstractmethod
    def recognize(self, page: PageInput) -> RawPageResult:
        """Recognise a single page. Must never mutate ``page``."""
