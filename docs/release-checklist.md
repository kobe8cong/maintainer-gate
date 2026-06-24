# Release Checklist

Use this checklist before publishing a Maintainer Gate release.

## Code

- `npm test` passes.
- `node bin/maintainer-gate.js --input examples/risky-pr.json --format markdown --fail-on critical` passes.
- JSON output remains parseable.
- GitHub Action input behavior is documented.

## Documentation

- `README.md` reflects new commands, inputs, and policy fields.
- `CHANGELOG.md` includes user-facing changes.
- `docs/github-action.md` covers permissions and rollout guidance.
- `docs/policy.md` covers new policy fields.

## Package

- `package.json` version is updated.
- Repository, bugs, homepage, and author fields point to the real public project.
- `npm pack --dry-run` succeeds.

## GitHub

- CI is green on `main`.
- Release notes explain practical maintainer value.
- Roadmap issues are open and labeled.
- The first public version avoids overclaiming AI detection.
