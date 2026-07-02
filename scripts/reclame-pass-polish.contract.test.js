'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const passkit = fs.readFileSync(path.join(root, 'src/engine/passkit.js'), 'utf8');
const portalLink = fs.readFileSync(path.join(root, 'src/engine/portal-pass-link.js'), 'utf8');
const thankYou = fs.readFileSync(path.join(root, 'src/engine/thank-you-html.js'), 'utf8');
const productLine = require('../src/engine/pass-product-line');

test('Ads brand skips portal and personal area links', () => {
  const brand = { config: { product_line: 'ads' } };
  assert.equal(productLine.isPortalPassBrand(brand), false);
  assert.equal(productLine.isPersonalAreaBackLink('Area personale', 'https://example.com/portal/x'), true);
  assert.match(passkit, /isPortalPassBrand\(brand\)/);
  assert.match(passkit, /omitAltText: !useHrBack/);
  assert.match(portalLink, /isPortalPassBrand\(brand\)/);
});

test('passkit reads per-pass dynamic link for push link out on back', () => {
  assert.match(passkit, /function resolveDynamicPassLink/);
  assert.match(passkit, /resolveBackLink1\(brandConfig, instance/);
});

test('Thank-you page hides portal CTA for non-HR brands', () => {
  assert.match(thankYou, /showPortal/);
  assert.match(thankYou, /Pass aggiunto/);
});

test('push UX shows pass back preview with link out', () => {
  const pushUx = fs.readFileSync(path.join(root, 'src/dashboard/js/a2w-push-ux.js'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(root, 'src/dashboard/index.html'), 'utf8');
  assert.match(pushUx, /a2wPushPassPreview/);
  assert.match(pushUx, /syncPushPassPreview/);
  assert.match(indexHtml, /pushBackSetupBlock/);
  assert.match(indexHtml, /Link out — URL/);
});
