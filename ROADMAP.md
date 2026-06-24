# Roadmap

Maintainer Gate focuses on pull request intake before deep code review.

## v0.1

- Local CLI for PR JSON input.
- GitHub Action metadata.
- Markdown, table, and JSON reports.
- Sticky PR comment support.
- Checks for linked issues, weak descriptions, large PRs, sensitive paths, missing tests, missing docs, and optional AI disclosure.

## v0.2

- First-class PR comment templates.
- More configurable sensitive path groups.
- GitHub labels for recommendations.
- `policy init` command to generate `.maintainer-gate.json` and AI contribution policy templates.

## v0.3

- Path-owner routing hints.
- SlopSleuth integration for generated-code release blockers.
- Baseline mode for existing large projects.
- Public example gallery of maintainer intake policies.

## Non-Goals

- Proving whether a pull request was AI-generated.
- Replacing human review.
- Automatically closing pull requests by default.
- Sending repository contents to third-party services.
