"""
Schema Engine (Rule 3).

Document types are *declared*, not coded. A ``DocumentSchema`` states WHAT a
document contains — its fields, their kinds, which are required, the labels that
typically anchor them, confidence thresholds, and which business rules apply.
The Extraction Engine reads these declarations and resolves values generically
over the Document Graph. Adding "Credit Note" or "Bill of Lading" support means
adding a schema, never writing a new regex extractor.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class ValueKind(str, Enum):
    STRING = "string"
    MONEY = "money"
    DATE = "date"
    NUMBER = "number"
    IDENTIFIER = "identifier"
    CURRENCY = "currency"
    TAX_ID = "tax_id"


class FieldRole(str, Enum):
    """How a field is located on the page — chooses the resolver strategy."""
    HEADER = "header"      # label-anchored value (Invoice No, Date, GSTIN…)
    PARTY = "party"        # vendor/customer block (top-of-doc / label block)
    TOTAL = "total"        # money near a totals label; excludes sub-totals
    DERIVED = "derived"    # computed/validated, not directly read


@dataclass(slots=True, frozen=True)
class FieldSpec:
    name: str
    kind: ValueKind
    role: FieldRole = FieldRole.HEADER
    required: bool = False
    # Label aliases that typically precede the value (case-insensitive).
    aliases: tuple[str, ...] = ()
    # Aliases that, if matched, DISQUALIFY a candidate (e.g. "sub" for total).
    negative_aliases: tuple[str, ...] = ()
    # Minimum confidence for the field to be auto-accepted (else human review).
    threshold: float = 0.6
    # Relative weight in the document-level confidence roll-up.
    weight: float = 1.0


@dataclass(slots=True, frozen=True)
class BusinessRuleRef:
    """Names a deterministic rule (resolved by the Validation Engine)."""
    code: str
    severity: str = "high"  # high | medium | low


@dataclass(slots=True, frozen=True)
class TableSpec:
    """Declares a line-item table and its expected columns."""
    columns: tuple[str, ...] = ("description", "quantity", "rate", "amount")
    header_hints: tuple[str, ...] = ("description", "item", "qty", "quantity", "rate", "price", "amount")


@dataclass(slots=True, frozen=True)
class DocumentSchema:
    doc_type: str
    version: str
    fields: tuple[FieldSpec, ...]
    rules: tuple[BusinessRuleRef, ...] = ()
    table: TableSpec | None = None
    # Keywords used by the classifier to recognise this document type.
    classifier_keywords: tuple[str, ...] = ()

    def field(self, name: str) -> FieldSpec | None:
        for f in self.fields:
            if f.name == name:
                return f
        return None

    @property
    def required_fields(self) -> tuple[str, ...]:
        return tuple(f.name for f in self.fields if f.required)
