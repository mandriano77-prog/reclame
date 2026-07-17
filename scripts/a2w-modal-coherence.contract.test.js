'use strict';

// Le modali parlavano tre linguaggi: 8px (.modal-content, 13 modali), 16px
// (.a2w-modal__dialog, una sola) e 12px (wizard import). E i bottoni dentro .a2w-modal
// erano 44px mentre ogni altro bottone della piattaforma è 40px: aprendo una modale i
// controlli cambiavano taglia.
// Ma il difetto peggiore era il colore: #05211d e #0b1220 — neri ereditati dall'accent
// teal di prima — imposti sul testo di OGNI bottone primario. Sul rosso del brand danno
// 3.43:1, sotto la soglia di leggibilità; --text-on-accent passa a 4.70:1.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const leggi = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const indexHtml = leggi('src/dashboard/index.html');
const modal = leggi('src/dashboard/styles/a2w-modal.css');
const chrome = leggi('src/dashboard/styles/a2w-chrome.css');
const leads = leggi('src/dashboard/styles/a2w-leads.css');
const dialog = leggi('src/dashboard/css/components/dialog.css');

test('nessun bottone primario ha più il testo dell\'era teal', () => {
  // Vale per tutta la piattaforma, non solo per le modali.
  for (const [nome, css] of [['a2w-chrome', chrome], ['a2w-modal', modal], ['a2w-leads', leads]]) {
    const codice = css.replace(/\/\*[\s\S]*?\*\//g, '');   // i commenti possono citarli
    assert.doesNotMatch(codice, /color:\s*#05211d/, `${nome}: residuo teal`);
    assert.doesNotMatch(codice, /color:\s*#0b1220/, `${nome}: residuo slate`);
  }
  assert.match(chrome, /\.a2w-btn-primary \{[\s\S]*?color: var\(--text-on-accent, #F4EDE2\)/);
  assert.match(leads, /#leads \.a2w-btn-primary \{[\s\S]*?color: var\(--text-on-accent, #F4EDE2\)/);
});

test('i dialoghi hanno tutti il raggio delle card', () => {
  assert.match(indexHtml, /\.modal-content \{[\s\S]*?border-radius: var\(--a2w-radius-card, var\(--radius-lg\)\)/);
  assert.match(modal, /border-radius: var\(--a2w-radius-card, 16px\)/);
  assert.match(dialog, /border-radius: var\(--a2w-radius-card, 12px\)/);
});

test('i bottoni nelle modali sono alti come tutti gli altri', () => {
  const codice = modal.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(codice, /min-height: 44px/);
  assert.match(modal, /\.a2w-modal \.a2w-btn-primary \{[\s\S]*?min-height: 40px/);
  assert.match(modal, /\.a2w-modal \.a2w-btn-ghost \{[\s\S]*?min-height: 40px/);
  // e usano il token del raggio, non un 10 inchiodato
  assert.match(modal, /\.a2w-modal \.a2w-btn-primary \{[\s\S]*?border-radius: var\(--radius-control, 10px\)/);
});
