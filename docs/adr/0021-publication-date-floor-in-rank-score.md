# 0021. Floor on publication dates in the rank score

- **Status:** Accepted
- **Date:** 2026-10-12
- **Approved by:** Project owner (asked for the fix)
- **Plan reference:** pre-defence review · **Amends:** [0010](0010-stored-feed-ranking-score.md)

## Context

The age part of the score had no upper limit, while pages were capped at 2000 ([0010](0010-stored-feed-ranking-score.md)). Validation accepts any year from 0001, and with the 500-year span ([0016](0016-code-review-corrections.md)) a book from year 1 earned about 1,969 page-equivalents of age. That is more than the 0.8 maximum for length:

| Book                  | rankScore |
| --------------------- | --------- |
| 1 page, year 1        | 0.788     |
| 2000 pages, year 2020 | 0.780     |

A one-page ancient text outranked the longest modern book, which contradicts the 80/20 weighting.

## Decision

- `computeRankScore` treats any publication date before 1 January 1500 as 1500 (`OLDEST_SCORED_DATE_MS`).
- **Why 1500:** it lies one 500-year span before the present, so the age part covers roughly 0 to 1, like the pages part. Its weighted maximum is about 0.19, close to its 20% share. Books printed before 1501 (incunabula) and older texts all count as equally old.
- The floor is a fixed date, not relative to now, so the score stays time-invariant and indexable.
- A unit test covers the floor and was confirmed to fail without it.

## Alternatives considered

- **Reject dates before 1500 in validation** — loses legitimate data, such as ancient works catalogued with their original date.
- **Cap age relative to now (at most 500 years old)** — the cap would move every day, so stored scores would go stale and the feed index would be wrong.
- **A wider age span** — shrinks the problem without removing it, since a span can always be exceeded by an older date, and it weakens the age part for ordinary books.

## Consequences

- Age contributes at most about 0.19, so length always carries most of the weight, as intended.
- Books from before 1500 tie on age and are ordered among themselves by length.
- **Existing data:** seeded books (1605 onward) and bulk-generated books (1600 onward) keep their scores. A database holding books created through the API with dates before 1500 must run `npm run rank:recompute` once.
