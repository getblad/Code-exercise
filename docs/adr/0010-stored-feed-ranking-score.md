# 0010. Stored, time-invariant feed ranking score

- **Status:** Accepted, amended by [0016](0016-code-review-corrections.md) and [0021](0021-publication-date-floor-in-rank-score.md)
- **Date:** 2026-10-11
- **Approved by:** Project owner
- **Plan reference:** D17 · **Implemented in:** T3 (score, indexes), T6 (feed query)

## Context

Within each country group, the feed ranks books by a weighted score: 80% pages (longer is higher) and 20% age (older is higher). The dataset may hold millions of books. Computing and sorting the score on every request would sort every candidate book each time.

## Decision

- **Formula.** Each book stores `rankScore`, computed by `computeRankScore` in `src/modules/books/rank-score.ts` whenever pages or published date are written:

  ```
  rankScore = 0.8 · min(pages, 2000) / 2000  −  0.2 · publishedDate / 100 years
  ```

- **Normalisation uses fixed constants, not dataset statistics.** Pages are capped at 2000 and scaled to 0–1; age is scaled so 100 years = 1. After weighting, one year of age is worth five pages.
- **Age is measured from a fixed point (the epoch), not from now.** The true score at any moment is `rankScore + 0.2 · now / 100 years`. That extra term is the same for every book, so the order never changes and the stored value stays valid forever.
- **Computed explicitly, not in a hook.** The service and the seeder call the pure function directly. Mongoose `save` hooks do not run on `bulkWrite` or `findOneAndUpdate`, so a hook would miss writes.
- **Indexes are named so queries can target them:**
  - `feed_country_rank`: `{ library, authorCountry, rankScore: -1, _id: -1 }`
  - `feed_rank`: `{ library, rankScore: -1, _id: -1, authorCountry }`

  The query that uses them is recorded in T6.

- `rankScore` is internal and is not returned by the API.

## Alternatives considered

- **Score per request** (`$addFields` + `$sort`) — simple, but sorts all candidates on every request and hits MongoDB's in-memory sort limit at scale.
- **Min-max normalisation over the candidate set** — exact relative scaling, but needs a full scan per request, and every insert of a new longest or oldest book would invalidate all scores.
- **Mongoose middleware** — misses `bulkWrite` and update queries.

## Consequences

- Inserting, updating or deleting a book touches only that book's score. Time passing touches nothing.
- Changing the weights or constants requires recomputing every score. That is one server-side `updateMany` with an aggregation pipeline, run as a planned migration.
- Books longer than 2000 pages get no extra credit for length. This is deliberate, so a single outlier cannot dominate the feed.
