"""
Gemini multimodal model, implemented as a RuntimeModel.

Only the inference lives here; the AI Runtime owns lifecycle, retries, timeout,
and telemetry. The call sends the document IMAGE plus the OCR text as a hint and
requests strict JSON. It iterates a list of current models so an exhausted-quota
(429) or renamed (404) model never blocks extraction. Uses stdlib ``urllib`` so
the platform gains no new dependency.
"""

from __future__ import annotations

import base64
import json
import time
import urllib.error
import urllib.request
from typing import Any

from app.core.config import get_settings
from app.core.logger import logger
from app.runtime.model import RuntimeModel
from app.services.vision.contracts import VisionExtraction, VisionInput

_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"

_SYSTEM = (
    "You are an enterprise document-understanding engine for a procurement platform. "
    "You are given the DOCUMENT IMAGE and (optionally) a noisy OCR text hint. Read the "
    "image directly, INCLUDING handwriting, stamps, and print the OCR missed. Extract "
    "fields STRICTLY from what is visible; if a field is absent, return null — never "
    "guess or invent. vendorName is the SELLER/issuer (often the letterhead), never a "
    "label like 'ADDRESS' or the buyer. customerName is the bill-to/recipient. Money "
    "fields are plain numbers (no symbols/commas); total is the final payable amount. "
    "Dates as ISO yyyy-mm-dd when unambiguous else literal. Detect docType: invoice, "
    "receipt, purchase_order, utility_bill, quotation, credit_note, unknown."
)

_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "docType": {"type": "STRING", "nullable": True},
        "vendorName": {"type": "STRING", "nullable": True},
        "customerName": {"type": "STRING", "nullable": True},
        "invoiceNumber": {"type": "STRING", "nullable": True},
        "poNumber": {"type": "STRING", "nullable": True},
        "invoiceDate": {"type": "STRING", "nullable": True},
        "dueDate": {"type": "STRING", "nullable": True},
        "currency": {"type": "STRING", "nullable": True},
        "taxId": {"type": "STRING", "nullable": True},
        "paymentTerms": {"type": "STRING", "nullable": True},
        "subtotal": {"type": "NUMBER", "nullable": True},
        "shipping": {"type": "NUMBER", "nullable": True},
        "tax": {"type": "NUMBER", "nullable": True},
        "discount": {"type": "NUMBER", "nullable": True},
        "balanceDue": {"type": "NUMBER", "nullable": True},
        "totalAmount": {"type": "NUMBER", "nullable": True},
        "lineItems": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "description": {"type": "STRING"},
                    "quantity": {"type": "NUMBER", "nullable": True},
                    "rate": {"type": "NUMBER", "nullable": True},
                    "amount": {"type": "NUMBER", "nullable": True},
                },
                "required": ["description"],
            },
        },
    },
    "required": ["docType"],
}


def gemini_available() -> bool:
    return bool(get_settings().GEMINI_API_KEY)


class GeminiVisionModel(RuntimeModel):
    name = "gemini-vision"

    def __init__(self) -> None:
        self._key = ""
        self._models: list[str] = []

    def load(self) -> None:
        settings = get_settings()
        self._key = settings.GEMINI_API_KEY
        # Current multimodal models first; configured model included as a member.
        self._models = list(
            dict.fromkeys(
                [
                    "gemini-2.5-flash",
                    "gemini-flash-latest",
                    "gemini-2.5-flash-lite",
                    settings.GEMINI_MODEL,
                    "gemini-2.0-flash",
                ]
            )
        )

    def health(self) -> bool:
        return bool(self._key)

    def predict(self, inputs: VisionInput) -> VisionExtraction:
        if not self._key:
            raise RuntimeError("GEMINI_API_KEY not configured")

        parts: list[dict[str, Any]] = [
            {
                "text": (
                    f"OCR hint (may be incomplete/noisy):\n{inputs.ocr_hint or '(none)'}\n\n"
                    "Read the attached document image and extract the fields."
                )
            },
            {
                "inline_data": {
                    "mime_type": inputs.mime_type,
                    "data": base64.b64encode(inputs.image_bytes).decode("ascii"),
                }
            },
        ]
        body = json.dumps(
            {
                "systemInstruction": {"parts": [{"text": _SYSTEM}]},
                "contents": [{"role": "user", "parts": parts}],
                "generationConfig": {
                    "temperature": 0,
                    "responseMimeType": "application/json",
                    "responseSchema": _SCHEMA,
                },
            }
        ).encode("utf-8")

        last_status = 0
        for model in self._models:
            url = _ENDPOINT.format(model=model, key=self._key)
            req = urllib.request.Request(
                url, data=body, headers={"Content-Type": "application/json"}, method="POST"
            )
            try:
                with urllib.request.urlopen(req, timeout=45) as resp:
                    payload = json.loads(resp.read().decode("utf-8"))
                parsed = self._parse(payload)
                if parsed is not None:
                    parsed.model = model
                    logger.info("vision.gemini_ok", model=model)
                    return parsed
            except urllib.error.HTTPError as exc:
                last_status = exc.code
                if exc.code in (401, 403):
                    raise RuntimeError(f"Gemini auth error {exc.code}") from exc
                logger.warning("vision.gemini_http", model=model, status=exc.code)
                if exc.code == 429:
                    time.sleep(1.0)
                continue
            except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
                logger.warning("vision.gemini_error", model=model, error=str(exc))
                continue

        raise RuntimeError(f"Gemini vision failed (last status {last_status})")

    @staticmethod
    def _parse(payload: dict[str, Any]) -> VisionExtraction | None:
        try:
            text = payload["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError, TypeError):
            return None
        try:
            d = json.loads(text)
        except json.JSONDecodeError:
            return None
        return VisionExtraction(
            doc_type=d.get("docType"),
            vendor_name=d.get("vendorName"),
            customer_name=d.get("customerName"),
            invoice_number=d.get("invoiceNumber"),
            po_number=d.get("poNumber"),
            invoice_date=d.get("invoiceDate"),
            due_date=d.get("dueDate"),
            currency=d.get("currency"),
            tax_id=d.get("taxId"),
            payment_terms=d.get("paymentTerms"),
            subtotal=d.get("subtotal"),
            shipping=d.get("shipping"),
            tax=d.get("tax"),
            discount=d.get("discount"),
            balance_due=d.get("balanceDue"),
            total=d.get("totalAmount"),
            line_items=[li for li in d.get("lineItems", []) if isinstance(li, dict)],
        )
