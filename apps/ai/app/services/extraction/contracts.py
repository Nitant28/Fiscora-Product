"""
Extraction contracts.

Rule 5: *every extracted field must include provenance*. No value appears without
evidence — which graph nodes / engines produced it, its bounding box, page, the
model versions involved, and how long it took. This is what powers the
explainability UI ("click a field, see the source region") and auditor trust.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

from app.contracts.ocr import BoundingBox


@dataclass(slots=True)
class FieldEvidence:
    # Engines / stages that contributed (e.g. "textlayer", "paddleocr", "schema").
    sources: tuple[str, ...] = ()
    box: Optional[BoundingBox] = None
    page: Optional[int] = None
    # Graph node ids the value was read from (for highlight-on-click).
    node_ids: tuple[str, ...] = ()
    model_versions: dict[str, str] = field(default_factory=dict)
    processing_time_ms: float = 0.0

    def as_dict(self) -> dict[str, Any]:
        return {
            "sources": list(self.sources),
            "box": self.box.as_list() if self.box else None,
            "page": self.page,
            "node_ids": list(self.node_ids),
            "model_versions": self.model_versions,
            "processing_time_ms": round(self.processing_time_ms, 2),
        }


@dataclass(slots=True)
class ExtractedField:
    name: str
    value: Any
    raw_text: Optional[str]
    confidence: float
    evidence: FieldEvidence = field(default_factory=FieldEvidence)
    # Set by the Validation Engine: "passed" | "failed" | "unchecked".
    validation: str = "unchecked"

    def as_dict(self) -> dict[str, Any]:
        return {
            "value": self.value,
            "raw_text": self.raw_text,
            "confidence": round(self.confidence, 4),
            "validation": self.validation,
            "evidence": self.evidence.as_dict(),
        }


@dataclass(slots=True)
class LineItem:
    description: str
    quantity: Optional[float] = None
    rate: Optional[float] = None
    amount: Optional[float] = None
    confidence: float = 0.0

    def as_dict(self) -> dict[str, Any]:
        return {
            "description": self.description,
            "quantity": self.quantity,
            "rate": self.rate,
            "amount": self.amount,
            "confidence": round(self.confidence, 4),
        }


@dataclass(slots=True)
class ExtractionResult:
    document_type: str
    fields: dict[str, ExtractedField] = field(default_factory=dict)
    line_items: list[LineItem] = field(default_factory=list)
    overall_confidence: float = 0.0
    # Populated by the Validation Engine.
    validation: list[dict[str, Any]] = field(default_factory=list)
    schema_version: str = "1.0"

    # ---- convenience accessors (typed value or None) ----
    def value(self, name: str) -> Any:
        f = self.fields.get(name)
        return f.value if f else None

    def confidence_of(self, name: str) -> float:
        f = self.fields.get(name)
        return f.confidence if f else 0.0

    def as_dict(self) -> dict[str, Any]:
        return {
            "document_type": self.document_type,
            "schema_version": self.schema_version,
            "overall_confidence": round(self.overall_confidence, 4),
            "fields": {k: v.as_dict() for k, v in self.fields.items()},
            "line_items": [li.as_dict() for li in self.line_items],
            "validation": self.validation,
        }
