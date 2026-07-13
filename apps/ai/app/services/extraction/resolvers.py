"""
Graph-driven field resolvers.

Resolvers locate a field's value by reasoning over the Document Graph — never by
hardcoded per-document regex. A ``FieldSpec`` declares *where* a value tends to
live (its role) and *what* labels anchor it (aliases); the resolver knows the
generic strategies:

    HEADER / TAX_ID : label-anchored value on the same line (or the line below)
    PARTY           : label block, else a top-of-document company line
    TOTAL           : the money token near a totals label, sub-totals excluded

Every resolved value carries provenance (contributing word nodes → box, page,
engines) so the result is explainable.
"""

from __future__ import annotations

import re
from typing import Optional

from app.contracts.graph import DocumentGraph, GraphNode, NodeKind
from app.contracts.ocr import BoundingBox
from app.services.extraction.contracts import ExtractedField, FieldEvidence
from app.services.extraction.normalize import (
    DATE_RE,
    detect_currency,
    normalize_date,
    parse_money,
)
from app.services.extraction.schema import FieldRole, FieldSpec, ValueKind

_COMPANY_SUFFIX = re.compile(
    r"\b(inc|incorporated|ltd|limited|llc|llp|pvt|private|corp|corporation|co|company|"
    r"gmbh|traders?|enterprises?|industries|solutions?|services?|systems?|technologies|"
    r"pharma|foods?|candies|works|associates)\b",
    re.IGNORECASE,
)
_NOISE_LABEL = re.compile(
    r"^(address|invoice|bill\s*to|ship\s*to|sold\s*to|account\s*(number|holder|no)|"
    r"service\s*(address|type)|bill\s*date|due\s*date|rate\s*code|meter|usage|charges?|"
    r"statement|tax\s*invoice|receipt|purchase\s*order|date|customer|to|from|description|"
    r"qty|quantity|amount|total|subtotal|previous|current|payment)\b",
    re.IGNORECASE,
)
_MONEY_TOKEN = re.compile(r"[-$₹£€]?\s*\d[\d,\s]*(?:[._]\d{1,2})?")


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace("\t", " ")).strip()


class GraphResolver:
    def __init__(self, graph: DocumentGraph) -> None:
        self.graph = graph
        self._lines = graph.lines  # page/reading order as built

    # ------------------------------------------------------------------ api
    def resolve(self, spec: FieldSpec) -> Optional[ExtractedField]:
        if spec.role == FieldRole.TOTAL:
            return self._resolve_total(spec)
        if spec.role == FieldRole.PARTY:
            return self._resolve_party(spec)
        return self._resolve_header(spec)

    # -------------------------------------------------------------- header
    def _resolve_header(self, spec: FieldSpec) -> Optional[ExtractedField]:
        for alias in spec.aliases:
            for line in self._lines:
                lt = _clean(line.text).lower()
                if alias not in lt:
                    continue
                raw = self._value_after(line, alias)
                value = self._coerce(raw, spec.kind)
                if value is None:
                    below = self.graph.line_below(line.id)
                    if below:
                        raw = _clean(below.text)
                        value = self._coerce(raw, spec.kind)
                        if value is not None:
                            return self._field(spec, value, raw, [below], 0.7)
                    continue
                nodes = self._value_nodes_after(line, alias) or [line]
                return self._field(spec, value, raw, nodes, 0.85)
        return None

    # --------------------------------------------------------------- party
    def _resolve_party(self, spec: FieldSpec) -> Optional[ExtractedField]:
        header = self._resolve_header(spec)
        if header is not None:
            return header
        # No label block — vendor is usually the top-of-document company line.
        if spec.name == "vendor_name":
            top = self._top_company_line()
            if top:
                return self._field(spec, _clean(top.text), _clean(top.text), [top], 0.6)
        return None

    def _top_company_line(self) -> Optional[GraphNode]:
        top = self._lines[:15]
        for line in top:
            txt = _clean(line.text)
            if _COMPANY_SUFFIX.search(txt) and not _NOISE_LABEL.match(txt) and len(txt) <= 60:
                return line
        for line in top:
            txt = _clean(line.text)
            if _NOISE_LABEL.match(txt) or re.search(r"[()\d@$₹£€]|www\.|http", txt):
                continue
            words = txt.split(" ")
            if 1 <= len(words) <= 6 and txt[:1].isupper():
                return line
        return None

    # --------------------------------------------------------------- total
    def _resolve_total(self, spec: FieldSpec) -> Optional[ExtractedField]:
        for alias in spec.aliases:
            for line in self._lines:
                lt = _clean(line.text).lower()
                if alias not in lt:
                    continue
                if any(neg in lt for neg in spec.negative_aliases):
                    continue
                # Money token appearing after the label on this line…
                after = self._text_after(_clean(line.text), alias)
                amount = self._last_money(after)
                nodes: list[GraphNode] = [line]
                if amount is None:
                    below = self.graph.line_below(line.id)
                    if below:
                        amount = self._last_money(_clean(below.text))
                        nodes = [below]
                if amount is not None:
                    return self._field(spec, amount, after or _clean(line.text), nodes, 0.85)
        return None

    # ------------------------------------------------------------- helpers
    def _coerce(self, raw: Optional[str], kind: ValueKind):
        if not raw:
            return None
        raw = _clean(raw)
        if kind == ValueKind.MONEY:
            return parse_money(raw)
        if kind == ValueKind.DATE:
            m = DATE_RE.search(raw)
            token = m.group(1) if m else raw
            return normalize_date(token) or token
        if kind == ValueKind.CURRENCY:
            return detect_currency(raw) or (raw[:3].upper() if raw else None)
        if kind in (ValueKind.IDENTIFIER, ValueKind.TAX_ID):
            m = re.search(r"[A-Za-z0-9][A-Za-z0-9/\-]{1,}", raw)
            val = m.group(0) if m else None
            return val if val and not re.fullmatch(r"(no|number|#|date)", val, re.IGNORECASE) else None
        if kind == ValueKind.NUMBER:
            return parse_money(raw)
        # STRING
        return raw or None

    @staticmethod
    def _text_after(line_text: str, alias: str) -> str:
        idx = line_text.lower().find(alias)
        if idx < 0:
            return ""
        return line_text[idx + len(alias):].strip(" :#\t-.\u2013")

    def _value_after(self, line: GraphNode, alias: str) -> str:
        return self._text_after(_clean(line.text), alias)

    def _value_nodes_after(self, line: GraphNode, alias: str) -> list[GraphNode]:
        """Word nodes after the alias span (for bbox/provenance)."""
        words = self.graph.line_words(line.id)
        if not words:
            return []
        alias_tokens = alias.split()
        lowered = [w.text.strip(":#-.,").lower() for w in words]
        for i in range(len(lowered) - len(alias_tokens) + 1):
            if all(
                lowered[i + k] == at or (len(alias_tokens) == 1 and lowered[i + k].startswith(at))
                for k, at in enumerate(alias_tokens)
            ):
                return words[i + len(alias_tokens):]
        return []

    @staticmethod
    def _last_money(text: str) -> Optional[float]:
        if not text:
            return None
        matches = _MONEY_TOKEN.findall(text)
        for tok in reversed(matches):
            val = parse_money(tok)
            if val is not None and (val >= 1 or "." in tok or "_" in tok):
                return val
        return None

    def _field(
        self,
        spec: FieldSpec,
        value,
        raw: Optional[str],
        nodes: list[GraphNode],
        base_conf: float,
    ) -> ExtractedField:
        boxes = [n.box for n in nodes if n.box is not None]
        sources: list[str] = []
        for n in nodes:
            for s in n.sources:
                if s and s not in sources:
                    sources.append(s)
        node_conf = [n.confidence for n in nodes if n.confidence]
        conf = base_conf * (sum(node_conf) / len(node_conf) if node_conf else 1.0)
        evidence = FieldEvidence(
            sources=tuple(sources) or ("extraction",),
            box=BoundingBox.union(boxes) if boxes else None,
            page=nodes[0].page if nodes else None,
            node_ids=tuple(n.id for n in nodes),
        )
        return ExtractedField(
            name=spec.name,
            value=value,
            raw_text=_clean(raw) if raw else None,
            confidence=round(min(conf, 0.99), 4),
            evidence=evidence,
        )
