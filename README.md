# Book Management API

A REST API for managing books in libraries, with JWT authentication and a ranked recommendation feed that stays fast at millions of books.

**Stack:** Node.js 22 · Express 5 · TypeScript 7 · MongoDB 8 with Mongoose 9 · Mocha + Sinon · Docker

## Quick start (Docker)

Requires Docker with Compose v2.

1. Copy the example environment file:

   ```bash
   cp .env.example .env
   ```

2. Set `JWT_SECRET` in `.env` to a random string of at least 32 characters. To generate one:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. Build and start the stack:

   ```bash
   docker compose up --build
   ```

The API listens on `http://localhost:3000` and inserts demo data on first start. `curl localhost:3000/health` returns `{"status":"ok"}` once MongoDB is reachable.

`docker compose down` stops the stack and keeps the data. `docker compose down -v` also wipes the MongoDB volume.

## Local development

Requires Node.js 22.12+ and Docker (for MongoDB).

```bash
npm ci
cp .env.example .env        # then set JWT_SECRET
docker compose up -d mongo
npm run dev                 # tsx watch mode with pretty-printed logs
```

## Configuration

| Variable           | Required | Default | Purpose                                                                                                 |
| ------------------ | -------- | ------- | ------------------------------------------------------------------------------------------------------- |
| `MONGO_URI`        | yes      | —       | `mongodb://` or `mongodb+srv://` connection string                                                      |
| `JWT_SECRET`       | yes      | —       | HS256 signing secret, at least 32 characters                                                            |
| `JWT_TTL_SECONDS`  | no       | `3600`  | Token lifetime                                                                                          |
| `PORT`             | no       | `3000`  | HTTP port                                                                                               |
| `LOG_LEVEL`        | no       | `info`  | `fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent`                                            |
| `SEED_ON_STARTUP`  | no       | `false` | Insert any missing demo data once per database, then record a `seed_runs` marker so it never runs again |
| `TRUST_PROXY_HOPS` | no       | `0`     | Number of reverse proxies in front of the API, so client IPs (and the login rate limit) are correct     |

- Invalid configuration stops startup with exit code 1, naming each bad variable but never its value.
- Under Docker, `docker-compose.yml` sets `MONGO_URI`, `PORT`, `NODE_ENV=production` and `SEED_ON_STARTUP` itself, and the secrets come from `.env`.
- The seed records a `seed_runs` marker after it runs, so later restarts never re-insert demo books that were deleted through the API.

## Demo data

Every demo user's password is `password123`.

| User    | Country | Libraries          | Role    |
| ------- | ------- | ------------------ | ------- |
| `admin` | US      | Central, Riverside | `admin` |
| `alice` | GB      | Riverside, Harbor  | `user`  |
| `bob`   | DE      | Harbor             | `user`  |

| Library                   | ID                         |
| ------------------------- | -------------------------- |
| Central Library, New York | `64a000000000000000000001` |
| Riverside Library, London | `64a000000000000000000002` |
| Harbor Library, Hamburg   | `64a000000000000000000003` |

There are 18 books spread across the three libraries, with IDs `64c000000000000000000001` to `…018`. To add random books for load testing:

```bash
docker compose exec app node dist/scripts/bulk-books.js --count 1000000
```

## API

`/health` and `/login` are public. Every other endpoint requires `Authorization: Bearer <token>`.

| Method | Path         | Description                                                                                                  |
| ------ | ------------ | ------------------------------------------------------------------------------------------------------------ |
| GET    | `/health`    | Liveness and MongoDB readiness (503 while the database is down)                                              |
| POST   | `/login`     | `{ username, password }` returns `{ token, tokenType, expiresIn }`. Limited to 10 attempts per minute per IP |
| POST   | `/books`     | Create a book in one of your libraries. Returns 201 with a `Location` header                                 |
| GET    | `/books`     | Books in your libraries, newest first. Accepts `?libraryId=&limit=&cursor=`                                  |
| GET    | `/books/:id` | One book                                                                                                     |
| PUT    | `/books/:id` | Replace a book; send every field                                                                             |
| DELETE | `/books/:id` | Delete a book. Returns 204                                                                                   |
| GET    | `/feed`      | Ranked recommendations. Accepts `?limit=&cursor=`                                                            |

### Examples

The examples use bash. On Windows, use Git Bash, or `curl.exe` in PowerShell.

```bash
TOKEN=$(curl -s -X POST localhost:3000/login -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"password123"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
AUTH="Authorization: Bearer $TOKEN"

curl -s -X POST localhost:3000/books -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "title": "Walden", "author": "Henry David Thoreau", "authorCountry": "US",
  "publishedDate": "1854-08-09", "pages": 352, "libraryId": "64a000000000000000000001" }'

curl -si "localhost:3000/books?limit=5" -H "$AUTH"           # next page is in the Link header
curl -s localhost:3000/books/64c000000000000000000001 -H "$AUTH"
curl -s -X PUT localhost:3000/books/64c000000000000000000001 -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"title":"Moby-Dick","author":"Herman Melville","authorCountry":"US","publishedDate":"1851-10-18","pages":640,"libraryId":"64a000000000000000000001"}'
curl -s -X DELETE localhost:3000/books/64c000000000000000000001 -H "$AUTH" -o /dev/null -w '%{http_code}\n'
curl -si "localhost:3000/feed?limit=10" -H "$AUTH"
```

### Validation

| Field             | Rule                                                 |
| ----------------- | ---------------------------------------------------- |
| `title`, `author` | Trimmed, 1–200 characters                            |
| `pages`           | Integer, 1–100,000                                   |
| `publishedDate`   | `YYYY-MM-DD`, not in the future                      |
| `authorCountry`   | Optional two-letter country code (`us` becomes `US`) |
| `libraryId`       | 24-character hex id                                  |

Unknown fields are rejected.

### Pagination

List endpoints return a plain JSON array (`[]` when nothing matches). When more results exist, the response carries a header such as `Link: <?limit=10&cursor=…>; rel="next"`. It is a relative reference: resolve it against the URL you requested (`/feed` becomes `/feed?limit=10&cursor=…`), which also works behind a path-prefixing proxy. The cursor is opaque, and paging costs the same at any depth.

### Errors

Errors use [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) `application/problem+json`:

```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "Validation failed",
  "instance": "/books",
  "requestId": "0f3c…",
  "errors": [{ "path": "pages", "message": "Too small: expected number to be >=1" }]
}
```

| Status | Meaning                                                                              |
| ------ | ------------------------------------------------------------------------------------ |
| 400    | Invalid body or query, malformed id, or tampered cursor                              |
| 401    | Missing, invalid or expired token, or wrong credentials (`WWW-Authenticate: Bearer`) |
| 403    | The request names a library you are not a member of                                  |
| 404    | Not found, including books in libraries you are not a member of                      |
| 429    | Too many login attempts                                                              |

Each response echoes its `X-Request-Id`, which matches the `requestId` in error bodies and in the server log.

## How the feed works

1. Only books from the user's libraries are considered.
2. Books whose `authorCountry` matches the user's country come first, then all others.
3. Within each group, books are ordered by score:
   - 80% pages, capped at 2000.
   - 20% age, where 500 years counts as 1, so both parts span roughly 0 to 1 and pages really carry four times the weight.
   - One year of age is worth one page.
4. Each book stores its score when it is written. Age is measured from a fixed point, not from "now", so the order never changes over time and can be indexed.
5. Each group is read with its own index already in score order, with no sorting at request time, and pages continue from a cursor.

Measured with 1,000,000 books ([ADR 0015](docs/adr/0015-integration-tests-and-scale-proof.md)):

| Measurement                                        | Result |
| -------------------------------------------------- | ------ |
| `/feed` median latency, 18 books                   | 5.1 ms |
| `/feed` median latency, 1M books, page 1           | 4.4 ms |
| `/feed` median latency, 1M books, page 50          | 4.8 ms |
| Rejected approach (score and sort on each request) | 710 ms |

At 1M books, each feed query examines about 22–27 index keys.

## Assumptions and deviations from the assignment

- **Author country:** the spec's Book has no author country, so `authorCountry` was added. Without it the "same country" rule can't be applied ([ADR 0009](docs/adr/0009-author-country-on-book.md)).
- **Users:** stored in MongoDB through the User schema, seeded with scrypt-hashed passwords, rather than hardcoded ([ADR 0011](docs/adr/0011-authentication.md)).
- **Library reference:** the API uses `libraryId` for a book's library.
- **Updates:** `PUT` replaces the whole book; there is no `PATCH`. The stored score depends on pages and date together ([ADR 0012](docs/adr/0012-books-api-contract.md)).
- **Lists:** plain arrays, with paging in the `Link` header, so an empty feed is literally `[]`.
- **Access:**
  - A book in someone else's library returns 404, so IDs can't be probed.
  - Naming a library you don't belong to returns 403.
  - The `admin` role grants nothing extra, because the assignment defines no admin powers.
- **Scoring:** books longer than 2000 pages get no extra credit for length, so a single outlier can't dominate the feed.

## Testing

```bash
npm run check      # Oxlint (type-aware), Prettier check, unit tests
npm run test:int   # integration tests on a real MongoDB 8.0.32 (downloads mongod on first run)
npm run coverage   # unit + integration under c8 (thresholds: 85% lines, 80% branches, 85% functions)
```

- **Unit tests:** Mocha, Sinon and supertest exercise the real HTTP pipeline and services, with repositories stubbed. They cover:
  - Login, tokens and rate limiting.
  - Books CRUD, including the 400, 403 and 404 rules, case-insensitive ids and the publication-date boundary.
  - Feed ordering and paging.
  - Error mapping and configuration.
- **Integration tests:** run on `mongodb-memory-server`, or against any server via `MONGO_TEST_URI=mongodb://…`. They cover:
  - Library scoping and keyset paging.
  - Feed order compared with a brute-force sort, including ties.
  - Query plans without an in-memory sort.
  - Seeding only once, so deleted demo books stay deleted.
- **Coverage:** `npm run coverage` enforces the thresholds above and prints the current figures.

## Project structure

```
src/
  server.ts            entry point: wiring only
  app.ts               Express middleware pipeline and routers
  config/              environment loading and validation
  infrastructure/      logger, MongoDB connection, HTTP server, process lifecycle
  middleware/          request logging, auth, rate limit, not-found, error handler
  errors/              AppError hierarchy
  http/                cursor encoding and Link header
  validation/          zod request parsing and shared schemas
  modules/             auth, users, libraries, books, feed, health; each service depends on a store
                       interface in *.types.ts, which its Mongoose repository implements
  seed/                demo data and the run-once seeder
  scripts/             operational scripts: bulk loader, rank-score recompute, shared runner
  utils/               small generic helpers
test/                  unit tests, helpers and integration/
docs/adr/              architecture decision records
```

## Scripts

| Script                                  | Purpose                                                            |
| --------------------------------------- | ------------------------------------------------------------------ |
| `npm run dev`                           | Run with reload and pretty logs                                    |
| `npm run build` / `npm start`           | Compile to `dist/` / run the compiled server                       |
| `npm run check`                         | Lint, format check and unit tests                                  |
| `npm test` / `test:int` / `coverage`    | Unit, integration, or both with coverage                           |
| `npm run lint` / `format` / `typecheck` | Individual quality tools                                           |
| `npm run seed:bulk -- --count N`        | Insert N random books (`MONGO_URI` from the environment or `.env`) |
| `npm run rank:recompute`                | Recompute every stored score after the scoring constants change    |

## Architecture decisions

Every significant decision is recorded in [`docs/adr`](docs/adr). The task plan is in [`docs/PLAN.md`](docs/PLAN.md).

| ADR                                                          | Decision                                       |
| ------------------------------------------------------------ | ---------------------------------------------- |
| [0001](docs/adr/0001-record-architecture-decisions.md)       | Record architecture decisions                  |
| [0002](docs/adr/0002-typescript-7-with-commonjs-output.md)   | TypeScript 7 with CommonJS output              |
| [0003](docs/adr/0003-express-5-modular-architecture.md)      | Express 5, feature modules, manual composition |
| [0004](docs/adr/0004-oxlint-and-prettier.md)                 | Oxlint with type-aware rules, and Prettier     |
| [0005](docs/adr/0005-test-toolchain.md)                      | Mocha + Sinon on compiled output, c8 coverage  |
| [0006](docs/adr/0006-version-control.md)                     | Version control conventions                    |
| [0007](docs/adr/0007-configuration-errors-and-logging.md)    | Configuration, error responses and logging     |
| [0008](docs/adr/0008-source-layout-and-process-lifecycle.md) | Source layout and process lifecycle            |
| [0009](docs/adr/0009-author-country-on-book.md)              | Author country on the book                     |
| [0010](docs/adr/0010-stored-feed-ranking-score.md)           | Stored, time-invariant ranking score           |
| [0011](docs/adr/0011-authentication.md)                      | Authentication: seeded users, scrypt, JWT      |
| [0012](docs/adr/0012-books-api-contract.md)                  | Books API contract                             |
| [0013](docs/adr/0013-feed-query.md)                          | Feed query: two index-ordered phases           |
| [0014](docs/adr/0014-containerization.md)                    | Containerization                               |
| [0015](docs/adr/0015-integration-tests-and-scale-proof.md)   | Integration tests and scale proof              |
| [0016](docs/adr/0016-code-review-corrections.md)             | Code review corrections                        |
| [0017](docs/adr/0017-second-review-corrections.md)           | Second review corrections                      |
