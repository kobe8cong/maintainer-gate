# Security Policy

Maintainer Gate runs locally or inside GitHub Actions. It does not require an API key and does not send repository contents to a third-party service.

When running as a GitHub Action, it may use `GITHUB_TOKEN` to fetch pull request file metadata from GitHub.

Do not paste real secrets into public issues. If you find a vulnerability in the tool itself, open a private security advisory after the repository is published.
