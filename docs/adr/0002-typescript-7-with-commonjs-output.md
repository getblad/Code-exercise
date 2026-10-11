# 0002. TypeScript 7 with CommonJS output

- **Status:** Accepted
- **Date:** 2026-10-08, revised 2026-10-11
- **Approved by:** Project owner
- **Plan reference:** D2 · **Implemented in:** T1

## Context

The assignment requires TypeScript on Node.js. The module system affects how Mocha, c8 and Sinon load code. TypeScript 7.0 (July 2026) is the native Go port of the compiler; 6.0 is the last JavaScript-based release.

D2 was approved on 2026-10-08 without a pinned compiler version. On 2026-10-11 the owner chose TypeScript 7 after a lint solution for it was confirmed ([0004](0004-oxlint-and-prettier.md)).

## Decision

- **Compiler:** `typescript@^7.0.2`.
- **Strictness:** `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`, `isolatedModules`.
- **Modules:** `module`/`moduleResolution: nodenext` with no `"type": "module"` in `package.json`, so output is CommonJS and relative imports need no extension. `target: es2023` for Node 22.
- **Build:** `tsc -p tsconfig.build.json` compiles `src/` to `dist/`. `tsx watch` runs `npm run dev` only; it uses esbuild, so it is independent of the compiler version.
- **Types:** `@types/node` pinned to `^22` to match the runtime, so Node APIs newer than the runtime fail to compile.

## Alternatives considered

- **TypeScript 6.0.x** — the only line typescript-eslint supports today, but it is the final JavaScript-based release; the project would need migrating soon.
- **ESM output** — every relative import needs a `.js` suffix, and Sinon cannot stub ESM namespace exports. Dependency injection avoids the stubbing problem, but CommonJS has the least friction.
- **Node native type stripping** — requires `.ts` import extensions and forbids parameter properties and enums.

## Consequences

- Measured on T1 code: type-check 1.0 s on TS 7 vs 3.3 s on TS 6 (cold).
- TS 7.0 has no stable programmatic API, so tools built on the TypeScript JS API (typescript-eslint, ts-node) cannot be used. Nothing in this stack needs it.
- Revisit when TS 7.1 ships its programmatic API.
