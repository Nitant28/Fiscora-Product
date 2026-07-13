from __future__ import annotations

import io
from pathlib import Path
from typing import Any, Optional

from app.contracts.document import DocumentContract
from app.contracts.graph import DocumentGraph, build_graph
from app.governance.audit.logger import AuditLogger
from app.orchestrator.context import PipelineContext
from app.orchestrator.registry import ServiceRegistry
from app.services.document.engine import DocumentEngine
from app.services.enhancement.engine import EnhancementEngine
from app.services.extraction import ExtractionEngine, ExtractionResult, get_schema
from app.services.extraction.confidence import ConfidenceFusion
from app.services.extraction.contracts import ExtractedField, FieldEvidence, LineItem
from app.services.extraction.normalize import normalize_date
from app.services.ocr.engine import OCREngine
from app.services.ocr.exceptions import OcrError
from app.services.validation import ValidationEngine
from app.services.vision import VisionEngine, VisionExtraction
from app.telemetry.metrics import TelemetryRecorder

# Documents below this fused confidence are routed to human review (Rule 12).
_REVIEW_THRESHOLD = 0.8
# Confidence assigned to a field that only the vision model could read.
_VISION_CONF = 0.82

# Formats Gemini accepts directly; everything else is re-encoded to PNG.
_DIRECT_MIME = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
}


class PipelineEngine:
    """Coordinates the document-intelligence stages.

    Document → Enhancement → OCR → Document Graph → Extraction (schema-driven) →
    Vision (semantic, image-native) → Fusion → Business Validation → Confidence
    Fusion. Every stage depends only on the previous stage's contract, and all AI
    inference (OCR, vision) flows through the AI Runtime — so models are swappable
    and the worker can consume the whole thing over one HTTP call.
    """

    def __init__(self):
        self.registry = ServiceRegistry()
        self.telemetry = TelemetryRecorder()
        self.document_engine = DocumentEngine()
        self.enhancement_engine = EnhancementEngine(telemetry=self.telemetry)
        self.ocr_engine = OCREngine(telemetry=self.telemetry)
        self.extraction_engine = ExtractionEngine()
        self.vision_engine = VisionEngine(telemetry=self.telemetry)
        self.validator = ValidationEngine()
        self.fusion = ConfidenceFusion()
        self.audit = AuditLogger()

    def run(self, context: PipelineContext):
        return context

    def run_file(self, path: str | Path) -> dict[str, Any]:
        document = self.document_engine.load(Path(path))
        context = PipelineContext(document=document)
        self.telemetry.record("document_load", 0.0, model="document_loader")

        enhancement = self.enhancement_engine.process(document)
        context.enhancement = enhancement

        try:
            context.ocr = self.ocr_engine.run(enhancement)
        except OcrError as exc:
            self.audit.log("ocr_skipped", reason=str(exc))
            context.ocr = None

        # Document Knowledge Graph — the single source of truth. Empty when OCR
        # produced nothing (e.g. a scanned image with no engine installed); vision
        # then carries the extraction.
        graph = (
            build_graph(document.id, context.ocr)
            if context.ocr is not None
            else DocumentGraph(document_id=document.id, page_count=len(document.pages))
        )

        result: ExtractionResult = self.extraction_engine.extract(graph)

        # Vision pass over the actual image (reads handwriting/print OCR missed).
        ocr_hint = context.ocr.text if context.ocr is not None else ""
        vision = self._run_vision(document, ocr_hint)
        if vision is not None:
            self._fuse_vision(result, vision)

        schema = get_schema(result.document_type)
        issues = self.validator.validate(result, schema)
        base_conf = context.ocr.confidence if context.ocr is not None else 0.7
        self.fusion.fuse(result, schema, base_conf, issues)
        context.extraction = result
        context.validation = result.validation

        needs_review = (
            result.overall_confidence < _REVIEW_THRESHOLD
            or any((not i.passed and i.severity == "high") for i in issues)
        )
        status = "needs_review" if needs_review else "validated"

        self.audit.log(
            "document_processed",
            status=status,
            document_type=result.document_type,
            confidence=result.overall_confidence,
            vision=bool(vision),
            failed_rules=[i.code for i in issues if not i.passed],
        )

        return self._to_dict(result, context, graph, status, vision)

    # -------------------------------------------------------------- vision
    def _run_vision(
        self, document: DocumentContract, ocr_hint: str
    ) -> Optional[VisionExtraction]:
        payload = self._document_bytes(document)
        if payload is None:
            return None
        image_bytes, mime = payload
        return self.vision_engine.extract(image_bytes, mime, ocr_hint)

    @staticmethod
    def _document_bytes(document: DocumentContract) -> Optional[tuple[bytes, str]]:
        src = document.source
        if src is not None:
            mime = _DIRECT_MIME.get(src.suffix.lower())
            if mime:
                try:
                    return src.read_bytes(), mime
                except OSError:
                    pass
        if document.pages:
            try:
                buf = io.BytesIO()
                document.pages[0].image.convert("RGB").save(buf, format="PNG")
                return buf.getvalue(), "image/png"
            except Exception:  # pragma: no cover - defensive
                return None
        return None

    def _fuse_vision(self, result: ExtractionResult, v: VisionExtraction) -> None:
        """Merge vision fields into the result.

        Vision refines the semantic fields (parties, ids, dates, doc type) and
        fills any monetary/line-item gaps. Deterministic OCR values already in the
        result are kept when present (they carry graph provenance); vision only
        fills or upgrades low-confidence/missing fields. Validation still runs
        afterwards and can override everything.
        """
        if v.doc_type and result.document_type in ("unknown", "invoice"):
            result.document_type = v.doc_type

        strings = {
            "vendor_name": v.vendor_name,
            "customer_name": v.customer_name,
            "invoice_number": v.invoice_number,
            "po_number": v.po_number,
            "tax_id": v.tax_id,
            "payment_terms": v.payment_terms,
            "currency": v.currency,
        }
        for name, value in strings.items():
            self._maybe_set(result, name, value)

        for name, value in {"invoice_date": v.invoice_date, "due_date": v.due_date}.items():
            if value:
                self._maybe_set(result, name, normalize_date(value) or value)

        money = {
            "subtotal": v.subtotal,
            "shipping": v.shipping,
            "tax": v.tax,
            "discount": v.discount,
            "total": v.total if v.total is not None else v.balance_due,
        }
        for name, value in money.items():
            if value is not None:
                self._maybe_set(result, name, _as_float(value), only_if_missing=True)

        if not result.line_items and v.line_items:
            result.line_items = [
                LineItem(
                    description=str(li.get("description", "")).strip(),
                    quantity=li.get("quantity"),
                    rate=li.get("rate"),
                    amount=li.get("amount"),
                    confidence=0.75,
                )
                for li in v.line_items
                if li.get("description")
            ]

    @staticmethod
    def _maybe_set(
        result: ExtractionResult, name: str, value, only_if_missing: bool = False
    ) -> None:
        if value in (None, ""):
            return
        existing = result.fields.get(name)
        if existing is not None:
            if only_if_missing or existing.value not in (None, ""):
                if existing.confidence >= _VISION_CONF:
                    return
        result.fields[name] = ExtractedField(
            name=name,
            value=value,
            raw_text=str(value),
            confidence=_VISION_CONF,
            evidence=FieldEvidence(sources=("gemini-vision",), page=1),
        )

    # ------------------------------------------------------------------ output
    def _to_dict(self, result, context, graph, status: str, vision) -> dict[str, Any]:
        payload = result.as_dict()
        payload.update(
            {
                "vendor_name": result.value("vendor_name") or "",
                "invoice_number": result.value("invoice_number") or "",
                "currency": result.value("currency") or "",
                "total": _as_float(result.value("total")),
                "confidence": result.overall_confidence,
                "status": status,
                "raw_text": context.ocr.text if context.ocr is not None else "",
                "ocr_confidence": round(context.ocr.confidence, 4) if context.ocr else None,
                "ocr_engines": list(context.ocr.engines_used) if context.ocr else [],
                "vision_model": vision.model if vision else None,
                "graph": {
                    "nodes": len(graph.nodes),
                    "edges": len(graph.edges),
                    "pages": graph.page_count,
                },
            }
        )
        return payload

    @staticmethod
    def _empty_result(document_id: str) -> dict[str, Any]:
        return {
            "document_type": "unknown",
            "vendor_name": "",
            "invoice_number": "",
            "currency": "",
            "total": 0.0,
            "confidence": 0.0,
            "status": "needs_review",
            "ocr_confidence": None,
            "ocr_engines": [],
            "fields": {},
            "line_items": [],
            "validation": [],
        }


def _as_float(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0
