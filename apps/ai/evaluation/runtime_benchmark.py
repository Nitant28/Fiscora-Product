"""
AI Runtime micro-benchmark.

Measures the runtime's own overhead (dispatch, timeout guard, health/telemetry)
independent of any real model, plus cold-vs-warm and retry cost. Run:

    cd apps/ai && python -m evaluation.runtime_benchmark
"""

from __future__ import annotations

import statistics
import time

from app.runtime.config import RuntimeConfig
from app.runtime.contracts import ModelDescriptor, Task
from app.runtime.engine import AIRuntime
from app.runtime.model import RuntimeModel
from app.runtime.registry import ModelRegistry


class _NoOp(RuntimeModel):
    def __init__(self, work_ms: float = 0.0) -> None:
        self.work_ms = work_ms

    def predict(self, inputs):
        if self.work_ms:
            time.sleep(self.work_ms / 1000.0)
        return inputs


def _percentiles(samples: list[float]) -> dict[str, float]:
    s = sorted(samples)
    n = len(s)
    return {
        "p50": s[int(n * 0.50)],
        "p95": s[int(n * 0.95)],
        "p99": s[min(n - 1, int(n * 0.99))],
        "mean": statistics.fmean(s),
    }


def bench(iterations: int = 2000, work_ms: float = 0.0) -> None:
    reg = ModelRegistry()
    reg.register(
        ModelDescriptor(
            name="noop",
            version="1.0",
            task=Task.OCR,
            factory=lambda: _NoOp(work_ms),
        )
    )
    rt = AIRuntime(registry=reg, config=RuntimeConfig(timeout_s=5.0))

    # Cold call (includes load + warmup).
    t0 = time.perf_counter()
    rt.execute(Task.OCR, 0, model="noop")
    cold_ms = (time.perf_counter() - t0) * 1000.0

    latencies: list[float] = []
    start = time.perf_counter()
    for i in range(iterations):
        t = time.perf_counter()
        rt.execute(Task.OCR, i, model="noop")
        latencies.append((time.perf_counter() - t) * 1000.0)
    wall = time.perf_counter() - start

    pcts = _percentiles(latencies)
    print("== AI Runtime benchmark ==")
    print(f"iterations       : {iterations}")
    print(f"model work/call  : {work_ms:.2f} ms")
    print(f"cold call        : {cold_ms:.3f} ms (load+warmup+predict)")
    print(f"throughput       : {iterations / wall:,.0f} calls/s")
    print(
        "warm latency ms  : "
        f"p50={pcts['p50']:.3f} p95={pcts['p95']:.3f} "
        f"p99={pcts['p99']:.3f} mean={pcts['mean']:.3f}"
    )
    print(f"health           : {rt.health_report()['noop']}")
    rt.shutdown()


if __name__ == "__main__":
    bench()
    print()
    bench(iterations=500, work_ms=1.0)
