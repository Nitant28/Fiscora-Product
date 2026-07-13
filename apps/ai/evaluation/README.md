# AI Evaluation Framework

This package provides the initial evaluation and benchmarking scaffold for the procurement document pipeline.

## Goals
- Measure OCR and extraction quality from the first sprint onward.
- Compare model variants using a consistent metric set.
- Provide a place for benchmark assets and golden documents.

## Structure
- benchmark.py: benchmark runner and result container
- metrics.py: evaluation metrics definitions
- compare_models.py: model-to-model comparison summary
- datasets.py: dataset wrapper for benchmark assets

## Suggested future extensions
- OCR character accuracy and word accuracy scoring
- Field-level extraction precision/recall/F1
- Latency and memory profiling integration
- Golden-document regression suites
