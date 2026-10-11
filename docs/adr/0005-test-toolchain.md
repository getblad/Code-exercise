# 0005. Test toolchain: Mocha + Sinon on compiled output, c8 coverage

- **Status:** Accepted
- **Date:** 2026-10-08, revised 2026-10-11
- **Approved by:** Project owner
- **Plan reference:** D8 · **Implemented in:** T1

## Context

The assignment requires Mocha + Sinon. Coverage must be measured and meaningful, and the suite should stay small: few files, only cases that prove behaviour.

D8 was approved on 2026-10-08 with tsx loading TypeScript into Mocha. In T1, c8 reported phantom branches on every file: tsx (esbuild) injects module-interop helpers into each file, and c8 maps them to line 1. `app.ts` has no branches, yet showed 15, three of them uncovered. On 2026-10-11 the owner approved running tests on `tsc` output instead.

## Decision

- **Libraries:** Mocha 12, Sinon 22, supertest 7, and `node:assert/strict`.
- **Compiled tests:** `npm test` wipes `.test-build/`, compiles `src` and `test` with `tsconfig.test.json`, then runs Mocha on the JavaScript with `--enable-source-maps`. `importHelpers` puts the interop helpers in `tslib` instead of every file.
- **Coverage:** `npm run coverage` runs c8 with `exclude-after-remap`, so results map back to `src/**/*.ts`.
  - Thresholds: lines 85, branches 80, functions 85, statements 85.
  - Excluded: the composition root (`server.ts`) and, later, bootstrap code that only wires real infrastructure.
- **Stubbing:** Sinon stubs sit at the repository boundary (`sinon.createStubInstance`). Mongoose query chains are never stubbed. Only `Date` is faked when time matters.
- **Layout:** one test file per feature (app, auth, books, feed). A possible database integration test is decided separately (D19).

## Alternatives considered

- **tsx for tests** — no compile step, but the branch metric is wrong.
- **tsx for tests, tsc only for coverage** — two ways of running the same suite.
- **chai** — v5+ is ESM-only; `node:assert/strict` is built in and enough.
- **nyc** — needs an instrumentation step; c8 uses V8's native coverage.

## Consequences

- Coverage is exact: 100% statements, branches, functions and lines on T1 code.
- Tests run the same compiler output as the production build.
- Each run pays about 1 s of compilation.
- A deleted test cannot run as a stale compiled file, because the output folder is wiped.
- `tslib` is a dev dependency.
