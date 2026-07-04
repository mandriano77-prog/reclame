'use strict';

// Integration test for the template routes — locks their HTTP behavior BEFORE the T3
// extraction so we can confirm the move into src/api/template-routes.js changes nothing.
// Requires a DB: `npm run db:test:up && npm run test:integration`.

// Set env BEFORE requiring db/server (pg pool + JWT_SECRET are read at module load).
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgres://reclame:reclame@127.0.0.1:55432/reclame_test';
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.JWT_SECRET = 'itest-secret';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const db = require('../../src/db');
const { app } = require('../../src/server');

let server;
let base;
let token;
let brandId;
const SLUG = 'itest-tpl-brand';
const EMAIL = 'itest-tpl-admin@example.com';
const createdTemplateIds = [];

before(async () => {
  await db.getDb();
  await db.pool.query('DELETE FROM users WHERE email = $1', [EMAIL]).catch(() => {});
  await db.pool.query('DELETE FROM brands WHERE slug = $1', [SLUG]).catch(() => {});

  const brand = await db.createBrand({ name: 'Itest Tpl Brand', slug: SLUG, config: {} });
  brandId = brand.id;
  const user = await db.createUser({ email: EMAIL, password: 'pw-itest-12345', name: 'Itest Admin', role: 'admin', brand_id: null });
  token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: 'admin', brand_id: null }, 'itest-secret', { expiresIn: '1h' });

  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  for (const id of createdTemplateIds) {
    await db.pool.query('DELETE FROM pass_templates WHERE id = $1', [id]).catch(() => {});
  }
  await db.pool.query('DELETE FROM users WHERE email = $1', [EMAIL]).catch(() => {});
  await db.pool.query('DELETE FROM brands WHERE slug = $1', [SLUG]).catch(() => {});
  if (server) await new Promise((r) => server.close(r));
  await db.pool.end().catch(() => {});
});

function authed(path, opts = {}) {
  return fetch(`${base}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  });
}

test('templates: unauthenticated request is rejected (401)', async () => {
  const res = await fetch(`${base}/api/v1/templates?brand_id=${brandId}`);
  assert.equal(res.status, 401);
});

test('templates: POST creates, GET :id reads, GET list includes, DELETE removes', async () => {
  // create
  const createRes = await authed('/api/v1/templates', {
    method: 'POST',
    body: JSON.stringify({ brand_id: brandId, name: 'Itest Template', style: {} }),
  });
  assert.equal(createRes.status, 200);
  const created = await createRes.json();
  assert.ok(created.id, 'created template has an id');
  createdTemplateIds.push(created.id);

  // get by id
  const getRes = await authed(`/api/v1/templates/${created.id}`);
  assert.equal(getRes.status, 200);
  const got = await getRes.json();
  assert.equal(got.id, created.id);
  assert.equal(String(got.brand_id), String(brandId));

  // list
  const listRes = await authed(`/api/v1/templates?brand_id=${brandId}`);
  assert.equal(listRes.status, 200);
  const list = await listRes.json();
  assert.ok(Array.isArray(list) && list.some((t) => t.id === created.id), 'list includes the new template');

  // delete
  const delRes = await authed(`/api/v1/templates/${created.id}`, { method: 'DELETE' });
  assert.equal(delRes.status, 200);
  const after = await authed(`/api/v1/templates/${created.id}`);
  assert.equal(after.status, 404);
});

test('templates: missing brand_id on list returns 400', async () => {
  const res = await authed('/api/v1/templates');
  assert.equal(res.status, 400);
});
