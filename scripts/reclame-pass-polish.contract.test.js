'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const passkit = fs.readFileSync(path.join(root, 'src/engine/passkit.js'), 'utf8');
const portalLink = fs.readFileSync(path.join(root, 'src/engine/portal-pass-link.js'), 'utf8');
const thankYou = fs.readFileSync(path.join(root, 'src/engine/thank-you-html.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'src/dashboard/index.html'), 'utf8');
const productLine = require('../src/engine/pass-product-line');

test('Ads brand skips portal and personal area links', () => {
  const brand = { config: { product_line: 'ads' } };
  assert.equal(productLine.isPortalPassBrand(brand), false);
  assert.equal(productLine.isPersonalAreaBackLink('Area personale', 'https://example.com/portal/x'), true);
  assert.match(passkit, /isPortalPassBrand\(brand\)/);
  assert.match(passkit, /omitAltText: !useHrBack/);
  assert.match(portalLink, /isPortalPassBrand\(brand\)/);
});

test('pass back link tracking uses /api/v1 path', () => {
  assert.match(passkit, /\/api\/v1\/track\/pass-link/);
  assert.match(passkit, /attributedValue/);
  assert.match(passkit, /pushBackMode/);
  assert.match(passkit, /ctaOnly/);
  assert.match(passkit, /slice\(0, 1200\)/);
});

test('Thank-you page hides portal CTA for non-HR brands', () => {
  assert.match(thankYou, /showPortal/);
  assert.match(thankYou, /Pass aggiunto/);
});

test('push form hides extra fields on A2W shell', () => {
  assert.match(indexHtml, /a2w-push-field--hidden/);
  assert.match(indexHtml, /Testo promozione/);
});
