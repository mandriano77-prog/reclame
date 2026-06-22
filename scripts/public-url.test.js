'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const BASE_URL_PATH = path.join(__dirname, '../src/engine/base-url.js');

function loadBaseUrl() {
  delete require.cache[require.resolve(BASE_URL_PATH)];
  return require(BASE_URL_PATH);
}

function withEnv(overrides, fn) {
  const keys = [
    'PUBLIC_BASE_URL',
    'BASE_URL',
    'CUSTOM_DOMAIN',
    'DASHBOARD_PRODUCT_LINE',
    'PRODUCT_BRAND_NAME',
    'PORT'
  ];
  const saved = {};
  for (const key of keys) {
    saved[key] = process.env[key];
    if (Object.prototype.hasOwnProperty.call(overrides, key)) {
      if (overrides[key] == null) delete process.env[key];
      else process.env[key] = overrides[key];
    } else {
      delete process.env[key];
    }
  }
  try {
    return fn();
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    delete require.cache[require.resolve(BASE_URL_PATH)];
  }
}

test('resolveBaseUrlFromEnv prefers PUBLIC_BASE_URL', () => {
  withEnv({
    PUBLIC_BASE_URL: 'https://wallet.filodiretto.app',
    CUSTOM_DOMAIN: 'studio.filodiretto.app'
  }, () => {
    const { resolveBaseUrlFromEnv } = loadBaseUrl();
    assert.equal(resolveBaseUrlFromEnv(), 'https://wallet.filodiretto.app');
  });
});

test('buildPublicLandingUrl uses env base + slug', () => {
  withEnv({
    CUSTOM_DOMAIN: 'studio.filodiretto.app',
    DASHBOARD_PRODUCT_LINE: 'hr'
  }, () => {
    const { buildPublicLandingUrl } = loadBaseUrl();
    assert.equal(buildPublicLandingUrl('acme-corp'), 'https://studio.filodiretto.app/acme-corp');
  });
});

test('getProductBrandName defaults to FiloDiretto on HR line', () => {
  withEnv({ DASHBOARD_PRODUCT_LINE: 'hr' }, () => {
    const { getProductBrandName } = loadBaseUrl();
    assert.equal(getProductBrandName(), 'FiloDiretto');
  });
});
