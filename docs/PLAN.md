# Book Management API — Project Plan

Created 2026-10-07. Tasks run one at a time, on the owner's command. Every decision below is **Proposed** until the owner approves it. Once approved, it is recorded as an ADR in `docs/adr/` in the same task that implements it.

| Batch | Status                                                                                                  |
| ----- | ------------------------------------------------------------------------------------------------------- |
| 1     | Approved 2026-10-08. D2, D7 and D8 revised 2026-10-11 (TypeScript 7, Oxlint, tests on compiled output). |
| 2     | Approved 2026-10-11.                                                                                    |
| 3     | Approved 2026-10-11.                                                                                    |

All tasks T1–T9 are complete as of 2026-10-11. The README was verified on a fresh clone: `npm ci`, `npm run check`, `npm run test:int` and the Docker quick start with every curl example.

A post-delivery code review found 15 issues; all were fixed on 2026-10-11 (ADR 0016). A second review found 9 maintenance issues; all were fixed the same day (ADR 0017). A third review found 7 issues; all were fixed the same day (ADR 0018). A fourth review found 5 low-severity issues, fixed the same day (ADR 0019). A fifth review found a placeholder-secret risk and a hash-parsing edge case, both fixed (ADR 0020).

## Scope (from the assignment)

- REST CRUD for Books (Express + TypeScript + Mongoose). Users and Libraries are seeded only.
- Users can only create or view books in libraries they are members of.
- `GET /feed`: books from the user's libraries. Same-country authors come first, then the rest are ranked by score (80% pages, 20% age). Returns `[]` when no books match. Must scale to millions of books.
- JWT auth on `/books` and `/feed`. `POST /login` returns 401 on bad credentials. The secret is read from `.env`.
- Dockerfile and docker-compose (app + MongoDB). The Mongo connection comes from env vars.
- Mocha + Sinon tests for at least one CRUD endpoint and `/feed`, with at least one negative case.
- README with run instructions.

## Folder structure

```
docs/adr/                 0000-template.md, NNNN-kebab-title.md
src/
  server.ts               entry point: wiring only (env → logger → lifecycle → mongo → app → listen)
  app.ts                  createApp(deps): middleware pipeline and routers
  config/env.ts           .env loading + zod-validated, typed config
  infrastructure/         logger, mongo connection, http server start/stop, process lifecycle
  middleware/             request-logger, not-found, error-handler (+ require-auth in T4)
  errors/                 app-error.ts (AppError hierarchy)
  validation/             zod helpers: parseInput (→ 400 problem), shared schemas
  types/                  Express Request augmentation (req.principal)
  http/                   pagination: cursor codec + Link header
  modules/
    auth/                 auth.router, auth.service, auth.schemas, token.service, password-hasher, require-auth
    users/                user.model, user.repository
    libraries/            library.model
    books/                book.model, book.repository, book.service, book.router, book.schemas, book.mapper, rank-score
    feed/                 feed.repository, feed.service, feed.router, feed.schemas
    health/               health.router
  seed/                   seed-data.ts, seed.ts (run-once demo seeder)
  scripts/                bulk-books.ts, recompute-rank-scores.ts, run-script.ts
  utils/                  small generic helpers
test/
  helpers/test-app.ts
  app.test.ts
  auth.test.ts
  books.test.ts
  feed.test.ts
  integration/mongo.test.ts
```

## Decision register

### Batch 1: Foundation (needed before T1)

| ID  | Decision                     | Recommendation                                                                                                                                                                              | Alternatives                                                 | Why                                                                                                                       |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| D1  | ADR location and format      | `docs/adr/NNNN-title.md`, MADR-lite (Status, Date, Context, Decision, Alternatives, Consequences, Approved by)                                                                              | root `adr/`; Nygard minimal                                  | adr-tools convention; each ADR lands in the same commit as the code it explains                                           |
| D2  | Module system and TypeScript | TypeScript 7, strict + `noUncheckedIndexedAccess`, CommonJS output, `tsc` build, `tsx` for dev only                                                                                         | TS 6.0; ESM (`.js` import suffixes); Node type stripping     | Current TS line; least friction across Mocha, c8 and Sinon                                                                |
| D3  | HTTP layer and architecture  | Express 5; feature modules; manual composition root `createApp(deps)`; constructor injection; auth on by default, with only `/login` and `/health` public; thin handlers that call services | Express 4 + async wrapper; DI container (tsyringe/inversify) | Express 5 forwards async errors on its own; testable without a container; HTTP concerns stay separate from business logic |
| D4  | Validation and config        | zod v4 for body, query, params, env, JWT payload and cursor; `process.loadEnvFile` (no dotenv); fail fast at startup                                                                        | joi; express-validator; class-validator                      | One schema gives both validation and the TS type, with no casts                                                           |
| D5  | Error format                 | RFC 9457 `application/problem+json` `{type,title,status,detail,instance,requestId,errors?}`; 5xx details hidden                                                                             | Custom `{error:{code,message}}`                              | A standard format that clients and tools already understand                                                               |
| D6  | Logging                      | pino + pino-http; request id from `X-Request-Id` or a new UUID; redact auth headers and passwords; log IDs only; 4xx → warn, 5xx → error + stack                                            | winston; morgan                                              | Fastest structured logger; built-in redaction; no personal data in logs                                                   |
| D7  | Lint and format              | Oxlint type-aware (`oxlint-tsgolint`), rules mirroring typescript-eslint strict + stylistic type-checked; no `any`, no type assertions, no console; Prettier; warnings fail                 | ESLint + typescript-eslint (no TS 7 support); Biome          | Enforces the no-`any` / no-cast rules with tooling on TS 7                                                                |
| D8  | Test toolchain               | mocha + sinon + supertest + `node:assert/strict`, run on `tsc` output (`importHelpers` + tslib); stub repositories (never Mongoose models); c8 thresholds 85/80/85                          | tsx-loaded tests (phantom branches in coverage); chai@4; nyc | Exact coverage; tests run the same compiler output as the build                                                           |
| D9  | Local MongoDB                | `mongo:8.0`, no auth on the private compose network, port bound to 127.0.0.1, named volume                                                                                                  | Root credentials via `.env`                                  | Simplest setup; the connection still comes from `MONGO_URI`                                                               |
| D22 | Version control              | `git init` in T1; one commit per task after you approve it; plain messages, no AI co-author lines; never push to the default branch                                                         | No git (zip submission); commit only at the end              | Readable history for the reviewer                                                                                         |

### Batch 2: Data model and API contract (needed before T3)

| ID  | Decision                      | Recommendation                                                                                                                                                                                                          | Alternatives                                                                       | Why                                                                                                           |
| --- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| D10 | Author country (not in spec)  | Optional `authorCountry` on Book (ISO 3166-1 alpha-2, `null` if absent; a missing country counts as non-matching)                                                                                                       | Author collection; required field                                                  | Smallest addition that makes the "same country" rule possible                                                 |
| D11 | Users and authentication      | Users seeded into Mongo with a bcryptjs hash (`select:false`); JWT HS256 `{sub, role}`, 1h; user loaded per request; unknown user gets the same 401 as a wrong password (dummy compare); rate limit on `/login`         | Hardcoded in-memory users; libraries + country inside the JWT (stale until expiry) | Uses the User entity for real; membership changes apply immediately                                           |
| D12 | Authorization rules           | Membership required for every book operation; GET/PUT/DELETE by id outside the user's libraries → 404 (existence not revealed); create, list or move into a non-member library → 403; `admin` role grants nothing extra | 403 for out-of-scope ids; admin bypasses membership                                | The spec gives admin no powers                                                                                |
| D13 | Update method                 | `PUT /books/:id`, full replacement                                                                                                                                                                                      | PATCH (read-modify-write); both                                                    | `rankScore` needs pages and date together, so a single atomic update                                          |
| D14 | Pagination and response shape | Keyset cursor (opaque base64url); `limit` default 20, max 100; body is a plain JSON array; next page in a `Link: rel="next"` header                                                                                     | `{items, nextCursor}` envelope; offset pagination                                  | Matches "return an empty array"; cost doesn't grow with page depth                                            |
| D15 | Validation rules              | title/author trimmed, 1–200 chars; pages integer 1–100000; publishedDate `YYYY-MM-DD`, not in the future; ids 24-hex; unknown fields → 400; malformed id → 400                                                          | Strip unknown fields; malformed id → 404                                           | Typos surface instead of being ignored; prevents CastError 500s                                               |
| D16 | Seeding                       | Idempotent seed on startup (fixed ObjectIds, upserts), toggled by `SEED_ON_STARTUP`; separate `bulk-books` CLI (1M books) for the performance demo                                                                      | One-shot compose seed service; manual only                                         | `docker compose up` alone gives a working demo                                                                |
| D17 | Feed score                    | Stored, time-invariant `rankScore = 0.8·min(p,2000)/2000 + 0.2·(ANCHOR − publishedDate)/100y`, computed by a pure function (no Mongoose hooks)                                                                          | Per-request min-max normalization; aggregation `$sort` + `allowDiskUse`            | Ranking order never depends on "now", so it can be indexed and the cost doesn't grow with the number of books |
| D18 | Feed query and indexes        | Two-phase keyset query: same-country first, then the rest; two named indexes, used via `.hint()`; fetch limit+1; a short phase 1 is filled from phase 2                                                                 | Single aggregation with `$addFields` + `$sort`                                     | Non-blocking, merged index scans; proven with explain in T8                                                   |

### Batch 3: Verification and delivery (needed before T7)

| ID  | Decision            | Recommendation                                                                                                                                   | Alternatives                                             | Why                                                        |
| --- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- | ---------------------------------------------------------- |
| D19 | DB integration test | One file using mongodb-memory-server (same Mongo version), `MONGO_TEST_URI` override                                                             | Sinon only; testcontainers                               | Actually runs the feed query, which is the core complexity |
| D20 | Container           | Multi-stage `node:22-alpine`, runtime `npm ci --omit=dev`, `USER node`, exec-form CMD, `init: true`, healthchecks, `depends_on: service_healthy` | Distroless; single stage                                 | Small image that doesn't run as root                       |
| D21 | API docs            | README with curl examples; OpenAPI as a stretch goal                                                                                             | Hand-written `openapi.yaml`; zod-to-openapi + swagger-ui | Speed first                                                |

## Tasks

Each task ends green on `npm run check` (lint + format check + compile + tests). The ADRs for the decisions it implements are written as Accepted, and it gets one commit once approved.

| Task | Goal                                                                                                                                         | Decisions recorded                      |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| T1   | Scaffold: git, tsconfig, oxlint/prettier, mocha/c8, ADR template, `/health` liveness + one test                                              | D1, D2, D3, D7, D8, D22 → ADR 0001–0006 |
| T2   | Platform core: env config, pino logging, problem-details errors, Mongo connect, health readiness, graceful shutdown, compose with Mongo only | D4, D5, D6 → ADR 0007; layout → 0008    |
| T3   | Data model: Library/User/Book schemas, `computeRankScore`, indexes, idempotent seed                                                          | D10 → 0009, D17 → 0010 (D16 routine)    |
| T4   | Auth: `POST /login`, `requireAuth`, typed principal, login rate limit                                                                        | D11 → 0011                              |
| T5   | Books CRUD: POST/GET list/GET one/PUT/DELETE with membership rules and cursor pagination                                                     | D12–D15 → 0012                          |
| T6   | Feed: two-phase keyset query, cursor, Link header                                                                                            | D18 → 0013                              |
| T7   | Docker: multi-stage Dockerfile, full compose with healthchecks                                                                               | D9, D20 → 0014                          |
| T8   | Integration test + scale proof: mongodb-memory-server test, explain with no SORT stage, 1M bulk seed                                         | D19 → 0015                              |
| T9   | README, ADR index, final privacy and quality pass                                                                                            | D21 (routine: README with curl)         |

### Verification per task

- **T1:** `npm ci && npm run check && npm run build && npm run coverage` all green; the c8 report maps to `src/*.ts` with no phantom branches; `npm start` + `curl -i localhost:3000/health` → 200; a temporary `const x: any` fails lint.
- **T2:**
  - `/health` → 200 with Mongo up, 503 with Mongo stopped.
  - Unknown route → 404 problem+json, and its `requestId` matches the `X-Request-Id` header.
  - Malformed JSON → 400.
  - Missing `JWT_SECRET` → exits 1 and names the variable without printing its value.
  - Ctrl+C logs a clean shutdown.
- **T3:**
  - `rank-score` unit tests pass, including "shifting now keeps the order".
  - Seed logs counts and IDs only.
  - `feed_country_rank` and `feed_rank` indexes exist.
  - A restart doesn't duplicate data.
- **T4:**
  - Login returns a token.
  - Wrong password and unknown user both → 401 with `WWW-Authenticate`.
  - No, malformed or expired token → 401.
  - 11th rapid login → 429.
- **T5:**
  - Create → 201 + `Location`.
  - Invalid body → 400 with `errors[]`.
  - Non-member library → 403; a foreign book id → 404.
  - List returns an array + `Link`; PUT → 200; DELETE → 204, then GET → 404.
- **T6:**
  - Same-country books come first, ordered by score.
  - Following the `Link` header has no duplicates or gaps across the phase switch.
  - `?cursor=garbage` → 400; no books → `[]`.
- **T7:**
  - `docker compose up --build`: both services healthy, curls work.
  - Container runs as `node`; image is about 250 MB or less.
  - Data persists across `down`/`up` without duplicate seeding.
- **T8:**
  - `npm run test:int` passes.
  - Explain shows SORT_MERGE and no SORT, with keys examined ≈ limit + number of libraries.
  - After bulk-loading 1M books, `/feed` responds in ~50 ms or less.
- **T9:** a fresh clone, following the README word for word, works; coverage meets the thresholds; every ADR has a status; no co-author lines in the git log.

## Known limits and gotchas (go into the relevant ADRs)

- **Feed:**
  - More than 200 libraries per user exceeds Mongo's `internalQueryMaxScansToExplode`, and the query falls back to an in-memory sort.
  - Phase 2 examines many keys when a user's libraries are dominated by their own country.
  - Changing the score constants requires recomputing every `rankScore`.
- **Express 5:**
  - `req.query` is read-only.
  - Wildcards must be named.
  - JSON parse errors arrive as `entity.parse.failed`.
- **Mongoose:**
  - Validate ids with a 24-hex regex (`ObjectId.isValid` accepts any 12-char string).
  - Await `Model.init()` before listening.
  - Avoid `syncIndexes`.
- **Sinon:**
  - Stub repositories, not chainable Mongoose queries.
  - Fake only `Date`, so supertest doesn't hang.
- **Windows:** `.gitattributes` (`eol=lf`) goes in before the first commit; npm scripts must be cross-shell; use `curl.exe` in PowerShell.
- **mongodb-memory-server:** the first run downloads mongod (hundreds of MB); it can't run inside the alpine image.
