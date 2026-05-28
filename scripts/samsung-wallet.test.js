'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const MOD = path.join(__dirname, '../src/engine/samsung-wallet.js');

const ENV_KEYS = [
  'SAMSUNG_WALLET_CARD_TYPE',
  'SAMSUNG_WALLET_CARD_SUBTYPE',
  'SAMSUNG_WALLET_DEFAULT_CC2',
  'SAMSUNG_WALLET_CARD_ID',
  'SAMSUNG_WALLET_CERTIFICATE_ID',
  'SAMSUNG_WALLET_PARTNER_ID',
  'CUSTOM_DOMAIN'
];

function loadSamsung(overrides = {}) {
  const saved = {};
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    if (Object.prototype.hasOwnProperty.call(overrides, k)) {
      if (overrides[k] == null) delete process.env[k];
      else process.env[k] = String(overrides[k]);
    }
  }
  delete require.cache[require.resolve(MOD)];
  const mod = require(MOD);
  return {
    mod,
    restore() {
      for (const k of ENV_KEYS) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      }
      delete require.cache[require.resolve(MOD)];
    }
  };
}

test('buildLoyaltyCardResponse uses coupon type and IT tsapi default', () => {
  const { mod, restore } = loadSamsung({
    SAMSUNG_WALLET_CARD_TYPE: 'coupon',
    SAMSUNG_WALLET_CARD_SUBTYPE: 'others',
    SAMSUNG_WALLET_DEFAULT_CC2: 'IT',
    SAMSUNG_WALLET_CARD_ID: 'test-card',
    SAMSUNG_WALLET_CERTIFICATE_ID: 'test',
    SAMSUNG_WALLET_PARTNER_ID: 'test',
    CUSTOM_DOMAIN: 'studio.ads2wallet.com'
  });

  try {
    const brand = { id: 'b1', name: 'Motor K' };
    const template = { name: 'Promo Estate', style: { backgroundColor: '#112233' } };
    const instance = {
      serial_number: 'SN-001',
      field_values: { subtitle: 'Sconto 20%', expiry: '2030-12-31T23:59:59.000Z' }
    };

    const result = mod.buildLoyaltyCardResponse(brand, template, instance, 'refid-test', 'ACTIVE');
    assert.equal(result.card.type, 'coupon');
    assert.equal(result.card.subType, 'others');
    const attrs = result.card.data[0].attributes;
    assert.ok(attrs['barcode.value']);
    assert.equal(attrs.mainTitle, 'Promo Estate');
    assert.equal(attrs.subTitle1, 'Sconto 20%');
    assert.ok(typeof attrs.expiry === 'number' && attrs.expiry > 0);

    assert.equal(mod.buildTsapiBaseUrl(), 'https://it-tsapi.walletsvc.samsung.com');
    assert.equal(mod.buildTsapiBaseUrl('de'), 'https://de-tsapi.walletsvc.samsung.com');
  } finally {
    restore();
  }
});
