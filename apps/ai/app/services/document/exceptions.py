class DocumentError(Exception):
    """Base document exception."""


class UnsupportedDocument(DocumentError):
    """Unsupported document type."""


class CorruptedDocument(DocumentError):
    """Cannot open document."""


class PasswordProtectedPDF(DocumentError):
    """Encrypted PDF."""