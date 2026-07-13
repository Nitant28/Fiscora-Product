# ADR 0001: Freeze Architecture

Date: 2026-07-06

## Status
Accepted

## Context
The `P1` repository contains the AI service stack for Fiscora. To achieve a stable implementation baseline, we are freezing the approved architecture and preventing further restructuring.

## Decision
- Keep `apps/ai/app/` as the AI application boundary.
- Maintain `apps/ai/app/services/` for capability-based service packages.
- Place model artifacts under root `models/` and keep runtime code separate.
- Keep engineering governance documentation under `docs/engineering/`.

## Consequences
- Implementation can proceed without additional structural redesign.
- All future changes must conform to the approved package layout.
- Enforcement is required through review and CI checks.
