# Agent Workflow

Juured is expected to be edited by people using tools such as Codex, Claude Code, Cursor, and other
AI coding agents. This document keeps those agents aligned so they do not create separate
structures, duplicate tracking systems, or unclear handoffs.

## Source Of Truth

Use this order of context:

1. `README.md` for project purpose and current status.
2. `docs/ARCHITECTURE.md` for repository boundaries and future product layout.
3. GitHub issues for current work, blockers, and coordination.
4. ADRs in `docs/adr/` for accepted architecture decisions.
5. Pull requests for implementation discussion and final review.

Do not create a separate progress file unless maintainers explicitly decide to add one. GitHub
issues and PRs are the progress system because they avoid multiple agents editing the same status
document.

## Starting Work

1. Pull the latest `main`.
2. Read the issue or create one from `.github/ISSUE_TEMPLATE/agent_task.yml`.
3. Check whether an ADR or architecture doc already constrains the work.
4. Create a short-lived branch:

```text
feature/<issue-number>-short-description
fix/<issue-number>-short-description
docs/<issue-number>-short-description
chore/<issue-number>-short-description
```

1. Comment on the issue with the planned scope if the work affects another collaborator.

## During Work

Agents must keep their work discoverable:

- Link commits and PRs to the relevant issue.
- Prefer more small checkpoint commits over fewer large commits. Each checkpoint should capture
  meaningful progress that another collaborator can inspect or continue from.
- Mention changed boundaries such as `apps/`, `packages/`, `services/`, `infra/`, or `.github/`.
- Record blockers as issue comments instead of leaving them only in chat.
- Create a new issue when discovering work that should not be bundled into the current branch.

## Handoff Format

Use this format in issue comments or PR descriptions when handing work to another collaborator:

```markdown
## Handoff

Current objective:

Changed files:

Relevant architecture/docs:

Verification:

Open decisions:

Suggested next step:
```

## When To Create Issues

Create an issue when:

- Work needs another teammate's decision.
- A blocker affects another branch or milestone.
- You find a bug outside your current scope.
- You identify a future task that should not be implemented immediately.
- A product boundary or shared interface needs discussion before coding.

Use labels consistently:

- `needs:decision` for maintainer or team decisions.
- `blocked` for work that cannot proceed.
- `area:ci`, `area:docs`, `area:security`, or `area:dependencies` for affected areas.
- `agent:handoff` when another person or agent should continue from your notes.

## Architecture Discipline

Agents must not route around the repository structure.

- Product apps belong under `apps/`.
- Shared code belongs under `packages/`.
- Backend services belong under `services/`.
- Deployment and infrastructure code belongs under `infra/`.
- Architecture decisions belong under `docs/adr/`.
- Repository automation belongs under `.github/` and `scripts/`.

If a change does not fit those boundaries, stop and open a `needs:decision` issue before inventing a
new structure.

## Before Handoff Or PR

Run:

```bash
npm run verify
```

Then update the issue or PR with:

- What changed.
- What checks passed.
- What still needs review.
- What another collaborator should read first.
