from __future__ import annotations

from pathlib import Path
from typing import Any

from PIL import Image

from app.contracts.document import DocumentContract, DocumentMetadata, DocumentPage
from app.pipelines.invoice_pipeline import InvoicePipeline


class InvoiceBenchmark:
    def run(self, sample_text: str) -> dict[str, Any]:
        document = DocumentContract(
            source=Path("benchmark/invoice.png"),
            metadata=DocumentMetadata(
                filename="invoice.png",
                extension=".png",
                mime_type="image/png",
                file_size=1024,
                sha256="benchmark",
                total_pages=1,
            ),
            raw={"text": sample_text},
        )
        document.pages.append(
            DocumentPage(
                page_number=1,
                image=Image.new("RGB", (2, 2), color="white"),
                width=2,
                height=2,
                dpi=300,
            )
        )
        result = InvoicePipeline().run(document)
        return {
            "document_type": result["document_type"],
            "vendor_name": result["vendor_name"],
            "invoice_number": result["invoice_number"],
            "total": result["total"],
            "currency": result["currency"],
        }
