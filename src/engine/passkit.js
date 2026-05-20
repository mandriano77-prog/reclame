const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const archiver = require('archiver');
const { Transform } = require('stream');

/**
 * Generate SVG path for a letter using geometric shapes (no font dependency).
 * Returns SVG elements string for the given letter, sized to fit within (w, h).
 */
function letterToSvgPaths(letter, x, y, w, h, fillColor) {
  const l = letter.toUpperCase();
  const t = Math.max(1, Math.round(w * 0.18)); // stroke thickness

  // Each letter is drawn with rect elements only
  switch (l) {
    case 'A': return `
      <rect x="${x}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x}" y="${y}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x}" y="${y + Math.round(h*0.45)}" width="${w}" height="${t}" fill="${fillColor}"/>`;
    case 'B': return `
      <rect x="${x}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x}" y="${y}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x}" y="${y+h-t}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x}" y="${y + Math.round(h*0.45)}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y}" width="${t}" height="${Math.round(h*0.5)}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y + Math.round(h*0.45)}" width="${t}" height="${Math.round(h*0.55)}" fill="${fillColor}"/>`;
    case 'C': return `
      <rect x="${x}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x}" y="${y}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x}" y="${y+h-t}" width="${w}" height="${t}" fill="${fillColor}"/>`;
    case 'D': return `
      <rect x="${x}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x}" y="${y}" width="${Math.round(w*0.7)}" height="${t}" fill="${fillColor}"/>
      <rect x="${x}" y="${y+h-t}" width="${Math.round(w*0.7)}" height="${t}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y+t}" width="${t}" height="${h-t*2}" fill="${fillColor}"/>`;
    case 'E': return `
      <rect x="${x}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x}" y="${y}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x}" y="${y+h-t}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x}" y="${y + Math.round(h*0.45)}" width="${Math.round(w*0.7)}" height="${t}" fill="${fillColor}"/>`;
    case 'F': return `
      <rect x="${x}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x}" y="${y}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x}" y="${y + Math.round(h*0.45)}" width="${Math.round(w*0.7)}" height="${t}" fill="${fillColor}"/>`;
    case 'G': return `
      <rect x="${x}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x}" y="${y}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x}" y="${y+h-t}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y + Math.round(h*0.45)}" width="${t}" height="${Math.round(h*0.55)}" fill="${fillColor}"/>
      <rect x="${x + Math.round(w*0.5)}" y="${y + Math.round(h*0.45)}" width="${Math.round(w*0.5)}" height="${t}" fill="${fillColor}"/>`;
    case 'H': return `
      <rect x="${x}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x}" y="${y + Math.round(h*0.45)}" width="${w}" height="${t}" fill="${fillColor}"/>`;
    case 'I': return `
      <rect x="${x}" y="${y}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x}" y="${y+h-t}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x + Math.round(w*0.5) - Math.round(t*0.5)}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>`;
    case 'J': return `
      <rect x="${x}" y="${y}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x}" y="${y+h-t}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x}" y="${y + Math.round(h*0.6)}" width="${t}" height="${Math.round(h*0.4)}" fill="${fillColor}"/>`;
    case 'K': return `
      <rect x="${x}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y}" width="${t}" height="${Math.round(h*0.5)}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y + Math.round(h*0.45)}" width="${t}" height="${Math.round(h*0.55)}" fill="${fillColor}"/>
      <rect x="${x+t}" y="${y + Math.round(h*0.4)}" width="${w-t*2}" height="${t}" fill="${fillColor}"/>`;
    case 'L': return `
      <rect x="${x}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x}" y="${y+h-t}" width="${w}" height="${t}" fill="${fillColor}"/>`;
    case 'M': return `
      <rect x="${x}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x}" y="${y}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x + Math.round(w*0.5) - Math.round(t*0.5)}" y="${y}" width="${t}" height="${Math.round(h*0.5)}" fill="${fillColor}"/>`;
    case 'N': return `
      <rect x="${x}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x}" y="${y}" width="${w}" height="${t}" fill="${fillColor}"/>`;
    case 'O': return `
      <rect x="${x}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x}" y="${y}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x}" y="${y+h-t}" width="${w}" height="${t}" fill="${fillColor}"/>`;
    case 'P': return `
      <rect x="${x}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x}" y="${y}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x}" y="${y + Math.round(h*0.45)}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y}" width="${t}" height="${Math.round(h*0.5)}" fill="${fillColor}"/>`;
    case 'Q': return `
      <rect x="${x}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x}" y="${y}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x}" y="${y+h-t}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x + Math.round(w*0.6)}" y="${y + Math.round(h*0.6)}" width="${t}" height="${Math.round(h*0.4)}" fill="${fillColor}"/>`;
    case 'R': return `
      <rect x="${x}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x}" y="${y}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x}" y="${y + Math.round(h*0.45)}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y}" width="${t}" height="${Math.round(h*0.5)}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y + Math.round(h*0.45)}" width="${t}" height="${Math.round(h*0.55)}" fill="${fillColor}"/>`;
    case 'S': return `
      <rect x="${x}" y="${y}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x}" y="${y}" width="${t}" height="${Math.round(h*0.5)}" fill="${fillColor}"/>
      <rect x="${x}" y="${y + Math.round(h*0.45)}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y + Math.round(h*0.45)}" width="${t}" height="${Math.round(h*0.55)}" fill="${fillColor}"/>
      <rect x="${x}" y="${y+h-t}" width="${w}" height="${t}" fill="${fillColor}"/>`;
    case 'T': return `
      <rect x="${x}" y="${y}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x + Math.round(w*0.5) - Math.round(t*0.5)}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>`;
    case 'U': return `
      <rect x="${x}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x}" y="${y+h-t}" width="${w}" height="${t}" fill="${fillColor}"/>`;
    case 'V': return `
      <rect x="${x}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x + Math.round(w*0.5) - Math.round(t*0.5)}" y="${y+h-t}" width="${t}" height="${t}" fill="${fillColor}"/>`;
    case 'W': return `
      <rect x="${x}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x}" y="${y+h-t}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x + Math.round(w*0.5) - Math.round(t*0.5)}" y="${y + Math.round(h*0.5)}" width="${t}" height="${Math.round(h*0.5)}" fill="${fillColor}"/>`;
    case 'X': return `
      <rect x="${x}" y="${y}" width="${t}" height="${Math.round(h*0.45)}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y}" width="${t}" height="${Math.round(h*0.45)}" fill="${fillColor}"/>
      <rect x="${x}" y="${y + Math.round(h*0.4)}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x}" y="${y + Math.round(h*0.5)}" width="${t}" height="${Math.round(h*0.5)}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y + Math.round(h*0.5)}" width="${t}" height="${Math.round(h*0.5)}" fill="${fillColor}"/>`;
    case 'Y': return `
      <rect x="${x}" y="${y}" width="${t}" height="${Math.round(h*0.5)}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y}" width="${t}" height="${Math.round(h*0.5)}" fill="${fillColor}"/>
      <rect x="${x}" y="${y + Math.round(h*0.45)}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x + Math.round(w*0.5) - Math.round(t*0.5)}" y="${y + Math.round(h*0.45)}" width="${t}" height="${Math.round(h*0.55)}" fill="${fillColor}"/>`;
    case 'Z': return `
      <rect x="${x}" y="${y}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x}" y="${y+h-t}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x}" y="${y + Math.round(h*0.4)}" width="${w}" height="${t}" fill="${fillColor}"/>`;
    default: // fallback: simple block
      return `<rect x="${x+Math.round(w*0.2)}" y="${y+Math.round(h*0.2)}" width="${Math.round(w*0.6)}" height="${Math.round(h*0.6)}" rx="${Math.round(w*0.1)}" fill="${fillColor}" opacity="0.6"/>`;
  }
}

/**
 * Parse hex color string to {r, g, b} object
 * Supports #RGB, #RRGGBB, and rgb(r,g,b) formats
 */
function parseColor(color) {
  // Handle rgb(r,g,b) format
  const rgbMatch = color.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (rgbMatch) {
    return { r: parseInt(rgbMatch[1]), g: parseInt(rgbMatch[2]), b: parseInt(rgbMatch[3]) };
  }
  // Handle hex format
  let hex = color.replace('#', '');
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  return {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16)
  };
}

/**
 * Apple: max 10 locations per pass; invalid coordinates must not appear in pass.json.
 * @param {Record<string, unknown>} brandConfig
 * @returns {{ latitude: number, longitude: number, relevantText?: string, altitude?: number }[]}
 */
function normalizePassLocations(brandConfig) {
  const raw = brandConfig.locations;
  if (!raw || !Array.isArray(raw) || raw.length === 0) return [];
  const out = [];
  for (const loc of raw) {
    if (out.length >= 10) break;
    const latitude = parseFloat(/** @type {{ latitude?: unknown }} */ (loc).latitude);
    const longitude = parseFloat(/** @type {{ longitude?: unknown }} */ (loc).longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) continue;
    const entry = { latitude, longitude };
    const rt = loc.relevantText;
    if (rt != null && String(rt).trim()) entry.relevantText = String(rt).trim().slice(0, 200);
    if (loc.altitude != null && loc.altitude !== '') {
      const alt = parseFloat(loc.altitude);
      if (Number.isFinite(alt)) entry.altitude = alt;
    }
    out.push(entry);
  }
  return out;
}

/** Map template back-field keys to link slot index 0..2 (Link 1–3). */
function backFieldLinkSlotIndex(key) {
  const k = String(key || '').toLowerCase();
  if (k === 'link1' || k === 'link_0' || k === 'link0') return 0;
  if (k === 'link2' || k === 'link_1') return 1;
  if (k === 'link3' || k === 'link_2') return 2;
  return -1;
}

const TEMPLATE_LINK_FIELD_KEYS = new Set(['link1', 'link2', 'link3', 'link_0', 'link_1', 'link_2', 'link0']);

/**
 * Always three slots — empty middle links must not shift Link 3 into Link 2 position.
 */
function resolveTemplateLinkSlots(tplFields) {
  const slots = [
    { label: '', url: '' },
    { label: '', url: '' },
    { label: '', url: '' }
  ];
  if (!tplFields) return slots;

  const put = (idx, label, url) => {
    if (idx < 0 || idx > 2) return;
    const l = label != null ? String(label).trim() : '';
    const u = url != null ? String(url).trim() : '';
    if (!l && !u) return;
    slots[idx] = { label: l, url: u };
  };

  if (!Array.isArray(tplFields) && Array.isArray(tplFields.links)) {
    tplFields.links.forEach((link, i) => {
      if (i > 2 || !link) return;
      put(i, link.label, link.url);
    });
    return slots;
  }

  if (!Array.isArray(tplFields) && Array.isArray(tplFields.backFields)) {
    tplFields.backFields.forEach((bf) => {
      const idx = backFieldLinkSlotIndex(bf.key);
      if (idx >= 0) put(idx, bf.label, bf.value || bf.url);
    });
    return slots;
  }

  if (Array.isArray(tplFields)) {
    tplFields.forEach((field) => {
      if (field.type !== 'back') return;
      const idx = backFieldLinkSlotIndex(field.key);
      if (idx >= 0) put(idx, field.label, field.value);
    });
  }
  return slots;
}

/**
 * Generate the pass.json content for Apple Wallet
 */
function generatePassJson(template, instance, brand, options = {}) {
  const {
    baseUrl = 'http://localhost:3000',
    passTypeIdentifier = process.env.PASS_TYPE_IDENTIFIER || `pass.com.nudj.${brand.slug}`,
    teamIdentifier = process.env.TEAM_IDENTIFIER || 'XXXXXXXXXX'
  } = options;

  // Read colors from brand.config first, then template.style, then defaults
  const brandConfig = brand.config || {};
  const fgHex = brandConfig.foregroundColor || null;
  const foregroundColor = fgHex ? `rgb(${parseColor(fgHex).r}, ${parseColor(fgHex).g}, ${parseColor(fgHex).b})` : (template.style?.foregroundColor || 'rgb(255, 255, 255)');
  const bgHex = brandConfig.backgroundColor || null;
  const backgroundColor = bgHex ? `rgb(${parseColor(bgHex).r}, ${parseColor(bgHex).g}, ${parseColor(bgHex).b})` : (template.style?.backgroundColor || 'rgb(0, 0, 0)');
  const lblHex = brandConfig.labelColor || null;
  const labelColor = lblHex ? `rgb(${parseColor(lblHex).r}, ${parseColor(lblHex).g}, ${parseColor(lblHex).b})` : (template.style?.labelColor || 'rgb(212, 230, 0)');

  // ── Build field arrays ──────────────────────────────────────────
  // Layout (storeCard): Header → Strip → Secondary → Auxiliary → Back
  const headerFields = [];
  const secondaryFields = [];
  const auxiliaryFields = [];
  const backFields = [];

  // No primaryFields — they overlay the strip image on storeCard
  const primaryFields = [];

  // FIELDS from template — supports both legacy array and new object format
  const tplFields = template.fields || {};
  let hasTemplateHeader = false;
  if (Array.isArray(tplFields)) {
    // Legacy array format: [{key, label, value, type}]
    tplFields.forEach((field) => {
      const fieldObj = {
        key: field.key,
        label: (field.label || field.key).toUpperCase(),
        value: instance.field_values?.[field.key] || field.value || ''
      };
      if (field.dateStyle) fieldObj.dateStyle = field.dateStyle;
      if (field.type === 'secondary') secondaryFields.push(fieldObj);
      else if (field.type === 'auxiliary') auxiliaryFields.push(fieldObj);
      else if (field.type === 'back') backFields.push(fieldObj);
    });
  } else {
    // New object format: {headerFields, secondaryFields, auxiliaryFields, links, regolamento, contatti}
    if (tplFields.headerFields) {
      tplFields.headerFields.forEach(f => {
        if (f.label || f.value) { hasTemplateHeader = true; headerFields.push({ key: f.key || 'header_info', label: (f.label || '').toUpperCase(), value: f.value || '' }); }
      });
    }
    if (tplFields.secondaryFields) {
      tplFields.secondaryFields.forEach(f => {
        if (f.label || f.value) secondaryFields.push({ key: f.key || 'sec_info', label: (f.label || '').toUpperCase(), value: instance.field_values?.[f.key] || f.value || '' });
      });
    }
    if (tplFields.auxiliaryFields) {
      tplFields.auxiliaryFields.forEach(f => {
        if (f.label || f.value) auxiliaryFields.push({ key: f.key || 'aux_info', label: (f.label || '').toUpperCase(), value: instance.field_values?.[f.key] || f.value || '' });
      });
    }
  }

  // Pass face (auxiliary): optional override, else mirror first POI lock-screen message so the tessera updates without a second form.
  const GEO_AUX_KEY = 'geo_inzone_promo';
  let geoFaceMsg = String(brandConfig.geofencingFaceMessage || '').trim();
  if (!geoFaceMsg && brandConfig.locations && Array.isArray(brandConfig.locations)) {
    for (const loc of brandConfig.locations) {
      const t = String(loc.relevantText || '').trim();
      if (t) {
        geoFaceMsg = t.slice(0, 120);
        break;
      }
    }
  }
  let geoFaceLbl = String(brandConfig.geofencingFaceLabel || '').trim();
  if (!geoFaceLbl && brandConfig.locations && Array.isArray(brandConfig.locations)) {
    const firstWithText = brandConfig.locations.find((l) => String(l.relevantText || '').trim());
    if (firstWithText && String(firstWithText.name || '').trim()) {
      geoFaceLbl = String(firstWithText.name).trim().toUpperCase().slice(0, 16);
    }
  }
  if (!geoFaceLbl) geoFaceLbl = 'MESSAGGIO';
  geoFaceLbl = geoFaceLbl.toUpperCase().slice(0, 16) || 'MESSAGGIO';
  if (geoFaceMsg) {
    const field = { key: GEO_AUX_KEY, label: geoFaceLbl, value: geoFaceMsg.slice(0, 120) };
    const existingIdx = auxiliaryFields.findIndex((f) => f.key === GEO_AUX_KEY);
    if (existingIdx >= 0) auxiliaryFields.splice(existingIdx, 1);
    auxiliaryFields.unshift(field);
  } else {
    const stale = auxiliaryFields.findIndex((f) => f.key === GEO_AUX_KEY);
    if (stale >= 0) auxiliaryFields.splice(stale, 1);
  }

  // HEADER fallback: hint to tap ··· for more details (only if template has no custom header)
  if (!hasTemplateHeader) {
    headerFields.push({
      key: 'info_hint',
      label: 'CLICK SUI PUNTINI',
      value: 'per i dettagli'
    });
  }

  // AUXILIARY: Promo teaser on pass front — changeMessage triggers lock screen notification
  // IMPORTANT: only FRONT fields (header/primary/secondary/auxiliary) trigger lock screen
  // notifications. Back fields update silently. The value MUST change each push.
  if (brandConfig.pushAnnouncement && brandConfig.pushAnnouncement.message) {
    const promoTitle = (brandConfig.pushAnnouncement.title || 'NOVITÀ').substring(0, 30).toUpperCase();
    const pushTs = brandConfig.pushAnnouncement.ts || Date.now();
    // Invisible zero-width spaces make value unique without visible artifacts
    const zwsp = '​'.repeat((pushTs % 10) + 1);
    const promoText = brandConfig.pushAnnouncement.message.substring(0, 30);
    auxiliaryFields.push({
      key: 'announcement',
      label: promoTitle,
      value: promoText + zwsp,
      changeMessage: '%@'
    });
  }

  // ── BACK FIELDS (order: Novità → Link 1 → Regolamento → Link 2 → Link 3 → Contatti) ──

  function wrapTrackableBackLinkUrl(key, label, destinationUrl) {
    if (!destinationUrl || !instance.serial_number) return destinationUrl;
    if (/^(mailto:|tel:|javascript:)/i.test(destinationUrl)) return destinationUrl;
    if (String(destinationUrl).includes('/track/pass-link')) return destinationUrl;
    try {
      const tracked = new URL(`${baseUrl}/api/track/pass-link`);
      tracked.searchParams.set('sn', instance.serial_number);
      tracked.searchParams.set('key', key);
      tracked.searchParams.set('to', destinationUrl);
      if (label) tracked.searchParams.set('label', label);
      return tracked.toString();
    } catch (_) {
      return destinationUrl;
    }
  }

  function makeBackLinkField(key, label, url) {
    const trackedUrl = url ? wrapTrackableBackLinkUrl(key, label, url) : null;
    const field = {
      key,
      label: '',
      value: label || url || ''
    };
    if (trackedUrl) {
      field.attributedValue = `<a href="${trackedUrl}">${label || url}</a>`;
    }
    return field;
  }

  function resolveBackLink1(brandCfg, serialNumber) {
    const pushOut = brandCfg.pushLinkOut;
    if (pushOut?.url) {
      return makeBackLinkField('link_0', pushOut.label || 'Scopri di più', pushOut.url);
    }
    if (brandCfg.instantWinActive && serialNumber) {
      const playUrl = `${baseUrl}/play/${serialNumber}`;
      const iwLabel = brandCfg.instantWinActive.label || 'Gioca e Vinci!';
      return makeBackLinkField('link_0', iwLabel, playUrl);
    }
    if (brandCfg.gamificationActive && serialNumber) {
      const gameTypeRoutes = { quiz: 'quiz', memory: 'memory', puzzle: 'puzzle' };
      const gameRoute = gameTypeRoutes[brandCfg.gamificationActive.game_type] || 'quiz';
      const gameUrl = `${baseUrl}/game/${gameRoute}/${serialNumber}`;
      const gamLabel = brandCfg.gamificationActive.label || 'Gioca ora!';
      return makeBackLinkField('link_0', gamLabel, gameUrl);
    }
    return null;
  }

  const orderedBackFields = [];
  if (brandConfig.pushAnnouncement && brandConfig.pushAnnouncement.message) {
    orderedBackFields.push({
      key: 'announcement_full',
      label: brandConfig.pushAnnouncement.title || 'NOVITÀ E PROMOZIONI',
      value: brandConfig.pushAnnouncement.message
    });
  }

  const linkSlots = resolveTemplateLinkSlots(tplFields);
  const link1 = resolveBackLink1(brandConfig, instance.serial_number)
    || (linkSlots[0].label || linkSlots[0].url
      ? makeBackLinkField('link_0', linkSlots[0].label, linkSlots[0].url)
      : null);
  if (link1) orderedBackFields.push(link1);

  // 3. REGOLAMENTO — from brand backContent OR template fields
  const backContent = brandConfig.backContent || {};
  const tplRegolamento = (!Array.isArray(tplFields) && tplFields.regolamento) || '';
  const regolamento = backContent.regolamento || tplRegolamento;
  if (regolamento) {
    orderedBackFields.push({
      key: 'regolamento',
      label: '',
      value: regolamento
    });
  }

  [1, 2].forEach((idx) => {
    const link = linkSlots[idx];
    if (!link.label && !link.url) return;
    orderedBackFields.push(makeBackLinkField(`link_${idx}`, link.label, link.url));
  });

  // 4. CONTATTI — from brand backContent OR template fields
  const tplContatti = (!Array.isArray(tplFields) && tplFields.contatti) || '';
  const contatti = backContent.contatti || tplContatti;
  if (contatti) {
    orderedBackFields.push({
      key: 'contatti',
      label: '',
      value: contatti
    });
  }

  // 5. Any remaining template back fields (fallback)
  backFields.forEach(f => {
    // Skip if already covered by backContent or link slots
    if (f.key === 'regolamento' && backContent.regolamento) return;
    if (f.key === 'contatti' && backContent.contatti) return;
    if (TEMPLATE_LINK_FIELD_KEYS.has(String(f.key || '').toLowerCase())) return;
    orderedBackFields.push(f);
  });

  // ── Pass structure ────────────────────────────────────────────
  const structureKey = template.pass_type || 'storeCard';
  const passStructure = {};
  if (headerFields.length > 0) passStructure.headerFields = headerFields;
  if (primaryFields.length > 0) passStructure.primaryFields = primaryFields;
  if (secondaryFields.length > 0) passStructure.secondaryFields = secondaryFields;
  if (auxiliaryFields.length > 0) passStructure.auxiliaryFields = auxiliaryFields;
  if (orderedBackFields.length > 0) passStructure.backFields = orderedBackFields;

  const passJson = {
    formatVersion: 1,
    passTypeIdentifier,
    serialNumber: instance.serial_number,
    teamIdentifier,
    organizationName: brand.name,
    description: template.name,
    foregroundColor,
    backgroundColor,
    labelColor,
    authenticationToken: instance.auth_token,
    webServiceURL: `${baseUrl}/api`,
    [structureKey]: passStructure,
    // Barcode — PDF417 compact rectangle (scannable, low visual footprint)
    barcodes: [
      {
        message: instance.serial_number,
        format: 'PKBarcodeFormatPDF417',
        messageEncoding: 'iso-8859-1',
        altText: `N° ${instance.serial_number.substring(0, 13)}`
      }
    ],
    barcode: {
      message: instance.serial_number,
      format: 'PKBarcodeFormatPDF417',
      messageEncoding: 'iso-8859-1',
      altText: `N° ${instance.serial_number.substring(0, 13)}`
    }
  };

  // Geofencing — iOS shows the pass on lock screen when inside maxDistance (m) of any location.
  // Sticky / repeated appearance while stationary is normal iOS behavior inside the zone, not APNs.
  const normalizedLocs = normalizePassLocations(brandConfig);
  if (normalizedLocs.length > 0) {
    passJson.locations = normalizedLocs;
  }

  // Relevant date — triggers lock screen notification at this time
  if (brandConfig.relevantDate) {
    passJson.relevantDate = brandConfig.relevantDate;
  }

  // maxDistance (m): explicit brand maxDistance, else largest POI radius, else 500. Clamp to sane range.
  let maxRadius = 500;
  if (brandConfig.locations && Array.isArray(brandConfig.locations)) {
    brandConfig.locations.forEach((loc) => {
      const r = parseInt(String(loc.radius), 10);
      if (Number.isFinite(r) && r > maxRadius) maxRadius = r;
    });
  }
  let maxDistanceM = parseInt(String(brandConfig.maxDistance), 10);
  if (!Number.isFinite(maxDistanceM) || maxDistanceM < 1) maxDistanceM = maxRadius;
  maxDistanceM = Math.min(Math.max(maxDistanceM, 1), 100000);
  if (normalizedLocs.length > 0) {
    passJson.maxDistance = maxDistanceM;
  }

  return passJson;
}

/**
 * Generate icon PNG files with brand initial (geometric paths, no font needed)
 */
async function generateIcon(brandName, bgColor = '#0D0B1A', fgColor = '#FFFFFF') {
  const initial = brandName.charAt(0).toUpperCase();
  const bg = parseColor(bgColor);

  // 29x29 icon — letter drawn with geometric rects
  const letter29 = letterToSvgPaths(initial, 7, 6, 15, 17, fgColor);
  const icon29 = await sharp(Buffer.from(
    `<svg width="29" height="29" xmlns="http://www.w3.org/2000/svg">
      <rect width="29" height="29" fill="${bgColor}"/>${letter29}
    </svg>`
  )).png().toBuffer();

  // 58x58 icon (2x)
  const letter58 = letterToSvgPaths(initial, 14, 12, 30, 34, fgColor);
  const icon58 = await sharp(Buffer.from(
    `<svg width="58" height="58" xmlns="http://www.w3.org/2000/svg">
      <rect width="58" height="58" fill="${bgColor}"/>${letter58}
    </svg>`
  )).png().toBuffer();

  return { icon: icon29, icon2x: icon58 };
}

/**
 * Generate logo PNG files — shows brand initial in a rounded badge.
 * The full brand name is displayed via logoText in pass.json.
 * Uses geometric SVG paths — NO font/text dependency.
 */
async function generateLogo(brandName, bgColor = '#0D0B1A', fgColor = '#FFFFFF') {
  const initial = brandName.charAt(0).toUpperCase();

  // 160x50 logo — initial letter in a rounded rect badge, aligned LEFT
  const letter160 = letterToSvgPaths(initial, 16, 10, 20, 30, fgColor);
  const logo160 = await sharp(Buffer.from(
    `<svg width="160" height="50" xmlns="http://www.w3.org/2000/svg">
      <rect width="160" height="50" fill="${bgColor}"/>
      <rect x="6" y="3" width="44" height="44" rx="10" fill="${fgColor}" opacity="0.15"/>${letter160}
    </svg>`
  )).png().toBuffer();

  // 320x100 logo (2x) — aligned LEFT
  const letter320 = letterToSvgPaths(initial, 32, 20, 40, 60, fgColor);
  const logo320 = await sharp(Buffer.from(
    `<svg width="320" height="100" xmlns="http://www.w3.org/2000/svg">
      <rect width="320" height="100" fill="${bgColor}"/>
      <rect x="12" y="6" width="88" height="88" rx="20" fill="${fgColor}" opacity="0.15"/>${letter320}
    </svg>`
  )).png().toBuffer();

  return { logo: logo160, logo2x: logo320 };
}

/**
 * Generate strip image (for coupon/storeCard) — geometric initial, no font
 */
async function generateStrip(brandName, bgColor = '#0D0B1A', fgColor = '#FFFFFF') {
  const initial = brandName.charAt(0).toUpperCase();

  // 375x123 strip — large initial centered, clean background (no decorative rect)
  const letter375 = letterToSvgPaths(initial, 162, 22, 50, 80, fgColor);
  const strip375 = await sharp(Buffer.from(
    `<svg width="375" height="123" xmlns="http://www.w3.org/2000/svg">
      <rect width="375" height="123" fill="${bgColor}"/>${letter375}
    </svg>`
  )).png().toBuffer();

  // 750x246 strip (2x)
  const letter750 = letterToSvgPaths(initial, 325, 43, 100, 160, fgColor);
  const strip750 = await sharp(Buffer.from(
    `<svg width="750" height="246" xmlns="http://www.w3.org/2000/svg">
      <rect width="750" height="246" fill="${bgColor}"/>${letter750}
    </svg>`
  )).png().toBuffer();

  return { strip: strip375, strip2x: strip750 };
}

/**
 * Generate manifest.json with SHA1 hashes
 */
function generateManifest(files) {
  const manifest = {};

  Object.entries(files).forEach(([filename, buffer]) => {
    const sha1 = crypto.createHash('sha1');
    sha1.update(buffer);
    manifest[filename] = sha1.digest('hex');
  });

  return JSON.stringify(manifest);
}

/**
 * Clean PEM file: remove Bag Attributes and other non-PEM content
 */
function cleanPem(pem) {
  const lines = pem.split('\n');
  const cleaned = [];
  let inBlock = false;
  for (const line of lines) {
    if (line.startsWith('-----BEGIN')) { inBlock = true; cleaned.push(line); continue; }
    if (line.startsWith('-----END')) { cleaned.push(line); inBlock = false; continue; }
    if (inBlock && !line.startsWith('Bag Attributes') && !line.match(/^\s*(friendlyName|localKeyID|subject|issuer|Key Fingerprint)/) && !line.match(/^\s+[0-9A-Fa-f]{2}\s/) && line.trim() !== '') {
      cleaned.push(line);
    }
  }
  return cleaned.join('\n');
}

/**
 * Sign the manifest using openssl cms (reliable Apple-compatible signing)
 */
function signManifest(manifestJson, certPath, keyPath, wwdrPath) {
  const { execSync } = require('child_process');

  const hasCerts = fs.existsSync(certPath) && fs.existsSync(keyPath);

  if (!hasCerts) {
    console.warn('⚠️ MOCK MODE: pass not signed (install Apple certificate to enable)');
    return Buffer.from('UNSIGNED_MOCK_SIGNATURE');
  }

  try {
    // Create temp dir for signing
    const tmpDir = `/tmp/pkpass-sign-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    fs.mkdirSync(tmpDir, { recursive: true });

    // Clean PEM files to remove Bag Attributes
    const cleanCert = cleanPem(fs.readFileSync(certPath, 'utf8'));
    const cleanKey = cleanPem(fs.readFileSync(keyPath, 'utf8'));

    const tmpCert = path.join(tmpDir, 'cert.pem');
    const tmpKey = path.join(tmpDir, 'key.pem');
    const tmpManifest = path.join(tmpDir, 'manifest.json');
    const tmpSig = path.join(tmpDir, 'signature');

    fs.writeFileSync(tmpCert, cleanCert);
    fs.writeFileSync(tmpKey, cleanKey, { mode: 0o600 });
    fs.writeFileSync(tmpManifest, manifestJson);

    // Build openssl cms command
    let cmd = `openssl cms -sign -binary -in ${tmpManifest} -signer ${tmpCert} -inkey ${tmpKey} -outform DER -out ${tmpSig}`;
    if (wwdrPath && fs.existsSync(wwdrPath)) {
      const cleanWwdr = cleanPem(fs.readFileSync(wwdrPath, 'utf8'));
      const tmpWwdr = path.join(tmpDir, 'wwdr.pem');
      fs.writeFileSync(tmpWwdr, cleanWwdr);
      cmd += ` -certfile ${tmpWwdr}`;
    }

    execSync(cmd, { stdio: 'pipe' });

    const signature = fs.readFileSync(tmpSig);
    console.log(`✓ Pass signed with openssl cms (${signature.length} bytes)`);

    // Cleanup
    try { execSync(`rm -rf ${tmpDir}`, { stdio: 'pipe' }); } catch(e) {}

    return signature;
  } catch (error) {
    console.error('⚠️ openssl cms signing failed:', error.message);
    // Fallback: try smime
    try {
      const tmpDir2 = `/tmp/pkpass-smime-${Date.now()}`;
      fs.mkdirSync(tmpDir2, { recursive: true });
      const cleanCert = cleanPem(fs.readFileSync(certPath, 'utf8'));
      const cleanKey = cleanPem(fs.readFileSync(keyPath, 'utf8'));
      fs.writeFileSync(path.join(tmpDir2, 'cert.pem'), cleanCert);
      fs.writeFileSync(path.join(tmpDir2, 'key.pem'), cleanKey, { mode: 0o600 });
      fs.writeFileSync(path.join(tmpDir2, 'manifest.json'), manifestJson);

      let cmd = `openssl smime -sign -binary -in ${tmpDir2}/manifest.json -signer ${tmpDir2}/cert.pem -inkey ${tmpDir2}/key.pem -outform DER -out ${tmpDir2}/sig.der`;
      if (wwdrPath && fs.existsSync(wwdrPath)) {
        const cleanWwdr = cleanPem(fs.readFileSync(wwdrPath, 'utf8'));
        fs.writeFileSync(path.join(tmpDir2, 'wwdr.pem'), cleanWwdr);
        cmd += ` -certfile ${tmpDir2}/wwdr.pem`;
      }
      execSync(cmd, { stdio: 'pipe' });
      const sig = fs.readFileSync(path.join(tmpDir2, 'sig.der'));
      console.log(`✓ Pass signed with openssl smime fallback (${sig.length} bytes)`);
      try { execSync(`rm -rf ${tmpDir2}`, { stdio: 'pipe' }); } catch(e) {}
      return sig;
    } catch(e2) {
      console.error('⚠️ MOCK MODE: both cms and smime signing failed:', e2.message);
      return Buffer.from('UNSIGNED_MOCK_SIGNATURE');
    }
  }
}

/**
 * Create the complete .pkpass file
 */
async function createPkpass(template, instance, brand, options = {}) {
  const {
    baseUrl = 'http://localhost:3000',
    certPath = path.join(__dirname, '../../certs/signerCert.pem'),
    keyPath = path.join(__dirname, '../../certs/signerKey.pem'),
    wwdrPath = path.join(__dirname, '../../certs/wwdr.pem')
  } = options;

  // Generate pass.json
  const passJson = generatePassJson(template, instance, brand, { baseUrl });

  // Generate images - use brand.config colors first, then template.style, then defaults
  const brandCfg = brand.config || {};
  const bgColor = brandCfg.backgroundColor || template.style?.backgroundColor || '#0D0B1A';
  const fgColor = brandCfg.foregroundColor || template.style?.foregroundColor || '#FFFFFF';

  let iconBuffers, logoBuffers;

  // Check if brand has custom logo images (base64 in config)
  // Re-process logos to ensure left alignment every time
  if (brand.config?.logos) {
    const brandLogos = brand.config.logos;
    iconBuffers = {
      icon: brandLogos['icon'] ? Buffer.from(brandLogos['icon'], 'base64') : null,
      icon2x: brandLogos['icon@2x'] ? Buffer.from(brandLogos['icon@2x'], 'base64') : null
    };

    // Re-resize logos with left alignment (stored logos may be centered)
    if (brandLogos['logo']) {
      const rawLogo = Buffer.from(brandLogos['logo'], 'base64');
      const logo1x = await sharp(rawLogo).resize(160, 50, { fit: 'contain', position: 'left', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
      const logo2x = await sharp(rawLogo).resize(320, 100, { fit: 'contain', position: 'left', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
      logoBuffers = { logo: logo1x, logo2x: logo2x };
    } else {
      logoBuffers = { logo: null, logo2x: null };
    }
    console.log('✓ Using custom brand logos (left-aligned)');
  }

  // Fall back to default icon files, then generated
  if (!iconBuffers?.icon) {
    const defaultIconPath = path.join(__dirname, '..', '..', 'public', 'assets', 'default-icon.png');
    const defaultIcon2xPath = path.join(__dirname, '..', '..', 'public', 'assets', 'default-icon@2x.png');
    if (fs.existsSync(defaultIconPath)) {
      iconBuffers = {
        icon: fs.readFileSync(defaultIconPath),
        icon2x: fs.existsSync(defaultIcon2xPath) ? fs.readFileSync(defaultIcon2xPath) : fs.readFileSync(defaultIconPath)
      };
      console.log('✓ Using default icon (H mark from assets)');
    } else {
      const icons = await generateIcon(brand.name, bgColor, fgColor);
      iconBuffers = icons;
    }
  }
  if (!logoBuffers?.logo) {
    const logos = await generateLogo(brand.name, bgColor, fgColor);
    logoBuffers = logos;
  }

  // Template-level images override brand-level (template.style.images)
  const tplImages = template.style?.images || {};

  // Logo from template overrides brand logo
  if (tplImages.logo) {
    const rawLogo = Buffer.from(tplImages.logo, 'base64');
    const logo1x = await sharp(rawLogo).resize(160, 50, { fit: 'contain', position: 'left', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const logo2x = await sharp(rawLogo).resize(320, 100, { fit: 'contain', position: 'left', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    logoBuffers = { logo: logo1x, logo2x: logo2x };
    console.log('✓ Using template-level logo');
  }

  // Strip images — push override → template → brand → default file → generated
  let stripBuffers;
  const defaultStripPath = path.join(__dirname, '..', '..', 'public', 'assets', 'default-strip.png');
  const pushStripB64 = brandCfg.stripOverride;
  if (pushStripB64) {
    const rawStrip = Buffer.from(pushStripB64, 'base64');
    const strip1x = await sharp(rawStrip).resize(375, 123, { fit: 'cover' }).png().toBuffer();
    const strip2x = await sharp(rawStrip).resize(750, 246, { fit: 'cover' }).png().toBuffer();
    stripBuffers = { strip: strip1x, strip2x: strip2x };
    console.log('✓ Using push strip override');
  } else if (tplImages.strip) {
    const rawStrip = Buffer.from(tplImages.strip, 'base64');
    const strip1x = await sharp(rawStrip).resize(375, 123, { fit: 'cover' }).png().toBuffer();
    const strip2x = await sharp(rawStrip).resize(750, 246, { fit: 'cover' }).png().toBuffer();
    stripBuffers = { strip: strip1x, strip2x: strip2x };
    console.log('✓ Using template-level strip image');
  } else if (brand.config?.logos?.strip) {
    const rawStrip = Buffer.from(brand.config.logos.strip, 'base64');
    const strip1x = await sharp(rawStrip).resize(375, 123, { fit: 'cover' }).png().toBuffer();
    const strip2x = await sharp(rawStrip).resize(750, 246, { fit: 'cover' }).png().toBuffer();
    stripBuffers = { strip: strip1x, strip2x: strip2x };
    console.log('✓ Using custom strip image (from brand)');
  } else if (fs.existsSync(defaultStripPath)) {
    const rawStrip = fs.readFileSync(defaultStripPath);
    const strip1x = await sharp(rawStrip).resize(375, 123, { fit: 'cover' }).png().toBuffer();
    const strip2x = await sharp(rawStrip).resize(750, 246, { fit: 'cover' }).png().toBuffer();
    stripBuffers = { strip: strip1x, strip2x: strip2x };
    console.log('✓ Using default strip image (from file)');
  } else {
    stripBuffers = await generateStrip(brand.name, bgColor, fgColor);
  }

  // Thumbnail — for generic and eventTicket
  let thumbnailBuffers = null;
  if (tplImages.thumbnail) {
    const rawThumb = Buffer.from(tplImages.thumbnail, 'base64');
    thumbnailBuffers = {
      thumb: await sharp(rawThumb).resize(90, 90, { fit: 'cover' }).png().toBuffer(),
      thumb2x: await sharp(rawThumb).resize(180, 180, { fit: 'cover' }).png().toBuffer()
    };
    console.log('✓ Using template-level thumbnail');
  }

  // Background — for eventTicket
  let backgroundBuffers = null;
  if (tplImages.background) {
    const rawBg = Buffer.from(tplImages.background, 'base64');
    backgroundBuffers = {
      bg: await sharp(rawBg).resize(180, 220, { fit: 'cover' }).png().toBuffer(),
      bg2x: await sharp(rawBg).resize(360, 440, { fit: 'cover' }).png().toBuffer()
    };
    console.log('✓ Using template-level background');
  }

  // Build file map
  const files = {
    'pass.json': Buffer.from(JSON.stringify(passJson, null, 2)),
    'icon.png': iconBuffers.icon,
    'icon@2x.png': iconBuffers.icon2x || iconBuffers.icon,
    'logo.png': logoBuffers.logo,
    'logo@2x.png': logoBuffers.logo2x || logoBuffers.logo
  };

  // Strip images for storeCard/coupon/eventTicket (unless eventTicket uses background+thumbnail instead)
  const passType = template.pass_type || 'storeCard';
  if (passType === 'coupon' || passType === 'storeCard' || (passType === 'eventTicket' && !backgroundBuffers)) {
    files['strip.png'] = stripBuffers.strip;
    files['strip@2x.png'] = stripBuffers.strip2x;
  }

  // Thumbnail for generic/eventTicket
  if (thumbnailBuffers && (passType === 'generic' || passType === 'eventTicket')) {
    files['thumbnail.png'] = thumbnailBuffers.thumb;
    files['thumbnail@2x.png'] = thumbnailBuffers.thumb2x;
  }

  // Background for eventTicket
  if (backgroundBuffers && passType === 'eventTicket') {
    files['background.png'] = backgroundBuffers.bg;
    files['background@2x.png'] = backgroundBuffers.bg2x;
  }

  // Generate manifest
  const manifestJson = generateManifest(files);
  const manifestBuffer = Buffer.from(manifestJson);
  files['manifest.json'] = manifestBuffer;

  // Sign manifest
  const signature = signManifest(manifestJson, certPath, keyPath, wwdrPath);
  files['signature'] = signature;

  // Create ZIP archive
  return new Promise((resolve, reject) => {
    const buffers = [];
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('data', (chunk) => {
      buffers.push(chunk);
    });

    archive.on('end', () => {
      resolve(Buffer.concat(buffers));
    });

    archive.on('error', (err) => {
      reject(err);
    });

    // Add files to archive
    Object.entries(files).forEach(([filename, buffer]) => {
      archive.append(buffer, { name: filename });
    });

    archive.finalize();
  });
}

/**
 * Generate default images for a brand (unused in createPkpass but available)
 */
async function generateDefaultImages(brandName, primaryColor = '#0D0B1A') {
  const fgColor = '#FFFFFF';
  const icons = await generateIcon(brandName, primaryColor, fgColor);
  const logos = await generateLogo(brandName, primaryColor, fgColor);
  const strips = await generateStrip(brandName, primaryColor, fgColor);

  return {
    icons,
    logos,
    strips
  };
}

module.exports = {
  generatePassJson,
  generateIcon,
  generateLogo,
  generateStrip,
  generateManifest,
  signManifest,
  createPkpass,
  generateDefaultImages
};
