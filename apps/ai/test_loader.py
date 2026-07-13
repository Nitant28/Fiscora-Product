from enhancement.loader import DocumentLoader
from enhancement.processor import ImageProcessor

loader = DocumentLoader()
processor = ImageProcessor()

pages = loader.load(
    "../api/uploads/1780242476377-INV-014_purchase_order.pdf"
)

result = processor.process(
    pages[0]
)

print(result["quality"])

result["image"].save("processed.png")