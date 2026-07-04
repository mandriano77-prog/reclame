'use strict';

// Template CRUD + image routes, extracted from routes.js (T3 modularization). All routes are
// authenticated (registered after the auth gate). Closure-scoped helpers are injected via deps;
// pure db/engine functions are required directly.

const {
  listTemplates,
  getBrand,
  createTemplate,
  getTemplate,
  updateTemplate,
  touchPassesForTemplate,
  deleteTemplate,
  getDevicesForTemplate,
} = require('../db');
const { sendPushBatch } = require('../engine/apns');

function registerTemplateRoutes(router, deps) {
  const {
    requireBrandId,
    isHrBrand,
    validateTemplateBackPayload,
    syncGoogleWalletClassForTemplate,
  } = deps;

  async function normalizeTemplateBodyForBrand(body, brand, req) {
    if (!isHrBrand(brand, req)) return body;
    return { ...body, pass_type: 'employee_pass' };
  }

  router.get('/templates', async (req, res) => {
    try {
      const { brand_id } = req.query;
      if (!brand_id) return res.status(400).json({ error: 'brand_id richiesto' });
      if (!requireBrandId(req, res, brand_id)) return;
      const templates = await listTemplates(brand_id);
      res.json(templates);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.post('/templates', async (req, res) => {
    try {
      if (!requireBrandId(req, res, req.body.brand_id)) return;
      const brand = await getBrand(req.body.brand_id);
      if (!brand) return res.status(404).json({ error: 'Brand non trovato' });
      validateTemplateBackPayload(req.body);
      const template = await createTemplate(await normalizeTemplateBodyForBrand(req.body, brand, req));
      await syncGoogleWalletClassForTemplate(brand, template);
      res.json(template);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.get('/templates/:id', async (req, res) => {
    try {
      const template = await getTemplate(req.params.id);
      if (!template) return res.status(404).json({ error: 'Template non trovato' });
      if (!requireBrandId(req, res, template.brand_id)) return;
      res.json(template);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.put('/templates/:id', async (req, res) => {
    try {
      const existing = await getTemplate(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Template non trovato' });
      if (!requireBrandId(req, res, existing.brand_id)) return;
      validateTemplateBackPayload(req.body);
      const brand = await getBrand(existing.brand_id);
      const template = await updateTemplate(
        req.params.id,
        await normalizeTemplateBodyForBrand(req.body, brand, req)
      );
      await syncGoogleWalletClassForTemplate(brand, template);
      const { touched } = await touchPassesForTemplate(req.params.id);
      let wallet_push_sent = 0;
      const devices = await getDevicesForTemplate(req.params.id);
      if (devices.length) {
        const batch = await sendPushBatch(devices.map((d) => d.push_token));
        wallet_push_sent = batch.filter((r) => r.success).length;
      }
      res.json({ ...template, wallet_refresh: { passes_touched: touched, push_sent: wallet_push_sent } });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Template image upload (base64 in style JSONB)
  router.post('/templates/:id/images', async (req, res) => {
    try {
      const template = await getTemplate(req.params.id);
      if (!template) return res.status(404).json({ error: 'Template non trovato' });
      if (!requireBrandId(req, res, template.brand_id)) return;
      const { image_type, image_base64 } = req.body;
      // image_type: 'logo', 'strip', 'thumbnail', 'background'
      if (!['logo', 'strip', 'thumbnail', 'background'].includes(image_type)) {
        return res.status(400).json({ error: 'image_type deve essere: logo, strip, thumbnail, background' });
      }
      if (!image_base64) return res.status(400).json({ error: 'image_base64 richiesto' });
      const style = template.style || {};
      style.images = style.images || {};
      style.images[image_type] = image_base64;
      await updateTemplate(req.params.id, { style });
      res.json({ success: true, image_type });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.delete('/templates/:id/images/:imageType', async (req, res) => {
    try {
      const template = await getTemplate(req.params.id);
      if (!template) return res.status(404).json({ error: 'Template non trovato' });
      if (!requireBrandId(req, res, template.brand_id)) return;
      const style = template.style || {};
      if (style.images) {
        delete style.images[req.params.imageType];
        await updateTemplate(req.params.id, { style });
      }
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Public PNG for Google/Samsung Wallet (strip, thumbnail, background from template.style.images)
  router.get('/templates/:id/wallet-image/:imageType', async (req, res) => {
    try {
      const template = await getTemplate(req.params.id);
      if (!template) return res.status(404).json({ error: 'Template non trovato' });
      const imageType = req.params.imageType;
      if (!['logo', 'strip', 'thumbnail', 'background'].includes(imageType)) {
        return res.status(400).json({ error: 'imageType deve essere: logo, strip, thumbnail, background' });
      }
      const b64 = template.style?.images?.[imageType];
      if (!b64) return res.status(404).json({ error: 'Immagine non trovata' });
      const buf = Buffer.from(b64, 'base64');
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'public, max-age=3600');
      res.send(buf);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.delete('/templates/:id', async (req, res) => {
    try {
      const existing = await getTemplate(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Template non trovato' });
      if (!requireBrandId(req, res, existing.brand_id)) return;
      await deleteTemplate(req.params.id);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
}

module.exports = { registerTemplateRoutes };
