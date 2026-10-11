# 0017. Second review corrections

- **Status:** Accepted
- **Date:** 2026-10-11
- **Approved by:** Project owner (asked for every second-review finding to be fixed)
- **Plan reference:** second post-delivery review · **Amends:** [0011](0011-authentication.md), [0015](0015-integration-tests-and-scale-proof.md), [0016](0016-code-review-corrections.md)

## Context

A second full review found no correctness bugs and no requirement gaps, but nine maintenance issues. Four of them change structure or contracts recorded in earlier ADRs.

## Decision

1. **Token port (completes the Dependency Inversion in 0016; amends 0011)**
   - `AuthService` now depends on a `TokenIssuer` interface (`auth.types.ts`) instead of the concrete `TokenService` class, which is tied to jsonwebtoken. `TokenService` implements it.
   - `verify()` returns only the user id. The `role` claim is still signed into tokens for clients to read, but the server neither requires nor trusts it; roles always come from the database.
2. **Feed query builder outside the class**
   - The query moved from the public `FeedRepository.rankedQuery` method to a module-level `rankedBooksQuery` function. The repository's API is again just `findRanked`, matching the `RankedBookSource` port, and the integration test still runs `explain()` on the exact production query.
3. **Scripts folder (amends the paths in 0015 and 0016)**
   - The operational scripts moved from `src/seed/` to `src/scripts/`: the bulk loader, the rank-score recompute and the shared `runMongoScript` runner. `src/seed/` holds only demo data and the run-once seeder.
   - The npm script names are unchanged. The compiled paths are now `dist/scripts/bulk-books.js` and `dist/scripts/recompute-rank-scores.js`.
4. **Regression tests for the first-review fixes**
   - **Integration:** `seedDatabase` runs twice with a delete in between, and the deleted demo book must stay gone.
   - **Unit:** with `Date` frozen at 2026-10-11T12:00Z, "2026-10-12" (already today in UTC+14) is accepted and "2026-10-13" is rejected.
   - Each test was confirmed to fail when its fix is disabled.

**Smaller fixes:**

- The cyclic `pick` helper is now a single shared `pickCyclic` in `src/utils/array.ts`.
- `EARLIEST_TIMEZONE_OFFSET_MS` is renamed to `MAX_UTC_OFFSET_MS`.
- The README describes seeding as once per database, guarded by the marker, and no longer quotes test counts or coverage figures that drift with every change.

## Alternatives considered

- **Keep `rankedQuery` public and document it as test-only** — production code could still use it and skip the record mapping.
- **Drop the `role` claim entirely** — clients lose an easy way to show the role. Keeping it informational costs nothing, since the server ignores it.
- **Keep scripts under `src/seed/`** — the folder name would keep misdescribing its contents, and the coverage exclusion for `src/seed/**` would silently cover unrelated code.

## Consequences

- Every service now depends only on interfaces: `BookStore`, `RankedBookSource`, `UserStore` and `TokenIssuer`.
- A regression in the seed marker or the date boundary now fails a test.
- Commands in older ADRs that reference `dist/seed/bulk-books.js` should use `dist/scripts/bulk-books.js`.
