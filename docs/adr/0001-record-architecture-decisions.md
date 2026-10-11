# 0001. Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-10-08, scope narrowed 2026-10-11
- **Approved by:** Project owner
- **Plan reference:** D1 · **Implemented in:** T1

## Context

The project is built in small tasks, and significant technical decisions are approved by the owner before they are implemented. Reviewers need to see why each choice was made, what else was considered, and when it was agreed, without digging through chat history.

## Decision

- Only significant decisions are recorded: architecture, deviations from the assignment, trade-offs with a real cost, and changes to earlier decisions. Routine choices follow the conventions visible in the code.
- Decisions are recorded as lightweight MADR files in `docs/adr/NNNN-kebab-title.md`, numbered sequentially, using [0000-template.md](0000-template.md).
- Each ADR states status, approval date, approver, the plan decision id (`docs/PLAN.md`) and the task that implements it.
- An ADR is written in the task that implements its decision and lands in the same commit as that code.
- Accepted ADRs are not rewritten. A changed decision gets a new ADR that supersedes the old one. A decision revised before its ADR was written is recorded once, with the revision noted in its context.

## Alternatives considered

- **Root-level `adr/` folder** — works, but `docs/adr/` is the common convention (adr-tools) and keeps the root clean.
- **Nygard minimal format** — no alternatives or approval fields, which the owner explicitly wants.
- **Wiki or issue tracker** — lives apart from the code and drifts out of sync.

## Consequences

- Every choice is traceable from code to rationale.
- Small overhead per decision; decisions are batched for approval to keep it low.
