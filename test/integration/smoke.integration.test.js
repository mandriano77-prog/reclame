'use strict';

// Integration smoke test: boots the real Express app against a real Postgres and exercises the
// app -> route -> DB path over HTTP. Requires a database — start one with `docker compose up -d db`
// then run `npm run test:integration`. NOT part of `npm test` (which must run without a DB in CI).
//
// This is the harness that makes the routes.js modularization (T3) verifiable: after extracting a
// route group, these tests confirm the HTTP behavior is unchanged. Add a case per critical flow.

// Point the app at the test DB BEFORE requiring db/server (the pg pool is built at module load).
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgres://reclame:reclame@127.0.0.1:55432/reclame_test';
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const db = require('../../src/db');
const { app } = require('../../src/server');

let server;
let base;
const SLUG = 'itest-brand';

before(async () => {
  await db.getDb(); // apply schema/migrations against the test DB
  await db.pool.query('DELETE FROM brands WHERE slug = $1', [SLUG]).catch(() => {});
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((r) => server.close(r));
  await db.pool.query('DELETE FROM brands WHERE slug = $1', [SLUG]).catch(() => {});
  await db.pool.end().catch(() => {});
});

test('GET /health boots the app against the DB', async () => {
  const res = await fetch(`${base}/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
});

test('POST /api/v1/signup validates missing brand_slug (400)', async () => {
  const res = await fetch(`${base}/api/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 400);
});

test('GET /api/v1/brands/by-slug/:slug round-trips through the DB', async () => {
  await db.createBrand({ name: 'Itest Brand', slug: SLUG, config: { labelColor: '#123456' } });
  const res = await fetch(`${base}/api/v1/brands/by-slug/${SLUG}`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.slug, SLUG);
  assert.equal(body.name, 'Itest Brand');
});

test('security headers are applied on responses', async () => {
  const res = await fetch(`${base}/health`);
  assert.equal(res.headers.get('x-frame-options'), 'SAMEORIGIN');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
});
