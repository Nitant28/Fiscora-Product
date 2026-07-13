"""Dataset helpers for benchmark and golden-document evaluation."""

from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional


@dataclass
class BenchmarkDataset:
    """Represents a benchmark dataset collection used by the AI service."""

    name: str
    root: Optional[Path] = None
    documents: List[str] = field(default_factory=list)

    @classmethod
    def default_dataset(cls) -> "BenchmarkDataset":
        """Return the default benchmark dataset root for procurement documents."""

        root = Path(__file__).resolve().parents[1] / "datasets"
        return cls(name="procurement-benchmark", root=root, documents=[])

    def iter_documents(self) -> List[Path]:
        """Yield document paths from the dataset tree when present."""

        if not self.root:
            return []
        return sorted(path for path in self.root.rglob("*") if path.is_file())
