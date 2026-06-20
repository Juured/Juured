# Repository Instructions

This repository follows the global Codex rules supplied by the maintainer.

These instructions also define the expected collaboration model for AI coding agents working through
Codex, Claude Code, Cursor, or similar tools.

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

## Agent Collaboration Rules

- Read `README.md`, `docs/ARCHITECTURE.md`, and `docs/AGENT_WORKFLOW.md` before changing project
  structure.
- Treat GitHub issues as the project progress tracker. Before starting non-trivial work, search
  existing issues and create or claim an issue when no suitable one exists.
- Keep work scoped to one issue or one clear objective per branch.
- Update the issue or pull request with progress, blockers, architectural impact, and handoff notes.
- Prefer more small checkpoint commits over fewer large commits. Commit after meaningful verified
  progress so collaborators and their agents can understand the sequence of work.
- Do not create parallel architecture, workflow, or tracking systems. Extend the existing files
  instead.
- Do not create empty product directories. Add `apps/`, `packages/`, `services/`, or `infra/` only
  when real implementation files are included.
- Add or update an ADR in `docs/adr/` when introducing architectural boundaries, runtime stack
  choices, data flow, deployment shape, or shared interfaces.
- Keep `npm run verify` passing before handing work to another collaborator.

## Handoff Expectations

Every agent handoff should answer:

- What changed?
- Which issue or objective does it support?
- Which files are the next collaborator expected to read first?
- What checks passed or failed?
- What decisions are still needed?

Use `.github/ISSUE_TEMPLATE/agent_task.yml` for work that needs coordination across multiple people
or agents.
