from enum import Enum


class PipelineStage(str, Enum):

    DOCUMENT = "document"

    ENHANCEMENT = "enhancement"

    CLASSIFICATION = "classification"

    LAYOUT = "layout"

    OCR = "ocr"

    VISION = "vision"

    EXTRACTION = "extraction"

    VALIDATION = "validation"

    RISK = "risk"

    COMPLETE = "complete"