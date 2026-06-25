# Changelog

All notable changes to Maintainer Gate will be documented in this file.

## [0.1.1] - Unreleased

### Changed

- Reduce weak-description false positives for small, issue-linked documentation-only pull requests.

## [0.1.0] - 2026-06-24

### Added

- Initial PR intake rule engine.
- CLI with table, Markdown, and JSON output.
- GitHub Action metadata.
- Optional sticky PR comment mode for GitHub Actions.
- Checks for linked issues, weak descriptions, large PRs, sensitive paths, missing tests, missing docs, and optional AI disclosure.
- Policy configuration with `.maintainer-gate.json`.
- Example risky and clean PR payloads.
