# ADR 0003: Service Boundaries

Date: 2026-07-06

## Status
Accepted

## Context
The `apps/ai` stack needs clear boundaries so services can evolve independently.

## Decision
- Define one capability service per folder in `apps/ai/app/services/`.
- Services may use shared interfaces and utilities, but not import other service packages directly.
- Pipelines orchestrate interactions between services.

## Consequences
- Services can be maintained and tested independently.
- The architecture scales better for new AI capabilities.
- Cross-service coupling is minimized.
