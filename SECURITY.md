# Security Policy

## Supported Versions

The project has not shipped a public release yet. Security fixes apply to the default branch until
release branches exist.

## Reporting a Vulnerability

Do not open a public issue for suspected vulnerabilities.

Send a private report to the maintainers through the repository owner or GitHub private
vulnerability reporting when enabled. Include:

- Affected files, commits, or workflows.
- Reproduction steps.
- Impact and affected data, if known.
- Suggested fix, if available.

Maintainers should acknowledge valid reports within 72 hours during active project periods.

## Security Controls

- Gitleaks scans for committed secrets.
- Dependency review blocks vulnerable dependency additions in pull requests.
- CodeQL scans JavaScript and TypeScript once source files exist.
- OSSF Scorecard reports supply-chain posture.
- Dependabot proposes GitHub Actions and npm dependency updates.
