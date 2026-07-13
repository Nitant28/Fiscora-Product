"""
Health & telemetry tracking for runtime-managed models.

Keeps per-model operational state — status, call/failure counts, a rolling
latency window — so the runtime can make routing decisions and operators get
observable dashboards ("which model is slow / failing?").
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from statistics import mean

from app.runtime.contracts import ModelStatus

_LATENCY_WINDOW = 50


@dataclass(slots=True)
class HealthRecord:
    status: ModelStatus = ModelStatus.REGISTERED
    loads: int = 0
    calls: int = 0
    failures: int = 0
    consecutive_failures: int = 0
    last_error: str | None = None
    last_latency_ms: float = 0.0
    _latencies: deque[float] = field(default_factory=lambda: deque(maxlen=_LATENCY_WINDOW))

    @property
    def mean_latency_ms(self) -> float:
        return mean(self._latencies) if self._latencies else 0.0

    @property
    def success_rate(self) -> float:
        return (self.calls - self.failures) / self.calls if self.calls else 1.0

    def as_dict(self) -> dict[str, object]:
        return {
            "status": self.status.value,
            "loads": self.loads,
            "calls": self.calls,
            "failures": self.failures,
            "consecutive_failures": self.consecutive_failures,
            "success_rate": round(self.success_rate, 4),
            "mean_latency_ms": round(self.mean_latency_ms, 2),
            "last_latency_ms": round(self.last_latency_ms, 2),
            "last_error": self.last_error,
        }


class HealthTracker:
    def __init__(self) -> None:
        self._records: dict[str, HealthRecord] = {}

    def record(self, name: str) -> HealthRecord:
        return self._records.setdefault(name, HealthRecord())

    def set_status(self, name: str, status: ModelStatus) -> None:
        self.record(name).status = status

    def on_load(self, name: str) -> None:
        rec = self.record(name)
        rec.loads += 1

    def on_success(self, name: str, latency_ms: float) -> None:
        rec = self.record(name)
        rec.calls += 1
        rec.consecutive_failures = 0
        rec.last_latency_ms = latency_ms
        rec._latencies.append(latency_ms)
        rec.status = ModelStatus.HEALTHY

    def on_failure(self, name: str, error: str) -> None:
        rec = self.record(name)
        rec.calls += 1
        rec.failures += 1
        rec.consecutive_failures += 1
        rec.last_error = error
        # Two strikes → degraded; the model stays registered and retryable.
        rec.status = (
            ModelStatus.FAILED
            if rec.consecutive_failures >= 3
            else ModelStatus.DEGRADED
        )

    def get(self, name: str) -> HealthRecord | None:
        return self._records.get(name)

    def snapshot(self) -> dict[str, dict[str, object]]:
        return {name: rec.as_dict() for name, rec in self._records.items()}
