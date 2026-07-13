import hashlib

import filetype

from pathlib import Path

from app.contracts.document import DocumentMetadata


class MetadataExtractor:

    @staticmethod
    def extract(path: Path):

        sha = hashlib.sha256(path.read_bytes()).hexdigest()

        kind = filetype.guess(path)

        return DocumentMetadata(

            filename=path.name,

            extension=path.suffix.lower(),

            mime_type=kind.mime if kind else "unknown",

            file_size=path.stat().st_size,

            sha256=sha,

            total_pages=0,

        )