# 0020. Fifth review corrections

- **Status:** Accepted
- **Date:** 2026-10-11
- **Approved by:** Project owner (asked for every fifth-review finding to be fixed)
- **Plan reference:** fifth post-delivery review · **Amends:** [0007](0007-configuration-errors-and-logging.md), [0019](0019-fourth-review-corrections.md)

## Context

A fifth review found one security issue and one small correctness issue. The `JWT_SECRET` placeholder shipped in `.env.example` met the 32-character minimum, so a stack started from the copied example ran with a publicly known signing key. The demo user IDs are published in the README, so anyone could forge an admin token. The T9 fresh-clone check had in fact run that way without noticing.

## Decision

1. **Refuse placeholder secrets at startup** (amends 0007)
   - `JWT_SECRET` must be at least 32 characters and must not look like a placeholder. Anything matching `replace-with`, `change-me`, `your-secret`, `placeholder` or `example` (case-insensitive) is refused.
   - Startup fails with exit code 1 and `JWT_SECRET: is a placeholder; set a random value`. As with every config error, the value is never printed.
   - Verified: the rebuilt image exits 1 when given the placeholder, and the owner's real secret still starts normally.
2. **Malformed scrypt cost is "invalid", not a crash** (amends 0019)
   - The hash parser now also requires `N` to be a power of two greater than 1. A corrupted stored hash makes `verifyPassword` return `false` (a uniform 401) instead of throwing `ERR_CRYPTO_INVALID_SCRYPT_PARAMS` (a 500).

**Not applied by the assistant:**

- `.env.example` should set `JWT_SECRET=` to empty, so a missing secret fails fast, add `TRUST_PROXY_HOPS=0`, and drop the unused `NODE_ENV`. The assistant's permissions block edits to `.env*` files, so the owner makes this change.

## Alternatives considered

- **An entropy check (distinct characters, character classes)** — heuristic, and easy to pass with a long English sentence. Matching the known placeholder vocabulary targets the actual risk, a copied example value.
- **Generating a secret automatically when it's missing** — every restart would issue a new key and silently invalidate all tokens, and a multi-instance deployment would disagree on the key.

## Consequences

- A deployment can no longer run with the documented example key.
- Any real secret containing one of the denied words is refused too. That is acceptable for a value that should be random.
