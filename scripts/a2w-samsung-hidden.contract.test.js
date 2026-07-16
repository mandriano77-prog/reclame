'use strict';

// Samsung Wallet non è in uso ("non ancora"): il codice resta, le superfici spariscono.
// Offriva un canale push, un filtro audience, un bottone sul pass e una legenda anche
// dove Samsung non è configurato — scelte che l'operatore poteva fare e che non
// producevano nulla (l'API risponde 501). Non si cancella niente: tutto è legato allo
// stato reale della configurazione, quindi il giorno che le variabili ci sono la UI
// ricompare da sé, senza che nessuno debba ricordarsene.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'src/dashboard/index.html'), 'utf8');
const server = fs.readFileSync(path.join(root, 'src/server.js'), 'utf8');

test('/health dice quali wallet sono davvero attivi', () => {
  assert.match(server, /wallet: \{\s*\n\s*apple: true,\s*\n\s*google: healthWallets\.google\(\),\s*\n\s*samsung: healthWallets\.samsung\(\)/);
  // i moduli si richiedono a chiamata: server.js non li importa in cima, e un riferimento
  // a un modulo non importato avrebbe fatto esplodere /health — cioè il healthcheck su cui
  // Railway decide se il servizio è vivo.
  // isEnabled, non isConfigured: le credenziali Samsung sono in produzione ma il wallet
  // non è in uso, e la UI deve sparire lo stesso (vedi samsung-switch.test.js).
  assert.match(server, /samsung: \(\) => require\('\.\/engine\/samsung-wallet'\)\.isEnabled\(\)/);
});

test('la dashboard nasconde Samsung solo quando non è configurato', () => {
  assert.match(indexHtml, /function a2wHideSamsungUiIfUnconfigured\(wallet\)/);
  // esce subito se Samsung c'è (ricompare da sé) e se /health non ha risposto (prudente)
  assert.match(indexHtml, /if \(!wallet \|\| wallet\.samsung\) return;/);
  assert.match(indexHtml, /a2wHideSamsungUiIfUnconfigured\(h\.wallet\);/);
});

test('copre le superfici statiche che offrivano una scelta inerte', () => {
  const fn = indexHtml.match(/function a2wHideSamsungUiIfUnconfigured\(wallet\) \{[\s\S]*?\n\}/);
  assert.ok(fn, 'funzione trovata');
  assert.match(fn[0], /option\[value="samsung"\]/);      // canale push + filtro audience
  assert.match(fn[0], /passDetailSamsungBtn/);            // bottone nel dettaglio pass
  assert.match(fn[0], /\[data-wallet="samsung"\]/);       // markup marcato a mano
});

test('le parti che si ridisegnano non si puliscono: si disegnano già senza Samsung', () => {
  // Rimuovere dal DOM una volta al caricamento non regge dove la UI si rigenera: la
  // legenda dei pass veniva ricostruita a ogni tabella e Samsung ricompariva. Chi disegna
  // deve sapere quali wallet esistono.
  assert.match(indexHtml, /let a2wWallets = \{ apple: true, google: true, samsung: true \};/);
  assert.match(indexHtml, /function a2wWalletOn\(nome\) \{ return a2wWallets\[nome\] !== false; \}/);
  assert.match(indexHtml, /if \(wallet\) a2wWallets = \{ \.\.\.a2wWallets, \.\.\.wallet \};/);
  // ottimista: se /health non risponde non si nasconde nulla
  assert.match(indexHtml, /a2wWalletOn\('samsung'\)\s*\n?\s*\? '<span><strong>Samsung/);
});
