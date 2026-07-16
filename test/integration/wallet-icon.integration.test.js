'use strict';

// Icona notifica: il percorso che l'utente usa davvero (scelta dalla Media Library →
// sync sul brand). Blocca il salvataggio end-to-end e, soprattutto, la distinzione tra
// "non c'era nulla da sincronizzare" e "sincronizzazione fallita": erano entrambi 400 e
// il client li ingoiava tutti e due, così l'icona non si salvava senza dirlo a nessuno.
// Richiede un DB: `npm run db:test:up && npm run test:integration`.

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgres://reclame:reclame@127.0.0.1:55432/reclame_test';
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.JWT_SECRET = 'itest-secret';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const sharp = require('sharp');

const db = require('../../src/db');
const { app } = require('../../src/server');

let server;
let base;
let token;
let brandId;
const SLUG = 'itest-walleticon';
const EMAIL = 'itest-walleticon@example.com';

async function cleanup() {
  const r = await db.pool.query('SELECT id FROM brands WHERE slug = $1', [SLUG]).catch(() => ({ rows: [] }));
  for (const { id } of r.rows) {
    await db.pool.query('DELETE FROM media WHERE brand_id = $1', [id]).catch(() => {});
  }
  await db.pool.query('DELETE FROM users WHERE email = $1', [EMAIL]).catch(() => {});
  await db.pool.query('DELETE FROM brands WHERE slug = $1', [SLUG]).catch(() => {});
}

async function makeMedia() {
  const png = await sharp({
    create: { width: 512, height: 512, channels: 4, background: { r: 200, g: 30, b: 40, alpha: 1 } },
  }).png().toBuffer();
  return db.createMedia({
    brand_id: brandId, kind: 'image', filename: 'icona.png', image_base64: png.toString('base64'),
  });
}

before(async () => {
  await db.getDb();
  await cleanup();
  const brand = await db.createBrand({ name: 'Itest Wallet Icon', slug: SLUG, config: { product_line: 'ads' } });
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

function sync(body) {
  return fetch(`${base}/api/v1/brands/${brandId}/wallet-icon/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body || {}),
  });
}

test("scegliere un'icona dalla Media Library la salva davvero sul brand", async () => {
  const media = await makeMedia();
  const res = await sync({ media_id: media.id });
  assert.equal(res.status, 200);

  const brand = await db.getBrand(brandId);
  assert.equal(brand.config.brand_identity_assets.wallet_icon, media.id, 'il riferimento al media è registrato');
  // Ciò che conta è l'icona sincronizzata sul brand: è quella che finisce sul pass e
  // sopravvive alla cancellazione del media dalla libreria.
  assert.ok(brand.config.logos.icon, 'icona 29px salvata');
  assert.ok(brand.config.logos['icon@3x'], 'icona 87px salvata (quella che mostra l\'anteprima)');
});

test('un brand senza icona configurata è un no-op silenzioso, non un errore', async () => {
  const r = await db.pool.query('SELECT config FROM brands WHERE id = $1', [brandId]);
  const cfg = r.rows[0].config;
  delete cfg.brand_identity_assets.wallet_icon;
  await db.pool.query('UPDATE brands SET config = $2 WHERE id = $1', [brandId, cfg]);

  const res = await sync({});
  assert.equal(res.status, 400);
  // Il codice è ciò che permette al client di distinguere: senza, saltava in silenzio
  // anche i fallimenti veri.
  assert.equal((await res.json()).code, 'no_icon_configured');
});

test("un media sparito è un fallimento dichiarato, non un salvataggio finto", async () => {
  const res = await sync({ media_id: '11111111-2222-3333-4444-555555555555' });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.code, 'sync_failed', 'distinguibile dal no-op');
  assert.match(body.error, /Media Library/i, 'dice all\'utente cosa fare');

  const brand = await db.getBrand(brandId);
  assert.ok(!brand.config.brand_identity_assets?.wallet_icon, 'un sync fallito non registra il media morto');
});
