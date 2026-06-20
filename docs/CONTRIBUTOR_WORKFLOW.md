# Contributor Workflow

## Branching Model

Use a protected `main` branch with short-lived work branches.

```text
main
  feature/12-auth-flow
  fix/18-ci-cache
  docs/21-architecture-notes
  chore/24-label-sync
```

This keeps review smaller and reduces merge conflicts for hackathon collaboration.

## Pull Request Expectations

Every pull request should include:

- A concise summary.
- The issue or decision it supports.
- Verification commands and results.
- Any release impact.

Required checks should include:

- `CI / Repository checks`
- `Security / Secret scan`
- `Security / Dependency review`
- `Security / CodeQL`

`Security / OSSF Scorecard` runs on `main` and scheduled scans because it evaluates repository
posture rather than a single PR diff.

## Review Flow

1. Open the PR early once the scope is clear.
2. Keep commits focused and messages readable.
3. Address reviewer comments in follow-up commits.
4. Re-run `npm run verify` after meaningful changes.
5. Squash merge or rebase merge according to maintainer preference.

## Merge Conflict Avoidance

- Keep documentation changes close to the code or process they explain.
- Avoid formatting-only edits in product PRs.
- Coordinate before touching root files used by everyone.
- Prefer small config files over large central files when adding stack-specific tooling.
