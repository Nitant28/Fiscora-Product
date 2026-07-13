from __future__ import annotations

from pathlib import Path
from shutil import copy2
from typing import Any


class FailureGallery:
    """Collects failed benchmark samples into a structured gallery."""

    def __init__(self, output_dir: str | Path | None = None) -> None:
        self.output_dir = Path(output_dir or "benchmarks/failures")
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def store(self, source_path: str | Path, reason: str) -> Path:
        source = Path(source_path)
        destination = self.output_dir / f"{source.stem}_{reason}{source.suffix}"
        copy2(source, destination)
        return destination
