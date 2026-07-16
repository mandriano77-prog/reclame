'use strict';

// I controlli di form non ereditano il font dalla pagina: senza una regola esplicita il
// browser ci mette Arial 13.33px. Il progetto scriveva `font-family: inherit` componente
// per componente, e chi se ne dimenticava cadeva in Arial: erano 69 fra bottoni, tab e
// voci di menu, mentre Inter veniva scaricato da Google Fonts e ignorato.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'src/dashboard/index.html'), 'utf8');

test('i controlli di form ereditano il font della pagina, alla radice', () => {
  assert.match(indexHtml, /button, input, select, textarea, optgroup \{ font-family: inherit; \}/);
});

test('la regola tocca solo la famiglia, non il corpo', () => {
  // Ereditare anche font-size sposterebbe altezze già tarate componente per componente:
  // il difetto visibile era il carattere sbagliato, non la dimensione.
  const m = indexHtml.match(/button, input, select, textarea, optgroup \{[^}]*\}/);
  assert.ok(m, 'regola trovata');
  assert.doesNotMatch(m[0], /font-size/);
});
