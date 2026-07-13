from email import base64mime
from app import test_path
from pathlib import Path

from app.services.document.loader import DocumentLoader
from app.services.document.validator import DocumentValidator


class DocumentEngine:

    def __init__(self):

        self.validator = DocumentValidator()
        self.loader = DocumentLoader()

    def load(self, path: str | Path):

        file = Path(path)

        mime = self.validator.validate(file)

        if mime == "application/pdf":

            return self.loader.load_pdf(file)

        return self.loader.load_image(file)