'use strict';

// Le risposte JSON dell'API non devono mai essere riusate dalla cache del browser.
// Senza Cache-Control esplicito il browser applica una freschezza euristica (Safari in
// modo aggressivo): dopo un salvataggio la dashboard rileggeva brand e template dalla
// cache e mostrava i dati vecchi, facendo sembrare che il salvataggio non funzionasse.
// Le immagini invece restano cacheabili: le servono HUB e Google Wallet.
// Richiede un DB: `npm run db:test:up && npm run test:integration`.

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
const SLUG = 'itest-apicache';
const EMAIL = 'itest-apicache@example.com';

async function cleanup() {
  await db.pool.query('DELETE FROM users WHERE email = $1', [EMAIL]).catch(() => {});
  await db.pool.query('DELETE FROM brands WHERE slug = $1', [SLUG]).catch(() => {});
}

before(async () => {
  await db.getDb();
  await cleanup();
  const brand = await db.createBrand({ name: 'Itest Api Cache', slug: SLUG, config: {} });
  brandId = brand.id;
  const user = await db.createUser({ email: EMAIL, password: 'pw-itest-12345', name: 'Itest Admin', role: 'admin', brand_id: null });
  token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: 'admin', brand_id: null }, 'itest-secret', { expiresIn: '1h' });

  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await cleanup();
  if (server) await new Promise((r) => server.close(r));
  await db.pool.end().catch(() => {});
});

test('le letture JSON della dashboard non sono mai riusabili dalla cache', async () => {
  const paths = [`/api/v1/brands/${brandId}`, `/api/v1/templates?brand_id=${brandId}`];
  for (const p of paths) {
    const res = await fetch(`${base}${p}`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(res.status, 200, p);
    assert.equal(res.headers.get('cache-control'), 'no-store', `${p} deve essere no-store`);
  }
});

test('anche le risposte di errore non finiscono in cache', async () => {
  // Un 401 messo in cache lascerebbe la dashboard convinta di essere scollegata.
  const res = await fetch(`${base}/api/v1/brands/${brandId}`);
  assert.equal(res.status, 401);
  assert.equal(res.headers.get('cache-control'), 'no-store');
});

test('le immagini restano cacheabili: le servono HUB e Google Wallet', async () => {
  const res = await fetch(`${base}/assets/logo-placeholder?t=GM`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /image\/png/);
  // il no-store del JSON non deve aver invaso il percorso delle immagini
  assert.match(res.headers.get('cache-control') || '', /max-age=\d+/);
});
