# 0004. Oxlint with type-aware rules, and Prettier

- **Status:** Accepted
- **Date:** 2026-10-08, revised 2026-10-11
- **Approved by:** Project owner
- **Plan reference:** D7 · **Implemented in:** T1

## Context

Lint must enforce the coding rules mechanically: no `any`, no type assertions, no floating promises, no unsafe flows of `any` values, no `console`.

D7 was approved on 2026-10-08 as ESLint + typescript-eslint `strictTypeChecked`. During T1, TypeScript 7 became the target ([0002](0002-typescript-7-with-commonjs-output.md)). typescript-eslint does not support it: its peer range stops below TypeScript 6.1, because TS 7.0 has no stable programmatic API. Support is expected with TS 7.1, with no date. On 2026-10-11 the owner approved switching to Oxlint.

## Decision

- **Linter:** Oxlint 1.x with type-aware mode from `oxlint-tsgolint` 7, which is built on the TypeScript 7 (Go) checker. Config: `.oxlintrc.json`.
  - Categories `correctness` and `suspicious` are errors.
  - Explicit rules mirror typescript-eslint's `strict-type-checked` and `stylistic-type-checked` presets, rule for rule.
  - `consistent-type-assertions: never` (`as const` stays allowed), `no-non-null-assertion`, `no-explicit-any`, `no-console`.
  - `npm run lint` runs `oxlint --deny-warnings`, so warnings fail the build.
- **Formatter:** Prettier 3 (`singleQuote`, `printWidth: 100`, `trailingComma: all`). `npm run format:check` is part of `npm run check`.

## Alternatives considered

- **TypeScript 6 + ESLint/typescript-eslint** — the most mature option, but it ties the project to the last JavaScript-based TypeScript line.
- **TypeScript 6 for lint plus TypeScript 7 for build** — Microsoft's suggested transition setup, but two compilers can disagree, and both packages ship a `tsc` binary.
- **Biome** — its type inference is its own and partial; it does not use the TypeScript checker.

## Consequences

- Verified 2026-10-11 with a probe file: `any`, `as` casts, `!` non-null assertions, a floating promise, unsafe assignment and member access, and `console` were all reported; `as const` was not.
- Lint takes about 2 s at T1 size, the same as ESLint; the speed advantage only shows on large codebases.
- Type-aware Oxlint is young (stable since autumn 2026) and covers 59 of typescript-eslint's 61 type-aware rules; gaps are possible. There is no shareable preset, so rules are listed explicitly. ESLint plugins are unavailable; none are needed.
- Revisit when typescript-eslint supports TypeScript 7.1+.
