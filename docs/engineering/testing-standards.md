# Testing Standards

This document defines testing expectations for Fiscora.

## Test Location
- Unit tests belong under `tests/` or `apps/*/tests/`.
- Service-level tests may live next to the service if clearly labeled as tests.
- Production code under `apps/ai/app/` must not contain executable test scripts.

## Test Types
- Unit tests for individual functions and services.
- Integration tests for service interaction and pipelines.
- Regression tests for known data/model behaviors.

## Naming
- Test files must begin with `test_` or end with `_test.py`.
- Test classes and functions should describe expected behavior.

## CI Requirements
- All tests required for a PR must pass before merge.
- Include smoke tests for model loading and service startup for `apps/ai`.
