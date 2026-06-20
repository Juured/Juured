# ADR 0001: Repository Foundation First

## Status

Accepted

## Context

Juured is starting as an empty repository with multiple collaborators. The product stack has not
been selected yet, but the repository still needs professional collaboration, security, CI/CD,
release, and documentation defaults.

## Decision

Bootstrap the repository with language-neutral DevOps and governance essentials before adding
product code:

- GitHub Actions for repository checks, security scans, labels, and releases.
- Dependabot for npm and GitHub Actions updates.
- Contributor workflow, security policy, architecture notes, and release documentation.
- A local `npm run verify` command that matches CI.

## Consequences

- Contributors can validate changes before application code exists.
- Future stack-specific checks can be added without replacing the foundation.
- Maintainers must update architecture docs and ADRs as real product boundaries emerge.
