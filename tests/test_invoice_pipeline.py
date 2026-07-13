import unittest
from pathlib import Path

from PIL import Image

from app.contracts.document import DocumentContract, DocumentMetadata, DocumentPage
from app.pipelines.invoice_pipeline import InvoicePipeline


class InvoicePipelineTest(unittest.TestCase):
    def test_extracts_invoice_fields_from_raw_text(self) -> None:
        document = DocumentContract(
            source=Path("fixtures/invoice.png"),
            metadata=DocumentMetadata(
                filename="invoice.png",
                extension=".png",
                mime_type="image/png",
                file_size=1024,
                sha256="abc123",
                total_pages=1,
            ),
            raw={
                "text": "Acme Supplies\nInvoice #INV-1001\nAmount Due: 125.50 USD"
            },
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

        self.assertEqual(result["document_type"], "invoice")
        self.assertEqual(result["vendor_name"], "Acme Supplies")
        self.assertEqual(result["invoice_number"], "INV-1001")
        self.assertEqual(result["total"], 125.5)
        self.assertEqual(result["currency"], "USD")


if __name__ == "__main__":
    unittest.main()
