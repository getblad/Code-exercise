# 0015. Database integration tests and scale proof

- **Status:** Accepted, amended by [0017](0017-second-review-corrections.md)
- **Date:** 2026-10-11
- **Approved by:** Project owner
- **Plan reference:** D19 · **Implemented in:** T8

## Context

Unit tests replace repositories with Sinon stubs ([0005](0005-test-toolchain.md)), so the MongoDB queries were checked only by hand. That includes the feed's index-ordered queries, the core of the design. The claim that the feed stays fast at millions of books also needed evidence.

## Decision

**Integration suite: one file, `test/integration/mongo.test.ts`**

- **Database:** a real `mongod` 8.0.32, the same version as compose, started in-process by `mongodb-memory-server-core`. The `-core` package downloads the binary on first use rather than at `npm ci`, so Docker builds stay fast. Setting `MONGO_TEST_URI` runs the suite against an existing server instead. Each run uses a throwaway `books_test_<timestamp>` database and drops it afterwards.
- **Coverage, 5 tests:**
  1. Book reads, updates and deletes are scoped to the given libraries.
  2. `/books` lists newest-first and continues after a cursor.
  3. The feed, paged 7 at a time over 70 books, matches a brute-force in-memory sort exactly. The data includes three libraries (one foreign), `null` countries, and a run of 10 tied scores that crosses page boundaries.
  4. Over 2,000 books, both feed phases (first page and mid-collection cursor) have no `SORT` stage in the winning plan. Each examines at most `limit + 1` documents and fewer than `3 × limit` index keys. The `+1` is the book at the cursor position, fetched and then dropped by the tie-break filter.
  5. User credential and profile lookups.

**Scripts**

| Script             | Runs                                                                 |
| ------------------ | -------------------------------------------------------------------- |
| `npm test`         | Unit tests only: no database, no downloads (part of `npm run check`) |
| `npm run test:int` | Integration suite (`.mocharc.integration.json`, 120 s timeout)       |
| `npm run coverage` | Both suites under c8 with merged results                             |

Repositories are back in the coverage scope, which ends the temporary exclusion noted in [0011](0011-authentication.md).

**Scale proof**

`npm run seed:bulk` (`src/seed/bulk-books.ts`) inserts N random books (default 1M) in unordered batches of 10k through the native driver.

## Results (2026-10-11, Docker Desktop on Windows 11)

- **Load time:** 1,000,000 books in 8.4 s (about 119k inserts/s), with all four book indexes maintained.
- **`/feed?limit=20` latency** (30 requests each, curl from the host):

  | Dataset                                      | Median | p90    |
  | -------------------------------------------- | ------ | ------ |
  | 18 books                                     | 5.1 ms | 6.4 ms |
  | 1,000,018 books, page 1                      | 4.4 ms | 4.9 ms |
  | 1,000,018 books, page 50 (reached by cursor) | 4.8 ms | 5.2 ms |

- **Query plans at 1M** (admin, 666,681 candidate books, `limit` 21):

  | Query                        | SORT stage | Keys examined | Docs examined | Time |
  | ---------------------------- | ---------- | ------------- | ------------- | ---- |
  | Same-country, page 1         | no         | 22            | 21            | 0 ms |
  | Other countries, page 1      | no         | 24            | 21            | 0 ms |
  | Other countries, deep cursor | no         | 27            | 22            | 0 ms |

- **Rejected alternative, measured:** computing and sorting the score per request (`$addFields` + `$sort`, `allowDiskUse`) took 710 ms per request over the same candidates.

Totals: unit and integration suites combined pass 43 tests (38 + 5). Merged coverage: 97.2% lines, 94% branches, 94.6% functions.

## Alternatives considered

- **Integration tests against the compose MongoDB only** — needs Docker running for every test run. Still available through `MONGO_TEST_URI`.
- **testcontainers** — the same Docker dependency, with more setup.
- **No integration tests** — the core query would stay untested, and the scaling claim would rest on manual checks.

## Consequences

- The first integration run downloads the mongod binary (about 770 MB on Windows, less on Linux and macOS) into `~/.cache/mongodb-binaries`. Later runs take under a second.
- A query-plan regression, such as a dropped index or a changed filter shape, now fails a test instead of silently degrading at scale.
- `npm run check` stays fast and offline. Run `test:int` or `coverage` before a release.
