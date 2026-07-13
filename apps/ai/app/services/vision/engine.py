"""
VisionEngine — the public entry point of the Vision Intelligence layer.

It runs the vision model through the AI Runtime (never directly), so lifecycle,
retries, timeout, and telemetry are centrally managed. Returns ``None`` when no
vision model is available or the call fails, so the orchestrator degrades to the
deterministic graph extraction instead of erroring.
"""

from __future__ import annotations

from typing import Optional

from app.core.logger import logger
from app.runtime.contracts import Task
from app.runtime.engine import AIRuntime, get_ai_runtime
from app.runtime.exceptions import ExecutionExhausted, NoModelForTask
from app.services.vision.contracts import VisionExtraction, VisionInput
from app.services.vision.runtime_models import register_vision_models


class VisionEngine:
    def __init__(self, runtime: AIRuntime | None = None, telemetry=None) -> None:
        self.runtime = runtime or get_ai_runtime()
        self.telemetry = telemetry
        register_vision_models(self.runtime.registry)

    def available(self) -> bool:
        reg = self.runtime.registry
        return reg.has("gemini-vision") and reg.get("gemini-vision").is_available()

    def extract(
        self, image_bytes: bytes, mime_type: str, ocr_hint: str = ""
    ) -> Optional[VisionExtraction]:
        if not self.available():
            return None
        try:
            execution = self.runtime.execute(
                Task.VISION,
                VisionInput(image_bytes=image_bytes, mime_type=mime_type, ocr_hint=ocr_hint),
                timeout_s=60.0,
            )
            return execution.output
        except (ExecutionExhausted, NoModelForTask) as exc:
            logger.warning("vision.unavailable", error=str(exc))
            return None
