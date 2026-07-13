from dataclasses import dataclass, field
from pathlib import Path
from PIL import Image
from typing import Any
from uuid import uuid4


@dataclass(slots=True)
class DocumentPage:

    page_number: int

    image: Image.Image

    width: int

    height: int

    dpi: int

    rotation: int = 0


@dataclass(slots=True)
class DocumentMetadata:

    filename: str

    extension: str

    mime_type: str

    file_size: int

    sha256: str

    total_pages: int

    created_by: str | None = None


@dataclass(slots=True)
class DocumentContract:

    id: str = field(default_factory=lambda: str(uuid4()))

    source: Path | None = None

    metadata: DocumentMetadata | None = None

    pages: list[DocumentPage] = field(default_factory=list)

    raw: dict[str, Any] = field(default_factory=dict)