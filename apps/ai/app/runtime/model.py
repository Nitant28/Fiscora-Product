"""
RuntimeModel — the single interface every AI model implements.

The runtime owns lifecycle (load → warmup → predict → unload) and health; a model
only implements the inference. Heavy frameworks must be imported lazily inside
``load``/``predict`` so registering a descriptor never imports a model runtime.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class RuntimeModel(ABC):
    """Base class for all runtime-managed models."""

    #: Stable identifier, must match the registered descriptor name.
    name: str = "model"

    def load(self) -> None:
        """Construct/allocate the underlying model. Called once by the runtime."""

    def warmup(self) -> None:
        """Optional: run a dummy inference so the first real call isn't slow."""

    @abstractmethod
    def predict(self, inputs: Any) -> Any:
        """Perform inference. Must be pure w.r.t. ``inputs`` (no mutation)."""

    def health(self) -> bool:
        """Cheap readiness probe; the runtime uses it to gate execution."""
        return True

    def unload(self) -> None:
        """Release memory/GPU. Called by the runtime on LRU eviction/shutdown."""
