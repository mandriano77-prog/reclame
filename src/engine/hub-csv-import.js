'use strict';

const { parse } = require('csv-parse/sync');

const REQUIRED_COLUMNS = ['merchant_name', 'category', 'discount_label'];
const VALID_CATEGORIES = new Set([
  'food', 'fitness', 'retail', 'salute', 'viaggi', 'tech', 'servizi', 'altro'
]);

function normalizeHeader(h) {
  return String(h || '').trim().toLowerCase().replace(/\s+/g, '_');
}

function parseBool(value) {
  const v = String(value || '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'si' || v === 'sì';
}

function rowToMerchantPayload(row) {
  return {
    name: String(row.merchant_name || '').trim(),
    category: String(row.category || '').trim().toLowerCase(),
    logo_url: row.logo_url ? String(row.logo_url).trim() : null,
    description: row.description ? String(row.description).trim() : null,
    discount_label: String(row.discount_label || '').trim(),
    conditions: row.conditions ? String(row.conditions).trim() : null,
    valid_until: row.valid_until ? String(row.valid_until).trim() : null,
    online_enabled: parseBool(row.online_enabled),
    online_url: row.online_url ? String(row.online_url).trim() : null,
    online_promo_code: row.online_promo_code ? String(row.online_promo_code).trim() : null,
    physical_enabled: parseBool(row.physical_enabled),
    location: {
      address: row.address ? String(row.address).trim() : null,
      city: row.city ? String(row.city).trim() : null,
      latitude: row.latitude ? String(row.latitude).trim() : null,
      longitude: row.longitude ? String(row.longitude).trim() : null
    }
  };
}

function validateMerchantRow(payload, rowNum) {
  if (!payload.name) return `Riga ${rowNum}: merchant_name obbligatorio`;
  if (!payload.discount_label) return `Riga ${rowNum}: discount_label obbligatorio`;
  if (!payload.category) return `Riga ${rowNum}: category obbligatoria`;
  if (!VALID_CATEGORIES.has(payload.category)) {
    return `Riga ${rowNum}: category non valida (${payload.category})`;
  }
  return null;
}

function parseMerchantCsvText(csvText) {
  const text = String(csvText || '').replace(/^\uFEFF/, '');
  if (!text.trim()) {
    throw new Error('CSV vuoto');
  }
  const records = parse(text, {
    columns: (headers) => headers.map(normalizeHeader),
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    delimiter: ';'
  });
  if (!records.length) {
    throw new Error('CSV senza righe dati');
  }
  const headers = Object.keys(records[0] || {});
  for (const col of REQUIRED_COLUMNS) {
    if (!headers.includes(col)) {
      throw new Error(`Colonna obbligatoria mancante: ${col}`);
    }
  }
  return records;
}

async function geocodeAddress({ address, city, country = 'IT' }) {
  const parts = [address, city, country].filter(Boolean);
  if (!parts.length) return null;

  const userAgent = process.env.NOMINATIM_USER_AGENT || 'Filodiretto/1.0';
  const q = encodeURIComponent(parts.join(', '));
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`;

  const res = await fetch(url, {
    headers: { 'User-Agent': userAgent, Accept: 'application/json' }
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || !data.length) return null;
  const hit = data[0];
  const lat = parseFloat(hit.lat);
  const lon = parseFloat(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { latitude: lat, longitude: lon };
}

async function importMerchantsFromCsvRows(brandId, rows, db) {
  const result = { imported: 0, updated: 0, skipped: 0, errors: [] };
  const defaultRadius = parseInt(process.env.GEOFENCING_DEFAULT_RADIUS_M, 10) || 150;

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    try {
      const payload = rowToMerchantPayload(rows[i]);
      const validationError = validateMerchantRow(payload, rowNum);
      if (validationError) {
        result.skipped++;
        result.errors.push(validationError);
        continue;
      }

      const existing = await db.findMerchantByNameAndBrand(brandId, payload.name);
      let merchantId;

      const merchantFields = {
        name: payload.name,
        category: payload.category,
        logo_url: payload.logo_url,
        description: payload.description,
        discount_label: payload.discount_label,
        conditions: payload.conditions,
        valid_until: payload.valid_until || null,
        online_enabled: payload.online_enabled,
        online_url: payload.online_url,
        online_promo_code: payload.online_promo_code,
        physical_enabled: payload.physical_enabled,
        active: true
      };

      if (existing) {
        await db.updateMerchant(existing.id, brandId, merchantFields);
        merchantId = existing.id;
        result.updated++;
      } else {
        const created = await db.createMerchant({ brand_id: brandId, ...merchantFields });
        merchantId = created.id;
        result.imported++;
      }

      const loc = payload.location;
      if (loc.address) {
        let latitude = loc.latitude ? parseFloat(loc.latitude) : null;
        let longitude = loc.longitude ? parseFloat(loc.longitude) : null;
        if ((!Number.isFinite(latitude) || !Number.isFinite(longitude)) && loc.address) {
          try {
            const geo = await geocodeAddress({ address: loc.address, city: loc.city });
            if (geo) {
              latitude = geo.latitude;
              longitude = geo.longitude;
            }
          } catch (geoErr) {
            result.errors.push(`Riga ${rowNum}: geocoding fallito (${geoErr.message})`);
          }
        }
        await db.createMerchantLocation(merchantId, {
          address: loc.address,
          city: loc.city,
          latitude: Number.isFinite(latitude) ? latitude : null,
          longitude: Number.isFinite(longitude) ? longitude : null,
          geofence_radius_m: defaultRadius
        });
      }
    } catch (err) {
      result.skipped++;
      result.errors.push(`Riga ${rowNum}: ${err.message}`);
    }
  }

  return result;
}

module.exports = {
  REQUIRED_COLUMNS,
  VALID_CATEGORIES,
  parseMerchantCsvText,
  rowToMerchantPayload,
  validateMerchantRow,
  geocodeAddress,
  importMerchantsFromCsvRows
};
