'use strict';

// Il cliente vede due superfici: la landing (si iscrive) e l'HUB (dentro il pass, dopo).
// Devono sembrare un prodotto solo — la dashboard, che usa il brand, può avere una sua
// voce. Il legame più forte è il carattere: la landing usava il font di sistema mentre
// l'HUB ha la sua firma editoriale (Fraunces sui titoli, Manrope nel corpo). Ora combaciano.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const landing = fs.readFileSync(path.join(root, 'src/landing/index.html'), 'utf8');
const hubCss = fs.readFileSync(path.join(root, 'src/hub/hub.css'), 'utf8');

test('la landing carica gli stessi font dell\'HUB', () => {
  // l'HUB li dichiara come token
  assert.match(hubCss, /--hub-display: 'Fraunces'/);
  assert.match(hubCss, /--hub-font: 'Manrope'/);
  // la landing li carica dalla stessa sorgente, e non più Inter
  assert.match(landing, /fonts\.googleapis\.com\/css2\?family=Fraunces:opsz[^"]*Manrope/);
  assert.doesNotMatch(landing, /family=Inter/);
});

test('il titolo è Fraunces, il corpo Manrope — come l\'HUB', () => {
  // corpo
  assert.match(landing, /html, body \{\s*\n\s*font-family: 'Manrope'/);
  // titolo principale
  assert.match(landing, /h1 \{[\s\S]{0,200}?font-family: 'Fraunces'/);
  // e la schermata post-installazione non torna a un altro font
  assert.doesNotMatch(landing, /font-family: 'Inter'/);
  assert.match(landing, /\.thank-you-view h1 \{[\s\S]{0,120}?font-family: 'Fraunces'/);
});
