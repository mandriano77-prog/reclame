'use strict';

// Contract: la palette brand auto-estratta dal logo tinge l'accent della dashboard
// (shell scura) e viene rimossa quando nessun brand è selezionato.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'src/dashboard/index.html'), 'utf8');

test('applyBrandAccentVars esiste ed è cablata in applyBrandTheme', () => {
  assert.match(indexHtml, /function applyBrandAccentVars\(config\)/);
  assert.match(indexHtml, /applyBrandAccentVars\(brand\.config \|\| null\)/);
  assert.match(indexHtml, /applyBrandAccentVars\(null\)/);
});

test('accent brand solo con palette_source (auto o manual), non con default fissi', () => {
  assert.match(indexHtml, /function resolveBrandAccentFromConfig\(config\)/);
  assert.match(indexHtml, /config\.palette_source/);
  assert.match(indexHtml, /\(config\.colors && config\.colors\.accent\) \|\| config\.backgroundColor/);
  assert.match(indexHtml, /function normalizeBrandAccentHex\(/);
  assert.match(indexHtml, /function ensureVisibleBrandAccent\(/);
});

test('tinta limitata alla shell scura e reversibile', () => {
  assert.match(indexHtml, /data-shell'\)\s*!==\s*'dark'/);
  assert.match(indexHtml, /BRAND_ACCENT_CLEAR_VARS/);
  assert.match(indexHtml, /rootStyle\.removeProperty\(v\)/);
});

test('vengono impostate le variabili accent della shell', () => {
  for (const v of [
    '--accent', '--accent-hover',
    '--a2w-accent', '--a2w-accent-subtle',
    '--a2w-action-primary', '--a2w-action-primary-hover',
    '--a2w-border-focus', '--bg-active'
  ]) {
    assert.match(
      indexHtml,
      new RegExp(`setProperty\\('${v}'`),
      `setProperty ${v}`
    );
  }
  // hover ~12% più scuro e subtle ad alpha ~14%
  assert.match(indexHtml, /darkenHex\(accent, 30\)/);
  assert.match(indexHtml, /adjustAlpha\(accent, 0\.14\)/);
});

test('il canvas scuro non viene toccato dalla tinta brand', () => {
  const fnMatch = indexHtml.match(/function applyBrandAccentVars\(config\) \{[\s\S]*?\n\}/);
  assert.ok(fnMatch, 'corpo funzione trovato');
  assert.doesNotMatch(fnMatch[0], /setProperty\('--bg'/);
  assert.doesNotMatch(fnMatch[0], /setProperty\('--bg2'/);
  assert.doesNotMatch(fnMatch[0], /setProperty\('--bg-app'/);
  assert.doesNotMatch(fnMatch[0], /setProperty\('--bg-canvas'/);
});
