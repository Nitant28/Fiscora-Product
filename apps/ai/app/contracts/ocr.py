"""
OCR contract — the typed hand-off from the OCR Intelligence layer to downstream
stages (Layout / Vision / Extraction).

Design goals:
- Engine-agnostic: nothing here mentions PaddleOCR/Tesseract/Surya. Any engine
  produces the same shape, so engines are swappable and fusible.
- Traceable: every word carries its winning engine and confidence so extraction
  and human review can explain "where did this value come from".
- Serialisable: ``as_dict`` produces stable JSON for storage, telemetry, and the
  evaluation harness.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(slots=True, frozen=True)
class BoundingBox:
    """Axis-aligned box in pixel space (top-left origin)."""

    x: int
    y: int
    w: int
    h: int

    @property
    def x2(self) -> int:
        return self.x + self.w

    @property
    def y2(self) -> int:
        return self.y + self.h

    @property
    def area(self) -> int:
        return max(0, self.w) * max(0, self.h)

    @property
    def cx(self) -> float:
        return self.x + self.w / 2.0

    @property
    def cy(self) -> float:
        return self.y + self.h / 2.0

    def iou(self, other: "BoundingBox") -> float:
        """Intersection-over-union with another box (0.0 when disjoint)."""
        ix1 = max(self.x, other.x)
        iy1 = max(self.y, other.y)
        ix2 = min(self.x2, other.x2)
        iy2 = min(self.y2, other.y2)
        iw = max(0, ix2 - ix1)
        ih = max(0, iy2 - iy1)
        inter = iw * ih
        if inter == 0:
            return 0.0
        union = self.area + other.area - inter
        return inter / union if union > 0 else 0.0

    @staticmethod
    def union(boxes: list["BoundingBox"]) -> "BoundingBox":
        x1 = min(b.x for b in boxes)
        y1 = min(b.y for b in boxes)
        x2 = max(b.x2 for b in boxes)
        y2 = max(b.y2 for b in boxes)
        return BoundingBox(x1, y1, x2 - x1, y2 - y1)

    def as_list(self) -> list[int]:
        return [self.x, self.y, self.w, self.h]


@dataclass(slots=True)
class OcrWord:
    text: str
    confidence: float  # 0.0 .. 1.0
    box: BoundingBox
    engine: str  # engine whose reading won for this token
    # Engines that independently agreed on this exact token (incl. `engine`).
    agreed_by: tuple[str, ...] = ()
    line_id: int = -1

    def as_dict(self) -> dict[str, object]:
        return {
            "text": self.text,
            "confidence": round(self.confidence, 4),
            "box": self.box.as_list(),
            "engine": self.engine,
            "agreed_by": list(self.agreed_by),
            "line_id": self.line_id,
        }


@dataclass(slots=True)
class OcrLine:
    text: str
    confidence: float
    box: BoundingBox
    words: list[OcrWord] = field(default_factory=list)

    def as_dict(self) -> dict[str, object]:
        return {
            "text": self.text,
            "confidence": round(self.confidence, 4),
            "box": self.box.as_list(),
            "words": [w.as_dict() for w in self.words],
        }


@dataclass(slots=True)
class PageOcr:
    page_number: int
    text: str
    confidence: float
    width: int
    height: int
    lines: list[OcrLine] = field(default_factory=list)
    engines: tuple[str, ...] = ()

    @property
    def word_count(self) -> int:
        return sum(len(line.words) for line in self.lines)

    def low_confidence_words(self, threshold: float) -> list[OcrWord]:
        return [
            w
            for line in self.lines
            for w in line.words
            if w.confidence < threshold
        ]

    def as_dict(self) -> dict[str, object]:
        return {
            "page_number": self.page_number,
            "confidence": round(self.confidence, 4),
            "width": self.width,
            "height": self.height,
            "word_count": self.word_count,
            "engines": list(self.engines),
            "lines": [line.as_dict() for line in self.lines],
        }


@dataclass(slots=True)
class OcrContract:
    """Full-document OCR result handed to Layout / Vision / Extraction."""

    pages: list[PageOcr]
    text: str
    confidence: float
    engines_used: tuple[str, ...]
    processing_time_ms: float
    fusion_applied: bool = False
    # Mean confidence contributed by each engine (observability / A-B tests).
    per_engine_confidence: dict[str, float] = field(default_factory=dict)

    @property
    def word_count(self) -> int:
        return sum(p.word_count for p in self.pages)

    def low_confidence_words(self, threshold: float) -> list[OcrWord]:
        return [w for p in self.pages for w in p.low_confidence_words(threshold)]

    def as_dict(self) -> dict[str, object]:
        return {
            "confidence": round(self.confidence, 4),
            "engines_used": list(self.engines_used),
            "fusion_applied": self.fusion_applied,
            "processing_time_ms": round(self.processing_time_ms, 2),
            "word_count": self.word_count,
            "per_engine_confidence": {
                k: round(v, 4) for k, v in self.per_engine_confidence.items()
            },
            "pages": [p.as_dict() for p in self.pages],
        }
