# 0023. Per-user rate limit on book writes

- **Status:** Accepted
- **Date:** 2026-10-20
- **Approved by:** Project owner
- **Plan reference:** pre-defence review · **Amends:** [0012](0012-books-api-contract.md)

## Context

Only `POST /login` was rate-limited ([0011](0011-authentication.md)). That covers the anonymous attack surface: every other route needs a valid token, and the signature is checked before any database work. Reads are bounded too: at most 100 rows per page, read in index order.

Writes are not bounded. One logged-in user could create books in a loop, and every insert updates four indexes and adds storage.

## Decision

- `POST /books`, `PUT /books/:id` and `DELETE /books/:id` share one limiter: **60 requests per minute per user**, counted together.
- It is keyed by the authenticated user's id, not the IP. Users behind one office IP don't share a budget, and a client can't escape the limit by changing IP.
- The limiter is attached to the three routes in `book.router.ts`. They run after `requireAuth`, so the user is always known.
- Over the limit, the response is a 429 problem+json, "Too many book changes, try again later", with `Retry-After` and the draft-8 `RateLimit` headers, the same as login.
- Both limiters are built by one helper in `src/middleware/rate-limit.ts`; only the limit, the message and the key differ.
- Reads stay unlimited.

## Alternatives considered

- **A per-IP limit on every route** — penalises users who share an IP, and is weak flood protection, because Node has already accepted and parsed the request. Flood protection belongs at the edge (load balancer, API gateway).
- **Separate limits per method** — more configuration for no practical benefit.
- **Limits from environment variables** — the login limit is a constant too. Configuration can be added when a deployment needs different values.

## Consequences

- One account can change at most 60 books a minute. Bulk loading goes through `npm run seed:bulk`, not the API.
- Requests count before validation, so invalid writes use up the budget as well.
- The counters are in memory, per process, like the login limiter's: a restart clears them, and each instance counts separately. A shared store such as Redis fixes both.
