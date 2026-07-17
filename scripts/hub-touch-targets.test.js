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

test('la pill saldo (e il suo link profilo) è stata rimossa dall\'header', () => {
  // Era il bersaglio più piccolo dell'HUB (.hub-coin-link ~17px, poi portato a 44). La pill
  // del saldo è stata rimossa su richiesta (doppione del saldo, che vive nella scheda
  // Gettoni): niente più .hub-coin-link, quindi niente più bersaglio da presidiare qui.
  assert.doesNotMatch(css, /\.hub-coin-link\s*\{/);
});

test('i comandi che si toccano di più arrivano a 44px', () => {
  assert.match(regola('.hub-chip'), /min-height: 44px/);        // filtri categoria
  assert.match(regola('.hub-toggle'), /min-height: 44px/);      // "Vicino a me"
  assert.match(regola('.hub-booking-cancel'), /min-height: 44px/);
});

test('le schede Offerte/Gettoni: compatte ma comode (40px)', () => {
  // Eccezione voluta: sono un rail verticale a 2 segmenti nell'header. A 44px l'uno
  // farebbero ~100px e dominerebbero la testata (feedback del cliente: "troppo grande").
  // 40px resta un bersaglio comodo, ben sopra il minimo WCAG 2.5.8 AA (24px). Sotto i 40
  // il test scatta: non si scende di soppiatto.
  const r = regola('.hub-tab');
  const m = r.match(/min-height:\s*(\d+)px/);
  assert.ok(m, '.hub-tab deve dichiarare min-height');
  assert.ok(Number(m[1]) >= 40, `.hub-tab min-height ${m[1]}px < 40px`);
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
