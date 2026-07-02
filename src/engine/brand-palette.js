/**
 * Brand palette auto-extraction from logo/icon images.
 * Derives wallet pass colors (background/foreground/label) + UI accent
 * from the dominant saturated color of an uploaded image (PNG/JPEG/SVG…).
 */
'use strict';

const sharp = require('sharp');

const FALLBACK_ACCENT = '#C72E22'; // Reclame red

function clamp255(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function toHex({ r, g, b }) {
  return (
    '#' +
    [r, g, b].map((v) => clamp255(v).toString(16).padStart(2, '0')).join('')
  ).toUpperCase();
}

function hexToRgb(hex) {
  let h = String(hex || '').trim().replace(/^#/, '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16)
  };
}

/** HSL from 0-255 RGB; s and l in [0,1]. */
function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { s, l };
}

/** WCAG relative luminance in [0,1]. */
function relativeLuminance(r, g, b) {
  const chan = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}

/** Linear mix of two RGB colors; t=0 → a, t=1 → b. */
function mixRgb(a, b, t) {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t
  };
}

/** True when the brand set colors by hand — auto extraction must not overwrite. */
function isManualPalette(config) {
  return String(config?.palette_source || '') === 'manual';
}

/** Derive the full palette from a chosen accent RGB. */
function paletteFromAccent(accentRgb) {
  const accentHex = toHex(accentRgb);
  const lum = relativeLuminance(accentRgb.r, accentRgb.g, accentRgb.b);
  const isDark = lum < 0.45;
  const fgRgb = isDark ? { r: 255, g: 255, b: 255 } : { r: 26, g: 26, b: 26 };
  const foregroundColor = toHex(fgRgb);
  // Secondary label: accent pushed 65% toward the foreground so it reads on the bg.
  const labelColor = toHex(mixRgb(accentRgb, fgRgb, 0.65));
  return {
    backgroundColor: accentHex,
    foregroundColor,
    labelColor,
    accent: accentHex
  };
}

/**
 * Extract a brand palette from an image buffer (sharp rasterizes SVG too).
 * @param {Buffer} buffer raw image bytes
 * @returns {Promise<{backgroundColor:string, foregroundColor:string, labelColor:string, accent:string}|null>}
 */
async function extractPaletteFromImage(buffer) {
  if (!buffer || !buffer.length) return null;
  try {
    const { data, info } = await sharp(buffer)
      .resize(48, 48, { fit: 'inside', withoutEnlargement: false })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const channels = info.channels || 4;
    // Quantize to 4 bits per channel, keep per-bucket sums for a faithful average.
    const buckets = new Map();
    for (let i = 0; i + 3 < data.length; i += channels) {
      const a = data[i + 3];
      if (a < 128) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const e = buckets.get(key);
      if (e) {
        e.count += 1;
        e.r += r;
        e.g += g;
        e.b += b;
      } else {
        buckets.set(key, { count: 1, r, g, b });
      }
    }
    if (!buckets.size) return null;

    const candidates = [...buckets.values()]
      .map((e) => ({
        count: e.count,
        r: Math.round(e.r / e.count),
        g: Math.round(e.g / e.count),
        b: Math.round(e.b / e.count)
      }))
      .sort((a, b) => b.count - a.count);

    // 1) most frequent color with real saturation and usable lightness
    let accent = candidates.find((c) => {
      const { s, l } = rgbToHsl(c.r, c.g, c.b);
      return s >= 0.25 && l >= 0.15 && l <= 0.9;
    });
    // 2) fallback: most frequent non-near-white / non-near-black
    if (!accent) {
      accent = candidates.find((c) => {
        const { l } = rgbToHsl(c.r, c.g, c.b);
        return l >= 0.08 && l <= 0.92;
      });
    }
    // 3) final fallback: Reclame red
    const accentRgb = accent
      ? { r: accent.r, g: accent.g, b: accent.b }
      : hexToRgb(FALLBACK_ACCENT);

    return paletteFromAccent(accentRgb);
  } catch (err) {
    console.warn('[brand-palette] extraction failed:', err.message);
    return null;
  }
}

module.exports = {
  extractPaletteFromImage,
  paletteFromAccent,
  isManualPalette,
  relativeLuminance,
  rgbToHsl,
  FALLBACK_ACCENT
};
