"""
Bridges OCR engine adapters into the AI Runtime as ``RuntimeModel`` descriptors.

This is what enforces the golden rule for OCR: the OCR *service* decides which
engines to run (routing), but the actual inference goes through the runtime
(lifecycle, retries, timeout, telemetry, warm-caching). Swapping/adding an engine
is a registry change, not a business-logic change.
"""

from __future__ import annotations

import threading
from typing import Any

from app.core.config import get_settings
from app.runtime.contracts import Device, ModelDescriptor, Task
from app.runtime.model import RuntimeModel
from app.runtime.registry import ModelRegistry
from app.services.ocr.engines.base import OcrEngineAdapter
from app.services.ocr.engines.paddle import PaddleEngine
from app.services.ocr.engines.tesseract import TesseractEngine
from app.services.ocr.engines.textlayer import TextLayerEngine


class OcrRuntimeModel(RuntimeModel):
    """Adapts an ``OcrEngineAdapter`` to the runtime's ``RuntimeModel`` interface."""

    def __init__(self, adapter: OcrEngineAdapter) -> None:
        self._adapter = adapter
        self.name = adapter.name

    def predict(self, inputs: Any):
        return self._adapter.recognize(inputs)

    def health(self) -> bool:
        return self._adapter.is_available()


def _device() -> Device:
    return Device.CUDA if get_settings().DEVICE == "cuda" else Device.CPU


# Descriptor table — the single place engines are declared to the runtime.
_DESCRIPTORS: tuple[ModelDescriptor, ...] = (
    ModelDescriptor(
        name="textlayer",
        version="1.0",
        task=Task.OCR,
        factory=lambda: OcrRuntimeModel(TextLayerEngine()),
        framework="native",
        device=Device.CPU,
        license="n/a",
        priority=10,  # exact digital text → always preferred when present
        availability=lambda: True,
    ),
    ModelDescriptor(
        name="paddle",
        version="paddleocr-3.x",
        task=Task.OCR,
        factory=lambda: OcrRuntimeModel(PaddleEngine(use_gpu=_device() == Device.CUDA)),
        framework="paddleocr",
        device=_device(),
        languages=("en", "ch"),
        doc_types=("invoice", "purchase_order", "receipt", "generic"),
        license="Apache-2.0",
        dependencies=("paddleocr", "paddlepaddle"),
        priority=20,
        availability=lambda: PaddleEngine().is_available(),
    ),
    ModelDescriptor(
        name="tesseract",
        version="tesseract-5.x",
        task=Task.OCR,
        factory=lambda: OcrRuntimeModel(TesseractEngine()),
        framework="tesseract",
        device=Device.CPU,
        languages=("eng",),
        doc_types=("generic",),
        license="Apache-2.0",
        dependencies=("pytesseract", "tesseract"),
        priority=30,
        availability=lambda: TesseractEngine().is_available(),
    ),
)

_registered_into: set[int] = set()
_lock = threading.Lock()


def register_ocr_models(registry: ModelRegistry) -> None:
    """Idempotently register OCR engines into the given registry."""
    key = id(registry)
    if key in _registered_into:
        return
    with _lock:
        if key in _registered_into:
            return
        for descriptor in _DESCRIPTORS:
            registry.register(descriptor, replace=False)
        _registered_into.add(key)
