from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from app.contracts.document import DocumentContract


class InvoicePipeline:
    """Simple invoice extraction pipeline with benchmarkable output."""

    def run(self, document: DocumentContract) -> dict[str, Any]:
        text = self._extract_text(document)
        invoice_number = self._extract_invoice_number(text, document)
        vendor_name = self._extract_vendor(text, document)
        total = self._extract_total(text)
        currency = self._extract_currency(text)
        confidence = self._calculate_confidence(text, invoice_number, vendor_name, total)

        return {
            "document_type": "invoice",
            "vendor_name": vendor_name,
            "invoice_number": invoice_number,
            "total": total,
            "currency": currency,
            "raw_text": text,
            "confidence": confidence,
        }

    def _extract_text(self, document: DocumentContract) -> str:
        if document.raw.get("text"):
            return str(document.raw["text"])
        return ""

    def _extract_vendor(self, text: str, document: DocumentContract) -> str:
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        if lines:
            return lines[0]
        if document.source:
            return document.source.stem.replace("-", " ").title()
        return "Example Vendor"

    def _extract_invoice_number(self, text: str, document: DocumentContract) -> str:
        match = re.search(r"Invoice\s*#\s*([A-Za-z0-9\-]+)", text, re.IGNORECASE)
        if match:
            return match.group(1)

        if document.source:
            filename_match = re.search(r"(\d+)", document.source.name)
            if filename_match:
                return filename_match.group(1)

        return ""

    def _extract_total(self, text: str) -> float:
        match = re.search(r"Amount\s+Due[:\s]+([0-9]+(?:\.[0-9]+)?)", text, re.IGNORECASE)
        return float(match.group(1)) if match else 0.0

    def _extract_currency(self, text: str) -> str:
        match = re.search(r"([A-Z]{3})\s*$", text, re.IGNORECASE)
        return match.group(1).upper() if match else ""

    def _calculate_confidence(self, text: str, invoice_number: str, vendor_name: str, total: float) -> float:
        score = 0.0
        if text:
            score += 0.35
        if invoice_number:
            score += 0.35
        if vendor_name:
            score += 0.2
        if total:
            score += 0.1
        return round(min(score, 1.0), 2)
