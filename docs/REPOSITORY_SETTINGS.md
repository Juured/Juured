# Repository Settings

These settings must be enabled in GitHub after the first commit is pushed.

## Branch Protection

Protect `main` with:

- Require a pull request before merging.
- Require approvals from CODEOWNERS.
- Dismiss stale pull request approvals when new commits are pushed.
- Require status checks to pass before merging.
- Require branches to be up to date before merging.
- Restrict force pushes.
- Restrict deletions.

## Required Status Checks

Use these checks once GitHub has observed the first workflow run:

- `CI / Repository checks`
- `Security / Secret scan`
- `Security / Dependency review`
- `Security / CodeQL`

Do not require `Security / OSSF Scorecard` on pull requests because it runs only on `main`,
schedules, and manual dispatch.

## Security Features

Enable:

- Private vulnerability reporting.
- Dependabot alerts.
- Dependabot security updates.
- Secret scanning.
- Push protection, if available for the repository plan.
