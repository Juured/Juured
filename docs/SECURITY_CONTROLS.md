# Security Controls

## Automated Controls

| Control           | Location                         | Purpose                                       |
| ----------------- | -------------------------------- | --------------------------------------------- |
| Gitleaks          | `.github/workflows/security.yml` | Detect committed secrets                      |
| Dependency review | `.github/workflows/security.yml` | Block vulnerable dependency additions in PRs  |
| CodeQL            | `.github/workflows/security.yml` | Static analysis for JavaScript and TypeScript |
| OSSF Scorecard    | `.github/workflows/security.yml` | Supply-chain posture reporting                |
| Dependabot        | `.github/dependabot.yml`         | Dependency and GitHub Actions update PRs      |

## Contributor Controls

- Run `npm run verify` before opening a PR.
- Keep `.env` files local and use `.env.example` only for non-secret names.
- Do not paste secrets into issues, pull requests, logs, or screenshots.
- Use GitHub environments and repository secrets for deployment credentials after deployment exists.
