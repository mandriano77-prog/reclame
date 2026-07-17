'use strict';

// L'HUB si ricolora sul brand. `buttonBgFor()` proteggeva solo il RIEMPIMENTO dei
// bottoni, ma l'accent grezzo finiva anche sul TESTO: sconto sulle card, saldo coin e
// soprattutto il codice da mostrare in cassa. Falliva per ogni accent realistico —
// incluso il viola di default (4.43:1) e il rosso del brand (3.43:1); su un blu scendeva
// a 1.64:1. Su fondo scuro il testo si schiarisce: scurirlo, come fanno i bottoni,
// peggiorerebbe.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'src/hub/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/hub/hub.css'), 'utf8');

/** Estrae le funzioni VERE da app.js e le esegue: niente reimplementazione nel test. */
function caricaHelper() {
  const estrai = (nome) => {
    const i = src.indexOf('function ' + nome + '(');
    if (i < 0) return '';
    let d = 0;
    for (let k = src.indexOf('{', i); k < src.length; k += 1) {
      if (src[k] === '{') d += 1;
      else if (src[k] === '}') { d -= 1; if (d === 0) return src.slice(i, k + 1); }
    }
    return '';
  };
  const costante = src.match(/const CARD_SURFACE = '[^']+';/);
  const mixCost = src.match(/const ACCENT_SOFT_MIX = [\d.]+;/);
  assert.ok(costante && mixCost, 'costanti dichiarate');
  const codice = costante[0] + '\n' + mixCost[0] + '\n'
    + ['hexToRgbNumber', 'luminance', 'contrastRatio', 'lightenHex', 'mixHex', 'accentTextFor']
      .map(estrai).filter(Boolean).join('\n');
  // eslint-disable-next-line no-new-func
  return new Function(codice + '\nreturn { accentTextFor, contrastRatio, luminance, CARD_SURFACE };')();
}

const ACCENT_REALI = {
  'viola di default': '#8B5CF6',
  'rosso Reclame': '#C72E22',
  'bordeaux': '#B91C1C',
  'magenta': '#C2185B',
  'blu': '#1428A0',
  'verde petrolio': '#0B7285',
};

test("l'accent come testo si legge, per ogni brand", () => {
  const f = caricaHelper();
  for (const [nome, hex] of Object.entries(ACCENT_REALI)) {
    const testo = f.accentTextFor(hex);
    const r = f.contrastRatio(f.luminance(testo), f.luminance(f.CARD_SURFACE));
    assert.ok(r >= 4.5, `${nome} (${hex}): ${r.toFixed(2)}:1 — sotto 4.5`);
  }
});

test('vale anche sul fondo colorato del codice promo', () => {
  // .hub-promo e .hub-discount-badge stanno su --hub-accent-soft (accent al 16% sulla
  // card): fondo più chiaro, contrasto più difficile. È il codice che il cliente deve
  // leggere e ripetere in cassa.
  const f = caricaHelper();
  const hex2 = (h) => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mix = (fg, bg, a) => {
    const A = hex2(fg); const B = hex2(bg);
    return '#' + A.map((v, i) => Math.round(B[i] + (v - B[i]) * a).toString(16).padStart(2, '0')).join('');
  };
  for (const [nome, hex] of Object.entries(ACCENT_REALI)) {
    const soft = mix(hex, f.CARD_SURFACE, 0.16);
    const r = f.contrastRatio(f.luminance(f.accentTextFor(hex)), f.luminance(soft));
    assert.ok(r >= 4.5, `${nome} su accent-soft: ${r.toFixed(2)}:1 — sotto 4.5`);
  }
});

test('il colore grezzo resta dove non si legge', () => {
  // Bordi, aloni, riempimenti e la spunta nativa devono restare il brand esatto: lì il
  // colore si guarda, non si legge. Schiarirli sbiadirebbe l'identità senza motivo.
  assert.match(css, /accent-color: var\(--hub-accent\);/);          // spunta "Vicino a me"
  assert.match(css, /border-top-color: var\(--hub-accent\);/);      // spinner
  assert.match(src, /setProperty\('--hub-accent', accent\)/);       // grezzo, invariato
  assert.match(src, /setProperty\('--hub-accent-text', accentTextFor\(accent\)\)/);
});

test('nessun testo usa più l\'accent grezzo', () => {
  const testoGrezzo = css.match(/(^|[{;\s])color: var\(--hub-accent\)(?!-)/gm) || [];
  assert.equal(testoGrezzo.length, 0, 'trovato testo ancora sull\'accent non verificato');
  assert.ok((css.match(/color: var\(--hub-accent-text, var\(--hub-accent\)\)/g) || []).length >= 15);
});
