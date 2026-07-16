'use strict';

// Il pulsante W.AI (.wai-fab) e i toast vivevano nello stesso angolo con lo stesso
// bottom/right: ogni messaggio della piattaforma — errori compresi — arrivava tagliato
// dal pulsante. I toast salgono sopra di lui.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'src/dashboard/index.html'), 'utf8');

function regola(nome) {
  const m = indexHtml.match(new RegExp('\\n\\s*\\' + nome + '\\s*\\{[^}]*\\}'));
  return m ? m[0] : '';
}

test('i toast non nascono più sotto il pulsante W.AI', () => {
  const toast = regola('.toast');
  const fab = regola('.wai-fab');
  assert.ok(toast && fab, 'entrambe le regole trovate');
  // il FAB resta ancorato in basso a destra: è il toast che deve scansarlo
  assert.match(fab, /bottom: var\(--space-6\)/);
  assert.match(fab, /height: 56px/);
  // il toast lascia spazio al FAB (56px) più un respiro
  assert.match(toast, /bottom: calc\(var\(--space-6\) \+ 56px \+ var\(--space-2\)\)/);
  assert.doesNotMatch(toast, /bottom: var\(--space-6\);/);
});

test('e nemmeno dietro al pannello W.AI, dove W.AI segnala i suoi errori', () => {
  // Alzare solo il bottom non basta: il pannello parte da bottom 92px con z-index 10049 e
  // largo fino a 400px, quindi inghiottirebbe il toast a 96px. Serve lo z-index.
  const toast = regola('.toast');
  const panel = regola('.wai-panel');
  const zToast = Number((toast.match(/z-index: (\d+)/) || [])[1]);
  const zPanel = Number((panel.match(/z-index: (\d+)/) || [])[1]);
  const zFab = Number((regola('.wai-fab').match(/z-index: (\d+)/) || [])[1]);
  assert.ok(zToast > zPanel, `toast (${zToast}) deve stare sopra il pannello (${zPanel})`);
  assert.ok(zToast > zFab, `toast (${zToast}) deve stare sopra il FAB (${zFab})`);
});
