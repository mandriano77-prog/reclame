'use strict';

// I controlli della dashboard avevano --radius-sm (4px), il gradino più piccolo della
// scala: bottoni e campi sembravano rettangoli, in un prodotto la cui landing usa 14px e
// il cui HUB usa le pillole. Ora un token solo, --radius-control, per tutto ciò che si
// clicca o si compila: cambiarlo è una riga, non dodici.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'src/dashboard/index.html'), 'utf8');
const chrome = fs.readFileSync(path.join(root, 'src/dashboard/styles/a2w-chrome.css'), 'utf8');

test('esiste un solo interruttore per il raggio dei controlli', () => {
  assert.match(indexHtml, /--radius-control: 10px;/);
});

test('bottoni, campi e voci di nav lo usano', () => {
  for (const re of [
    /\.btn, \.btn-primary \{[\s\S]{0,400}?border-radius: var\(--radius-control\)/,
    /textarea \{[\s\S]{0,400}?border-radius: var\(--radius-control\)/,
    /\.nav-item \{[\s\S]{0,400}?border-radius: var\(--radius-control\)/,
  ]) assert.match(indexHtml, re);
  // la shell Ads ridefiniva le voci di nav con più specificità: senza questo, in
  // produzione sarebbero rimaste a 4px mentre in locale sembravano a posto.
  assert.doesNotMatch(chrome, /border-radius: var\(--radius-sm\)/);
  assert.match(chrome, /html\[data-shell="dark"\]\.a2w-shell \.nav-item \{[\s\S]{0,300}?border-radius: var\(--radius-control\)/);
});

test('i controlli non usano più il gradino più piccolo', () => {
  // resta solo su un badge minuscolo, dove 4px è giusto
  const usi = indexHtml.match(/border-radius: var\(--radius-sm\)/g) || [];
  assert.equal(usi.length, 1, 'solo .strip-card-badge');
  assert.match(indexHtml, /\.strip-card-badge \{[^}]*border-radius: var\(--radius-sm\)/);
});
