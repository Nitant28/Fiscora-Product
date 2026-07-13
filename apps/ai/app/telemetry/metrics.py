from __future__ import annotations

from dataclasses import dataclass, field
from time import perf_counter
from typing import Any


@dataclass(slots=True)
class TelemetryEvent:
    stage: str
    duration_ms: float
    confidence: float | None = None
    model: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


class TelemetryRecorder:
    """Lightweight recorder for stage-level AI pipeline metrics."""

    def __init__(self) -> None:
        self.events: list[TelemetryEvent] = []

    def record(self, stage: str, duration_ms: float, **kwargs: Any) -> TelemetryEvent:
        event = TelemetryEvent(stage=stage, duration_ms=duration_ms, **kwargs)
        self.events.append(event)
        return event

    def timed(self, stage: str, **kwargs: Any):
        def decorator(func):
            def wrapped(*args, **inner_kwargs):
                started = perf_counter()
                try:
                    return func(*args, **inner_kwargs)
                finally:
                    duration_ms = (perf_counter() - started) * 1000.0
                    self.record(stage, duration_ms, **kwargs)

            return wrapped

        return decorator
