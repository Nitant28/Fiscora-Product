from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class InvoiceDocument:
    """Business-level invoice entity used by the domain layer."""

    document_id: str
    vendor_name: str = ""
    invoice_number: str = ""
    currency: str = ""
    total: float = 0.0
    raw_text: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)
    confidence: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "document_id": self.document_id,
            "vendor_name": self.vendor_name,
            "invoice_number": self.invoice_number,
            "currency": self.currency,
            "total": self.total,
            "raw_text": self.raw_text,
            "metadata": self.metadata,
            "confidence": self.confidence,
        }
