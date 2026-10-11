# 0013. Feed query: two index-ordered phases with keyset paging

- **Status:** Accepted
- **Date:** 2026-10-11
- **Approved by:** Project owner
- **Plan reference:** D18 · **Implemented in:** T6

## Context

`GET /feed` returns books from the caller's libraries: same-country authors first, then everyone else, each group ordered by the stored `rankScore` ([0010](0010-stored-feed-ranking-score.md)). The dataset may hold millions of books, so no request may sort the candidate set in memory.

## Decision

**Two phases, each read in index order**

| Phase   | Filter                                               | Index (hinted by name)                                                   |
| ------- | ---------------------------------------------------- | ------------------------------------------------------------------------ |
| `same`  | `library ∈ L`, `authorCountry = C`                   | `feed_country_rank` `{ library, authorCountry, rankScore: -1, _id: -1 }` |
| `other` | `library ∈ L`, `authorCountry ≠ C` (includes `null`) | `feed_rank` `{ library, rankScore: -1, _id: -1, authorCountry }`         |

- Both sort by `{ rankScore: -1, _id: -1 }`. Every index field before the sort fields is matched by exact value, so MongoDB runs one index scan per library and merges them already in rank order (`SORT_MERGE`). There is no blocking `SORT`.
- In the `other` phase, the `≠ C` test is checked on the index key itself, so books that fail it are skipped without being fetched.
- A single index can't serve both phases. With only `feed_rank`, the `same` phase would walk every key in the user's libraries whenever their country is rare. With only `feed_country_rank`, the `≠` test would sit before the sort fields and force a SORT. Indexes are hinted so the planner can't switch between them as data changes.

**Paging**

- The service asks the `same` phase for `limit + 1` rows. If they don't fill the page, it asks the `other` phase for the remainder in the same request.
- The cursor is the position of the last returned book, `{ phase, score, id }`, encoded opaquely and returned in a `Link: rel="next"` header ([0012](0012-books-api-contract.md)). A cursor in the `other` phase skips the `same` query entirely.
- A continuation query uses `rankScore ≤ s`, so the index scan starts at the cursor instead of re-reading from the top. A narrow `$or` (`rankScore < s` or `_id < id`) drops ties with the last-seen book.
- The response is a plain array, and an empty result is `[]`. A user with no libraries gets `[]` without any database query.

**Verified on 2026-10-11 against the seeded data:**

- Paging `admin`'s feed 4 at a time returned the same 14 books, in the same order, as a brute-force in-memory sort, including across the phase switch in the middle of page 2. `bob`'s feed matched too.
- The query plan for each phase (first page and with a cursor) is `LIMIT > FETCH > SORT_MERGE > IXSCAN`: no SORT stage, and documents examined equal documents returned.

## Alternatives considered

- **One aggregation** (`$addFields: { sameCountry }` + `$sort`) — simplest to write, but a blocking sort over every candidate on every request.
- **`$facet` or `$unionWith` combining both phases** — still sorts after the union and loses index order.
- **Offset pagination** — the cost of skipping grows with page depth.

## Consequences

- **Constant cost per page.** It is roughly `limit` plus one key per library, regardless of collection size. This gets re-measured with 1M books in T8.
- **Library limit.** MongoDB splits the query into at most 200 per-library scans (`internalQueryMaxScansToExplode`), so a user in more than 200 libraries falls back to an in-memory sort. Acceptable for this domain; revisit if memberships grow.
- **Country-dominated libraries.** The `other` phase checks, but never fetches, same-country keys ranked above the cursor. This only gets costly when a user's libraries are almost entirely books from their own country.
- **Write cost.** Each book carries four indexes (`_id`, `library_recent`, two feed indexes). Writes cost more in exchange for constant-time reads.
