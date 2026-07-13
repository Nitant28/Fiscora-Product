"""
Unit tests for the schema-driven extraction stack:
    build_graph → ExtractionEngine → ValidationEngine → ConfidenceFusion.

These assert *platform* behaviour (model-agnostic, graph-based, provenance,
rules-override-AI), not a single hardcoded sample.
"""

from __future__ import annotations

from app.contracts.graph import NodeKind, Relation, build_graph
from app.contracts.ocr import BoundingBox, OcrContract, OcrLine, OcrWord, PageOcr
from app.services.extraction import ExtractionEngine, get_schema
from app.services.extraction.confidence import ConfidenceFusion
from app.services.validation import ValidationEngine


# --------------------------------------------------------------------- helpers
def _line(text: str, y: int, engine: str = "textlayer") -> OcrLine:
    words: list[OcrWord] = []
    x = 10
    for token in text.split(" "):
        w = max(20, len(token) * 12)
        words.append(
            OcrWord(
                text=token,
                confidence=0.95,
                box=BoundingBox(x, y, w, 20),
                engine=engine,
                agreed_by=(engine,),
            )
        )
        x += w + 8
    box = BoundingBox.union([w.box for w in words])
    return OcrLine(text=text, confidence=0.95, box=box, words=words)


def _contract(lines: list[str], confidence: float = 0.95) -> OcrContract:
    ocr_lines = [_line(t, 30 + i * 30) for i, t in enumerate(lines)]
    page = PageOcr(
        page_number=1,
        text="\n".join(lines),
        confidence=confidence,
        width=1000,
        height=1400,
        lines=ocr_lines,
        engines=("textlayer",),
    )
    return OcrContract(
        pages=[page],
        text="\n".join(lines),
        confidence=confidence,
        engines_used=("textlayer",),
        processing_time_ms=1.0,
    )


_INVOICE_LINES = [
    "Acme Traders Pvt Ltd",
    "Invoice No: INV-1024",
    "Invoice Date: 2024-05-01",
    "Due Date: 2024-05-31",
    "Bill To: Wayne Enterprises",
    "Subtotal 1000.00",
    "Tax 180.00",
    "Total 1180.00",
]


def _run(lines: list[str], ocr_conf: float = 0.95):
    ocr = _contract(lines, ocr_conf)
    graph = build_graph("doc-1", ocr)
    result = ExtractionEngine().extract(graph)
    schema = get_schema(result.document_type)
    issues = ValidationEngine().validate(result, schema)
    ConfidenceFusion().fuse(result, schema, ocr.confidence, issues)
    return graph, result, {i.code: i for i in issues}


# ----------------------------------------------------------------------- graph
def test_graph_is_source_of_truth():
    ocr = _contract(_INVOICE_LINES)
    graph = build_graph("doc-1", ocr)

    assert graph.page_count == 1
    assert len(graph.by_kind(NodeKind.LINE)) == len(_INVOICE_LINES)
    assert graph.by_kind(NodeKind.WORD), "words should be nodes"

    first_line = graph.lines[0]
    words = graph.line_words(first_line.id)
    assert [w.text for w in words] == ["Acme", "Traders", "Pvt", "Ltd"]

    # reading-flow edge exists between consecutive lines
    below = graph.line_below(first_line.id)
    assert below is not None and "Invoice No" in below.text


# ------------------------------------------------------------------ extraction
def test_extraction_is_schema_driven_and_grounded():
    _, result, _ = _run(_INVOICE_LINES)

    assert result.document_type == "invoice"
    assert result.value("vendor_name") == "Acme Traders Pvt Ltd"
    assert result.value("invoice_number") == "INV-1024"
    assert result.value("invoice_date") == "2024-05-01"
    assert result.value("due_date") == "2024-05-31"
    assert result.value("subtotal") == 1000.0
    assert result.value("tax") == 180.0
    assert result.value("total") == 1180.0


def test_every_field_carries_provenance():
    _, result, _ = _run(_INVOICE_LINES)
    inv = result.fields["invoice_number"]
    assert inv.evidence.page == 1
    assert inv.evidence.node_ids, "must reference the graph nodes it came from"
    assert "textlayer" in inv.evidence.sources
    assert inv.evidence.box is not None


# ------------------------------------------------------------------ validation
def test_totals_math_passes_when_amounts_reconcile():
    _, result, issues = _run(_INVOICE_LINES)
    assert issues["totals_math"].passed is True
    assert result.fields["total"].validation == "passed"


def test_business_rules_override_model_confidence():
    bad = list(_INVOICE_LINES)
    bad[-1] = "Total 9999.00"  # deliberately breaks subtotal+tax=total
    _, result, issues = _run(bad)

    assert issues["totals_math"].passed is False
    assert result.fields["total"].validation == "failed"
    # A failed high-severity rule caps the document confidence (Rule 8).
    assert result.overall_confidence <= 0.6


def test_low_ocr_confidence_lowers_fused_confidence():
    _, high, _ = _run(_INVOICE_LINES, ocr_conf=0.95)
    _, low, _ = _run(_INVOICE_LINES, ocr_conf=0.4)
    assert low.overall_confidence < high.overall_confidence


# -------------------------------------------------------- doc-type generality
def test_classifier_routes_to_correct_schema():
    _, result, _ = _run(
        [
            "City Power & Gas",
            "Account Holder: James Thornton",
            "Bill Date: 06/02/2023",
            "Due Date: 06/23/2023",
            "Electric (kWh) Gas (Therms)",
            "Total Amount Due 268.20",
        ]
    )
    assert result.document_type == "utility_bill"
    assert result.value("total") == 268.20
    assert result.value("invoice_date") == "2023-06-02"
