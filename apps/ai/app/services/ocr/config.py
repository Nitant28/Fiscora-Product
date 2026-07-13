"""
Configuration for the OCR Intelligence layer.

Every threshold and policy lives here (never hard-coded in the engine) so OCR
behaviour is tunable per deployment and unit-testable.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache


@dataclass(frozen=True, slots=True)
class OcrConfig:
    # --- Engine selection ----------------------------------------------------
    # Preference order. The first available engines are used; when >1 image
    # engine is available their outputs are fused. "textlayer" is the embedded
    # digital-PDF text layer (exact, free) and is preferred when present.
    engine_order: tuple[str, ...] = ("textlayer", "paddle", "tesseract")

    # A digital PDF already contains perfect text — skip pixel OCR when a text
    # layer exists unless the caller forces re-OCR (e.g. suspected scanned PDF).
    prefer_text_layer: bool = True
    force_ocr: bool = False

    # Max image engines to actually run per page (cost control). Fusion needs
    # >=2 to vote; beyond 3 the marginal accuracy rarely justifies the latency.
    max_engines_per_page: int = 2

    # --- Fusion --------------------------------------------------------------
    # Two detections from different engines are the "same" token when their
    # boxes overlap at least this much.
    fusion_iou_threshold: float = 0.5
    # Confidence added per additional engine that agrees on the exact token.
    agreement_bonus: float = 0.06
    # Penalty applied to a token only one engine saw while others were running
    # (possible spurious detection). 0 = keep complementary detections as-is.
    singleton_penalty: float = 0.05
    max_confidence: float = 0.999

    # --- Reading order -------------------------------------------------------
    # Words whose vertical centres fall within this fraction of the median word
    # height are grouped into the same line.
    line_overlap_ratio: float = 0.6

    # --- Downstream policy ---------------------------------------------------
    # Fields below this go to human review (matches Settings.OCR_CONFIDENCE).
    review_threshold: float = 0.85
    # Minimum characters for the text-layer engine to be considered "complete"
    # for a page; below this we assume it's a scanned PDF and run pixel OCR.
    text_layer_min_chars: int = 8


@lru_cache
def get_ocr_config() -> OcrConfig:
    return OcrConfig()
