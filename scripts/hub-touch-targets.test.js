'use strict';

// L'HUB si usa col pollice, su un telefono, spesso in piedi in una galleria. I comandi
// erano tutti sotto i 44px raccomandati: il peggiore era l'accesso al profilo, 17×16px in
// una barra affollata — un bersaglio che si manca.
// Criterio: cresce l'area toccabile, non il disegno. I margini negativi compensano il
// padding, così i comandi restano visivamente identici.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', 'src/hub/hub.css'), 'utf8');

function regola(nome) {
  const i = css.indexOf(nome + ' {');
  assert.ok(i >= 0, 'regola trovata: ' + nome);
  return css.slice(i, css.indexOf('}', i));
}

test("l'accesso al profilo è un bersaglio vero", () => {
  const r = regola('.hub-coin-link');
  assert.match(r, /min-height: 44px/);
  assert.match(r, /min-width: 44px/);
  // il margine negativo compensa il padding: l'aspetto resta quello di prima
  assert.match(r, /margin: -11px -14px/);
});

test('i comandi che si toccano di più arrivano a 44px', () => {
  assert.match(regola('.hub-chip'), /min-height: 44px/);        // filtri categoria
  assert.match(regola('.hub-tab'), /min-height: 44px/);         // schede Offerte/Coin
  assert.match(regola('.hub-toggle'), /min-height: 44px/);      // "Vicino a me"
  assert.match(regola('.hub-booking-cancel'), /min-height: 44px/);
});

test('il tasto indietro è 44 e non 38', () => {
  const r = regola('.hub-back');
  assert.match(r, /width: 44px/);
  assert.match(r, /height: 44px/);
});

test('la spunta nativa resta piccola: il bersaglio è la sua label', () => {
  // Ingrandire l'input nativo lo deformerebbe: è la label a doversi prendere il tocco.
  assert.match(css, /\.hub-toggle input \{[^}]*width: 16px; height: 16px;/);
});
