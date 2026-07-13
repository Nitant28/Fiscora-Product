"""Registers the vision model into the AI Runtime registry (idempotent)."""

from __future__ import annotations

import threading

from app.runtime.contracts import Device, ModelDescriptor, Task
from app.runtime.registry import ModelRegistry
from app.services.vision.gemini import GeminiVisionModel, gemini_available

_DESCRIPTOR = ModelDescriptor(
    name="gemini-vision",
    version="gemini-flash",
    task=Task.VISION,
    factory=lambda: GeminiVisionModel(),
    framework="google-genai",
    device=Device.CPU,
    doc_types=("invoice", "receipt", "purchase_order", "utility_bill", "credit_note", "generic"),
    license="proprietary-api",
    dependencies=("gemini-api",),
    priority=10,
    availability=gemini_available,
)

_registered_into: set[int] = set()
_lock = threading.Lock()


def register_vision_models(registry: ModelRegistry) -> None:
    key = id(registry)
    if key in _registered_into:
        return
    with _lock:
        if key in _registered_into:
            return
        registry.register(_DESCRIPTOR, replace=False)
        _registered_into.add(key)
