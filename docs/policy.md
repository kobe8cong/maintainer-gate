# Policy Configuration

Maintainer Gate reads `.maintainer-gate.json` by default.

## Bootstrap Policy Files

Use `policy init` to add starter policy files to a repository:

```bash
maintainer-gate policy init
```

It creates:

- `.maintainer-gate.json`
- `AI_POLICY.md`
- `.github/PULL_REQUEST_TEMPLATE.md`

The command refuses to overwrite existing files. Use `maintainer-gate policy init --force` only when you intentionally want to replace those starter files.

```json
{
  "requireLinkedIssue": true,
  "requireAiDisclosure": false,
  "maxChangedFiles": 18,
  "maxChangedLines": 600,
  "failOn": "high"
}
```

## Fields

| Field | Type | Purpose |
| --- | --- | --- |
| `requireLinkedIssue` | boolean | Require a linked issue or clear issue reference. |
| `requireAiDisclosure` | boolean | Require AI assistance disclosure in the PR body. |
| `maxChangedFiles` | number | Maximum changed files before large-PR triage. |
| `maxChangedLines` | number | Maximum additions plus deletions before large-PR triage. |
| `riskyPathSeverity` | string | Severity for sensitive path changes. |
| `minBodyLength` | number | Minimum PR body length before weak-description checks. |
| `failOn` | string | CI failure threshold: `low`, `medium`, `high`, or `critical`. |
| `riskyPathGroups` | array | Custom sensitive path groups. |

CLI flags override config where applicable.

## Custom Risky Paths

```json
{
  "riskyPathGroups": [
    {
      "name": "tenant-isolation",
      "patterns": ["tenant", "workspace", "organization"]
    },
    {
      "name": "payments",
      "patterns": ["billing", "stripe", "checkout"]
    }
  ]
}
```

Patterns are simple case-insensitive substring matches against changed file paths.

See [checks.md](checks.md) for the checks that use these policy fields.
