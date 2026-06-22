'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const HUB_JWT_PATH = path.join(__dirname, '../src/engine/hub-jwt.js');

function loadHubJwt() {
  delete require.cache[require.resolve(HUB_JWT_PATH)];
  return require(HUB_JWT_PATH);
}

function withEnv(overrides, fn) {
  const saved = {};
  for (const key of ['HUB_BASE_URL', 'CUSTOM_DOMAIN']) {
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
    for (const key of ['HUB_BASE_URL', 'CUSTOM_DOMAIN']) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    delete require.cache[require.resolve(HUB_JWT_PATH)];
  }
}

test('getHubBaseUrl uses CUSTOM_DOMAIN/hub when HUB_BASE_URL unset', () => {
  withEnv({ CUSTOM_DOMAIN: 'studio.filodiretto.app' }, () => {
    const { getHubBaseUrl } = loadHubJwt();
    assert.equal(getHubBaseUrl(), 'https://studio.filodiretto.app/hub');
  });
});

test('getHubBaseUrl prefers explicit HUB_BASE_URL', () => {
  withEnv({
    HUB_BASE_URL: 'https://custom.example/hub/',
    CUSTOM_DOMAIN: 'studio.filodiretto.app'
  }, () => {
    const { getHubBaseUrl } = loadHubJwt();
    assert.equal(getHubBaseUrl(), 'https://custom.example/hub');
  });
});

test('buildHubAppUrl produces correct path prefix for me app', () => {
  withEnv({ CUSTOM_DOMAIN: 'studio.filodiretto.app' }, () => {
    const { buildHubAppUrl } = loadHubJwt();
    const url = buildHubAppUrl('tok-abc', 'acme', 'me');
    assert.equal(
      url,
      'https://studio.filodiretto.app/hub/me?token=tok-abc&brand=acme'
    );
  });
});

test('buildHubAppUrl produces correct conv and pga paths', () => {
  withEnv({ CUSTOM_DOMAIN: 'studio.filodiretto.app' }, () => {
    const { buildHubUrl, buildHubAppUrl } = loadHubJwt();
    assert.equal(
      buildHubUrl('tok', 'brand-slug'),
      'https://studio.filodiretto.app/hub/conv?token=tok&brand=brand-slug'
    );
    assert.equal(
      buildHubAppUrl('tok', 'brand-slug', 'pga'),
      'https://studio.filodiretto.app/hub/pga?token=tok&brand=brand-slug'
    );
  });
});

test('getHubBaseUrl falls back when no env vars set', () => {
  withEnv({}, () => {
    const { getHubBaseUrl } = loadHubJwt();
    assert.equal(getHubBaseUrl(), 'https://hub.filodiretto.app');
  });
});
