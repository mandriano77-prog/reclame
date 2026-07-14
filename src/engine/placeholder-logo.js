'use strict';

/**
 * On-the-fly placeholder merchant logo: a rounded square with the initials on a
 * category color. Real raster PNG served from our own domain, so it works both in
 * the HUB web PWA and on Google Wallet (which rejects unreachable/SVG logos).
 */

const sharp = require('sharp');

// One stable color per HUB category.
const CATEGORY_COLORS = {
  food: '#E8590C',
  retail: '#6C5CE7',
  tech: '#0B7285',
  salute: '#2B8A3E',
  fitness: '#C2255C',
  viaggi: '#1971C2',
  servizi: '#5F3DC4',
  altro: '#495057'
};

function sanitizeInitials(text) {
  const clean = String(text || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return clean.slice(0, 2) || '•';
}

function sanitizeHex(color, fallback = '#6C5CE7') {
  const raw = String(color || '').replace(/^#/, '').trim();
  return /^[0-9a-fA-F]{6}$/.test(raw) ? `#${raw.toUpperCase()}` : fallback;
}

function colorForCategory(category) {
  return CATEGORY_COLORS[String(category || '').toLowerCase()] || null;
}

function escapeXml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function renderPlaceholderLogo({ text, bg, size = 240 } = {}) {
  const s = Math.max(64, Math.min(512, parseInt(size, 10) || 240));
  const initials = escapeXml(sanitizeInitials(text));
  const bgColor = sanitizeHex(bg);
  const fontSize = Math.round(s * 0.42);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
    <rect width="${s}" height="${s}" rx="${Math.round(s * 0.18)}" fill="${bgColor}"/>
    <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central"
      font-family="Inter, Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="700" fill="#FFFFFF">${initials}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = {
  CATEGORY_COLORS,
  sanitizeInitials,
  sanitizeHex,
  colorForCategory,
  renderPlaceholderLogo
};
