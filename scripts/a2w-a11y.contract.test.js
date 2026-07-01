'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const tokens = fs.readFileSync(path.join(root, 'src/dashboard/styles/a2w-tokens.css'), 'utf8')
  + fs.readFileSync(path.join(root, 'src/dashboard/styles/rm-tokens.css'), 'utf8');
const a11y = fs.readFileSync(path.join(root, 'src/dashboard/styles/a2w-a11y.css'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'src/dashboard/js/a2w-shell.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'src/dashboard/index.html'), 'utf8');

test('token testo terziario rispetta soglia WCAG AA (>= 0.55)', () => {
  const match = tokens.match(/--a2w-text-tertiary:\s*rgba\(\s*\d+,\s*\d+,\s*\d+,\s*([\d.]+)\)/);
  assert.ok(match, 'a2w-text-tertiary token missing');
  assert.ok(Number(match[1]) >= 0.55, 'tertiary opacity too low for AA on dark bg');
});

test('a2w-a11y.css definisce focus-visible con token acqua', () => {
  assert.match(a11y, /--a2w-border-focus/);
  assert.match(a11y, /\.wai-fab:focus-visible/);
  assert.match(a11y, /\.sidebar \.nav-item:focus-visible/);
});

test('shell imposta aria-label su voci nav e tastiera', () => {
  assert.match(shell, /initA2wNavItemKeyboard/);
  assert.match(shell, /initA2wIconButtonA11y/);
  assert.match(shell, /setAttribute\('aria-label', labelText\)/);
  assert.match(shell, /a2wNavGroupToggleKey/);
});

test('W.AI FAB e modal-close hanno aria-label descrittivi', () => {
  assert.match(indexHtml, /id="waiBtn"[^>]*aria-label="Apri assistente W\.AI"/);
  assert.match(indexHtml, /modal-close[^>]*aria-label="Chiudi modale campagna"/);
  assert.match(indexHtml, /closeAudienceEditor\(\)" aria-label="Chiudi editor audience"/);
});

test('Ads2Wallet shell binds W.AI FAB click (fd-wai is HR-only)', () => {
  assert.doesNotMatch(indexHtml, /id="waiBtn"[^>]*onclick=/);
  assert.match(shell, /function bindA2wWaiControls/);
  assert.match(shell, /bindA2wWaiControls\(\)/);
  assert.match(shell, /toggleWaiOverlay\(\)/);
});

test('breadcrumb duplicati nascosti — solo header globale su A2W', () => {
  const chrome = fs.readFileSync(path.join(root, 'src/dashboard/styles/a2w-chrome.css'), 'utf8');
  assert.match(chrome, /\.a2w-bi-breadcrumb[\s\S]*display:\s*none/);
  assert.doesNotMatch(indexHtml, /a2w-bi-breadcrumb/);
  assert.doesNotMatch(shell, /a2w-page-breadcrumb/);
});
