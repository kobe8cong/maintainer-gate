# Intake Checks

Maintainer Gate checks whether a pull request has enough context to deserve deep review time.

It does not claim to detect AI-generated code. Each check is about maintainer workflow risk.

## Suggested Labels

Reports include `suggestedLabels`, a conservative list of labels maintainers can apply manually or wire into later automation. Maintainer Gate does not change GitHub labels by itself.

| Rule | Suggested label |
| --- | --- |
| `intake.linked-issue` | `needs-context` |
| `intake.weak-description` | `needs-context` |
| `intake.large-pr` | `large-pr` |
| `risk.sensitive-paths` | `sensitive-paths` |
| `quality.missing-tests` | `missing-tests` |
| `quality.missing-docs` | `missing-docs` |
| `policy.ai-disclosure` | `ai-disclosure` |

## `intake.linked-issue`

Severity: `medium`

Triggers when the PR title and body do not reference an issue with phrases such as `fixes #123`, `closes #123`, `refs #123`, or a GitHub issue URL.

Why it matters: issue-linked work is easier to triage, prioritize, and close if the implementation is not ready.

## `intake.weak-description`

Severity: `medium`

Triggers when the PR body is empty, too short, or mostly narrates that files were changed without explaining intent, tests, or risk.

Why it matters: maintainers need problem, intent, testing, and risk context before reading code.

## `intake.large-pr`

Severity: `high`

Triggers when changed files or changed lines exceed policy thresholds.

Why it matters: large unsolicited PRs are expensive to review and often need splitting before implementation review.

## `risk.sensitive-paths`

Severity: `high` by default

Triggers when files match configured sensitive path groups such as auth, security, billing, database, or release workflows.

Why it matters: these changes usually need owner review, stronger tests, or explicit rollout notes.

## `quality.missing-tests`

Severity: `medium`

Triggers when production code changes are present but no test files changed.

Why it matters: maintainers should know whether behavior is covered before spending deep review time.

## `quality.missing-docs`

Severity: `low`

Triggers when user-facing configuration, policy, CLI, or workflow files change without docs.

Why it matters: adoption friction and support burden often come from undocumented behavior changes.

## `policy.ai-disclosure`

Severity: `medium`

Optional. Triggers when `requireAiDisclosure` is enabled but the PR body does not disclose meaningful AI assistance.

Why it matters: some projects want contributors to disclose AI assistance so maintainers can ask better review questions without accusing anyone.
