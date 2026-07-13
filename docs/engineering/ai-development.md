# AI Development Standards

This document defines AI development governance for Fiscora.

## Model Management
- Models and weights are stored under root `models/` only.
- `apps/ai/app` code may only reference models through `app/model_manager`.
- Models must be versioned and audited before production use.

## Model Loading
- Use centralized model loaders and registries.
- Avoid loading large models in service constructors.
- Use lazy model initialization when possible.

## Data Privacy
- Do not store sensitive customer data in temporary files or logs.
- For data used in training or validation, follow legal and privacy guidelines.
- Mask or pseudonymize PII before logging.

## Security
- Validate all input to AI services.
- Prefer defensive coding around model inference to handle malformed requests.
- Ensure runtime environment variables are used for secrets and paths.

## Governance
- Document model purpose, version, and approved use cases.
- Keep a record of model registry changes and approvals.
- Review new model integrations with architecture and security stakeholders.
