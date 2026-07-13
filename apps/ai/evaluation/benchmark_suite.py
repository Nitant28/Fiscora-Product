"""Composite benchmark suite wrapper."""

from dataclasses import dataclass
from typing import List


@dataclass
class BenchmarkSuite:
    """Container for a collection of benchmark runs."""

    name: str
    cases: List[dict]

    def run(self) -> List[dict]:
        return [dict(case) for case in self.cases]
