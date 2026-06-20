# Release Process

Juured uses semantic version tags to trigger GitHub releases.

## Version Tags

Use this shape:

```text
v0.1.0
v0.1.1
v1.0.0
v1.0.0-alpha.1
```

## Release Steps

1. Confirm `main` is green.
2. Confirm release-impact labels are correct on merged PRs.
3. Tag the release.

```bash
git checkout main
git pull --ff-only
git tag v0.1.0
git push origin v0.1.0
```

The release workflow creates a GitHub release with generated notes. The categories are controlled by
`.github/release.yml`.

## Release Labels

- `release:major` for breaking changes.
- `release:minor` for user-visible features.
- `release:patch` for fixes.
- `type:documentation` for docs-only changes.
- `area:security` for security work.
