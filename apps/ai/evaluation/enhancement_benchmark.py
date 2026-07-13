"""
Enhancement benchmark.

Sweeps a matrix of synthetic defect profiles through the Enhancement Engine and
reports, per profile: quality score before/after, the transforms selected, and
per-document latency. Also prints an aggregate throughput summary.

Run:  python -m evaluation.enhancement_benchmark   (from apps/ai)
"""

from __future__ import annotations

import statistics
from dataclasses import dataclass
from time import perf_counter

from app.services.enhancement.engine import EnhancementEngine
from app.telemetry.metrics import TelemetryRecorder
from evaluation.synthetic_documents import degrade, make_clean_page, make_document


@dataclass
class Profile:
    name: str
    kwargs: dict


PROFILES = [
    Profile("clean", {}),
    Profile("blurred", {"blur": 15}),
    Profile("noisy", {"noise": 22.0}),
    Profile("dark", {"darken": 0.35}),
    Profile("low_contrast", {"low_contrast": True}),
    Profile("skewed", {"rotate": 6.0}),
    Profile("shadowed", {"shadow": True}),
    Profile("worst_case", {"blur": 9, "noise": 18.0, "low_contrast": True, "rotate": 4.0, "shadow": True}),
]


def run(iterations: int = 3) -> None:
    engine = EnhancementEngine(telemetry=TelemetryRecorder())

    header = f"{'profile':<14}{'before':>8}{'after':>8}{'delta':>8}{'ms':>9}  transforms"
    print(header)
    print("-" * len(header))

    latencies: list[float] = []
    deltas: list[float] = []

    for profile in PROFILES:
        base = make_clean_page()
        image = degrade(base, **profile.kwargs) if profile.kwargs else base

        best_ms = float("inf")
        result = None
        for _ in range(iterations):
            doc = make_document([image])
            start = perf_counter()
            result = engine.process(doc)
            best_ms = min(best_ms, (perf_counter() - start) * 1000.0)

        before = result.quality_before.score if result.quality_before else 0.0
        after = result.quality_after.score if result.quality_after else 0.0
        applied = ",".join(result.applied_transforms) or "(skipped)"

        latencies.append(best_ms)
        deltas.append(after - before)

        print(
            f"{profile.name:<14}{before:>8.1f}{after:>8.1f}"
            f"{after - before:>8.1f}{best_ms:>9.1f}  {applied}"
        )

    print("-" * len(header))
    print(f"documents:        {len(PROFILES)}")
    print(f"median latency:   {statistics.median(latencies):.1f} ms/doc")
    print(f"p95 latency:      {sorted(latencies)[int(len(latencies) * 0.95) - 1]:.1f} ms/doc")
    print(f"throughput:       {1000.0 / statistics.mean(latencies):.1f} docs/sec (single core)")
    print(f"mean score delta: {statistics.mean(deltas):+.1f}")


if __name__ == "__main__":
    run()
