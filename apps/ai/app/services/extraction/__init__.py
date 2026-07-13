"""
Extraction Intelligence — schema-driven, graph-based field extraction.

Public surface:
    ExtractionEngine   — extract structured fields from a DocumentGraph.
    ExtractionResult   — typed result with per-field provenance & confidence.
    DocumentSchema     — declarative document definition (fields/validators/rules).
    SCHEMA_LIBRARY     — registry of supported document types.
"""

from app.services.extraction.contracts import (
    ExtractedField,
    ExtractionResult,
    FieldEvidence,
    LineItem,
)
from app.services.extraction.engine import ExtractionEngine
from app.services.extraction.schema import DocumentSchema, FieldSpec, ValueKind
from app.services.extraction.library import SCHEMA_LIBRARY, get_schema

__all__ = [
    "ExtractionEngine",
    "ExtractionResult",
    "ExtractedField",
    "FieldEvidence",
    "LineItem",
    "DocumentSchema",
    "FieldSpec",
    "ValueKind",
    "SCHEMA_LIBRARY",
    "get_schema",
]
