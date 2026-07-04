'use strict';

// Guards the Reclame (a2w) HUB/Promozioni fix: the conventions section's interactivity lives in
// the HR bundle (fd-conventions.js), which the a2w shell never loads. a2w-conventions.js ports it.
// If it stops being loaded or stops defining switchConventionsTab, the section breaks again
// (tab click → "switchConventionsTab is not defined", dead table/buttons).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const conv = fs.readFileSync(path.join(root, 'src/dashboard/js/a2w-conventions.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'src/dashboard/index.html'), 'utf8');
const reclameCss = fs.readFileSync(path.join(root, 'src/dashboard/styles/a2w-reclame.css'), 'utf8');

test('a2w-conventions.js is loaded by the dashboard', () => {
  assert.match(indexHtml, /<script src="\/dashboard\/js\/a2w-conventions\.js"><\/script>/);
});

test('a2w-conventions defines the globals the section relies on', () => {
  assert.match(conv, /global\.switchConventionsTab\s*=/);
  assert.match(conv, /global\.loadConventionsHub\s*=/);
});

test('a2w-conventions only runs on the a2w shell', () => {
  assert.match(conv, /function isA2wShell\(\)/);
  assert.match(conv, /if \(!isA2wShell\(\)\) return;/);
});

test('a2w-conventions wires template download and CSV import', () => {
  assert.match(conv, /hub-merchant-import-template\.csv/);
  assert.match(conv, /hubMerchantTemplateBtn/);
  assert.match(conv, /hubGuideTemplateBtn/);
  assert.match(conv, /hubOnboardingTemplateBtn/);
  assert.match(conv, /\/merchants\/import-csv/);
});

test('a2w-conventions adds Content-Type so POST/PUT bodies parse', () => {
  assert.match(conv, /Content-Type/);
});

test('reclame CSS hides the duplicate HR "Promozioni" nav item on a2w', () => {
  assert.match(reclameCss, /\.nav-item\.fd-nav-item--hr\[data-section-id="conventions"\]/);
});
