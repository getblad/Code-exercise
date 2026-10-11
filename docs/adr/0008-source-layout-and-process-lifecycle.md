# 0008. Source layout and process lifecycle

- **Status:** Accepted
- **Date:** 2026-10-11
- **Approved by:** Project owner
- **Plan reference:** owner review of T2 · **Implemented in:** T2

## Context

The first T2 draft put env-file loading, process error handlers, listen handling and shutdown logic into `server.ts`. The owner asked for clear separation of concerns.

## Decision

**Layout:** each folder owns one concern.

| Path                     | Responsibility                                                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `src/server.ts`          | Entry point and composition root. It only wires: env → logger → lifecycle → Mongo → app → listen.                    |
| `src/app.ts`             | Express middleware pipeline and routers.                                                                             |
| `src/config/`            | Loading `.env` and validating configuration.                                                                         |
| `src/infrastructure/`    | Runtime adapters: `logger`, `mongo` (connect/ping/disconnect), `http-server` (start/close as promises), `lifecycle`. |
| `src/middleware/`        | Cross-cutting HTTP: `request-logger`, `not-found`, `error-handler`, and from T4 `require-auth`.                      |
| `src/errors/`            | The `AppError` hierarchy, which has no HTTP or framework dependencies.                                               |
| `src/modules/<feature>/` | Feature code: routers, services, repositories, schemas, models.                                                      |

**Process lifecycle** (`infrastructure/lifecycle.ts`):

- Components register shutdown hooks as they start, and the hooks run in reverse order: the HTTP server closes before MongoDB disconnects. A failing hook is logged, and the remaining hooks still run.
- `SIGINT` and `SIGTERM` trigger shutdown with exit code 0.
- `unhandledRejection` and `uncaughtException` are logged as `fatal` and trigger shutdown with exit code 1.
- A startup failure after any resource has opened (for example, port in use after MongoDB connected) also runs the hooks, so nothing is left open.
- Shutdown is idempotent. A 10 s watchdog forces exit if a hook hangs.

**Error middleware** (`middleware/error-handler.ts`) is the single place that turns errors into responses:

| Error                                                 | Response                                                          |
| ----------------------------------------------------- | ----------------------------------------------------------------- |
| `AppError`                                            | Its own status                                                    |
| Mongoose `ValidationError`                            | 400 with field errors                                             |
| Mongoose `CastError`                                  | 400, field name only, never the value                             |
| MongoDB duplicate key (11000)                         | 409                                                               |
| Body-parser client errors (malformed JSON, too large) | 4xx                                                               |
| Anything else                                         | 500 with no detail; the stack is logged on the request's log line |

## Alternatives considered

- **Everything in `server.ts`** — fast to write, but mixes configuration, transport and process concerns and hides the startup order.
- **A lifecycle library (e.g. `@godaddy/terminus`, `http-terminator`)** — one more dependency for about 50 lines of behaviour.
- **Per-route try/catch** — duplicates mapping logic and makes it easy to leak internals.

## Consequences

- `server.ts` reads as the startup sequence and nothing else.
- Resources are released in the correct order on every exit path. Verified in a Linux container: SIGTERM exits 0 within 5 ms, and a port conflict closes MongoDB and exits 1.
- `infrastructure/` is excluded from unit-test coverage; it is verified by running the process, as stated in [0005](0005-test-toolchain.md).
