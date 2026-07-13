from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(slots=True)
class DocumentLoadResult:
    document_type: str
    source: str
    pages: int
    metadata: dict[str, Any]
