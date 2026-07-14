'use strict';

// Integration test for the custom commercial-packages feature: PUT a brand's
// bespoke catalog, confirm GET packages + GET calendar reflect it, revert to
// presets with an empty array, and reject invalid input.
// Requires a DB: `npm run db:test:up && npm run test:integration`.

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
const SLUG = 'itest-commpkg-brand';
const EMAIL = 'itest-commpkg-admin@example.com';

before(async () => {
  await db.getDb();
  await db.pool.query('DELETE FROM users WHERE email = $1', [EMAIL]).catch(() => {});
  await db.pool.query('DELETE FROM brands WHERE slug = $1', [SLUG]).catch(() => {});

  const brand = await db.createBrand({ name: 'Itest CommPkg Brand', slug: SLUG, config: {} });
  brandId = brand.id;
  const user = await db.createUser({ email: EMAIL, password: 'pw-itest-12345', name: 'Itest Admin', role: 'admin', brand_id: null });
  token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: 'admin', brand_id: null }, 'itest-secret', { expiresIn: '1h' });

  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
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

test('commercial packages: unauthenticated request is rejected (401)', async () => {
  const res = await fetch(`${base}/api/v1/brands/${brandId}/commercial/packages`);
  assert.equal(res.status, 401);
});

test('commercial packages: a fresh brand serves the presets (custom=false)', async () => {
  const res = await authed(`/api/v1/brands/${brandId}/commercial/packages`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.custom, false);
  assert.ok(Array.isArray(data.packages) && data.packages.length >= 1);
  assert.ok(data.formats && typeof data.formats === 'object');
});

test('commercial packages: PUT saves a custom catalog and GET reflects it', async () => {
  const putRes = await authed(`/api/v1/brands/${brandId}/commercial/packages`, {
    method: 'PUT',
    body: JSON.stringify({
      packages: [
        {
          key: 'flash',
          label: 'Flash Weekend',
          description: 'Solo push',
          inventory: { push_lockscreen: 5, geofence_recall: 1 },
          suggested_price_cents: 300000,
        },
      ],
    }),
  });
  assert.equal(putRes.status, 200);
  const put = await putRes.json();
  assert.equal(put.custom, true);
  assert.equal(put.packages.length, 1);
  assert.equal(put.packages[0].key, 'flash');

  const getRes = await authed(`/api/v1/brands/${brandId}/commercial/packages`);
  const got = await getRes.json();
  assert.equal(got.custom, true);
  assert.equal(got.packages.length, 1);
  assert.equal(got.packages[0].label, 'Flash Weekend');
  assert.equal(got.packages[0].inventory.push_lockscreen, 5);
});

test('commercial packages: the calendar reflects the custom catalog', async () => {
  const res = await authed(`/api/v1/brands/${brandId}/commercial/calendar`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.packages.length, 1);
  assert.equal(data.packages[0].key, 'flash');
  assert.ok(Array.isArray(data.packages[0].formats));
});

test('commercial packages: a booking accepts the custom package key', async () => {
  const res = await authed(`/api/v1/brands/${brandId}/commercial/bookings`, {
    method: 'POST',
    body: JSON.stringify({
      tenant_name: 'Nike Outlet',
      package_key: 'flash',
      format: 'push_lockscreen',
      start_at: new Date('2026-08-01T10:00:00Z').toISOString(),
    }),
  });
  assert.equal(res.status, 201, await res.text());
  const booking = await res.json();
  assert.equal(booking.package_key, 'flash');
  await db.pool.query('DELETE FROM commercial_bookings WHERE id = $1', [booking.id]).catch(() => {});
});

test('commercial packages: PUT [] reverts to the presets', async () => {
  const putRes = await authed(`/api/v1/brands/${brandId}/commercial/packages`, {
    method: 'PUT',
    body: JSON.stringify({ packages: [] }),
  });
  assert.equal(putRes.status, 200);
  const put = await putRes.json();
  assert.equal(put.custom, false);

  const getRes = await authed(`/api/v1/brands/${brandId}/commercial/packages`);
  const got = await getRes.json();
  assert.equal(got.custom, false);
  assert.ok(got.packages.length >= 1);
});

test('commercial packages: a package with no slots is rejected (400)', async () => {
  const res = await authed(`/api/v1/brands/${brandId}/commercial/packages`, {
    method: 'PUT',
    body: JSON.stringify({ packages: [{ key: 'bad', label: 'Bad', inventory: {} }] }),
  });
  assert.equal(res.status, 400);
});
