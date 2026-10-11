# 0003. Express 5 with feature modules and a manual composition root

- **Status:** Accepted
- **Date:** 2026-10-08
- **Approved by:** Project owner
- **Plan reference:** D3 · **Implemented in:** T1 (structure), T2+ (modules)

## Context

The API needs JWT auth on almost every route, a clear split between HTTP handling and business logic, and code that Mocha + Sinon can test without a database or a running server.

## Decision

- **Express 5** (5.2): a rejected promise from an async handler reaches the error middleware without wrappers.
- **Feature modules** under `src/modules/<feature>/`: `*.router.ts`, `*.service.ts`, `*.repository.ts`, `*.schemas.ts`, `*.model.ts`.
- **Thin handlers:** a router file holds route definitions and handlers that only parse input, call a service and send the response. Business rules live in services; database access lives in repositories.
- **Manual composition root:** `createApp(deps)` in `src/app.ts` builds the Express app from injected services; `src/server.ts` creates the real dependencies and starts listening. Classes take dependencies through their constructors. No DI container.
- **Auth by default:** the public router (`/login`, `/health`) is mounted before `requireAuth`; every router mounted after it requires a valid JWT.
- **Hardening:** `helmet()` security headers (also removes `X-Powered-By`); `express.json({ limit: '100kb' })`.

## Alternatives considered

- **Express 4 + async wrapper** — an extra dependency, and a forgotten wrapper means a hung request.
- **DI container (tsyringe, inversify)** — needs decorators and `reflect-metadata`, and hides the wiring.
- **Separate controller files** — an extra layer with no behaviour of its own.

## Consequences

- Tests build the app with Sinon-stubbed repositories and call it through supertest.
- A new route is opt-out of auth only by being mounted in the public router, which makes exceptions visible.
- Express 5 changes: wildcards must be named (`/*splat`), `req.query` is a read-only getter (so query parsing happens in handlers), and body-parse errors arrive as `entity.parse.failed`.
