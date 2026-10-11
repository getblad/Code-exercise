# 0016. Code review corrections

- **Status:** Accepted
- **Date:** 2026-10-11
- **Approved by:** Project owner (asked for every review finding to be fixed)
- **Plan reference:** post-T9 review · **Amends:** [0010](0010-stored-feed-ranking-score.md), [0012](0012-books-api-contract.md)

## Context

A full review against the assignment and the coding standards found 15 issues. Most were local fixes. Five changed earlier decisions or the API contract, and those are recorded here.

## Decision

1. **Rebalanced score normalisation** (amends 0010)
   - **Problem:** age was scaled so that 100 years equals 1, while pages are capped at 1. Over real publication ranges (1600–2025) the 20% age weight therefore outweighed the 80% pages weight: a 100-page book from 1605 outranked a 2000-page book from 1990.
   - **Change:** the age span is now 500 years, so both terms fall roughly within 0–1 and pages carry four times the weight. One year of age is now worth one page.
   - **Unchanged:** the score stays time-invariant and indexable.
   - **Data:** `npm run rank:recompute` (`src/seed/recompute-rank-scores.ts`) re-scores every stored book through the same `computeRankScore` function, so the formula exists in one place only. It took 27 s for 1,000,018 books.
2. **Seed once**
   - **Problem:** the seed re-upserted demo books on every start, so a book deleted through the API came back after a restart.
   - **Change:** a `seed_runs` marker document (`demo-data-v1`) is written after the seed. When the marker exists, the seed is skipped, which also avoids re-hashing passwords on every start.
   - **Concurrency:** the marker is an upsert, so two instances starting together can't collide.
3. **Proxy trust**
   - **Problem:** behind a reverse proxy, every client shared the proxy's IP in the login rate limiter.
   - **Change:** `TRUST_PROXY_HOPS` (default 0) sets Express `trust proxy` to an explicit hop count. Trusting everything would let clients spoof `X-Forwarded-For`.
   - **Logging:** the limiter's `X-Forwarded-For` console warning is turned off, so all output stays in the structured log.
4. **Relative `Link` reference** (amends 0012)
   - The next-page link is now query-only (`<?limit=…&cursor=…>`) and resolves against the requested URL. An absolute path broke when a proxy served the API under a path prefix.
5. **Repository ports (Dependency Inversion)**
   - Services now depend on interfaces, not on Mongoose repositories: `BookStore` (`book.types.ts`), `RankedBookSource` (`feed.types.ts`) and `UserStore` (`user.types.ts`). The repositories implement them.
   - `Principal` is now the user profile type (`auth.types.ts`) rather than a copied shape.
   - Type-only files (`*.types.ts`, `*.d.ts`) are excluded from coverage, because TypeScript erases them and they contain nothing to execute.

**Other fixes, which follow from existing decisions:**

- Ids are lower-cased during validation. Upper-case hex no longer fails the membership check with a false 403.
- "Not in the future" compares calendar dates against today in UTC+14, the first time zone to reach a new day. A user's local "today" is never rejected.
- A missing `req.principal` is now a programming error and returns 500, not 401.
- The shared pagination query schema lives in `validation/schemas.ts`.
- The unused `NODE_ENV` setting was removed from config validation.
- Scripts share `runMongoScript`, which loads `.env` like the server does.
- The integration teardown only drops the database when it is connected.
- The rank-score comment is now a single line.

## Alternatives considered

- **Keep the 100-year span and document the skew** — the feed would still contradict the assignment's 80/20 weighting.
- **Normalise age by the dataset's min/max** — exact, but every new oldest book would invalidate all scores (rejected in 0010).
- **Seed only when the collections are empty** — a crash mid-seed would leave partial data that is never completed. The marker is written only after a full seed.
- **`trust proxy: true`** — spoofable. An explicit hop count is safe by default.

## Consequences

- Any existing database must run `npm run rank:recompute` once after upgrading. Fresh databases are seeded with the new scores.
- Feed order changes: length now dominates, as the assignment intends. Query cost and the index design are unchanged, so the measurements in [0015](0015-integration-tests-and-scale-proof.md) still hold.
- Deployments behind proxies must set `TRUST_PROXY_HOPS`.
- Clients must resolve `Link` relative to the request URL, as RFC 8288 specifies.
