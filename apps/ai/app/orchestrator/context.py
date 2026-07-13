from dataclasses import dataclass
from typing import Any, Optional

from app.contracts.document import DocumentContract
from app.contracts.enhancement import EnhancementContract


@dataclass(slots=True)
class PipelineContext:

    document: Optional[DocumentContract] = None

    enhancement: Optional[EnhancementContract] = None

    classification: Any = None

    layout: Any = None

    ocr: Any = None

    vision: Any = None

    extraction: Any = None

    validation: Any = None

    risk: Any = None