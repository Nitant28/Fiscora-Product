# Coding Standards

This document defines the Fiscora engineering coding standards.

## Imports
- Use absolute imports only.
- Never use `from .` or `from ..`.
- Never use local imports inside functions unless absolutely necessary.

## Typing
- Every public function and method must include type hints.
- Strongly prefer `typing` types for public interfaces.

## Logging
- Use structured logging via `logger`.
- Never use `print()` in production code.

## Error Handling
- Use explicit exception classes for domain and service errors.
- Do not swallow exceptions silently.

## Configuration
- Do not hardcode API keys, ports, model paths, thresholds, or cache sizes.
- All runtime configuration must come from environment/configuration files.
