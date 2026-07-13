"""Contracts for the Vision Intelligence layer."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass(slots=True)
class VisionInput:
    """What the vision model receives: the raw document + an OCR hint."""
    image_bytes: bytes
    mime_type: str
    ocr_hint: str = ""


@dataclass(slots=True)
class VisionExtraction:
    """Structured fields read from the image by the vision model."""
    doc_type: Optional[str] = None
    vendor_name: Optional[str] = None
    customer_name: Optional[str] = None
    invoice_number: Optional[str] = None
    po_number: Optional[str] = None
    invoice_date: Optional[str] = None
    due_date: Optional[str] = None
    currency: Optional[str] = None
    tax_id: Optional[str] = None
    payment_terms: Optional[str] = None
    subtotal: Optional[float] = None
    shipping: Optional[float] = None
    tax: Optional[float] = None
    discount: Optional[float] = None
    balance_due: Optional[float] = None
    total: Optional[float] = None
    line_items: list[dict[str, Any]] = field(default_factory=list)
    model: str = ""

    def as_dict(self) -> dict[str, Any]:
        return {
            "doc_type": self.doc_type,
            "vendor_name": self.vendor_name,
            "customer_name": self.customer_name,
            "invoice_number": self.invoice_number,
            "po_number": self.po_number,
            "invoice_date": self.invoice_date,
            "due_date": self.due_date,
            "currency": self.currency,
            "tax_id": self.tax_id,
            "payment_terms": self.payment_terms,
            "subtotal": self.subtotal,
            "shipping": self.shipping,
            "tax": self.tax,
            "discount": self.discount,
            "balance_due": self.balance_due,
            "total": self.total,
            "line_items": self.line_items,
            "model": self.model,
        }
