# ADR 0004: Document Pipeline

Date: 2026-07-06

## Status
Accepted

## Context
Fiscora's AI capability includes document processing and validation workflows.

## Decision
- Orchestrate document processing through `apps/ai/app/pipelines/`.
- Each pipeline composes service operations to perform extraction, validation, enhancement, and classification.
- Keep pipeline orchestration separate from individual service business logic.

## Consequences
- Document workflows are easier to reason about and extend.
- Service behavior can be reused by multiple pipelines.
- Pipeline changes do not force service refactors.
