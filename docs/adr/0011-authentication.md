# 0011. Authentication: seeded users, scrypt, short-lived JWT

- **Status:** Accepted, amended by [0017](0017-second-review-corrections.md) and [0019](0019-fourth-review-corrections.md)
- **Date:** 2026-10-11
- **Approved by:** Project owner
- **Plan reference:** D11 · **Implemented in:** T3 (password hashing), T4

## Context

`/books` and `/feed` require a JWT obtained from `POST /login` with predefined users. The feed and the access rules need each user's country and library memberships.

## Decision

**Users and passwords**

- Users live in MongoDB (`User` schema) and are seeded at startup.
- Passwords are hashed with Node's built-in `scrypt` (N=16384, r=8, p=1, 16-byte random salt, 64-byte key), stored as `scrypt$<salt>$<key>`, and compared with `timingSafeEqual`. No extra dependency.
- `passwordHash` has `select: false`; only the login lookup asks for it explicitly.

**Login**

- `POST /login` validates `{ username, password }` (strict: unknown fields are rejected).
- It returns `{ token, tokenType: "Bearer", expiresIn }`.
- A wrong password and an unknown user get the same 401 (`Invalid username or password`). Unknown usernames are still checked against a dummy hash, so response time doesn't reveal which accounts exist.
- The route is rate-limited to 10 attempts per minute per IP (`express-rate-limit`, `RateLimit` headers per draft-8). Over the limit it returns a 429 problem response.

**Token**

- `jsonwebtoken`, HS256 with `JWT_SECRET` from the environment (32+ characters, validated at startup), expiry `JWT_TTL_SECONDS` (default 3600).
- Claims: `sub` (user id) and `role` only. Verification pins `algorithms: ['HS256']`, and the payload is validated with zod.
- Every 401 carries `WWW-Authenticate: Bearer`. Expired tokens say `Token expired`; any other failure says `Invalid token`.

**Request authentication**

- `requireAuth` is mounted after the public routers (`/health`, `/login`), so every later route is protected by default.
- It accepts `Authorization: Bearer <token>` (scheme is case-insensitive) and loads the user's profile by id: role, country and library ids.
- The profile is attached as `req.principal`, typed through a global Express `Request` augmentation. A token for a deleted user is rejected.

**Lint**

- Oxlint's `no-async-endpoint-handlers` is turned off, with owner approval on 2026-10-11. The rule targets Express < 5. Express 5 forwards rejected promises to the error middleware ([0003](0003-express-5-modular-architecture.md)), so the rule only produced false positives.

## Alternatives considered

- **Hardcoded in-memory users** — allowed by the assignment, but the User schema would then not be used for login.
- **Libraries and country inside the JWT** — saves one indexed read per request, but membership changes would not apply until the token expires.
- **bcrypt** — the common choice, but needs a native build or a JS port as a dependency. `scrypt` is built in and memory-hard.
- **`jose`** — modern and dependency-free, but `jsonwebtoken` is the de-facto standard for HS256 in Express apps.
- **Wrapping handlers in an `asyncRoute()` helper to satisfy the lint rule** — redundant on Express 5.

## Consequences

- One indexed `_id` lookup per authenticated request. Access changes take effect immediately.
- The rate limiter's store is in memory, so limits are per process. A multi-instance deployment would need a shared store such as Redis.
- Unit tests use the real `AuthService` and `TokenService` with a Sinon-stubbed `UserRepository`. Repositories are excluded from unit-test coverage and are exercised against a real database by the integration suite (D19, T8).
