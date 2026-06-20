# Repository Instructions

This repository follows the global Codex rules supplied by the maintainer.

## Local Priorities

- Keep the repository foundation language-neutral until the application stack is explicitly
  selected.
- Add application code under clear top-level boundaries such as `apps/`, `packages/`, `services/`,
  or `infra/`.
- Update `docs/ARCHITECTURE.md` and add an ADR under `docs/adr/` when changing architectural
  boundaries.
- Keep `npm run verify` as the local source of truth for checks that contributors should run before
  opening pull requests.
- Do not weaken CI, security scans, branch protection expectations, or release checks without
  documenting the decision.
