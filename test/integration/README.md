# Integration tests

These boot the **real** Express app against a **real** Postgres and exercise the
`app → route → DB` path over HTTP. They are the safety net that makes larger
refactors (e.g. splitting `routes.js`) verifiable: after moving code, run these to
confirm the HTTP behaviour is unchanged.

They are **not** part of `npm test` — that suite must run without a database in CI.
These need a database and are run separately.

## Run locally

```bash
# 1. Start a throwaway Postgres (Docker Desktop must be running)
npm run db:test:up          # docker compose up -d db  → localhost:55432

# 2. Run the integration tests against it
npm run test:integration

# 3. Stop the database when done
npm run db:test:down
```

To point at a different database instead of the compose one:

```bash
TEST_DATABASE_URL="postgres://user:pass@host:5432/db" npm run test:integration
```

## What's covered

`smoke.integration.test.js`:
- `GET /health` — the app boots against the DB.
- `POST /api/v1/signup` with no body — validation returns 400.
- `GET /api/v1/brands/by-slug/:slug` — a real DB round-trip (create → read).
- Security headers are present on responses.

## Adding cases

The app is exported from `src/server.js` (`module.exports = { app }`) and boots only
when run directly (`require.main === module`), so tests can `require` it without
opening the production port or starting cron jobs. Add a `test(...)` per critical
flow you want to lock before refactoring the routes it touches.
