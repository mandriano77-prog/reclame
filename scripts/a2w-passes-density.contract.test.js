'use strict';

// "Pass Emessi" era un muro: sette righe di legenda sempre aperte sopra una tabella che
// spesso ne ha una, un riquadro che spiegava come si usa una casella di spunta, e sei KPI
// di cui uno ripeteva un dato scritto 12px più sotto — costringendo la griglia ad andare
// a capo e lasciando l'ultima card orfana.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'src/dashboard/index.html'), 'utf8');

test('la legenda è a scomparsa, non un muro sempre aperto', () => {
  assert.match(indexHtml, /<details class="pass-table-legend"/);
  assert.match(indexHtml, /<summary class="pass-table-legend__title">Come leggere la tabella<\/summary>/);
  // chiusa di default: nessun attributo open
  assert.doesNotMatch(indexHtml, /<details class="pass-table-legend"[^>]*\sopen/);
  // gli stili sono legati al summary perché la stessa classe è riusata come <div>
  assert.match(indexHtml, /summary\.pass-table-legend__title \{[^}]*cursor: pointer/);
});

test('via il riquadro che spiegava la casella di spunta', () => {
  // lo diceva già la legenda, alla voce "Selezione multipla"
  assert.doesNotMatch(indexHtml, /bulk-select-hint/);
  assert.match(indexHtml, /<strong>Selezione multipla<\/strong>/);
});

test('nessun KPI ripete un dato già scritto sotto', () => {
  // "In questa pagina" duplicava la riga di paginazione ("1–2 di 2 pass")
  assert.doesNotMatch(indexHtml, /stat-label">In questa pagina/);
  assert.match(indexHtml, /di \$\{passTotalCount\} pass/);
});

test('legenda e intestazione nominano solo i wallet che esistono', () => {
  // prima erano rigenerate a ogni tabella, annullando la rimozione fatta al caricamento
  assert.match(indexHtml, /function walletColumnLabel\(\)/);
  assert.match(indexHtml, /a2wWalletOn\('samsung'\)/);
  assert.doesNotMatch(indexHtml, /Apple · Google · Samsung/);
  assert.match(indexHtml, /function a2wWalletOn\(nome\)/);
});

test('niente gergo da sviluppatore nelle descrizioni di pagina', () => {
  assert.doesNotMatch(indexHtml, /reachability push/);
  assert.doesNotMatch(indexHtml, /Raggiungibili \(Apple \/ Google \/ Samsung\)/);
});
