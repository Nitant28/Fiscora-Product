# AI Runtime

The **execution operating system** for every AI capability (OCR, layout, vision,
classification, extraction). It enforces the platform's single most important
architectural rule:

> **No AI model is ever called directly from business logic.**
> Business code calls `runtime.execute(task, inputs, model=…)`; the runtime owns
> everything else.

That one seam lets you upgrade PaddleOCR → a future model, swap Gemini for another
provider, A/B-test versions, or run tenant-specific configs **without touching a
line of business code**.

## What the runtime owns

```
resolve descriptor → lazy load → warmup → (timeout-guarded) predict
    → retries w/ backoff → telemetry + health → LRU memory management
```

- **Lifecycle**: lazy load, warmup, warm-instance reuse, LRU eviction, unload.
- **Resilience**: configurable retries with linear backoff; per-call timeout guard.
- **Observability**: per-model health (status, calls, failures, success rate,
  rolling latency window) + telemetry events (`runtime.<task>`).
- **Routing**: resolve a model explicitly (`model=`), by preference list
  (`prefer=`), or automatically by task + capability (language / doc type).
- **Memory**: at most `max_warm_models` instances stay warm; the rest are evicted.

## Model Registry v2

Stores rich `ModelDescriptor` metadata — **not** bare instances — so the runtime
decides *which* model to use without loading anything:

| Field | Purpose |
| ----- | ------- |
| `name`, `version` | identity + versioning (every result records the version) |
| `task` | which capability it serves (`Task.OCR`, `Task.VISION`, …) |
| `factory` | lazy builder → a `RuntimeModel` (heavy imports stay lazy) |
| `framework`, `device`, `license`, `dependencies` | operational metadata |
| `languages`, `doc_types` | capability filters for routing |
| `priority` | lower = preferred among models serving the same task |
| `availability()` | cheap probe: can this run in this environment now? |

## Writing a model

Implement `RuntimeModel` and register a descriptor:

```python
class MyOCR(RuntimeModel):
    def load(self): ...        # allocate (once)
    def warmup(self): ...      # optional dummy inference
    def predict(self, page):   # the only required method
        return RawPageResult(words=[...])
    def health(self): return True
    def unload(self): ...      # free GPU/mem on eviction

registry.register(ModelDescriptor(
    name="my_ocr", version="1.0", task=Task.OCR,
    factory=lambda: MyOCR(), priority=15,
    availability=lambda: _deps_installed(),
))
result = runtime.execute(Task.OCR, page, model="my_ocr")
```

## Reference integration: OCR

The OCR layer is the reference consumer. Engines (`textlayer`, `paddle`,
`tesseract`) are registered via `services/ocr/runtime_models.py`; `OCREngine`
**routes** (picks engine names by policy) while the runtime **executes**. See
`app/services/ocr/`.

## Configuration (`config.py`)

`max_retries`, `retry_backoff_ms`, `timeout_s`, `max_warm_models` (from
`Settings.MAX_MODELS_IN_MEMORY`), `enable_warmup`, `default_device` (from
`Settings.DEVICE`), `max_workers`.

## Testing & benchmarking

```bash
cd apps/ai
python -m pytest tests/unit/test_runtime_registry.py \
                 tests/unit/test_runtime_engine.py \
                 tests/integration/test_ocr_runtime.py -q
python -m evaluation.runtime_benchmark   # throughput, cold-vs-warm, overhead
```

Unit tests cover registry resolution, warm reuse, retries, permanent-failure
exhaustion, timeout enforcement, LRU eviction, and preference routing. The OCR
integration test proves inference flows through the runtime (health + telemetry
populated, warm instance reused across pages).
