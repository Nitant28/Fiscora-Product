"""
AI Runtime contracts.

These types are the vocabulary every AI capability (OCR, layout, vision, …)
speaks. Business logic references only these — never a concrete model class — so
models are swappable, versionable, and A/B-testable without touching callers.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable


class Task(str, Enum):
    OCR = "ocr"
    LAYOUT = "layout"
    VISION = "vision"
    CLASSIFICATION = "classification"
    ENHANCEMENT = "enhancement"
    EXTRACTION = "extraction"


class Device(str, Enum):
    CPU = "cpu"
    CUDA = "cuda"
    AUTO = "auto"


class ModelStatus(str, Enum):
    REGISTERED = "registered"  # known, not yet loaded
    LOADING = "loading"
    WARM = "warm"  # loaded + warmed, ready
    HEALTHY = "healthy"  # served at least one call successfully
    DEGRADED = "degraded"  # recent failures, still registered
    FAILED = "failed"  # load/inference failing hard
    UNLOADED = "unloaded"  # evicted to free memory


@dataclass(frozen=True, slots=True)
class ModelDescriptor:
    """Registry v2 entry: everything the runtime needs to *decide* about a model
    without loading it. The heavy instance is built lazily via ``factory``."""

    name: str
    version: str
    task: Task
    factory: Callable[[], "object"]  # builds a RuntimeModel (lazy, may be heavy)
    framework: str = "custom"
    device: Device = Device.CPU
    languages: tuple[str, ...] = ()
    doc_types: tuple[str, ...] = ()
    license: str = "unknown"
    dependencies: tuple[str, ...] = ()
    # Lower = preferred when several models can serve the same task.
    priority: int = 100
    # Cheap probe: can this model run in this environment right now?
    availability: Callable[[], bool] | None = None

    def is_available(self) -> bool:
        if self.availability is None:
            return True
        try:
            return bool(self.availability())
        except Exception:
            return False

    def serves(
        self, task: Task, language: str | None = None, doc_type: str | None = None
    ) -> bool:
        if self.task != task:
            return False
        if language and self.languages and language not in self.languages:
            return False
        if doc_type and self.doc_types and doc_type not in self.doc_types:
            return False
        return True


@dataclass(slots=True)
class ExecutionResult:
    """Outcome of a single ``AIRuntime.execute`` call."""

    output: Any
    model: str
    version: str
    task: Task
    latency_ms: float
    attempts: int
    reused_warm: bool
    metadata: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return {
            "model": self.model,
            "version": self.version,
            "task": self.task.value,
            "latency_ms": round(self.latency_ms, 2),
            "attempts": self.attempts,
            "reused_warm": self.reused_warm,
            "metadata": self.metadata,
        }
