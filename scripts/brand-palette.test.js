'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');

const {
  extractPaletteFromImage,
  paletteFromAccent,
  isManualPalette,
  FALLBACK_ACCENT
} = require('../src/engine/brand-palette');

function solidPng(background, { width = 32, height = 32 } = {}) {
  return sharp({ create: { width, height, channels: 4, background } }).png().toBuffer();
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16)
  };
}

function channelDelta(hexA, hexB) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  return Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b));
}

test('logo rosso pieno → accent rosso, testo bianco, hex maiuscoli', async () => {
  const buf = await solidPng({ r: 200, g: 30, b: 30, alpha: 1 });
  const p = await extractPaletteFromImage(buf);
  assert.ok(p, 'palette estratta');
  for (const key of ['backgroundColor', 'foregroundColor', 'labelColor', 'accent']) {
    assert.match(p[key], /^#[0-9A-F]{6}$/, `${key} è hex maiuscolo`);
  }
  assert.ok(channelDelta(p.accent, '#C81E1E') <= 12, `accent ~rosso, got ${p.accent}`);
  assert.equal(p.backgroundColor, p.accent);
  assert.equal(p.foregroundColor, '#FFFFFF');
  // label = accent mescolato verso il foreground → più chiaro dell'accent
  const lbl = hexToRgb(p.labelColor);
  const acc = hexToRgb(p.accent);
  assert.ok(lbl.g > acc.g && lbl.b > acc.b, 'labelColor più vicino al bianco');
});

test('logo navy scuro → foreground bianco', async () => {
  const buf = await solidPng({ r: 16, g: 32, b: 64, alpha: 1 });
  const p = await extractPaletteFromImage(buf);
  assert.ok(p);
  assert.ok(channelDelta(p.accent, '#102040') <= 12, `accent ~navy, got ${p.accent}`);
  assert.equal(p.foregroundColor, '#FFFFFF');
});

test('logo giallo chiaro → foreground scuro', async () => {
  const buf = await solidPng({ r: 250, g: 220, b: 60, alpha: 1 });
  const p = await extractPaletteFromImage(buf);
  assert.ok(p);
  assert.equal(p.foregroundColor, '#1A1A1A');
});

test('logo quasi bianco → fallback Reclame red', async () => {
  const buf = await solidPng({ r: 252, g: 252, b: 252, alpha: 1 });
  const p = await extractPaletteFromImage(buf);
  assert.ok(p);
  assert.equal(p.accent, FALLBACK_ACCENT);
});

test('immagine tutta trasparente → null (nessun pixel utile)', async () => {
  const buf = await solidPng({ r: 200, g: 30, b: 30, alpha: 0 });
  const p = await extractPaletteFromImage(buf);
  assert.equal(p, null);
});

test('buffer non valido → null senza throw', async () => {
  assert.equal(await extractPaletteFromImage(Buffer.from('not an image')), null);
  assert.equal(await extractPaletteFromImage(null), null);
  assert.equal(await extractPaletteFromImage(Buffer.alloc(0)), null);
});

test('SVG rasterizzato da sharp → palette dal colore dominante', async () => {
  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40">' +
    '<rect width="40" height="40" fill="#1D4ED8"/></svg>'
  );
  const p = await extractPaletteFromImage(svg);
  assert.ok(p, 'palette da SVG');
  assert.ok(channelDelta(p.accent, '#1D4ED8') <= 12, `accent ~blu, got ${p.accent}`);
  assert.equal(p.foregroundColor, '#FFFFFF');
});

test('pixel semitrasparenti (alpha < 128) ignorati', async () => {
  // metà rossa opaca + metà verde con alpha basso: vince il rosso
  const red = await solidPng({ r: 200, g: 30, b: 30, alpha: 1 }, { width: 16, height: 32 });
  const composite = await sharp({
    create: { width: 32, height: 32, channels: 4, background: { r: 30, g: 200, b: 30, alpha: 0.3 } }
  })
    .composite([{ input: red, left: 0, top: 0 }])
    .png()
    .toBuffer();
  const p = await extractPaletteFromImage(composite);
  assert.ok(p);
  const acc = hexToRgb(p.accent);
  assert.ok(acc.r > acc.g, `accent rosso (verde semitrasparente ignorato), got ${p.accent}`);
});

test('paletteFromAccent: coerenza background/accent', () => {
  const p = paletteFromAccent({ r: 199, g: 46, b: 34 });
  assert.equal(p.backgroundColor, '#C72E22');
  assert.equal(p.accent, '#C72E22');
  assert.equal(p.foregroundColor, '#FFFFFF');
});

test('isManualPalette: override manuale salta autopalette', () => {
  assert.equal(isManualPalette({ palette_source: 'manual' }), true);
  assert.equal(isManualPalette({ palette_source: 'logo-auto' }), false);
  assert.equal(isManualPalette({}), false);
  assert.equal(isManualPalette(null), false);
});

test('mergeAutoPalette (fonte upload) rispetta override manuale', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, '../src/engine/brand-wallet-logo.js'), 'utf8');
  // contract: il merge è protetto da isManualPalette e l'icona non sovrascrive il logo
  assert.match(src, /isManualPalette\(config\)/);
  assert.match(src, /palette_source !== 'logo-auto'/);
  assert.match(src, /mergeAutoPalette\(config, palette, 'logo-auto'\)/);
  assert.match(src, /mergeAutoPalette\(config, palette, 'icon-auto'\)/);
  assert.match(src, /palette_updated_at/);
});

test('routes: upload logo in Media Library aggancia palette; restore azzera override manuale', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const routes = fs.readFileSync(path.join(__dirname, '../src/api/routes.js'), 'utf8');
  // POST /media type=logo → stesso hook palette di POST /brands/:id/logo
  assert.match(routes, /if \(type === 'logo'\)/);
  assert.match(routes, /Media logo palette sync failed/);
  // POST /brands/:id/logo/sync-from-identity → rimuove palette_source 'manual'
  // prima della ri-estrazione, con fallback sul logo legacy in config.logos
  assert.match(routes, /logo\/sync-from-identity/);
  assert.match(routes, /palette_source === 'manual'/);
  assert.match(routes, /palette_source: ''/);
  assert.match(routes, /Nessun logo da cui rigenerare la palette/);
});
