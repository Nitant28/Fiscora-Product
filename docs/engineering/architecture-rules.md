# Architecture Rules

This document captures the approved architecture rules for `apps/ai`.

## Service Boundaries
- Each capability lives in its own service package under `apps/ai/app/services/`.
- Services may depend only on shared interfaces and common utility modules.
- No service should import another service directly.

## Model Runtime Separation
- Model weights, checkpoints, and downloaded artifacts belong under root `models/`.
- `apps/ai/app` may only reference model names or registries, not raw weight files.
- Model loading is centralized through `apps/ai/app/model_manager`.

## Pipeline Rules
- Workflow orchestration lives under `apps/ai/app/pipelines/`.
- Pipelines may compose services, but service implementations remain isolated.
- Pipelines should accept inputs and return structured outputs.

## Interface Contracts
- Shared contracts live in `apps/ai/app/interfaces/`.
- Services implement interfaces and expose stable operation signatures.
- Changes to interfaces require review and may trigger migration updates.
