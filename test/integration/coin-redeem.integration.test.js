'use strict';

// Coin reward redemption (Reclame): coins → single-use code → shown at the till.
// Guards the money-critical bits: atomic debit, one live code, single use, expiry refund.
// Requires a DB: `npm run db:test:up && npm run test:integration`.

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgres://reclame:reclame@127.0.0.1:55432/reclame_test';
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.JWT_SECRET = 'itest-secret';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const db = require('../../src/db');
const { app } = require('../../src/server');
const {
  redeemReward,
  previewCoinRedemption,
  confirmCoinRedemption,
  getActiveRedemption,
} = require('../../src/engine/coin-redeem');

let server;
let base;

const SLUG = 'itest-coinredeem';
const PIN = '4321';
const SERIAL = 'ITEST-COIN-SN-1';

let brandId;
let rewardId;

async function cleanupBrand() {
  const r = await db.pool.query('SELECT id FROM brands WHERE slug = $1', [SLUG]).catch(() => ({ rows: [] }));
  for (const { id } of r.rows) {
    for (const tbl of ['coin_redemptions', 'coin_ledger', 'coin_actions_config', 'experiences_catalog', 'pga_settings']) {
      await db.pool.query(`DELETE FROM ${tbl} WHERE brand_id = $1`, [id]).catch(() => {});
    }
  }
  await db.pool.query('DELETE FROM brands WHERE slug = $1', [SLUG]).catch(() => {});
}

async function credit(amount) {
  await db.insertCoinLedgerEntry({
    brand_id: brandId, pass_serial: SERIAL, action_key: 'itest_topup', coin_amount: amount,
  });
}

before(async () => {
  await db.getDb();
  await cleanupBrand();
  const brand = await db.createBrand({
    name: 'Itest Coin', slug: SLUG,
    config: { product_line: 'ads', cashier_pin: PIN },
  });
  brandId = brand.id;
  const reward = await db.createExperience({
    brand_id: brandId, key: 'caffe', name: 'Caffè omaggio', category: 'food',
    coin_cost: 100, active: true, internal: true, requires_booking: false,
  });
  rewardId = reward.id;

  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await cleanupBrand();
  if (server) await new Promise((r) => server.close(r));
  await db.pool.end().catch(() => {});
});

function till(path, body) {
  return fetch(`${base}/api/v1${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function balance() {
  const b = await db.getPassCoinBalance(brandId, SERIAL);
  return Number(b.balance || 0);
}

test('redeem is refused when the customer cannot afford the reward', async () => {
  await assert.rejects(
    () => redeemReward({ brandId, passSerial: SERIAL, experienceId: rewardId }),
    (err) => err.code === 'insufficient_coins'
  );
  assert.equal(await balance(), 0, 'no coins moved');
});

test('redeem debits the coins and mints a code', async () => {
  await credit(250);
  assert.equal(await balance(), 250);

  const out = await redeemReward({ brandId, passSerial: SERIAL, experienceId: rewardId });
  assert.ok(out.redemption.code && out.redemption.code.length === 8);
  assert.equal(out.redemption.status, 'pending');
  assert.equal(out.redemption.coins_spent, 100);
  assert.equal(await balance(), 150, 'coins debited exactly once');
  assert.ok(out.qr_url && out.qr_url.startsWith('data:image/'), 'a QR is produced');
});

test('only one live code at a time', async () => {
  await assert.rejects(
    () => redeemReward({ brandId, passSerial: SERIAL, experienceId: rewardId }),
    (err) => err.code === 'redemption_pending'
  );
  assert.equal(await balance(), 150, 'the refused attempt did not debit');
});

test('the till validates the code, and it burns on use', async () => {
  const active = await getActiveRedemption(brandId, SERIAL);
  const code = active.redemption.code;

  // wrong PIN is rejected but does not consume the code
  const badPin = await previewCoinRedemption({ brandSlug: SLUG, code, pin: '0000' });
  assert.equal(badPin.valid, false);
  assert.equal(badPin.code, 'pin_invalid');

  const preview = await previewCoinRedemption({ brandSlug: SLUG, code, pin: PIN });
  assert.equal(preview.valid, true);
  assert.equal(preview.kind, 'coin_reward');
  assert.equal(preview.reward_name, 'Caffè omaggio');

  const confirm = await confirmCoinRedemption({ brandSlug: SLUG, code, pin: PIN, storeLabel: 'Cassa 1' });
  assert.equal(confirm.valid, true);

  // second scan of the same code must fail — single use
  const again = await confirmCoinRedemption({ brandSlug: SLUG, code, pin: PIN });
  assert.equal(again.valid, false);
  assert.match(again.reason, /già ritirato|non più valido/i);

  assert.equal(await balance(), 150, 'using the code does not move coins again');
});

test('an unknown code is not ours — the coupon flow gets a shot at it', async () => {
  const out = await previewCoinRedemption({ brandSlug: SLUG, code: 'ZZZZZZZZ', pin: PIN });
  assert.equal(out, null);
});

test('an expired code refunds the coins', async () => {
  const before = await balance();
  const out = await redeemReward({ brandId, passSerial: SERIAL, experienceId: rewardId });
  assert.equal(await balance(), before - 100);

  // force it past its window
  await db.pool.query(
    "UPDATE coin_redemptions SET expires_at = NOW() - INTERVAL '1 minute' WHERE code = $1",
    [out.redemption.code]
  );

  const swept = await db.expireStaleCoinRedemptions(brandId);
  assert.ok(swept.expired >= 1);
  assert.equal(await balance(), before, 'coins came back');

  // and the dead code cannot be used at the till
  const preview = await previewCoinRedemption({ brandSlug: SLUG, code: out.redemption.code, pin: PIN });
  assert.equal(preview.valid, false);
  assert.match(preview.reason, /scadut/i);
});

test('a refunded customer can redeem again', async () => {
  const out = await redeemReward({ brandId, passSerial: SERIAL, experienceId: rewardId });
  assert.equal(out.redemption.status, 'pending');
});


test('the REAL till payload works: the cashier app sends a coin code as serial_number', async () => {
  // The till decides checkout_code vs serial_number by looking for a hyphen. Coupon codes have
  // one; coin codes don't — so a coin code arrives as `serial_number`. This is exactly the
  // shape the cashier app posts, and it must validate. (Testing the engine directly missed it.)
  // earlier tests may leave a live code — clear it so this one starts clean
  await db.pool.query("DELETE FROM coin_redemptions WHERE brand_id = $1 AND status = 'pending'", [brandId]);
  await credit(200);
  const out = await redeemReward({ brandId, passSerial: SERIAL, experienceId: rewardId });
  const code = out.redemption.code;
  assert.ok(!code.includes('-'), 'coin codes carry no hyphen — hence the routing trap');

  const prev = await till('/redeem/preview', { brand_slug: SLUG, serial_number: code, pin: PIN });
  assert.equal(prev.status, 200);
  const prevBody = await prev.json();
  assert.equal(prevBody.valid, true);
  assert.equal(prevBody.kind, 'coin_reward');
  assert.equal(prevBody.reward_name, 'Caffè omaggio');

  const conf = await till('/redeem/confirm', { brand_slug: SLUG, serial_number: code, pin: PIN, store_label: 'Cassa 2' });
  assert.equal(conf.status, 200);
  assert.equal((await conf.json()).valid, true);

  // burnt
  const again = await till('/redeem/confirm', { brand_slug: SLUG, serial_number: code, pin: PIN });
  assert.equal(again.status, 422);
  assert.equal((await again.json()).already_redeemed, true);
});

test('a bogus reward id is a 404, not a 500', async () => {
  await assert.rejects(
    () => redeemReward({ brandId, passSerial: SERIAL, experienceId: 'not-a-uuid' }),
    (err) => err.code === 'reward_unavailable'
  );
});
