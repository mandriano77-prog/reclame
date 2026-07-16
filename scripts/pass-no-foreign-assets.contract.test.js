'use strict';

// Un pass non deve MAI mostrare il marchio di un altro cliente. In public/assets
// vivevano i "default" del padel club Hirostar — la promo "1° Maggio Campo Gratuito"
// (default-strip.png) e il marchio "H" (default-icon*.png). Ogni brand che non avesse
// ancora caricato strip o icona se li ritrovava sul pass: perdita di credibilità davanti
// al cliente e branding di terzi distribuito a sua insaputa.
// Il fallback corretto esiste già: generateStrip/generateIcon disegnano dal nome e dai
// colori del brand stesso.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const passkit = fs.readFileSync(path.join(root, 'src/engine/passkit.js'), 'utf8');
// I commenti spiegano perché questo fallback non deve tornare e devono poter nominare
// Hirostar: qui interessa il codice che gira.
const passkitCode = passkit.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');

test('la generazione del pass non carica asset di default da file', () => {
  assert.doesNotMatch(passkitCode, /default-strip/);
  assert.doesNotMatch(passkitCode, /default-icon/);
  assert.doesNotMatch(passkitCode, /hirostar/i);
});

test('senza strip o icona propria si genera dal brand, non si ripiega su un file', () => {
  assert.match(passkit, /stripBuffers = await generateStrip\(brand\.name/);
  assert.match(passkit, /iconBuffers = await generateIcon\(brand\.name/);
});

test('gli asset di altri brand non sono più nel repo', () => {
  const assets = path.join(root, 'public/assets');
  for (const f of ['default-strip.png', 'default-icon.png', 'default-icon@2x.png', 'default-icon@3x.png', 'hirostar-hangar-padel-logo.png']) {
    assert.equal(fs.existsSync(path.join(assets, f)), false, `${f} deve restare fuori dal repo`);
  }
});
