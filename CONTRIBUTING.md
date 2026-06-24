# Contributing

Thanks for helping maintainers spend review time where it matters.

## Good First Contributions

- Add a conservative intake check.
- Improve false-positive boundaries.
- Add example PR payloads.
- Improve GitHub Action documentation.
- Add AI contribution policy examples from real projects.

## Check Guidelines

Each check should be:

- Easy to explain to a contributor.
- Focused on maintainer review cost.
- Conservative enough to avoid needless conflict.
- Covered by tests.

Maintainer Gate should not shame contributors, guess intent, or claim to prove AI usage.

## Local Development

```bash
npm test
node bin/maintainer-gate.js --input examples/risky-pr.json
node bin/maintainer-gate.js --input examples/risky-pr.json --format markdown
```

## Pull Requests

Please include:

- The maintainer problem the change addresses.
- Example input before and after.
- Known false positives.
- Test coverage.
