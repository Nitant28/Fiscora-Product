"""
Text-layer "engine".

Digital PDFs already carry an exact, machine-readable text layer. Running pixel
OCR on them is slower and *less* accurate than simply reading that layer, so we
treat it as the highest-priority engine. We don't have per-word coordinates from
the plain text, so boxes are synthesised by laying lines out down the page — good
enough for reading order and line grouping; layout detection refines regions later.
"""

from __future__ import annotations

from app.contracts.ocr import BoundingBox
from app.services.ocr.engines.base import (
    OcrEngineAdapter,
    PageInput,
    RawPageResult,
    RawWord,
)

# Digital text is exact; we still keep it < 1.0 so a corroborating pixel engine
# can nudge confidence upward and to leave headroom for the max cap.
_TEXT_LAYER_CONFIDENCE = 0.99


class TextLayerEngine(OcrEngineAdapter):
    name = "textlayer"

    def is_available(self) -> bool:
        return True

    def recognize(self, page: PageInput) -> RawPageResult:
        text = (page.text_layer or "").strip()
        if not text:
            return RawPageResult(words=[])

        lines = [ln for ln in text.splitlines() if ln.strip()]
        if not lines:
            return RawPageResult(words=[])

        words: list[RawWord] = []
        # Synthesised boxes only need to preserve reading order, so we use a
        # nominal font metric (independent of how many lines there are) and lay
        # lines top-to-bottom. Horizontal overflow is fine — line grouping keys
        # on vertical position, not width.
        margin = max(4, int(min(page.width, page.height) * 0.04))
        line_h = max(10, min(40, page.height // 50))
        char_w = max(4, line_h // 2)
        line_gap = int(line_h * 1.5)

        for row, line in enumerate(lines):
            y = margin + row * line_gap
            x = margin
            for token in line.split():
                w = char_w * max(1, len(token))
                words.append(
                    RawWord(
                        text=token,
                        confidence=_TEXT_LAYER_CONFIDENCE,
                        box=BoundingBox(x=x, y=y, w=w, h=int(line_h * 0.8)),
                    )
                )
                x += w + char_w  # inter-word gap

        return RawPageResult(words=words)
