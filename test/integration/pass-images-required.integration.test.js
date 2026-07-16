'use strict';

// Un brand senza le sue immagini non emette pass: meglio nessun pass che un pass con la
// grafica sbagliata (prima ci finiva sopra il marchio di un altro cliente).
// Qui si blocca il comportamento verso i due pubblici diversi: il consumatore sulla
// landing non deve leggere gergo interno, l'operatore deve sapere cosa manca.
// Richiede un DB: `npm run db:test:up && npm run test:integration`.

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgres://reclame:reclame@127.0.0.1:55432/reclame_test';
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.JWT_SECRET = 'itest-secret';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const jwt = require('jsonwebtoken');

const db = require('../../src/db');
const { app } = require('../../src/server');
const { createPkpass, missingBrandPassImages } = require('../../src/engine/passkit');
const { buildPkpassCached } = require('../../src/engine/pkpass-cache');

let server;
let base;
const SLUG = 'itest-imgreq';
const EMAIL = 'itest-imgreq@example.com';
let token;
let brandId;
let templateId;

async function cleanup() {
  const r = await db.pool.query('SELECT id FROM brands WHERE slug LIKE $1', [SLUG + '%']).catch(() => ({ rows: [] }));
  for (const { id } of r.rows) {
    for (const t of ['pass_instances', 'pass_templates', 'events']) {
      await db.pool.query(`DELETE FROM ${t} WHERE brand_id = $1`, [id]).catch(() => {});
    }
  }
  await db.pool.query('DELETE FROM brands WHERE slug LIKE $1', [SLUG + '%']).catch(() => {});
  await db.pool.query('DELETE FROM users WHERE email = $1', [EMAIL]).catch(() => {});
}

before(async () => {
  await db.getDb();
  await cleanup();
  const brand = await db.createBrand({ name: 'Itest Img Req', slug: SLUG, config: { product_line: 'ads' } });
  brandId = brand.id;
  const tpl = await db.createTemplate({ brand_id: brandId, name: 'T', pass_type: 'storeCard', style: {}, fields: {} });
  templateId = tpl.id;
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

test("emettere un pass nuovo è rifiutato, e dice quali immagini mancano", async () => {
  const brand = await db.getBrand(brandId);
  const tpl = await db.getTemplate(templateId);
  const pass = await db.createPassInstance({
    brand_id: brandId, template_id: templateId, serial_number: 'SN-IMGREQ-1', field_values: {},
  });
  await assert.rejects(
    () => createPkpass(tpl, pass, brand, { requireBrandImages: true }),
    (err) => {
      assert.equal(err.code, 'brand_images_missing');
      assert.deepEqual(err.missing, ['logo', 'icona notifica', 'strip']);
      return true;
    }
  );
});

test("il logo non fa da icona notifica: va caricata davvero", async () => {
  // Il motore sa ricavare un'icona ritagliando il logo. Comodo, ma qui significherebbe
  // emettere un pass senza l'icona che il brand ha scelto — cioè esattamente la cosa
  // che non si vuole più.
  const square = (await sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 10, g: 80, b: 60, alpha: 1 } } }).png().toBuffer()).toString('base64');
  const solo = await db.createBrand({
    name: 'Itest Solo Logo', slug: SLUG + '-sologo',
    config: { product_line: 'ads', logos: { logo: square } },
  });
  const tpl = await db.createTemplate({ brand_id: solo.id, name: 'T', pass_type: 'storeCard', style: { images: { strip: square } }, fields: {} });
  const missing = await missingBrandPassImages(await db.getBrand(solo.id), await db.getTemplate(tpl.id));
  assert.deepEqual(missing, ['icona notifica'], 'logo e strip ci sono, manca solo l\'icona');
});

test("un pass GIÀ INSTALLATO continua ad aggiornarsi anche se il brand è incompleto", async () => {
  // Il blocco vale alla nascita del pass. Questo percorso è quello che iOS chiama per
  // rinfrescare un pass già nel telefono del cliente: farlo fallire congelerebbe i punti
  // per sempre, in silenzio — un danno ai clienti, non una protezione del brand.
  const brand = await db.getBrand(brandId);
  const tpl = await db.getTemplate(templateId);
  const pass = await db.createPassInstance({
    brand_id: brandId, template_id: templateId, serial_number: 'SN-IMGREQ-INSTALLED', field_values: {},
  });
  const buf = await buildPkpassCached(tpl, pass, brand);
  assert.ok(buf.length > 1000, 'il pass si ricostruisce con la grafica generata dal brand');
});

test("con le immagini del brand il pass si crea", async () => {
  const square = (await sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 10, g: 80, b: 60, alpha: 1 } } }).png().toBuffer()).toString('base64');
  const strip = (await sharp({ create: { width: 750, height: 246, channels: 4, background: { r: 10, g: 80, b: 60, alpha: 1 } } }).png().toBuffer()).toString('base64');
  const brand = await db.getBrand(brandId);
  brand.config.logos = { logo: square, icon: square, 'icon@2x': square, 'icon@3x': square };
  brand.config.brand_identity_assets = { wallet_icon: 'seeded' };
  await db.updateBrand(brandId, { config: brand.config });

  const tpl = await db.getTemplate(templateId);
  tpl.style = { ...(tpl.style || {}), images: { strip } };
  await db.updateTemplate(templateId, { style: tpl.style });

  const fresh = await db.getBrand(brandId);
  const freshTpl = await db.getTemplate(templateId);
  const pass = await db.createPassInstance({
    brand_id: brandId, template_id: templateId, serial_number: 'SN-IMGREQ-2', field_values: {},
  });
  const buf = await createPkpass(freshTpl, pass, fresh, { requireBrandImages: true });
  assert.ok(buf.length > 1000, 'il .pkpass viene prodotto');
});

test("nemmeno dal back office nasce un pass senza immagini", async () => {
  // Questo percorso creava il pass senza controllare nulla, e restava pure scaricabile
  // con la grafica di ripiego: la falla che vanificava tutto il resto.
  const naked = await db.createBrand({ name: 'Itest Img Req 3', slug: SLUG + '-3', config: { product_line: 'ads' } });
  const tpl = await db.createTemplate({ brand_id: naked.id, name: 'T3', pass_type: 'storeCard', style: {}, fields: {} });
  const res = await fetch(`${base}/api/v1/passes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ brand_id: naked.id, template_id: tpl.id }),
  });
  assert.equal(res.status, 422);
  const body = await res.json();
  assert.equal(body.code, 'brand_images_missing');
  // all'operatore si dice cosa manca: è lui che può rimediare
  assert.match(body.error, /logo/);
  assert.match(body.error, /Template Pass/);

  const passes = await db.listPasses(naked.id);
  assert.equal(passes.length, 0, 'e non resta un pass orfano a database');
});

test("sulla landing il consumatore non legge gergo da back office", async () => {
  // Il brand è di nuovo senza immagini: l'iscrizione pubblica deve fallire con onestà,
  // senza però promettere "riprova tra poco" (riprovare non cambierebbe nulla) e senza
  // dire a un cliente finale di aprire Template Pass.
  const naked = await db.createBrand({ name: 'Itest Img Req 2', slug: SLUG + '-2', config: { product_line: 'ads' } });
  await db.createTemplate({ brand_id: naked.id, name: 'T2', pass_type: 'storeCard', style: {}, fields: {} });

  const res = await fetch(`${base}/api/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brand_slug: SLUG + '-2', email: 'itest@example.com', first_name: 'Itest' }),
  });
  assert.equal(res.status, 422, 'non è un errore del server: è il brand incompleto');
  const body = await res.json();
  assert.doesNotMatch(body.error, /Template Pass|icona notifica|strip/i, 'niente gergo interno al consumatore');
  assert.doesNotMatch(body.error, /riprova/i, 'niente false promesse: riprovare non aiuta');
});
