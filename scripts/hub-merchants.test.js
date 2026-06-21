'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  parseMerchantCsvText,
  rowToMerchantPayload,
  validateMerchantRow
} = require('../src/engine/hub-csv-import');
const {
  signHubToken,
  verifyHubToken,
  buildHubUrl
} = require('../src/engine/hub-jwt');

const DB_SOURCE = fs.readFileSync(path.join(__dirname, '../src/db/index.js'), 'utf8');

test('getDb schema includes HUB Convenzioni tables', () => {
  for (const table of ['merchants', 'merchant_locations', 'convention_activations', 'hub_settings']) {
    assert.match(DB_SOURCE, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
  assert.match(DB_SOURCE, /idx_merchants_brand/);
  assert.match(DB_SOURCE, /idx_activations_created/);
});

test('CSV parser validates required columns and parses semicolon rows', () => {
  const csv = [
    'merchant_name;category;discount_label;address;city',
    'Virgin Active;fitness;-15% abbonamento;Via Sarca 22;Milano'
  ].join('\n');

  const rows = parseMerchantCsvText(csv);
  assert.equal(rows.length, 1);
  const payload = rowToMerchantPayload(rows[0]);
  assert.equal(payload.name, 'Virgin Active');
  assert.equal(payload.category, 'fitness');
  assert.equal(payload.discount_label, '-15% abbonamento');
  assert.equal(validateMerchantRow(payload, 2), null);
});

test('CSV parser rejects missing required column', () => {
  const csv = 'merchant_name;category\nFoo;fitness\n';
  assert.throws(() => parseMerchantCsvText(csv), /discount_label/);
});

test('hub JWT sign and verify with 90d-style claims', () => {
  process.env.JWT_HUB_SECRET = 'test-hub-secret-for-unit-tests';
  const token = signHubToken({
    user_id: 'user-1',
    pass_serial: 'SN-123',
    brand_id: 'brand-abc'
  });
  assert.ok(token);
  const decoded = verifyHubToken(token);
  assert.ok(decoded);
  assert.equal(decoded.user_id, 'user-1');
  assert.equal(decoded.pass_serial, 'SN-123');
  assert.equal(decoded.brand_id, 'brand-abc');

  process.env.HUB_BASE_URL = 'https://hub.test.example';
  const url = buildHubUrl(token, 'acme');
  assert.match(url, /^https:\/\/hub\.test\.example\/\?/);
  assert.match(url, /token=/);
  assert.match(url, /brand=acme/);
});

test('hub JWT rejects tampered token', () => {
  process.env.JWT_HUB_SECRET = 'test-hub-secret-for-unit-tests';
  const token = signHubToken({ pass_serial: 'SN-1', brand_id: 'b1' });
  const bad = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a');
  assert.equal(verifyHubToken(bad), null);
});
