'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  PACKAGE_CATALOG,
  FORMAT_KEYS,
  listPackages,
  getPackage,
  normalizePackage,
  getBrandPackages,
} = require('../src/engine/reclame-commercial');

test('listPackages() with no brand returns the frozen presets', () => {
  const presets = listPackages();
  assert.equal(presets.length, Object.keys(PACKAGE_CATALOG).length);
  assert.deepEqual(presets, Object.values(PACKAGE_CATALOG));
});

test('listPackages(brand) falls back to presets when no custom catalog', () => {
  assert.deepEqual(listPackages({ config: {} }), Object.values(PACKAGE_CATALOG));
  assert.deepEqual(listPackages({ config: { commercial_packages: [] } }), Object.values(PACKAGE_CATALOG));
});

test('normalizePackage clamps, defaults and slugifies', () => {
  const norm = normalizePackage({
    key: 'Flash Weekend!',
    label: '  Flash Weekend  ',
    description: 'x'.repeat(400),
    inventory: { push_lockscreen: '99999', hub_sponsored: -5, geofence_recall: 3 },
    suggested_price_cents: '300000',
  }, 0);
  assert.equal(norm.key, 'flashweekend'); // lowercased, non [a-z0-9_-] stripped (space + !)
  assert.equal(norm.label, 'Flash Weekend');
  assert.equal(norm.description.length, 160);
  assert.equal(norm.inventory.push_lockscreen, 9999); // clamped to max
  assert.equal(norm.inventory.hub_sponsored, 0); // negative -> 0
  assert.equal(norm.inventory.geofence_recall, 3);
  assert.equal(norm.inventory.coupon_cpa, 0); // missing -> 0
  assert.equal(norm.suggested_price_cents, 300000);
  // every format key is present
  FORMAT_KEYS.forEach((f) => assert.ok(f in norm.inventory));
});

test('normalizePackage derives a stable slug from the label when no key given', () => {
  const norm = normalizePackage({ label: 'No Key', inventory: { push_lockscreen: 1 } }, 2);
  assert.equal(norm.key, 'no_key');
});

test('normalizePackage falls back to pkg_N only when key and label are both empty', () => {
  const norm = normalizePackage({ inventory: { push_lockscreen: 1 } }, 2);
  assert.equal(norm.key, 'pkg_3');
});

test('normalizePackage clamps an absurd price to the ceiling', () => {
  const norm = normalizePackage({ key: 'x', label: 'X', suggested_price_cents: 999999999999 }, 0);
  assert.equal(norm.suggested_price_cents, 100000000);
});

test('getBrandPackages drops empty packages and de-duplicates by key', () => {
  const brand = {
    config: {
      commercial_packages: [
        { key: 'flash', label: 'Flash', inventory: { push_lockscreen: 5 } },
        { key: 'empty', label: 'Empty', inventory: {} }, // no slots -> dropped
        { key: 'flash', label: 'Dup', inventory: { hub_sponsored: 2 } }, // dup key -> dropped
      ],
    },
  };
  const pkgs = getBrandPackages(brand);
  assert.equal(pkgs.length, 1);
  assert.equal(pkgs[0].key, 'flash');
});

test('getBrandPackages returns null when nothing survives validation', () => {
  const brand = { config: { commercial_packages: [{ key: 'x', label: 'X', inventory: {} }] } };
  assert.equal(getBrandPackages(brand), null);
});

test('getPackage is brand-aware', () => {
  const brand = {
    config: { commercial_packages: [{ key: 'flash', label: 'Flash', inventory: { push_lockscreen: 5 } }] },
  };
  assert.equal(getPackage(brand, 'flash')?.key, 'flash');
  assert.equal(getPackage(brand, 'FLASH')?.key, 'flash'); // case-insensitive
  // a preset key that is not in the custom catalog is not found for a custom brand
  const firstPreset = Object.keys(PACKAGE_CATALOG)[0];
  assert.equal(getPackage(brand, firstPreset), null);
  // but a brand without a custom catalog resolves presets
  assert.equal(getPackage({ config: {} }, firstPreset)?.key, firstPreset);
});
