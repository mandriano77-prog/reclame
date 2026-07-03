'use strict';

const {
  getCommercialCalendar,
  createCommercialBooking,
  updateBookingStatus,
  listPackages,
  FORMAT_LABELS
} = require('../engine/reclame-commercial');
const { listAudiencePresets, getAudiencePreset } = require('../engine/audience-presets');
const { countAudienceMembers } = require('../engine/audiences');

function registerCommercialRoutes(router, { requireBrandId, requireWriteAccess }) {
  router.get('/commercial/packages', (_req, res) => {
    res.json({ packages: listPackages(), formats: FORMAT_LABELS });
  });

  router.get('/brands/:brand_id/commercial/calendar', async (req, res) => {
    try {
      const brand_id = req.params.brand_id;
      if (!requireBrandId(req, res, brand_id)) return;
      const data = await getCommercialCalendar(brand_id, {
        from: req.query.from || null,
        to: req.query.to || null
      });
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/brands/:brand_id/commercial/bookings', async (req, res) => {
    try {
      if (!requireWriteAccess(req, res)) return;
      const brand_id = req.params.brand_id;
      if (!requireBrandId(req, res, brand_id)) return;
      const booking = await createCommercialBooking(brand_id, req.body || {});
      res.status(201).json(booking);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.patch('/brands/:brand_id/commercial/bookings/:id', async (req, res) => {
    try {
      if (!requireWriteAccess(req, res)) return;
      const brand_id = req.params.brand_id;
      if (!requireBrandId(req, res, brand_id)) return;
      const status = req.body?.status;
      if (!status) return res.status(400).json({ error: 'status richiesto' });
      const row = await updateBookingStatus(brand_id, req.params.id, status);
      res.json(row);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/audience-presets', (_req, res) => {
    res.json(listAudiencePresets());
  });

  router.get('/brands/:brand_id/audience-presets/:key/preview', async (req, res) => {
    try {
      const brand_id = req.params.brand_id;
      if (!requireBrandId(req, res, brand_id)) return;
      const preset = getAudiencePreset(req.params.key);
      if (!preset) return res.status(404).json({ error: 'Preset non trovato' });
      const count = await countAudienceMembers(brand_id, preset.rules);
      res.json({ preset, count });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
}

module.exports = { registerCommercialRoutes };
