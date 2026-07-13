# Logging Standards

This document defines logging expectations for Fiscora services.

## General Rules
- Use structured logging and include context fields.
- Avoid using `print()` for diagnostics in production.
- Log at appropriate levels: `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`.

## AI Service Guidelines
- Log model load/unload events and version metadata.
- Log pipeline start/end and operation duration.
- Redact or avoid logging sensitive PII, API keys, and private customer data.

## Error Reporting
- Capture exceptions with stack traces when appropriate.
- Use domain-specific error messages for troubleshooting.
- Do not log raw user input unless absolutely necessary and safe.
