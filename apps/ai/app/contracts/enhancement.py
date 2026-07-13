"""
Enhancement contract — the typed hand-off from the Image Intelligence layer to
downstream stages (Layout / OCR / Vision).

Downstream services must depend ONLY on this contract, never on the enhancement
implementation, so the enhancement engine can evolve (new transforms, new
metrics) without breaking the pipeline.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.contracts.document import DocumentContract
from app.contracts.quality import QualityMetrics


@dataclass(slots=True)
class EnhancementContract:
    # Enhanced (or pass-through) document ready for the next stage.
    document: DocumentContract

    # Definitive quality metrics (post-enhancement when transforms ran).
    quality: QualityMetrics

    # Wall-clock time spent in the enhancement engine.
    processing_time_ms: float

    # Names of transforms actually executed, in execution order.
    applied_transforms: list[str] = field(default_factory=list)

    # True when the document was already good enough and left untouched.
    skipped: bool = False

    # Quality measured before / after enhancement (for observability & A/B).
    quality_before: QualityMetrics | None = None
    quality_after: QualityMetrics | None = None

    @property
    def improved(self) -> bool:
        if self.quality_before is None or self.quality_after is None:
            return False
        return self.quality_after.score > self.quality_before.score

    @property
    def score_delta(self) -> float:
        if self.quality_before is None or self.quality_after is None:
            return 0.0
        return round(self.quality_after.score - self.quality_before.score, 2)

    def as_dict(self) -> dict[str, object]:
        return {
            "processing_time_ms": round(self.processing_time_ms, 2),
            "applied_transforms": self.applied_transforms,
            "skipped": self.skipped,
            "score_delta": self.score_delta,
            "quality": self.quality.as_dict(),
            "quality_before": (
                self.quality_before.as_dict() if self.quality_before else None
            ),
            "quality_after": (
                self.quality_after.as_dict() if self.quality_after else None
            ),
        }
