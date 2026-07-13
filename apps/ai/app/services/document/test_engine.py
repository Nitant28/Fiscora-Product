from app.core.config import UPLOAD_DIR

from app.services.document.engine import DocumentEngine


engine = DocumentEngine()

pdf = UPLOAD_DIR / "1780242476377-INV-014_purchase_order.pdf"

document = engine.load(pdf)

print(document.id)

print(document.metadata)

print(document.metadata.total_pages)

print(document.pages[0].width)

print(document.pages[0].height)