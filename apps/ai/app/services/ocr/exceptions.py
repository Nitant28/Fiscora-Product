"""Typed errors for the OCR Intelligence layer."""

from __future__ import annotations


class OcrError(Exception):
    """Base class for all OCR-layer failures."""


class NoEngineAvailableError(OcrError):
    """No OCR engine could run for a document (no models, no text layer)."""


class OcrEngineError(OcrError):
    """A concrete engine failed while recognising a page."""

    def __init__(self, engine: str, message: str) -> None:
        super().__init__(f"[{engine}] {message}")
        self.engine = engine
