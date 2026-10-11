# 0006. Version control conventions

- **Status:** Accepted
- **Date:** 2026-10-08
- **Approved by:** Project owner
- **Plan reference:** D22 · **Implemented in:** T1

## Context

The work is reviewed task by task and may be submitted as a public repository. Development happens on Windows, while the app runs in Linux containers.

## Decision

- Git repository with default branch `main`.
- `.gitattributes` sets `* text=auto eol=lf` before the first commit, so Prettier and Docker never see CRLF line endings.
- One commit per task, made after the owner approves that task.
- Commit messages are plain descriptive text, with no ticket prefixes and no AI attribution or co-author lines.
- Nothing is pushed directly to a default or protected branch. Publishing to a remote is done by the owner, through a branch and pull request where applicable.
- `.gitignore` excludes `node_modules/`, `dist/`, `.test-build/`, `coverage/` and every `.env*` file except `.env.example`.

## Alternatives considered

- **Zip-only submission** — no history for the reviewer to follow.
- **A single commit at the end** — hides how the solution was built.

## Consequences

- The history mirrors the task plan, and each commit is self-contained and green.
- Secrets cannot be committed by accident through `.env`.
