# Claude Code Instructions

Follow the shared repository instructions in [AGENTS.md](AGENTS.md).

## Required Context

Before making structural or product changes, read:

- [README.md](README.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/AGENT_WORKFLOW.md](docs/AGENT_WORKFLOW.md)

## Collaboration Defaults

- Use GitHub issues as the source of truth for progress and blockers.
- Work in short-lived branches from `main`.
- Keep each branch tied to one issue or one clearly stated objective.
- Prefer small checkpoint commits after meaningful verified progress.
- Update the issue or PR with handoff notes before stopping.
- Run `npm run verify` before claiming the work is ready.

Do not introduce a new project structure without updating the architecture docs and adding an ADR
when the decision affects other collaborators.
