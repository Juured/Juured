# Contributing

Thanks for contributing to Juured. This project is set up for multiple collaborators, so small pull
requests and clear ownership matter.

## Branching

Create short-lived branches from `main`.

```text
feature/<issue-number>-short-description
fix/<issue-number>-short-description
docs/<issue-number>-short-description
chore/<issue-number>-short-description
```

Keep branches focused. If a change touches unrelated concerns, split it into separate pull requests.

## Local Checks

```bash
npm ci
npm run verify
```

Do not rely on CI as the first time checks run. If a check is intentionally skipped, explain why in
the pull request.

## Pull Requests

- Link the issue or decision that explains the change.
- Keep the PR description concrete: what changed, why it changed, and how it was verified.
- Prefer more small commits over one large commit. Each commit should represent a meaningful,
  verified checkpoint.
- Request review from CODEOWNERS when protected branch settings are enabled.
- Rebase or update from `main` before merge when the branch is stale.

## Merge Conflict Discipline

- Prefer additive changes and small files.
- Avoid broad formatting changes mixed with product changes.
- Update shared docs in the same PR as the behavior they describe.
- Coordinate before editing high-traffic files such as `README.md`, shared workflow files, or root
  configuration.

See [docs/CONTRIBUTOR_WORKFLOW.md](docs/CONTRIBUTOR_WORKFLOW.md) for more detail.
