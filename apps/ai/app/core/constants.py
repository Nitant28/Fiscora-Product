from enum import Enum


class DocumentType(str, Enum):

    PDF = "application/pdf"

    PNG = "image/png"

    JPEG = "image/jpeg"

    TIFF = "image/tiff"

    WEBP = "image/webp"

    BMP = "image/bmp"

    HEIC = "image/heic"


SUPPORTED_TYPES = {

    DocumentType.PDF.value,

    DocumentType.PNG.value,

    DocumentType.JPEG.value,

    DocumentType.TIFF.value,

    DocumentType.WEBP.value,

    DocumentType.BMP.value,

    DocumentType.HEIC.value,

}

MAX_DOCUMENT_SIZE_MB = 25