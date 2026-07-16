'use strict';

// La landing è l'unico schermo fra il cliente e il pass: due testi ci remavano contro.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const landing = fs.readFileSync(path.join(__dirname, '..', 'src/landing/index.html'), 'utf8');

test("su iPhone non si dice più di aprire la pagina da iPhone", () => {
  // Il ramo `if (isIOS)` lo legge solo chi è già su iPhone: gli si consigliava di fare
  // quello che aveva appena fatto. Il consiglio giusto sta nel ramo desktop.
  const i = landing.indexOf('if (isIOS) {');
  assert.ok(i > 0, 'ramo iOS trovato');
  const iosBranch = landing.slice(i, landing.indexOf('if (isAndroid) {', i));
  assert.doesNotMatch(iosBranch, /apri da iPhone|apri questa pagina/i);
  assert.match(iosBranch, /Il pass si aggiunge direttamente ad Apple Wallet/);
  // e il consiglio resta dov'è utile: sul desktop
  assert.match(landing, /Per l['’]installazione diretta, apri questa pagina dal tuo telefono/);
});

test('un errore permanente non invita a riprovare', () => {
  assert.match(landing, /function erroreIrrimediabile\(status\)/);
  assert.match(landing, /if \(e\.permanente\) \{/);
  assert.match(landing, /el\.btnLabel\.textContent = 'Non disponibile';/);
  // su un errore passeggero (rete, 5xx) "Riprova" resta giusto
  assert.match(landing, /\} else \{\s*\n\s*el\.btn\.disabled = false;\s*\n\s*el\.btnLabel\.textContent = 'Riprova';/);
});

test('la regola distingue ciò che può cambiare da sé da ciò che non cambia', () => {
  // Estrae la funzione dalla pagina e la esegue davvero: 422 immagini mancanti, 400
  // template assente, 404 brand inesistente e 501 wallet non configurato non migliorano
  // riprovando. Un 5xx, un timeout o un rate limit sì.
  const src = landing.match(/function erroreIrrimediabile\(status\) \{[\s\S]*?\n    \}/);
  assert.ok(src, 'funzione trovata');
  // eslint-disable-next-line no-new-func
  const fn = new Function(src[0] + '; return erroreIrrimediabile;')();
  for (const s of [422, 400, 404, 501]) assert.equal(fn(s), true, `${s} deve essere permanente`);
  for (const s of [500, 502, 503, 408, 429]) assert.equal(fn(s), false, `${s} deve essere ritentabile`);
});

test('Google e Samsung non buttano via il messaggio del server', () => {
  // Prima scrivevano "Errore — riprova" nell'etichetta e la ripristinavano dopo 2s: il
  // messaggio vero non lo vedeva nessuno. Ed erano l'unica strada per un utente Android.
  assert.match(landing, /function mostraErroreWallet\(btn, labelEl, etichettaOriginale, err\)/);
  const usi = landing.match(/mostraErroreWallet\(btn, (lbl|label), orig(HTML)?, err\)/g) || [];
  assert.equal(usi.length, 2, 'usata sia da Google sia da Samsung');
  assert.doesNotMatch(landing, /lbl\.textContent = 'Errore — riprova'/);
  assert.doesNotMatch(landing, /label\.textContent = 'Errore — riprova'/);
  // un <a> non si spegne con `disabled`: serve aria-disabled, con lo stile che lo segue
  assert.match(landing, /btn\.setAttribute\('aria-disabled', 'true'\)/);
  assert.match(landing, /\.cta\[aria-disabled="true"\] \{[^}]*pointer-events: none/);
});
