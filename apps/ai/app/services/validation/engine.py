"""
Business Validation Engine (Rule 8).

Deterministic rules run AFTER extraction and can *override* the AI. Money must
add up, dates must be ordered, required fields must exist. Rules are named in the
schema (``BusinessRuleRef``) and resolved here, so a document type opts into
exactly the checks it needs. Results are attached as evidence and feed confidence
fusion — a document whose totals don't reconcile cannot report high confidence,
no matter how sure the model was.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.services.extraction.contracts import ExtractionResult
from app.services.extraction.schema import DocumentSchema

_MATH_TOLERANCE = 1.0


@dataclass(slots=True)
class ValidationIssue:
    code: str
    passed: bool
    severity: str
    message: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "passed": self.passed,
            "severity": self.severity,
            "message": self.message,
        }


class ValidationEngine:
    def validate(self, result: ExtractionResult, schema: DocumentSchema) -> list[ValidationIssue]:
        issues: list[ValidationIssue] = []
        for rule in schema.rules:
            handler = getattr(self, f"_rule_{rule.code}", None)
            if handler is None:
                continue
            issue = handler(result, schema, rule.severity)
            if issue is not None:
                issues.append(issue)

        result.validation = [i.as_dict() for i in issues]
        return issues

    # ------------------------------------------------------------------ rules
    def _rule_required_fields(self, result, schema, severity) -> ValidationIssue:
        missing = [name for name in schema.required_fields if result.value(name) in (None, "")]
        if missing:
            return ValidationIssue(
                "required_fields", False, severity,
                f"Missing required field(s): {', '.join(missing)}",
            )
        return ValidationIssue("required_fields", True, severity, "All required fields present")

    def _rule_totals_math(self, result, schema, severity) -> ValidationIssue | None:
        subtotal = _num(result.value("subtotal"))
        total = _num(result.value("total"))
        if subtotal is None or total is None:
            return None  # not enough data to check — don't penalise
        tax = _num(result.value("tax")) or 0.0
        shipping = _num(result.value("shipping")) or 0.0
        discount = _num(result.value("discount")) or 0.0
        computed = subtotal + tax + shipping - discount
        passed = abs(computed - total) <= _MATH_TOLERANCE
        if "total" in result.fields:
            result.fields["total"].validation = "passed" if passed else "failed"
        return ValidationIssue(
            "totals_math", passed, severity,
            f"subtotal+tax+shipping-discount={computed:.2f} vs total={total:.2f}",
        )

    def _rule_date_order(self, result, schema, severity) -> ValidationIssue | None:
        inv = result.value("invoice_date")
        due = result.value("due_date")
        if not (isinstance(inv, str) and isinstance(due, str) and inv[:4].isdigit() and due[:4].isdigit()):
            return None
        passed = inv <= due  # ISO strings compare lexicographically
        return ValidationIssue(
            "date_order", passed, severity,
            f"invoice_date {inv} {'<=' if passed else '>'} due_date {due}",
        )

    def _rule_currency_present(self, result, schema, severity) -> ValidationIssue:
        present = result.value("currency") not in (None, "")
        return ValidationIssue(
            "currency_present", present, severity,
            "Currency detected" if present else "Currency not detected",
        )


def _num(value: Any) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    return None
