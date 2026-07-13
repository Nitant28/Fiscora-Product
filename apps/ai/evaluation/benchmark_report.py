"""Report generation helpers for benchmark output."""

from pathlib import Path
from typing import Iterable


def write_markdown_report(path: Path, rows: Iterable[dict]) -> Path:
    """Write a simple markdown benchmark summary."""

    lines = ["# Benchmark Report", "", "| name | score |", "| --- | --- |"]
    for row in rows:
        score = row.get("score", 0)
        lines.append(f"| {row.get('name', 'unknown')} | {score} |")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path
