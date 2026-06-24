# Maintainers

Maintainer Gate is maintained by the repository owner and volunteer contributors.

## Maintainer Responsibilities

- Keep the project focused on PR intake, not contributor shaming.
- Review new checks for clarity, false-positive risk, and usefulness to maintainers.
- Keep the GitHub Action easy to adopt with minimal permissions.
- Triage issues into bugs, policy requests, false positives, docs, and examples.
- Publish releases only after tests pass and docs reflect user-facing behavior.

## Review Standard

A new intake check should include:

- The maintainer problem it addresses.
- A risky PR example that should trigger.
- A safe PR example or false-positive boundary.
- Test coverage.
- Documentation updates when behavior changes.

## Release Cadence

Patch releases can ship for bug fixes and documentation corrections. Minor releases should group new checks, policy options, and GitHub Action behavior changes.
