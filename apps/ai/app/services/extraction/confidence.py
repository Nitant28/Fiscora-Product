"""
Confidence Fusion (Rule 7).

Raw OCR confidence is never exposed on its own. The final confidence of each
field combines multiple independent signals:

    extraction confidence  × OCR-quality factor  × validation adjustment

and the document-level headline confidence is a weighted roll-up of the fields
that matter, hard-capped when a high-severity business rule fails (Rule 8: rules
override the model).
"""

from __future__ import annotations

from app.services.extraction.contracts import ExtractionResult
from app.services.extraction.schema import DocumentSchema, ValueKind
from app.services.validation.engine import ValidationIssue


class ConfidenceFusion:
    def fuse(
        self,
        result: ExtractionResult,
        schema: DocumentSchema,
        ocr_confidence: float,
        issues: list[ValidationIssue],
    ) -> ExtractionResult:
        ocr_factor = 0.5 + 0.5 * _clamp(ocr_confidence)
        passed_fields = self._validated_fields(issues)

        for field in result.fields.values():
            fused = field.confidence * ocr_factor
            if field.name in passed_fields or field.validation == "passed":
                fused = min(0.99, fused + 0.1)
            elif field.validation == "failed":
                fused *= 0.5
            field.confidence = round(_clamp(fused), 4)

        headline = self._headline(result, schema)

        # Business rules override the model: a failed high-severity rule caps the
        # document confidence and forces human review downstream.
        if any((not i.passed and i.severity == "high") for i in issues):
            headline = min(headline, 0.6)

        result.overall_confidence = round(_clamp(headline), 4)
        return result

    @staticmethod
    def _validated_fields(issues: list[ValidationIssue]) -> set[str]:
        # totals_math passing validates the `total` field specifically.
        return {"total"} if any(i.code == "totals_math" and i.passed for i in issues) else set()

    @staticmethod
    def _headline(result: ExtractionResult, schema: DocumentSchema) -> float:
        num = den = 0.0
        for spec in schema.fields:
            if spec.kind == ValueKind.MONEY and spec.name != "total":
                continue
            f = result.fields.get(spec.name)
            den += spec.weight
            num += (f.confidence if f else 0.0) * spec.weight
        return num / den if den else 0.0


def _clamp(x: float) -> float:
    return max(0.0, min(1.0, x))
