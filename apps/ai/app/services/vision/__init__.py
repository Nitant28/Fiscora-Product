"""
Vision Intelligence — semantic reasoning over the document image.

The vision model (Gemini, multimodal) is registered in the AI Runtime like any
other model and invoked ONLY through it (golden rule: no direct model calls). It
reads the image directly — handwriting, stamps, print an OCR engine misses — and
returns structured fields that the orchestrator fuses with the deterministic
graph extraction. Swapping Gemini for Qwen2.5-VL later is a registry change.
"""

from app.services.vision.contracts import VisionExtraction, VisionInput
from app.services.vision.engine import VisionEngine

__all__ = ["VisionEngine", "VisionExtraction", "VisionInput"]
