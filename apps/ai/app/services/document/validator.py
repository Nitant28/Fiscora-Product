from pathlib import Path

import filetype

from app.core.constants import (
    MAX_DOCUMENT_SIZE_MB,
    SUPPORTED_TYPES,
)

from app.services.document.exceptions import (
    UnsupportedDocument,
)


class DocumentValidator:

    def validate(
        self,
        path: Path,
    ):

        if not path.exists():

            raise FileNotFoundError(path)

        size_mb = path.stat().st_size / (1024 * 1024)

        if size_mb > MAX_DOCUMENT_SIZE_MB:

            raise ValueError(
                f"File exceeds {MAX_DOCUMENT_SIZE_MB} MB."
            )

        kind = filetype.guess(path)

        if kind is None:

            raise UnsupportedDocument(
                "Cannot determine MIME type."
            )

        if kind.mime not in SUPPORTED_TYPES:

            raise UnsupportedDocument(
                kind.mime
            )

        return kind.mime