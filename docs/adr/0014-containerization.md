# 0014. Containerization: multi-stage image and compose stack

- **Status:** Accepted
- **Date:** 2026-10-08 (D9), 2026-10-11 (D20)
- **Approved by:** Project owner
- **Plan reference:** D9, D20 · **Implemented in:** T2 (MongoDB service), T7

## Context

The assignment asks for a `Dockerfile`, and a `docker-compose.yml` that starts the app and MongoDB, with the database connection taken from environment variables and the JWT secret from `.env`.

## Decision

**Image (`Dockerfile`)**

- Two stages on `node:22-alpine`, the same Node major as development:
  - `build`: `npm ci`, then `tsc` into `dist/`.
  - `runtime`: `npm ci --omit=dev`, plus `dist/` copied from the build stage.
- Runs as the unprivileged `node` user; `CMD ["node", "dist/server.js"]` in exec form, so Node receives signals directly.
- `HEALTHCHECK` calls `/health` with `wget` (Alpine has no curl). `/health` returns 503 while MongoDB is unreachable.
- `.dockerignore` keeps out `node_modules`, `dist`, tests, docs, `.git` and every `.env*` file, so secrets never enter an image layer.

**Compose (`docker-compose.yml`)**

- **`mongo` (D9):** `mongo:8.0` with a named volume `mongo-data` and a `mongosh` ping healthcheck. It has no authentication on the private compose network, and its port is published to `127.0.0.1` only, for local tooling.
- **`app` settings:**
  - Built from the `Dockerfile`; `init: true` adds a PID-1 init that forwards signals.
  - `restart: unless-stopped`; port `3000` published.
  - Starts only after `mongo` reports healthy.
- **`app` environment (D20):**
  - Secrets come from `env_file: .env`, which is required. Compose stops with a clear error if it is missing, so a placeholder secret never runs silently. Setup is `cp .env.example .env`.
  - `environment:` overrides the values that must be fixed inside the stack: `MONGO_URI=mongodb://mongo:27017/books`, `PORT=3000`, `NODE_ENV=production`, `SEED_ON_STARTUP=true`. A localhost URI in a developer's `.env` therefore can't break the container.

**Verified on 2026-10-11**

- `docker compose up --build` brought both services to healthy in about 10 s. Login, `/books` and `/feed` work on `:3000`, and requests without a token get 401.
- The image is 189 MB and the process runs as `node` on Node 22.
- `docker compose stop app` delivered SIGTERM through init. The app shut down gracefully and exited with code 0.
- After `docker compose down` and `up`, the data persisted and the seed inserted nothing.

## Alternatives considered

- **Fall back to `.env.example` when `.env` is missing** — zero setup, but a known placeholder secret would run without any warning.
- **Single-stage image** — ships the compiler, linters and test tools; larger and a bigger attack surface.
- **Distroless runtime** — smaller, but no shell or `wget` for the healthcheck.
- **Root credentials for MongoDB** — more configuration, with no benefit on a private local network.

## Consequences

- One command after copying `.env.example` starts the whole system with demo data.
- The image builds from the lockfile alone, with no host `node_modules` or Windows paths involved.
- MongoDB has no authentication. This is fine for local compose; production would add credentials and TLS through `MONGO_URI`.
