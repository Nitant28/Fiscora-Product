# AI Model Governance Policy

This document defines AI model governance for Fiscora.

## Policy Statement
All AI models used by Fiscora must be managed through the centralized model registry and must reside under root `models/`.

## Scope
- Models used by `apps/ai/app` services.
- Model weights, checkpoints, and downloaded artifacts.
- Model version metadata and approval records.

## Requirements
- Model artifacts must not be committed into `apps/ai/app`.
- Models must be referenced by name and version, not by absolute or relative file path.
- Model metadata must be tracked in source control or a documented governance log.

## Approval
- New model introduction requires architecture review and stakeholder signoff.
- Model version upgrades must be documented, tested, and approved.

## Auditing
- Maintain a record of model changes, including source, version, and intended capability.
- Review model usage and access patterns periodically.

## Security
- Keep model storage paths configurable and separated from production code.
- Validate all model inputs and handle inference exceptions gracefully.
