'use strict';

const express = require('express');
const {
  createMerchant,
  getMerchant,
  listMerchants,
  updateMerchant,
  softDeleteMerchant,
  createMerchantLocation,
  listMerchantLocations,
  deleteMerchantLocation,
  getMerchantAnalytics,
  getHubBrandAnalytics,
  getHubSettings,
  upsertHubSettings,
  findMerchantByNameAndBrand,
  getBrand,
  createMerchantLocation: dbCreateMerchantLocation
} = require('../db');
const {
  parseMerchantCsvText,
  importMerchantsFromCsvRows
} = require('../engine/hub-csv-import');
const { signHubPreviewToken, buildHubUrl } = require('../engine/hub-jwt');

const hubDb = {
  createMerchant,
  updateMerchant,
  findMerchantByNameAndBrand,
  createMerchantLocation: dbCreateMerchantLocation
};

function parseMultipartForm(buffer, contentType) {
  const match = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType || '');
  if (!match) throw new Error('Multipart boundary mancante');
  const boundary = match[1] || match[2];
  const body = Buffer.isBuffer(buffer) ? buffer : Buffer.from(String(buffer || ''), 'binary');
  const parts = body.toString('binary').split(`--${boundary}`);
  const fields = {};
  let fileContent = null;

  for (const part of parts) {
    if (!part || part === '--\r\n' || part === '--') continue;
    const sepIdx = part.indexOf('\r\n\r\n');
    if (sepIdx < 0) continue;
    const rawHeaders = part.slice(0, sepIdx);
    let content = part.slice(sepIdx + 4);
    if (content.endsWith('\r\n')) content = content.slice(0, -2);

    const nameMatch = /name="([^"]+)"/i.exec(rawHeaders);
    if (!nameMatch) continue;
    const fieldName = nameMatch[1];
    const filenameMatch = /filename="([^"]*)"/i.exec(rawHeaders);
    if (filenameMatch) {
      fileContent = Buffer.from(content, 'binary');
      fields[fieldName] = filenameMatch[1];
    } else {
      fields[fieldName] = content;
    }
  }

  return { fields, fileContent };
}

function registerHubMerchantRoutes(router, { requireBrandId, requireOwnedBrandPk, requireWriteAccess }) {
  router.get('/merchants', async (req, res) => {
    try {
      const { brand_id, category, active, search } = req.query;
      if (!requireBrandId(req, res, brand_id)) return;
      const merchants = await listMerchants(brand_id, { category, active, search });
      res.json(merchants);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin "Anteprima HUB": mint a short-lived preview token and return the HUB PWA URL
  // so the admin can see the merchant hub as a pass holder would, without a real pass.
  router.get('/brands/:brand_id/hub/preview-url', async (req, res) => {
    try {
      const brand_id = req.params.brand_id;
      if (!requireBrandId(req, res, brand_id)) return;
      const brand = await getBrand(brand_id);
      if (!brand) return res.status(404).json({ error: 'Brand non trovato' });
      const token = signHubPreviewToken({ brand_id });
      res.json({ url: buildHubUrl(token, brand.slug) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/merchants', async (req, res) => {
    try {
      if (!requireWriteAccess(req, res)) return;
      const { brand_id } = req.body || {};
      if (!requireBrandId(req, res, brand_id)) return;
      const merchant = await createMerchant(req.body);
      res.status(201).json(merchant);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/merchants/:id', async (req, res) => {
    try {
      if (!requireWriteAccess(req, res)) return;
      const existing = await getMerchant(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Merchant non trovato' });
      if (!requireBrandId(req, res, existing.brand_id)) return;
      const merchant = await updateMerchant(req.params.id, existing.brand_id, req.body);
      res.json(merchant);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/merchants/:id', async (req, res) => {
    try {
      if (!requireWriteAccess(req, res)) return;
      const existing = await getMerchant(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Merchant non trovato' });
      if (!requireBrandId(req, res, existing.brand_id)) return;
      const merchant = await softDeleteMerchant(req.params.id, existing.brand_id);
      res.json(merchant);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/merchants/import-csv', (req, res, next) => {
    const ct = req.headers['content-type'] || '';
    if (ct.includes('multipart/form-data')) {
      return express.raw({ type: () => true, limit: '5mb' })(req, res, next);
    }
    next();
  }, async (req, res) => {
    try {
      if (!requireWriteAccess(req, res)) return;

      let brandId;
      let csvText;

      const contentType = req.headers['content-type'] || '';
      if (contentType.includes('multipart/form-data')) {
        const { fields, fileContent } = parseMultipartForm(req.body, contentType);
        brandId = fields.brand_id;
        if (!fileContent || !fileContent.length) {
          return res.status(400).json({ error: 'File CSV mancante nel form (campo file)' });
        }
        csvText = fileContent.toString('utf8');
      } else {
        brandId = req.body?.brand_id || req.query?.brand_id;
        csvText = req.body?.csv_text;
      }

      if (!requireBrandId(req, res, brandId)) return;
      if (!csvText || !String(csvText).trim()) {
        return res.status(400).json({ error: 'CSV mancante' });
      }

      const rows = parseMerchantCsvText(csvText);
      const result = await importMerchantsFromCsvRows(brandId, rows, hubDb);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/merchants/:id/locations', async (req, res) => {
    try {
      const merchant = await getMerchant(req.params.id);
      if (!merchant) return res.status(404).json({ error: 'Merchant non trovato' });
      if (!requireBrandId(req, res, merchant.brand_id)) return;
      const locations = await listMerchantLocations(req.params.id, merchant.brand_id);
      res.json(locations);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/merchants/:id/locations', async (req, res) => {
    try {
      if (!requireWriteAccess(req, res)) return;
      const merchant = await getMerchant(req.params.id);
      if (!merchant) return res.status(404).json({ error: 'Merchant non trovato' });
      if (!requireBrandId(req, res, merchant.brand_id)) return;
      const location = await createMerchantLocation(req.params.id, req.body);
      res.status(201).json(location);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/locations/:id', async (req, res) => {
    try {
      if (!requireWriteAccess(req, res)) return;
      const locRes = await require('../db').pool.query(
        `SELECT ml.id, m.brand_id FROM merchant_locations ml
         JOIN merchants m ON m.id = ml.merchant_id WHERE ml.id = $1`,
        [req.params.id]
      );
      const row = locRes.rows[0];
      if (!row) return res.status(404).json({ error: 'Location non trovata' });
      if (!requireBrandId(req, res, row.brand_id)) return;
      await deleteMerchantLocation(req.params.id, row.brand_id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/merchants/:id/analytics', async (req, res) => {
    try {
      const merchant = await getMerchant(req.params.id);
      if (!merchant) return res.status(404).json({ error: 'Merchant non trovato' });
      if (!requireBrandId(req, res, merchant.brand_id)) return;
      const days = parseInt(req.query.days, 10) || 30;
      const analytics = await getMerchantAnalytics(req.params.id, merchant.brand_id, days);
      res.json(analytics);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/brands/:id/hub-analytics', async (req, res) => {
    try {
      if (!requireOwnedBrandPk(req, res, req.params.id)) return;
      const days = parseInt(req.query.days, 10) || 30;
      const analytics = await getHubBrandAnalytics(req.params.id, days);
      res.json(analytics);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/brands/:id/hub-settings', async (req, res) => {
    try {
      if (!requireOwnedBrandPk(req, res, req.params.id)) return;
      const settings = await getHubSettings(req.params.id);
      res.json(settings);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/brands/:id/hub-settings', async (req, res) => {
    try {
      if (!requireWriteAccess(req, res)) return;
      if (!requireOwnedBrandPk(req, res, req.params.id)) return;
      const settings = await upsertHubSettings(req.params.id, req.body || {});
      res.json(settings);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

module.exports = { registerHubMerchantRoutes };
