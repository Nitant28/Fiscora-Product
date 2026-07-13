"""
Extraction Engine.

Given a Document Graph, it: classifies the document type, selects the declared
schema, resolves every field generically via :class:`GraphResolver`, and parses
the line-item table. It performs NO document-type-specific coding — behaviour is
entirely driven by the schema library, so the engine is reusable across every
current and future document type (Rule 3 / Rule 14).

Confidence here is the *extraction* confidence only. It is later fused with OCR
and validation signals by :mod:`app.services.extraction.confidence` (Rule 7).
"""

from __future__ import annotations

import re
from typing import Optional

from app.contracts.graph import DocumentGraph
from app.services.extraction.contracts import (
    ExtractedField,
    ExtractionResult,
    LineItem,
)
from app.services.extraction.library import classify, get_schema
from app.services.extraction.normalize import detect_currency, parse_money
from app.services.extraction.resolvers import GraphResolver
from app.services.extraction.schema import DocumentSchema, ValueKind


class ExtractionEngine:
    def extract(
        self,
        graph: DocumentGraph,
        doc_type: Optional[str] = None,
    ) -> ExtractionResult:
        text = graph.text
        doc_type = doc_type or classify(text)
        schema = get_schema(doc_type)
        resolver = GraphResolver(graph)

        result = ExtractionResult(document_type=schema.doc_type, schema_version=schema.version)

        for spec in schema.fields:
            field = resolver.resolve(spec)
            if field is not None and field.value not in (None, ""):
                result.fields[spec.name] = field

        # Currency fallback: detect from anywhere in the document if not labelled.
        if "currency" not in result.fields:
            cur = detect_currency(text)
            if cur:
                result.fields["currency"] = ExtractedField(
                    name="currency", value=cur, raw_text=None, confidence=0.6,
                )

        if schema.table is not None:
            result.line_items = self._extract_line_items(graph, schema)

        result.overall_confidence = self._provisional_confidence(result, schema)
        return result

    # ------------------------------------------------------------- line items
    def _extract_line_items(self, graph: DocumentGraph, schema: DocumentSchema) -> list[LineItem]:
        hints = schema.table.header_hints if schema.table else ()
        lines = graph.lines
        items: list[LineItem] = []
        in_table = False

        for line in lines:
            low = line.text.lower()
            if not in_table:
                if sum(1 for h in hints if h in low) >= 2:
                    in_table = True
                continue
            if re.match(r"^\s*(subtotal|sub total|total|tax|shipping|discount|balance|notes|terms)\b", low):
                break
            item = self._parse_row(line.text)
            if item:
                items.append(item)
        return items

    @staticmethod
    def _parse_row(text: str) -> Optional[LineItem]:
        cols = [c.strip() for c in re.split(r"\t|\s{2,}", text) if c.strip()]
        if len(cols) < 2:
            return None
        # Trailing numeric columns are amount/rate/qty; leading text is description.
        nums: list[float] = []
        desc_parts: list[str] = []
        for c in cols:
            v = parse_money(c)
            if v is not None and re.search(r"\d", c) and not re.search(r"[A-Za-z]{3,}", c):
                nums.append(v)
            else:
                desc_parts.append(c)
        if not desc_parts or len(nums) < 1:
            return None
        description = " ".join(desc_parts)
        qty = rate = amount = None
        if len(nums) >= 3:
            qty, rate, amount = nums[0], nums[-2], nums[-1]
        elif len(nums) == 2:
            rate, amount = nums[0], nums[1]
        else:
            amount = nums[0]
        return LineItem(description=description, quantity=qty, rate=rate, amount=amount, confidence=0.7)

    # ------------------------------------------------------------- confidence
    @staticmethod
    def _provisional_confidence(result: ExtractionResult, schema: DocumentSchema) -> float:
        num = 0.0
        den = 0.0
        for spec in schema.fields:
            if spec.kind == ValueKind.MONEY and spec.name != "total":
                continue  # component amounts don't drive the headline confidence
            f = result.fields.get(spec.name)
            den += spec.weight
            num += (f.confidence if f else 0.0) * spec.weight
        return round(num / den, 4) if den else 0.0
