# GitHub Action

Maintainer Gate can run on `pull_request` events.

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

## Permissions

- `pull-requests: read` lets the action fetch changed files for sensitive-path and missing-test checks.
- `issues: write` is only needed when `comment: true`, because pull request comments use the issues comments API.

## Behavior

- The action reads the GitHub event from `GITHUB_EVENT_PATH`.
- If `GITHUB_TOKEN` is available, it fetches PR file metadata from the GitHub API.
- Markdown output is appended to the job summary.
- If `comment: true`, a sticky PR comment is created or updated.
- The workflow exits non-zero when findings meet the `fail-on` threshold.

## Recommended Rollout

Start with `fail-on: critical` or `fail-on: high`, then adjust after maintainers see the noise level. The goal is to reduce wasted review time, not surprise contributors with unexplained failures.

See [../examples/workflow.yml](../examples/workflow.yml) for a copyable workflow.
