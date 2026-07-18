'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const coupon = fs.readFileSync(path.join(root, 'src/engine/coupon-redemption.js'), 'utf8');
const routes = fs.readFileSync(path.join(root, 'src/api/routes.js'), 'utf8');
const pushDispatch = fs.readFileSync(path.join(root, 'src/engine/push-dispatch.js'), 'utf8');
const holderEvents = fs.readFileSync(path.join(root, 'src/engine/holder-events.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'src/dashboard/index.html'), 'utf8');
const serverJs = fs.readFileSync(path.join(root, 'src/server.js'), 'utf8');
const cashierJs = fs.readFileSync(path.join(root, 'src/cashier/cashier.js'), 'utf8');

test('coupon redemption engine exposes preview and confirm', () => {
  assert.match(coupon, /previewCouponRedemption/);
  assert.match(coupon, /confirmCouponRedemption/);
  assert.match(coupon, /coupon_redeemed/);
  assert.match(coupon, /coupon_redemptions/);
});

test('API exposes redeem and cashier endpoints', () => {
  assert.match(routes, /router\.post\('\/redeem\/preview'/);
  assert.match(routes, /router\.post\('\/redeem\/confirm'/);
  assert.match(routes, /\/brands\/:brand_id\/cashier'/);
});

test('push dispatch marks coupon redeemable on announcement', () => {
  assert.match(pushDispatch, /coupon_redeemable/);
  assert.match(pushDispatch, /offer_id: offerId/);
  assert.match(pushDispatch, /issueCodesForPush/);
});

test('holder insights include closed loop metrics', () => {
  assert.match(holderEvents, /coupon_redemptions/);
  assert.match(holderEvents, /closed_loop/);
});

test('dashboard and server expose cashier UX', () => {
  // pushCouponRedeemable (il tick "rendi riscattabile") è stato rimosso: link CTA e codice
  // riscatto confondevano insieme sul retro del pass, quindi ora sono un radio esclusivo
  // (pushBackMode: none/link/coupon) — scegliere "coupon" + un negozio è già, di per sé,
  // la scelta di generare il codice. pushCouponMerchant resta: è il negozio del riscatto.
  assert.match(indexHtml, /name="pushBackMode"/);
  assert.match(indexHtml, /pushCouponMerchant/);
  assert.match(indexHtml, /audienceClosedLoopStats/);
  assert.match(indexHtml, /loadCashierSetup/);
  assert.match(serverJs, /\/cashier/);
  assert.match(cashierJs, /checkout_code/);
});

test('resolveActiveCouponOffer respects redeemable flag', () => {
  const { resolveActiveCouponOffer } = require('../src/engine/coupon-redemption');
  const off = resolveActiveCouponOffer({ config: { pushAnnouncement: { title: 'X', message: 'Y', coupon: { redeemable: false } } } });
  assert.equal(off, null);
  const on = resolveActiveCouponOffer({ config: { pushAnnouncement: { title: 'X', message: 'Y', ts: 1 } } });
  assert.ok(on && on.offer_id);
});
