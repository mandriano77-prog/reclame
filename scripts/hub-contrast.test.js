'use strict';

// --hub-faint era #5C5C66: 2.84:1 sulla superficie delle card, sotto la soglia di
// leggibilità. E non è un colore decorativo: ci scriviamo la categoria di ogni offerta,
// le date dei movimenti, il segnaposto della ricerca e "Ti mancano N coin" — che è
// l'informazione su cui il cliente decide se può riscattare.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', 'src/hub/hub.css'), 'utf8');

function luminanza(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrasto(a, b) {
  const l1 = luminanza(a), l2 = luminanza(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
function token(nome) {
  const m = css.match(new RegExp('--' + nome + ':\\s*(#[0-9A-Fa-f]{6})'));
  assert.ok(m, 'token trovato: ' + nome);
  return m[1];
}

// La superficie più chiara su cui questi grigi fanno da testo: la card.
const CARD = '#111214';

test('i tre livelli di grigio si leggono tutti', () => {
  for (const t of ['hub-text', 'hub-muted', 'hub-faint']) {
    const c = contrasto(token(t), CARD);
    assert.ok(c >= 4.5, `--${t} (${token(t)}) è a ${c.toFixed(2)}:1, serve 4.5`);
  }
});

test('la gerarchia sopravvive: restano tre livelli distinti', () => {
  // Alzare faint fino a muted avrebbe risolto il contrasto perdendo un livello.
  const t = luminanza(token('hub-text'));
  const m = luminanza(token('hub-muted'));
  const f = luminanza(token('hub-faint'));
  assert.ok(t > m && m > f, 'text più chiaro di muted, muted più chiaro di faint');
});
