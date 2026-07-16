'use strict';

// Su Reclame "Importa contatti (CSV)" apriva il wizard di importazione DIPENDENTI di
// FiloDiretto: chiedeva la matricola — che un contatto retail non ha — e avrebbe quindi
// rifiutato ogni riga. Per giunta era tematizzato solo per il tema chiaro: titolo blu
// scuro su fondo scuro, stepper viola dentro un prodotto rosso, dropzone bianca.
// Un import Ads non esiste: finché non esiste, il bottone non esiste.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'src/dashboard/index.html'), 'utf8');
const routes = fs.readFileSync(path.join(root, 'src/api/routes.js'), 'utf8');

test('la barra contatti di Reclame non ha più un bottone Importa', () => {
  // Tolto dal markup, non nascosto via JS: la barra è condivisa fra il tab "Tutti i
  // contatti" e il tab "Audience", e quest'ultimo non passa dal codice che la ricompone —
  // nasconderlo da JS lo avrebbe lasciato visibile (e inerte) proprio lì.
  assert.doesNotMatch(indexHtml, /id="a2wContactsImportBtn"/);
  assert.doesNotMatch(indexHtml, /getElementById\('a2wContactsImportBtn'\)/);
  // e non restano chiavi di testo orfane a rievocarlo
  assert.doesNotMatch(indexHtml, /leads_import_btn/);
  assert.doesNotMatch(indexHtml, /leads_empty_import/);
});

test("lo stato vuoto di Reclame non offre né nomina l'import", () => {
  const empty = indexHtml.match(/if \(isA2w && !leadsHrMode && totalRows === 0\)[\s\S]{0,2600}/);
  assert.ok(empty, 'blocco empty-state Ads trovato');
  assert.doesNotMatch(empty[0], /openEmployeeImportModal/);
  // il testo non deve promettere una via che non c'è più
  const desc = indexHtml.match(/leads_empty_desc: '[^']*'/);
  assert.ok(desc, 'copy empty-state trovata');
  assert.doesNotMatch(desc[0], /import/i);
});

test("FiloDiretto conserva il suo import: vive in un'altra barra", () => {
  // #leadsImportBtn (contacts-toolbar) è il percorso HR e non è stato toccato.
  const toolbar = fs.readFileSync(path.join(root, 'src/dashboard/js/components/contacts/contacts-toolbar.js'), 'utf8');
  assert.match(toolbar, /leadsImportBtn/);
  assert.match(indexHtml, /onImport: openEmployeeImportModal/);
});

test('i tre endpoint di import dipendenti rifiutano un brand non-HR', () => {
  // Gli altri endpoint dipendenti avevano già questo cancello; l'import no: un brand Ads
  // poteva importare matricole e reparti nella propria lista contatti.
  for (const rotta of [
    "router.post('/brands/:brand_id/employees/import/preview'",
    "router.post('/brands/:brand_id/employees/import'",
    "router.get('/brands/:brand_id/employees/import/errors'",
  ]) {
    const i = routes.indexOf(rotta);
    assert.ok(i > 0, `rotta trovata: ${rotta}`);
    const corpo = routes.slice(i, i + 900);
    assert.match(corpo, /if \(!isHrBrand\(brand(ForErrors)?, req\)\)/, `manca il gate HR su ${rotta}`);
  }
});
