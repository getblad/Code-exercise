# 0022. Close keep-alive connections promptly on shutdown

- **Status:** Accepted
- **Date:** 2026-10-20
- **Approved by:** Project owner
- **Plan reference:** pre-defence review · **Amends:** [0008](0008-source-layout-and-process-lifecycle.md)

## Context

`closeHttpServer` called `server.close()` and then `server.closeIdleConnections()` once. Two problems showed up when it was measured on Node 22:

- Since Node 19, `close()` already closes idle connections itself, so the explicit call did nothing.
- A connection that was busy when shutdown began stayed open after its response finished, until Node's keep-alive timeout expired: 5000 ms plus a 1000 ms buffer by default. Shutdown therefore took as long as the slowest request in progress plus about 6 s. With a 3 s request in progress, the server closed after 9 s, close to the 10 s watchdog in [0008](0008-source-layout-and-process-lifecycle.md) that forces exit code 1.

## Decision

- `startHttpServer` adds a listener to every request: when its response finishes and `close()` has already run (`server.listening` is false), it calls `server.closeIdleConnections()`. Each keep-alive connection closes right after its last response.
- `closeHttpServer` is now only `server.close()`, as a promise.
- Requests in progress are never cut off. `closeIdleConnections()` only closes connections that have no request in progress.

**Measured with the real module**, an Express app, one idle keep-alive connection and requests of 3000, 1500 and 10 ms in progress when shutdown began:

| Code   | All three requests      | Server closed |
| ------ | ----------------------- | ------------- |
| Before | 200, completed normally | 9044 ms       |
| After  | 200, completed normally | 3029 ms       |

In both versions, a new connection after shutdown began was refused (`ECONNREFUSED`).

## Alternatives considered

- **Calling `closeIdleConnections()` every 100 ms until the server closes** — also correct (it closed 15 ms after the last response), but adds a timer and an arbitrary interval.
- **Lowering `keepAliveTimeout` at shutdown** — still waits for Node's 1000 ms keep-alive buffer.
- **`server.closeAllConnections()`** — cuts off requests in progress. Only suitable as a last resort at a deadline.
- **Sending `Connection: close` on responses during shutdown** — needs a list of the responses in progress so headers can be changed before they are sent.

## Consequences

- Shutdown takes as long as the slowest request in progress, no longer plus about 6 s.
- A request that never finishes still keeps the server open; the 10 s watchdog stops the process with exit code 1.
- A client that reuses a keep-alive connection at the moment it is closed can see `ECONNRESET`. This race exists in any keep-alive server. In production a load balancer stops routing to the instance before sending SIGTERM, and HTTP clients retry safe requests.
- Every request gets one small `finish` listener. It does nothing until shutdown begins.
