# Git Workflow

This document defines the Git workflow for Fiscora development.

## Branching
- `main` is the protected production branch.
- Feature work is developed in descriptive feature branches: `feature/<name>`.
- Fixes use `fix/<name>` and hotfixes use `hotfix/<name>`.

## Pull Requests
- Every PR must target `main` or the current release branch.
- PRs must include a brief description, linked issue, and testing notes.
- At least one code review is required before merge.

## Commit Messages
- Use imperative style: `Add`, `Fix`, `Update`, `Remove`.
- Keep messages concise and include context.
- Prefix scope when helpful: `ai:`, `api:`, `infra:`, `docs:`.

## Releases
- Release branches may be created for major releases.
- Merges to `main` require passing CI and architecture review for core systems.
