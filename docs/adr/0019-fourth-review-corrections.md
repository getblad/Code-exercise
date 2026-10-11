# 0019. Fourth review corrections

- **Status:** Accepted
- **Date:** 2026-10-11
- **Approved by:** Project owner (asked for every fourth-review finding to be fixed)
- **Plan reference:** fourth post-delivery review · **Amends:** [0011](0011-authentication.md), [0014](0014-containerization.md)

## Context

A fourth review found five low-severity issues and no correctness bugs or requirement gaps. Two change earlier decisions.

## Decision

1. **Self-describing password hashes** (amends 0011)
   - **Format:** stored hashes are now `scrypt$N$r$p$<salt>$<key>`, and verification uses the parameters stored in each hash, not the current constants.
   - **Raising the cost:** changing `CURRENT_PARAMS` only affects new hashes; existing ones keep verifying. `maxmem` is derived from the parameters, so a higher N doesn't hit Node's 32 MB scrypt default.
   - **Not added:** re-hashing on login when the stored parameters are below the target would complete the upgrade path, but it isn't needed yet.
   - **Old hashes:** hashes written in the earlier `scrypt$<salt>$<key>` form are rejected. That form only ever existed in local development databases and was never deployed, so there is no compatibility code. To re-seed a local database, delete its `users` and `seed_runs` documents and restart.
2. **Pinned images** (amends 0014)
   - Compose runs `mongo:8.0.32`, the same version the integration suite pins in `MONGO_VERSION`, and the Dockerfile builds on `node:22.23.3-alpine`.
   - Upgrades become deliberate. Bump the compose tag and `MONGO_VERSION` together.

**Smaller fixes:**

- The country-code error text is one exported constant, `COUNTRY_CODE_MESSAGE`. The Mongoose models prefix it with `{PATH}`.
- A test covers `Location` with and without a trailing slash (`books/<id>` vs `<id>`).

**Not applied by the assistant:**

- `.env.example` still lists the unused `NODE_ENV` and lacks `TRUST_PROXY_HOPS`. The assistant's permissions block edits to `.env*` files, so the owner makes this change manually.

## Alternatives considered

- **Accept the old hash format as well** — compatibility code for data that never left a development machine.
- **The PHC string format (`$scrypt$ln=14,r=8,p=1$…`)** — standard but more verbose to parse. The positional form carries the same information.
- **Pinning image digests** — fully reproducible, but unreadable and stale on every rebuild. Exact version tags are a reasonable middle ground.

## Consequences

- The scrypt work factor can be raised without locking anyone out.
- The integration suite and the compose stack run the same MongoDB build.
- Base-image security patches arrive only when the pinned tags are bumped, which now has to happen on purpose.
