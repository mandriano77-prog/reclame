'use strict';

// Integration test for booking-driven HUB sponsorship: a confirmed `hub_sponsored`
// booking features its merchant for the campaign window; cancelling or expiry unfeatures it.
// Requires a DB: `npm run db:test:up && npm run test:integration`.

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgres://reclame:reclame@127.0.0.1:55432/reclame_test';
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.JWT_SECRET = 'itest-secret';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const db = require('../../src/db');
const {
  createCommercialBooking,
  updateBookingStatus,
} = require('../../src/engine/reclame-commercial');

const SLUG = 'itest-hubspon-brand';
let brandId;
let merchantId;

function futureIso(days) {
  return new Date(Date.now() + days * 86400000).toISOString();
}

async function cleanupBrand() {
  const r = await db.pool.query('SELECT id FROM brands WHERE slug = $1', [SLUG]).catch(() => ({ rows: [] }));
  for (const { id } of r.rows) {
    for (const tbl of ['commercial_billing_entries', 'commercial_bookings', 'merchants']) {
      await db.pool.query(`DELETE FROM ${tbl} WHERE brand_id = $1`, [id]).catch(() => {});
    }
  }
  await db.pool.query('DELETE FROM brands WHERE slug = $1', [SLUG]).catch(() => {});
}

before(async () => {
  await db.getDb();
  await cleanupBrand();
  const brand = await db.createBrand({ name: 'Itest HubSpon', slug: SLUG, config: {} });
  brandId = brand.id;
  const merchant = await db.createMerchant({
    brand_id: brandId, name: 'Sponsor Me', category: 'retail', discount_label: '-30%', active: true,
  });
  merchantId = merchant.id;
});

after(async () => {
  await cleanupBrand();
  await db.pool.end().catch(() => {});
});

async function isMerchantFeatured() {
  const rows = await db.listActiveMerchantsForHub(brandId);
  const m = rows.find((x) => x.id === merchantId);
  return !!(m && m.sponsored);
}

test('hub_sponsored booking requires a merchant_id', async () => {
  await assert.rejects(
    () => createCommercialBooking(brandId, { tenant_name: 'X', package_key: 'starter', format: 'hub_sponsored', start_at: futureIso(0) }),
    /merchant/i
  );
});

test('a confirmed hub_sponsored booking features the merchant for the window', async () => {
  assert.equal(await isMerchantFeatured(), false, 'not featured before booking');
  const booking = await createCommercialBooking(brandId, {
    tenant_name: 'Nike', package_key: 'starter', format: 'hub_sponsored',
    merchant_id: merchantId, start_at: futureIso(-1), end_at: futureIso(7),
  });
  assert.equal(await isMerchantFeatured(), true, 'featured while the campaign is live');
  // cancelling it removes the featuring
  await updateBookingStatus(brandId, booking.id, 'cancelled');
  assert.equal(await isMerchantFeatured(), false, 'unfeatured after cancel');
});

test('featuring expires at read time once the window has passed', async () => {
  const booking = await createCommercialBooking(brandId, {
    tenant_name: 'Adidas', package_key: 'starter', format: 'hub_sponsored',
    merchant_id: merchantId, start_at: futureIso(-2), end_at: futureIso(1),
  });
  assert.equal(await isMerchantFeatured(), true);
  // simulate the campaign window ending: sponsored flag stays TRUE but sponsored_until is in the past
  await db.pool.query('UPDATE merchants SET sponsored_until = NOW() - INTERVAL \'1 hour\' WHERE id = $1', [merchantId]);
  assert.equal(await isMerchantFeatured(), false, 'expired sponsorship is not featured at read time');
  await updateBookingStatus(brandId, booking.id, 'cancelled').catch(() => {});
});

test('a future-dated campaign does not feature the merchant until it starts', async () => {
  const booking = await createCommercialBooking(brandId, {
    tenant_name: 'Future', package_key: 'starter', format: 'hub_sponsored',
    merchant_id: merchantId, start_at: futureIso(5), end_at: futureIso(20),
  });
  // flag is set but the window hasn't started → not featured at read time yet
  assert.equal(await isMerchantFeatured(), false, 'not featured before start_at');
  await updateBookingStatus(brandId, booking.id, 'cancelled');
});

test('a manual sponsorship survives an unrelated booking being cancelled', async () => {
  // manual featuring: sponsored TRUE with no window (sponsored_from NULL)
  await db.pool.query(
    'UPDATE merchants SET sponsored = TRUE, sponsored_from = NULL, sponsored_until = NULL WHERE id = $1',
    [merchantId]
  );
  assert.equal(await isMerchantFeatured(), true, 'manual featuring active');
  // add then cancel a booking for the same merchant
  const booking = await createCommercialBooking(brandId, {
    tenant_name: 'Temp', package_key: 'starter', format: 'hub_sponsored',
    merchant_id: merchantId, start_at: futureIso(-1), end_at: futureIso(2),
  });
  await updateBookingStatus(brandId, booking.id, 'cancelled');
  assert.equal(await isMerchantFeatured(), true, 'manual featuring preserved after booking cancel');
  // reset for isolation
  await db.pool.query('UPDATE merchants SET sponsored = FALSE, sponsored_from = NULL, sponsored_until = NULL WHERE id = $1', [merchantId]);
});

test('overlapping bookings keep the merchant featured until the last one ends', async () => {
  const b1 = await createCommercialBooking(brandId, {
    tenant_name: 'Puma', package_key: 'starter', format: 'hub_sponsored',
    merchant_id: merchantId, start_at: futureIso(-1), end_at: futureIso(3),
  });
  const b2 = await createCommercialBooking(brandId, {
    tenant_name: 'Reebok', package_key: 'starter', format: 'hub_sponsored',
    merchant_id: merchantId, start_at: futureIso(-1), end_at: futureIso(10),
  });
  assert.equal(await isMerchantFeatured(), true);
  // cancel the first — still featured because b2 is active
  await updateBookingStatus(brandId, b1.id, 'cancelled');
  assert.equal(await isMerchantFeatured(), true, 'still featured while another booking is live');
  // cancel the second — now unfeatured
  await updateBookingStatus(brandId, b2.id, 'cancelled');
  assert.equal(await isMerchantFeatured(), false, 'unfeatured once the last booking is cancelled');
});
