'use strict';

// La thank-you post-installazione (src/engine/thank-you-html.js) è la terza superficie che
// vede il cliente, dopo landing e HUB. Aveva il viola #8B5CF6 inchiodato — così i cerchi
// restavano viola mentre il resto prendeva il colore del pass — e mostrava l'iniziale del
// brand al posto dell'icona notifica. Ora usa la palette del pass e la sua icona, con gli
// stessi font di landing e HUB.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const ty = fs.readFileSync(path.join(root, 'src/engine/thank-you-html.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'src/server.js'), 'utf8');

test('cerchi e riquadri prendono il colore del pass, non un viola inchiodato', () => {
  // le tinte derivano da --brand (= labelColor del pass), via color-mix
  assert.match(ty, /--brand-soft: color-mix\(in srgb, var\(--brand\) 12%, transparent\)/);
  assert.match(ty, /--brand-line: color-mix\(in srgb, var\(--brand\) 38%, transparent\)/);
  // niente più rgba viola nei componenti visibili (i default :root e il fallback JS restano)
  assert.doesNotMatch(ty, /rgba\(139, 92, 246/);
  // e --brand è davvero il colore del pass
  assert.match(ty, /const accent = normalizeHexColor\(brandColor\)/);
});

test("in testa va l'icona notifica, non l'iniziale inventata", () => {
  assert.match(ty, /const headerImageUrl = iconUrl \|\| logoUrl;/);
  assert.match(ty, /img\.className = 'brand-icon'/);
  assert.match(ty, /\.logo-area \.brand-icon/);
  // il server passa l'endpoint icona pubblico, costruito dallo slug
  assert.match(server, /by-slug\/\$\{encodeURIComponent\(brand\.slug\)\}\/icon/);
  assert.match(server, /iconUrl,/);
});

test('stessi font di landing e HUB', () => {
  assert.match(ty, /family=Fraunces:opsz[^"'`]*Manrope/);
  assert.doesNotMatch(ty, /family=Inter/);
  assert.match(ty, /html, body \{[\s\S]{0,120}?font-family: 'Manrope'/);
  assert.match(ty, /h1 \{[\s\S]{0,120}?font-family: 'Fraunces'/);
});
