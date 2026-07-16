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

test('Ads: senza le immagini del brand un pass nuovo non si emette', () => {
  assert.match(passkitCode, /err\.code = 'brand_images_missing'/);
  // Una regola sola, riusata da chi emette il pass e da chi rifiuta prima del database:
  // due copie divergerebbero, e una delle due lascerebbe passare il caso sbagliato.
  assert.match(passkitCode, /async function missingBrandPassImages\(brand, template\)/);
  assert.match(passkitCode, /missing\.push\('logo'\)/);
  assert.match(passkitCode, /missing\.push\('icona notifica'\)/);
  assert.match(passkitCode, /missing\.push\('strip'\)/);
  // l'icona dev'essere caricata: quella ricavata dal logo non vale
  assert.match(passkitCode, /icon\.source === 'logo_derived'/);
});

test('le uniche immagini di un pass Ads sono logo, strip e icona notifica', () => {
  // Niente thumbnail né background: non arrivano su nessun pass Ads.
  assert.doesNotMatch(passkitCode, /files\['thumbnail\.png'\]/);
  assert.doesNotMatch(passkitCode, /files\['background\.png'\]/);
  // la thumbnail resta solo a FiloDiretto, che la incolla sulla strip
  assert.match(passkitCode, /if \(hrBrand && tplImages\.thumbnail\)/);
  // e il server non le accetta più in upload da un brand Ads
  const tplRoutes = fs.readFileSync(path.join(root, 'src/api/template-routes.js'), 'utf8');
  assert.match(tplRoutes, /isHrBrand\(brandForImages\) \? \['logo', 'strip', 'thumbnail'\] : \['logo', 'strip'\]/);
});

test('il blocco vale solo alla nascita del pass, mai sugli aggiornamenti', () => {
  // createPkpass ricostruisce anche i pass già installati (aggiornamenti Apple Wallet):
  // se il blocco fosse sempre attivo, i pass nel telefono dei clienti si congelerebbero.
  // Quindi è opt-in e spento di default, e lo accendono solo i punti di emissione.
  assert.match(passkitCode, /requireBrandImages = false/);
  assert.match(passkitCode, /if \(requireBrandImages && !hrBrand\)/);
  const routes = fs.readFileSync(path.join(root, 'src/api/routes.js'), 'utf8');
  const accesi = routes.match(/requireBrandImages: true/g) || [];
  assert.equal(accesi.length, 2, 'solo iscrizione pubblica e rigenera da back office');
});

test('gli asset di altri brand non sono più nel repo', () => {
  const assets = path.join(root, 'public/assets');
  for (const f of ['default-strip.png', 'default-icon.png', 'default-icon@2x.png', 'default-icon@3x.png', 'hirostar-hangar-padel-logo.png']) {
    assert.equal(fs.existsSync(path.join(assets, f)), false, `${f} deve restare fuori dal repo`);
  }
});
