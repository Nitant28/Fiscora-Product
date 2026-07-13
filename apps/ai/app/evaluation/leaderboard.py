from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(slots=True)
class LeaderboardEntry:
    model_name: str
    accuracy: float
    latency_ms: float


class Leaderboard:
    """Stores simple benchmark rankings for model comparison."""

    def __init__(self, path: str | Path | None = None) -> None:
        self.path = Path(path or "benchmarks/leaderboard.json")
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.entries: list[LeaderboardEntry] = []

    def add(self, entry: LeaderboardEntry) -> None:
        self.entries.append(entry)

    def to_dict(self) -> list[dict[str, Any]]:
        return [
            {
                "model_name": entry.model_name,
                "accuracy": entry.accuracy,
                "latency_ms": entry.latency_ms,
            }
            for entry in sorted(self.entries, key=lambda item: (-item.accuracy, item.latency_ms))
        ]

    def save(self) -> None:
        self.path.write_text(__import__("json").dumps(self.to_dict(), indent=2), encoding="utf-8")
