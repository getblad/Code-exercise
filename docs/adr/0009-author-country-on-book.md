# 0009. Store the author's country on the book

- **Status:** Accepted
- **Date:** 2026-10-11
- **Approved by:** Project owner
- **Plan reference:** D10 · **Implemented in:** T3

## Context

The feed must "prioritize books by authors from the same country as the user". The assignment's Book entity has `author` as a plain string and no country, so the rule cannot be applied without extra data. This is a deliberate deviation from the given schema.

## Decision

- Book gets an optional `authorCountry`: an ISO 3166-1 alpha-2 code (e.g. `US`), upper-cased, `null` when unknown.
- A book with no `authorCountry` never matches a user's country, so it ranks in the "other countries" group.
- The value is validated in the Mongoose schema and, from T5, in the request schema.
- The deviation is listed in the README.

## Alternatives considered

- **Required `authorCountry`** — stricter, but forces data that is often unknown.
- **Separate Author collection (name → country)** — normalised, but adds a lookup on every write, and author names are not unique.
- **Inferring from users or libraries** — wrong; the rule is about the author, not the reader or the location.

## Consequences

- The feed's same-country check is a plain equality on an indexed field.
- An author's country is copied onto each of their books. Correcting it means updating those books, which is acceptable for this domain.
