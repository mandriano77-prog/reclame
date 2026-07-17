'use strict';

// L'HUB è tutto ciò che il cliente vede del brand dentro il pass. Aveva l'accent viola di
// default (anche quando il pass era, per dire, salmone), etichette in inglese (Deal, Coin,
// Food, Retail, Tech, Fitness) e i "coin". Ora: colori dalla palette del pass, tutto in
// italiano (Offerte, Gettoni), categorie tradotte, icona notifica in testa.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'src/hub/app.js'), 'utf8');
const hubPwa = fs.readFileSync(path.join(root, 'src/api/hub-pwa.js'), 'utf8');

test('le due schede sono in italiano: Offerte e Gettoni', () => {
  assert.match(app, /\[\['conv', 'Offerte'\], \['pga', 'Gettoni'\]\]/);
  assert.match(app, /\$\('#hub-title'\)\.textContent = 'Gettoni';/);
  assert.doesNotMatch(app, /\['conv', 'Deal'\]/);
});

test('le categorie non sono più in inglese', () => {
  assert.match(app, /food: 'Ristorazione'/);
  assert.match(app, /fitness: 'Sport'/);
  assert.match(app, /retail: 'Negozi'/);
  assert.match(app, /tech: 'Tecnologia'/);
  // niente Food/Retail/Tech/Fitness come valori (le chiavi restano food/retail/…)
  assert.doesNotMatch(app, /: 'Food'/);
  assert.doesNotMatch(app, /: 'Retail'/);
});

test('nessun "coin" visibile: si dice gettoni', () => {
  // i testi che legge il cliente non contengono più "coin". Le chiavi-dato lo nominano
  // (coin_cost, coins_spent, coin_balance, coin_reward, hub-coin, class/id vari) e vanno
  // escluse: le azzeriamo PRIMA di cercare, altrimenti un "${x.coin_cost} coin" visibile
  // resterebbe nascosto dentro la stessa finestra di "coin_cost" (era il buco del test).
  const codice = app
    .replace(/\/\*[\s\S]*?\*\//g, '')          // commenti a blocco
    .replace(/\/\/.*$/gm, '')                  // commenti a riga
    .replace(/coin_cost|coins_spent|coin_balance|coin_reward|hub-coin|coin-widget|coinWidget|updateCoinWidget|renderCoin\b/g, 'DATO');
  const visibili = codice.match(/\bcoin\b/gi) || [];
  assert.equal(visibili.length, 0, 'coin ancora visibile: ' + visibili.length + ' occorrenze');
  assert.match(app, /gettoni disponibili/);
  assert.match(app, /Il programma Gettoni non è ancora attivo/);
});

test("l'accent segue la palette del pass, non il viola di default", () => {
  // il viola #8B5CF6 salvato in hub_settings (default della colonna) è trattato come "non
  // scelto": comanda labelColor del pass. Un accent scelto davvero (≠ default) resta.
  assert.match(hubPwa, /savedAccent && savedAccent !== '#8B5CF6' \? settings\.accent_color : null/);
  assert.match(hubPwa, /accent_color: accentChosen \|\| brandAccent/);
});
