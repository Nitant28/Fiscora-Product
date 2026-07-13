from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class InvoicePolicy:
    """Minimal domain policy used by validation and governance layers."""

    require_invoice_number: bool = True
    require_vendor_name: bool = True
    minimum_confidence: float = 0.55

    def is_valid(self, confidence: float, vendor_name: str, invoice_number: str) -> bool:
        return confidence >= self.minimum_confidence and bool(vendor_name) and bool(invoice_number)
