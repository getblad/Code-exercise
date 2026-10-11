# 0007. Configuration, error responses and logging

- **Status:** Accepted
- **Date:** 2026-10-08
- **Approved by:** Project owner
- **Plan reference:** D4, D5, D6 · **Implemented in:** T2

## Context

The service needs configuration that fails fast, one error contract every client can rely on, and logs that support debugging without leaking personal data or secrets.

## Decision

**Configuration**

- A zod v4 schema (`src/config/env.ts`) validates `process.env` at startup and produces a typed `Env`.
- Invalid configuration aborts startup with exit code 1. The message names each bad variable, never its value.
- `.env` is loaded with Node's built-in `process.loadEnvFile` when present (no dotenv). Variables already set in the environment take precedence. `.env.example` documents every variable.
- zod also validates request input, starting in T4.

**Error responses**

- Every error is RFC 9457 `application/problem+json`:
  - `type: "about:blank"`, `title` (HTTP status text), `status`, `detail`
  - `instance` (request URL), `requestId`
  - `errors[]` (field-level validation, when present)
- Code throws `AppError` subclasses carrying a status, and one central `errorHandler` maps them to responses. It also maps Mongoose and MongoDB failures; the full mapping table is in [0008](0008-source-layout-and-process-lifecycle.md).
- Malformed JSON returns 400 and an unknown route returns 404.
- Anything unexpected returns 500 with no detail, so internals never leak.
- `GET /health` pings MongoDB and returns 503 when it is unreachable.

**Logging**

- pino writes JSON to stdout with ISO timestamps. pino-pretty is used only in `npm run dev`.
- pino-http writes one line per request: id, method, URL, status and response time.
- **Request id:** taken from `X-Request-Id` when it matches `[\w.-]{1,128}`, otherwise a new UUID. It is echoed in the response header and in error bodies.
- **Levels:**
  - 5xx: `error`. Unexpected errors attach their stack to that request's log line. Deliberate ones, such as a 503 while the database is down, do not, so health polling doesn't flood the logs.
  - 4xx: `warn`.
  - Anything else: `info`.
  - Successful health checks: silent, because the container healthcheck polls them.
- **Privacy:** headers and bodies are never logged, only IDs. `password` and `token` fields are redacted as a safety net.

**Process lifecycle:** graceful shutdown and fatal-error handling are described in [0008](0008-source-layout-and-process-lifecycle.md).

## Alternatives considered

- **joi, express-validator, class-validator** — need separate type declarations or decorators. One zod schema gives both the validation and the TypeScript type.
- **dotenv** — Node 22 has this built in.
- **Custom error envelope (`{ error: { code, message } }`)** — non-standard; problem+json is understood by clients and tooling.
- **winston, morgan** — slower, and morgan's output is not structured.

## Consequences

- Clients parse a single error shape.
- A `requestId` from a client report leads straight to one log line.
- Details of unexpected errors are visible only in logs, never in responses.
