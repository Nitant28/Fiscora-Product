# ADR 0002: Model Registry

Date: 2026-07-06

## Status
Accepted

## Context
AI services must share model access consistently and avoid scattered weight management.

## Decision
- Use `apps/ai/app/model_manager/` as the central model registry and loader layer.
- Store downloaded model weights in root `models/`.
- Code outside model manager should reference models by name and version, not file paths.

## Consequences
- Model lifecycle and caching are centralized.
- Service implementations remain decoupled from storage details.
- Model governance and versioning are easier to audit.
