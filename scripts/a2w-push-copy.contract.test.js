'use strict';

// "Push & Notifiche" apriva con un paragrafo che elencava le tre schede scritte dieci
// pixel più sotto, e ogni campo aveva sotto la sua spiegazione: quando tutto è spiegato,
// niente spicca. L'anteprima live accanto mostra già dove finisce il testo.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'src/dashboard/index.html'), 'utf8');

test('la pagina non si autodescrive più', () => {
  // le schede si chiamano già Immediata / Programmata / Geofencing
  assert.doesNotMatch(indexHtml, /Gestisci le 3 modalità di notifica/);
  assert.match(indexHtml, /switchPushTab\('immediate'\)/);
  assert.match(indexHtml, /switchPushTab\('scheduled'\)/);
  assert.match(indexHtml, /switchPushTab\('geofencing'\)/);
});

test("le spiegazioni non ripetono quello che l'anteprima mostra", () => {
  assert.doesNotMatch(indexHtml, /Spazio ampio sul retro del pass\. Sul fronte e lock screen/);
  assert.match(indexHtml, /Sul retro del pass\. Sul fronte si vedono solo i primi caratteri\./);
  // la regola che evita l'errore vero resta, in una frase invece di due
  assert.match(indexHtml, /Se la campagna collegata ha una sua strip, vince quella\./);
});

test('niente "Link out (CTA)": link e codice riscatto sono scelte esclusive sul retro', () => {
  assert.doesNotMatch(indexHtml, /Link out \(CTA\)/);
  // Il titolo era "Pulsante sul retro" quando c'era solo il link; ora il blocco offre una
  // scelta a tre (niente / link / codice riscatto), quindi il titolo riflette la scelta,
  // non più solo il pulsante — e i due campi sono un radio mutuamente esclusivo.
  assert.match(indexHtml, />Sul retro del pass</);
  assert.match(indexHtml, /name="pushBackMode"/);
  // il titolo dice già "retro": la spiegazione del link tiene solo ciò che aggiunge
  assert.match(indexHtml, /L'indirizzo resta nascosto: il cliente vede solo il testo del link\./);
});
