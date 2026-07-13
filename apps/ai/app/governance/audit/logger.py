from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class AuditEntry:
    event_type: str
    detail: dict[str, Any] = field(default_factory=dict)


class AuditLogger:
    """Simple audit sink for production-grade governance hooks."""

    def __init__(self) -> None:
        self.entries: list[AuditEntry] = []

    def log(self, event_type: str, **detail: Any) -> AuditEntry:
        entry = AuditEntry(event_type=event_type, detail=detail)
        self.entries.append(entry)
        return entry
