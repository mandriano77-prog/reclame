'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const MOD = path.join(__dirname, '../src/engine/google-wallet.js');

function loadGoogleWallet(overrides = {}) {
  const keys = ['GOOGLE_WALLET_ISSUER_ID', 'GOOGLE_WALLET_REVIEW_STATUS', 'GOOGLE_WALLET_PASS_KIND'];
  const saved = {};
  for (const k of keys) {
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
      for (const k of keys) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      }
      delete require.cache[require.resolve(MOD)];
    }
  };
}

test('sanitizeSlugForClassId lowercases and normalizes', () => {
  const { mod, restore } = loadGoogleWallet({ GOOGLE_WALLET_ISSUER_ID: '3388000000023116539' });
  try {
    assert.equal(mod.sanitizeSlugForClassId('Motor_K'), 'motor_k');
    assert.equal(mod.sanitizeSlugForClassId('  Motor-K  '), 'motor-k');
    const brand = { slug: 'Motor_K' };
    const template = { id: '3ab88300-aaaa-bbbb-cccc-ddddeeeeffff' };
    assert.equal(
      mod.buildGenericClassId(brand, template),
      '3388000000023116539.motor_k_3ab88300-aaaa-bbbb-cccc-ddddeeeeffff'
    );
    assert.equal(
      mod.buildLoyaltyClassId(brand, template),
      '3388000000023116539.loyalty_motor_k_3ab88300-aaaa-bbbb-cccc-ddddeeeeffff'
    );
  } finally {
    restore();
  }
});

test('getReviewStatus respects env and falls back', () => {
  const { mod, restore } = loadGoogleWallet({
    GOOGLE_WALLET_ISSUER_ID: '1',
    GOOGLE_WALLET_REVIEW_STATUS: 'APPROVED'
  });
  try {
    assert.equal(mod.getReviewStatus(), 'APPROVED');
  } finally {
    restore();
  }

  const { mod: mod2, restore: restore2 } = loadGoogleWallet({
    GOOGLE_WALLET_ISSUER_ID: '1',
    GOOGLE_WALLET_REVIEW_STATUS: 'invalid'
  });
  try {
    assert.equal(mod2.getReviewStatus(), 'UNDER_REVIEW');
  } finally {
    restore2();
  }
});

test('formatGoogleWalletError maps classNotFound to 422', () => {
  const { mod, restore } = loadGoogleWallet({ GOOGLE_WALLET_ISSUER_ID: '1' });
  try {
    const err = new Error('Google Wallet API 404: {"error":{"errors":[{"reason":"classNotFound"}]}}');
    err.statusCode = 404;
    err.body = { error: { errors: [{ reason: 'classNotFound' }] } };
    const mapped = mod.formatGoogleWalletError(err);
    assert.equal(mapped.status, 422);
    assert.equal(mapped.code, 'class_not_found');
    assert.match(mapped.error, /Template non ancora registrato/i);
  } finally {
    restore();
  }
});

test('buildPassClass: brand.config.backgroundColor vince su template.style', () => {
  const { mod, restore } = loadGoogleWallet({
    GOOGLE_WALLET_ISSUER_ID: '3388000000023116539',
    GOOGLE_WALLET_PASS_KIND: null
  });
  try {
    const template = { id: '3ab88300-aaaa-bbbb-cccc-ddddeeeeffff', style: { backgroundColor: '#654321' } };
    const withBrandColor = mod.buildPassClass(
      { slug: 'acme', name: 'Acme', config: { backgroundColor: '#123456' } },
      template
    );
    assert.equal(withBrandColor.hexBackgroundColor, '#123456');

    const templateOnly = mod.buildPassClass({ slug: 'acme', name: 'Acme', config: {} }, template);
    assert.equal(templateOnly.hexBackgroundColor, '#654321');

    const fallback = mod.buildPassClass(
      { slug: 'acme', name: 'Acme', config: {} },
      { id: '3ab88300-aaaa-bbbb-cccc-ddddeeeeffff' }
    );
    assert.equal(fallback.hexBackgroundColor, '#0D0B1A');
  } finally {
    restore();
  }
});

test('pass object usa brand.config.backgroundColor prima del template (contract)', () => {
  const fs = require('fs');
  const src = fs.readFileSync(MOD, 'utf8');
  const matches = src.match(/rgbToHex\(brand\?\.config\?\.backgroundColor \|\| template\.style\?\.backgroundColor \|\| '#0D0B1A'\)/g) || [];
  assert.ok(matches.length >= 2, 'brand.config precedence su class e object');
  assert.doesNotMatch(src, /rgbToHex\(template\.style\?\.backgroundColor \|\| '#0D0B1A'\)/);
});

test('pass route ensures class before object', () => {
  const fs = require('fs');
  const routes = fs.readFileSync(path.join(__dirname, '../src/api/routes.js'), 'utf8');
  assert.match(routes, /ensurePassReadyOnServer\(brand, template, passObject\)/);
  assert.match(routes, /syncGoogleWalletClassForTemplate/);
});
