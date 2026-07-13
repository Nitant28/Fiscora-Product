# Image Intelligence Layer (Enhancement + Quality Engine)

Layers 2 & 3 of the Document Intelligence pipeline. This stage receives a
`DocumentContract` from the Document Foundation and produces an
`EnhancementContract` for the downstream Layout / OCR / Vision stages.

Its job is **not** to "clean every image". It is to *measure* image quality, then
apply the **minimal** set of corrections a page actually needs — and to leave
already-good pages untouched. This saves compute and never degrades clean scans.

## Flow

```
DocumentContract
      │
      ▼
QualityAnalyzer.analyze  ──►  QualityMetrics (before)
      │
      ▼
EnhancementDecision.plan  ──►  ["deskew", "contrast", ...]   (or [] → skip)
      │
      ▼
EnhancementPipeline.build_from_plan  ──►  [Transform, ...]
      │
      ▼
ImageProcessor.process  (per page, per-transform error isolation + telemetry)
      │
      ▼
QualityAnalyzer.analyze  ──►  QualityMetrics (after)
      │
      ▼
EnhancementContract  (document, quality, applied_transforms, before/after, timing)
```

## Contracts (`app/contracts`)

- **`QualityMetrics`** — raw measurements (`blur`, `brightness`, `contrast`,
  `noise`, `skew`, `exposure`, `shadow`, `dpi`, resolution) **plus** normalised
  `0–100` `subscores`, a weighted overall `score`, and a human `grade`
  (`excellent | good | fair | poor`). `as_dict()` gives a JSON-safe view.
- **`EnhancementContract`** — the enhanced `document`, the definitive `quality`,
  `applied_transforms`, `skipped`, `quality_before/after`, `processing_time_ms`,
  and derived `improved` / `score_delta`.

## Quality Engine (`quality.py`, `quality_metrics.py`)

`quality_metrics.py` holds **pure, independently testable** measurement functions
(no scoring, no decisions). `QualityAnalyzer` composes them into sub-scores using
the normalisation **bands** and **weights** in `config.py`, then blends them into
one score. All thresholds live in `EnhancementConfig` — never hard-coded.

## Transforms (`transforms/`)

Each transform is an independent, named module implementing
`ImageTransform.apply(bgr) -> bgr`:

| name        | module                        | purpose                                   |
|-------------|-------------------------------|-------------------------------------------|
| `orientation` | `geometry/orientation.py`   | 0/90/180/270 slot (model-based, TODO OCR) |
| `deskew`    | `geometry/deskew.py`          | fine rotation correction (min-area rect)  |
| `resize`    | `geometry/resize.py`          | cap oversized / upscale tiny pages        |
| `shadow`    | `filters/shadow.py`           | remove uneven illumination / gradients    |
| `contrast`  | `filters/contrast.py`         | CLAHE on the L channel                     |
| `denoise`   | `filters/denoise.py`          | edge-preserving (bilateral / NL-means)     |
| `threshold` | `filters/threshold.py`        | adaptive binarisation (worst-case only)    |

## Decision Engine (`decision.py`)

`EnhancementDecision.plan(metrics)` returns the canonical-ordered list of
transforms to run. A globally clean page (`score ≥ skip_all_above_score`) only
receives structural fixes (skew/oversize) and is otherwise skipped.

## Observability

- **Telemetry**: pass a `TelemetryRecorder` to `EnhancementEngine`; it records a
  per-transform event (`enhancement.<name>`) and a summary `enhancement` event
  with score/grade/applied/skip.
- **Logging**: structured `structlog` events (`enhancement.complete`,
  `enhancement.transform_failed`).

## Error handling

- `EmptyDocumentError` / `InvalidImageError` for unusable input.
- Individual transform failures are **logged and skipped** (graceful degradation)
  — one bad filter never aborts a document.

## Configuration

`EnhancementConfig` (in `config.py`) — normalisation bands, score weights (must
sum to 1.0), grade cut-offs, decision triggers, and transform bounds. Fetch the
cached singleton via `get_enhancement_config()` or inject a custom instance into
the engine for testing / per-tenant tuning.

## Testing

Run from `apps/ai`:

```bash
python -m pytest tests/unit tests/integration tests/golden -q
```

- `tests/unit` — metric functions, analyzer, decision, transforms
- `tests/integration` — full engine (skip, enhance, telemetry, page count, errors)
- `tests/golden` — pinned behaviour on deterministic reference pages

## Benchmark

```bash
python -m evaluation.enhancement_benchmark
```

Reports per-profile before/after score, selected transforms, latency, and an
aggregate throughput / p95 summary.
