# Fiscora AI Production Architecture

This document captures the production-ready architecture that should remain stable as the platform evolves.

## Architectural Layers

- Platform layer: shared infrastructure, configuration, file storage, cache, and runtime services.
- Domain layer: business entities, rules, and policies for procurement documents.
- Service layer: reusable AI capabilities such as enhancement, OCR, layout, extraction, validation, and risk.
- Pipeline layer: orchestrates services into end-to-end document workflows.
- Orchestrator layer: owns execution, retries, tracing, and workflow coordination.
- Evaluation layer: benchmarking, leaderboards, failure galleries, and regression reporting.
- Governance layer: audit, compliance, policy, and retention hooks.

## Core Rules

- No relative imports.
- No service-to-service imports; pipelines orchestrate services.
- All models are accessed through the model manager.
- Business logic stays in the domain layer.
- AI logic remains in services and pipelines, not in FastAPI routes.
- All configuration comes from typed settings.
- Every architectural change requires an ADR.

## Initial Implementation Scope

1. Document foundation: MIME detection, page loading, metadata extraction.
2. Enhancement: image preprocessing with measurable quality metrics.
3. Layout detection.
4. OCR.
5. OCR fusion.
6. Semantic vision.
7. Extraction.
8. Validation.
9. Risk analysis.
10. Procurement intelligence.
