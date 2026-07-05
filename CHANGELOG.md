# Changelog

All notable changes to Maintainer Gate will be documented in this file.

## [0.1.3] - 2026-07-05

### Added

- Add `maintainer-gate policy init` to create starter policy files.
- Add overwrite protection for policy init, with an explicit `--force` mode.

## [0.1.2] - 2026-06-27

### Added

- Add suggested labels to JSON, Markdown, and table reports.
- Document rule-to-label mappings for maintainer triage workflows.

## [0.1.1] - 2026-06-25

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
