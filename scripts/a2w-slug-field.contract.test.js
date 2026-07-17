'use strict';

// Il campo che genera l'indirizzo pubblico del brand si chiamava "Slug", non aveva
// spiegazione (a differenza di "Tagline", il campo accanto) e comunicava per simboli:
// ! ✓ ✕ ? — dove "!" (formato) e "?" (non siamo riusciti a controllare) erano due
// problemi diversi con lo stesso geroglifico.
// Ma il difetto vero era un altro: a2wBiUpdateSlugPreview() calcolava già l'indirizzo
// completo e cercava #a2wBiPreviewUrl — un elemento che non è mai esistito. Il valore
// finiva nel nulla e il campo restava muto.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'src/dashboard/index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/dashboard/styles/a2w-brand-identity.css'), 'utf8');

test("l'anteprima dell'indirizzo ha finalmente dove comparire", () => {
  assert.match(indexHtml, /<strong id="a2wBiPreviewUrl"><\/strong>/);
  // la funzione che la popola esisteva già: le mancava solo il posto
  assert.match(indexHtml, /const preview = a2wBiField\('a2wBiPreviewUrl'\);\s*\n\s*if \(preview\) preview\.textContent = text;/);
  assert.match(css, /\.a2w-bi-url-preview/);
});

test('il campo non si chiama più con una parola da sviluppatore', () => {
  assert.match(indexHtml, /<label class="form-label" for="biSlug">Indirizzo pagina pubblica<\/label>/);
  // e nessun testo mostrato all'utente dice più "slug"
  assert.doesNotMatch(indexHtml, /toast\('[^']*slug[^']*'\)/i);
  assert.doesNotMatch(indexHtml, /<p>[^<]*\bslug\b[^<]*<\/p>/i);
});

test('gli stati sono frasi, e i due errori diversi si distinguono', () => {
  assert.match(indexHtml, /a2wBiSetSlugStatus\(status, 'Libero', 'ok'\)/);
  assert.match(indexHtml, /Già usato da un altro brand — scegline un altro\./);
  // "non riusciamo a controllare" non è "hai sbagliato": prima erano entrambi un glifo
  assert.match(indexHtml, /Non riusciamo a verificarlo ora — riprova fra poco\./);
  assert.doesNotMatch(indexHtml, /status\.textContent = '✓'/);
  assert.doesNotMatch(indexHtml, /status\.textContent = '✕'/);
  assert.doesNotMatch(indexHtml, /status\.textContent = '\?'/);
});

test('il senso sta nel testo, non nel colore', () => {
  // il colore aiuta a colpo d'occhio, ma chi non lo distingue legge comunque la frase
  for (const t of ['ok', 'ko', 'warn']) {
    assert.match(css, new RegExp(`\\.a2w-bi-slug-status--${t}`), `tono ${t}`);
  }
  assert.match(indexHtml, /id="biSlugStatus"[^>]*aria-live="polite"/);
});
