# OCR Intelligence Layer

Engine-agnostic, **fusion-based** OCR. Downstream stages (Layout / Vision /
Extraction) depend **only** on `app.contracts.ocr.OcrContract`; the OCR engines
themselves are pluggable and hot-swappable.

## Flow

```
EnhancementContract (enhanced document)
   → select engines           (text layer preferred; else image engines)
   → recognise per engine      (isolated failures; adapters)
   → fuse detections           (spatial clustering + confidence voting)
   → assemble reading order     (lines, top-to-bottom / left-to-right)
   → aggregate confidence       (length- & word-count-weighted roll-up)
   → OcrContract + telemetry     (+ fused text published to document.raw["text"])
```

Why fusion? A single OCR engine caps accuracy at its own weaknesses. Running
several and reconciling them — e.g. Paddle reads `INVO1CE`, Tesseract reads
`INVOICE`; the agreeing, higher-confidence spelling wins — is the core accuracy
differentiator over single-engine OCR, and mirrors how Google/ABBYY/Rossum
achieve their numbers.

## Engines (adapters)

All implement `OcrEngineAdapter.recognize(PageInput) -> RawPageResult` and are
resolved through the `ModelRegistry` so heavy runtimes load once and are reused.
Heavy imports (`paddleocr`, `torch`, `pytesseract`) are **lazy** — importing this
package never pulls in model runtimes.

| Engine       | Role                              | Availability                          |
| ------------ | --------------------------------- | ------------------------------------- |
| `textlayer`  | Exact digital-PDF text (no OCR)   | Always (used when a text layer exists)|
| `paddle`     | Primary: printed text, invoices, tables | Needs `paddleocr` (in requirements) |
| `tesseract`  | Fallback + fusion voter, offline  | Needs `tesseract` binary + `pytesseract` |

Add Surya (orientation/reading order) or GOT-OCR later by dropping a new adapter
into `engines/` and appending it to `OcrConfig.engine_order` — nothing else
changes.

### Engine selection policy

1. If the page has a digital **text layer** and `prefer_text_layer` (default) and
   not `force_ocr` → use it exclusively (exact and free).
2. Else run the available **image engines** (up to `max_engines_per_page`, default
   2) and **fuse** them.
3. If no pixel engine is installed, fall back to any text layer present.
4. If a document yields no engine on any page → `NoEngineAvailableError`.

## Contracts

`OcrContract` → `PageOcr[]` → `OcrLine[]` → `OcrWord`. Every `OcrWord` carries
`confidence`, `box`, the winning `engine`, and `agreed_by` (which engines
corroborated it) — full provenance for extraction and human review. `as_dict()`
gives stable JSON for storage, telemetry, and the evaluation harness.

## Confidence

Fusion encodes cross-engine agreement into each token's confidence (boost when
corroborated, small penalty when only one of several engines saw it). The
`ConfidenceEngine` then rolls up: length-weighted per page, word-count-weighted
per document. Words below `OcrConfig.review_threshold` (0.85) are review
candidates via `OcrContract.low_confidence_words()`.

## Configuration (`config.py`)

`engine_order`, `prefer_text_layer`, `force_ocr`, `max_engines_per_page`,
`fusion_iou_threshold`, `agreement_bonus`, `singleton_penalty`,
`line_overlap_ratio`, `review_threshold`, `text_layer_min_chars`. All tunable per
deployment; none hard-coded in the engine.

## Installing the pixel engines (optional)

```bash
pip install -r apps/ai/requirements.txt   # includes paddleocr + pytesseract
# Tesseract also needs the native binary:
#   Windows: choco install tesseract   |   Debian: apt-get install tesseract-ocr
```

Without them the layer still runs on the text-layer engine (and CI stays green).

## Testing

```bash
cd apps/ai
python -m pytest tests/unit/test_ocr_fusion.py \
                 tests/unit/test_ocr_reading_order.py \
                 tests/integration/test_ocr_engine.py -q
```

- `test_ocr_fusion` — voting, agreement boost, disagreement resolution,
  complementary detections, singleton penalty.
- `test_ocr_reading_order` — line grouping, ordering, confidence roll-up.
- `test_ocr_engine` — end-to-end via the text-layer path, multi-page, telemetry,
  and the no-engine error case.
