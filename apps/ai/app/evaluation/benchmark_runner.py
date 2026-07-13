from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.evaluation.metrics.ocr_metrics import OCRMetrics


class BenchmarkRunner:
    """Produces a JSON report for a single pipeline run."""

    def __init__(self, output_dir: str | Path | None = None) -> None:
        self.output_dir = Path(output_dir or "benchmarks")
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def run(self, result: dict[str, Any], expected_text: str, duration_ms: float) -> dict[str, Any]:
        report = {
            "accuracy": OCRMetrics.word_accuracy(result.get("raw_text", ""), expected_text),
            "latency_ms": OCRMetrics.latency_ms(duration_ms),
            "result": result,
        }
        self._write_report(report)
        return report

    def _write_report(self, report: dict[str, Any]) -> None:
        timestamp = Path("latest").name
        report_path = self.output_dir / f"benchmark_{timestamp}.json"
        report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
