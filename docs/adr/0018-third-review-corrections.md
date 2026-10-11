# 0018. Third review corrections

- **Status:** Accepted
- **Date:** 2026-10-11
- **Approved by:** Project owner (asked for every third-review finding to be fixed)
- **Plan reference:** third post-delivery review · **Amends:** [0009](0009-author-country-on-book.md), [0012](0012-books-api-contract.md), [0016](0016-code-review-corrections.md)

## Context

A third review found no requirement gaps but seven issues, mostly hardening and consistency. Three of them change behaviour recorded in earlier ADRs.

## Decision

1. **Real ISO 3166-1 alpha-2 validation** (amends 0009)
   - **Problem:** country codes were checked only as "two letters", so `ZZ` and `XX` were stored, even though the error message promised ISO codes.
   - **Change:** `src/validation/country-codes.ts` now holds the official list of 249 assigned codes, used by the request schema (`countryCodeSchema`) and by both Mongoose models.
   - **Why a list:** Node's ICU region data (`Intl.DisplayNames`) was rejected. It also accepts non-ISO CLDR codes such as `ZZ` ("Unknown Region"), `UK`, `EU` and `QO`.
   - **Check:** the list was verified as 249 unique, sorted codes, each known to CLDR.
2. **Relative `Location` header** (amends 0012)
   - `POST /books` now returns `Location: books/<id>`, a relative reference like the next-page `Link`, built by `src/http/location.ts`. It resolves to `/books/<id>` directly and to `/api/books/<id>` behind a path-prefixing proxy.
3. **Recompute that is safe while the API is live** (amends 0016)
   - **Problem:** `rank:recompute` filtered its updates only by `_id`, so a book edited after the script read it got a stale score.
   - **Change:** each update now matches the `pages` and `publishedDate` that were read. Books edited in the meantime are skipped (their edit already stored a fresh score) and counted as `changedMeanwhile`.

**Smaller fixes:**

- `toBookRecord` moved from the books repository into `book.mapper.ts`, so the feed module no longer imports another module's repository.
- The dummy password hash is created lazily, once per process, instead of eagerly for every `AuthService` instance. This avoids a background scrypt job per test app, and a possible unhandled rejection at construction.
- The seed marker collection name is the exported constant `SEED_RUNS_COLLECTION`, which the integration test reuses.
- `npm run seed:bulk` and `npm run rank:recompute` run the TypeScript sources through tsx, so they work without a build. The container keeps using `node dist/scripts/...`.

## Alternatives considered

- **`Intl.DisplayNames` with an exclusion list** — a moving target that depends on the ICU version shipped with Node.
- **An absolute `Location` with a configurable base path** — more configuration, while a relative reference needs none.
- **Locking or pausing writes during recompute** — heavier than a conditional update that simply skips changed documents.

## Consequences

- Invalid country codes are rejected with a field error. Seeded and generated data use valid codes only.
- Every self-link the API emits (`Link`, `Location`) is now relative.
- The ISO list must be updated by hand if ISO 3166-1 assigns new codes, which happens rarely.
