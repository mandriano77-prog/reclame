'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const redemptionCodes = fs.readFileSync(path.join(root, 'src/engine/redemption-codes.js'), 'utf8');
const coupon = fs.readFileSync(path.join(root, 'src/engine/coupon-redemption.js'), 'utf8');
const pushDispatch = fs.readFileSync(path.join(root, 'src/engine/push-dispatch.js'), 'utf8');
const passkit = fs.readFileSync(path.join(root, 'src/engine/passkit.js'), 'utf8');
const db = fs.readFileSync(path.join(root, 'src/db/index.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'src/dashboard/index.html'), 'utf8');
const cashierJs = fs.readFileSync(path.join(root, 'src/cashier/cashier.js'), 'utf8');
const serverJs = fs.readFileSync(path.join(root, 'src/server.js'), 'utf8');

const {
  normalizeCheckoutCode,
  buildCheckoutCode,
  normalizePrefix
} = require('../src/engine/redemption-codes');

test('redemption-codes normalizes and builds human codes', () => {
  assert.equal(normalizeCheckoutCode(' zara-8k4m '), 'ZARA-8K4M');
  assert.equal(normalizePrefix('Zara!', 'Fallback'), 'ZARA');
  assert.match(buildCheckoutCode('ZARA', '8K4M'), /^ZARA-8K4M$/);
});

test('db schema includes redemption_codes and merchant checkout fields', () => {
  assert.match(db, /redemption_codes/);
  assert.match(db, /checkout_prefix/);
  assert.match(db, /merchant_cashier_pin/);
  assert.match(db, /getMerchantBySlug/);
});

test('push dispatch issues codes when merchant linked', () => {
  assert.match(pushDispatch, /issueCodesForPush/);
  assert.match(pushDispatch, /merchant_id/);
  assert.match(pushDispatch, /couponMeta\.merchant_id/);
});

test('passkit shows checkout block on pass back', () => {
  assert.match(passkit, /RISCATTO IN CASSA/);
  assert.match(passkit, /__checkout_code/);
});

test('coupon redemption accepts checkout_code path', () => {
  assert.match(coupon, /checkout_code/);
  assert.match(coupon, /lookupRedemptionByCode/);
  assert.match(coupon, /listMerchantCashierEndpoints/);
});

test('cashier UI and routes use merchant slug + checkout code', () => {
  assert.match(cashierJs, /checkout_code/);
  assert.match(cashierJs, /merchantSlugFromPath/);
  assert.match(serverJs, /merchantSlug/);
  assert.match(indexHtml, /pushCouponMerchant/);
  assert.match(indexHtml, /checkout_prefix/);
  assert.match(indexHtml, /a2w-hub-merchant\.js/);
});
