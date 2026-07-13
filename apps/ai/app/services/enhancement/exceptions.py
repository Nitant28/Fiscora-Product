"""Domain exceptions for the Image Intelligence layer."""

from __future__ import annotations


class EnhancementError(Exception):
    """Base class for all enhancement-layer failures."""


class EmptyDocumentError(EnhancementError):
    """Raised when a document reaches enhancement with no renderable pages."""


class InvalidImageError(EnhancementError):
    """Raised when a page image is missing, empty, or an unsupported shape."""


class TransformError(EnhancementError):
    """Raised when an individual transform fails irrecoverably.

    Note: the processor catches per-transform errors and degrades gracefully;
    this is reserved for programmer errors (e.g. unknown transform name).
    """
