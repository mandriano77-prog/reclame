'use strict';

// Locks the fix: a running push promo (pushBackMode) used to hide the HUB link from the
// pass back. On a Reclame (ads) pass the HUB — the retail-media surface — must always be
// reachable, promo or not.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { generatePassJson } = require('../src/engine/passkit');

const HUB_URL = 'https://example.test/hub/conv?token=tok&brand=acme';

function adsBrand(extraConfig = {}) {
  return {
    id: 'b1',
    name: 'Grandi Magazzini',
    slug: 'grandi-magazzini',
    config: { product_line: 'ads', ...extraConfig }
  };
}

const template = { pass_type: 'storeCard', style: {}, fields: [] };
const instance = { id: 'p1', serial_number: 'SN-1', field_values: {} };

function backFieldKeys(passJson) {
  const back = (passJson.storeCard && passJson.storeCard.backFields) || [];
  return back.map((f) => f.key);
}

test('ads pass back carries the HUB link when no push promo is running', () => {
  const passJson = generatePassJson(template, instance, adsBrand(), { hubUrl: HUB_URL });
  assert.ok(backFieldKeys(passJson).includes('hub_offers'), 'hub_offers link present');
});

test('ads pass back STILL carries the HUB link while a push promo is running', () => {
  const brand = adsBrand({ pushAnnouncement: { message: 'TEST PROMO' } });
  const passJson = generatePassJson(template, instance, brand, { hubUrl: HUB_URL });
  const keys = backFieldKeys(passJson);
  assert.ok(keys.includes('announcement_full'), 'the promo text is on the back');
  assert.ok(keys.includes('hub_offers'), 'the HUB link is NOT suppressed by the promo');
});

test('the HUB link is a "Scopri le offerte" CTA whose tracked url lands on the hub', () => {
  const brand = adsBrand({ pushAnnouncement: { message: 'TEST PROMO' } });
  const passJson = generatePassJson(template, instance, brand, { hubUrl: HUB_URL });
  const back = passJson.storeCard.backFields.find((f) => f.key === 'hub_offers');
  assert.ok(back, 'hub_offers field exists');
  assert.equal(back.value, 'Scopri le offerte');
  // the href is our click-tracking endpoint, with the hub url as the encoded destination
  assert.match(back.attributedValue, /\/track\/pass-link/);
  assert.match(back.attributedValue, /to=https%3A%2F%2Fexample\.test%2Fhub%2Fconv/);
});

test('no HUB link when the pass has no hub url', () => {
  const passJson = generatePassJson(template, instance, adsBrand(), {});
  assert.ok(!backFieldKeys(passJson).includes('hub_offers'));
});
