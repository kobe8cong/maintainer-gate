# Maintainer Gate

A no-drama PR intake gate for maintainers handling AI-assisted open-source contributions.

Maintainer Gate does not try to prove a contributor used AI. It checks whether a pull request gives maintainers enough context to be worth review time.

```bash
npx maintainer-gate --input examples/risky-pr.json
```

```text
Maintainer Gate: needs-maintainer-triage
Readiness: 0/100
Changed: 5 files, 690 additions, 185 deletions
Critical 0 | High 2 | Medium 3 | Low 1
Suggested labels: `needs-context`, `large-pr`, `sensitive-paths`, `missing-tests`, `missing-docs`
```

## Why This Exists

AI coding tools made it cheap to open pull requests. Maintainer review time did not get cheaper.

Maintainer Gate helps projects set a calm, explicit intake bar before deep review: link the issue, explain intent, keep changes small, add tests, and call out risky areas.

## What It Checks

- Missing linked issue or problem statement.
- Weak PR descriptions that only narrate the diff.
- Large PRs that need splitting or justification.
- Sensitive paths such as auth, security, billing, database, and release workflows.
- Production code changes without tests.
- User-facing configuration changes without docs.
- Optional AI assistance disclosure policy.

Reports also include suggested issue labels such as `needs-context`, `large-pr`, `sensitive-paths`, `missing-tests`, `missing-docs`, and `ai-disclosure`. Maintainer Gate only reports these labels; it does not apply labels to GitHub pull requests.

## Usage

```bash
maintainer-gate --input examples/risky-pr.json
maintainer-gate --input examples/risky-pr.json --format markdown
maintainer-gate --input examples/risky-pr.json --format json
maintainer-gate --input examples/risky-pr.json --require-ai-disclosure
maintainer-gate --input examples/risky-pr.json --fail-on high
```

## GitHub Actions

```yaml
name: Maintainer Gate

on:
  pull_request:
    types: [opened, edited, synchronize, reopened]

jobs:
  intake:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: read
      issues: write
    steps:
      - uses: actions/checkout@v4
      - uses: kobe8cong/maintainer-gate@v0.1.0
        env:
          GITHUB_TOKEN: ${{ github.token }}
        with:
          fail-on: high
          format: markdown
          comment: true
```

See [GitHub Action docs](docs/github-action.md).

A copyable workflow is available at [examples/workflow.yml](examples/workflow.yml).

## Configuration

Add `.maintainer-gate.json`:

```json
{
  "requireLinkedIssue": true,
  "requireAiDisclosure": false,
  "maxChangedFiles": 18,
  "maxChangedLines": 600,
  "failOn": "high"
}
```

See [policy configuration](docs/policy.md).

See [intake checks](docs/checks.md) for rule details and maintainer rationale.

## Positioning

Maintainer Gate is not a code reviewer, bot detector, or security scanner. It is an intake checklist that helps maintainers decide what to ask before spending deep review time.

## Roadmap

See [ROADMAP.md](ROADMAP.md).

- Suggested AI contribution policy templates.
- Path-owner routing hints.
- SlopSleuth integration for generated-code release blockers.
- Public examples from real maintainer workflows.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). New checks should be explainable, conservative, and focused on maintainer review cost.

Useful maintainer docs:

- [Roadmap](ROADMAP.md)
- [Release checklist](docs/release-checklist.md)
- [Security policy](SECURITY.md)
- [Code of conduct](CODE_OF_CONDUCT.md)

## License

MIT
