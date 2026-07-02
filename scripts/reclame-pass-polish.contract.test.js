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

test('Custom logo omits logoText to avoid overlapping brand name', () => {
  assert.match(passkit, /brandHasWalletLogoAsset/);
  assert.match(passkit, /omitLogoText = hasCustomLogo/);
});

test('Thank-you page hides portal CTA for non-HR brands', () => {
  assert.match(thankYou, /showPortal/);
  assert.match(thankYou, /Pass aggiunto/);
});
