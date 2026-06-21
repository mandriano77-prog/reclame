'use strict';

const { verifyHubToken } = require('../engine/hub-jwt');
const db = require('../db');

const HUB_EVENT_TYPES = new Set([
  'view', 'search_found', 'click_site', 'copy_code', 'show_qr', 'scan_qr', 'geofence_push'
]);

function extractHubToken(req) {
  return req.query?.token || req.body?.token || null;
}

function resolveHubAuth(req) {
  const token = extractHubToken(req);
  if (!token) return { error: { status: 401, message: 'Token mancante' } };
  const claims = verifyHubToken(token);
  if (!claims) return { error: { status: 401, message: 'Token non valido o scaduto' } };
  return { claims, token };
}

function parseFieldValues(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function loadHubContext(claims) {
  const pass = await db.getPassBySerial(claims.pass_serial);
  if (!pass) return { error: { status: 403, message: 'Pass non trovato' } };
  if (String(pass.brand_id) !== String(claims.brand_id)) {
    return { error: { status: 403, message: 'Pass non associato al brand' } };
  }
  if (pass.status && pass.status !== 'active') {
    return { error: { status: 403, message: 'Pass non attivo' } };
  }

  const [brand, settings, member] = await Promise.all([
    db.getBrand(claims.brand_id),
    db.getHubSettings(claims.brand_id),
    db.getMemberForPass(pass.id)
  ]);
  if (!brand) return { error: { status: 404, message: 'Brand non trovato' } };

  const fieldValues = parseFieldValues(pass.field_values);
  const profile = {
    user_id: claims.user_id,
    pass_serial: claims.pass_serial,
    pass_id: pass.id,
    member_id: member?.id || pass.member_id || null,
    first_name: member?.first_name || fieldValues.first_name || fieldValues.nome || null,
    last_name: member?.last_name || fieldValues.last_name || fieldValues.cognome || null,
    email: member?.email || fieldValues.email || null,
    department: member?.department || null,
    employee_id: member?.employee_id || null
  };

  return {
    pass,
    brand,
    settings,
    profile
  };
}

function publicBrand(brand) {
  return {
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    logo_url: brand.logo_url || brand.config?.logo_url || null
  };
}

function publicSettings(settings) {
  let categories = settings?.categories_enabled;
  if (typeof categories === 'string') {
    try { categories = JSON.parse(categories); } catch { categories = []; }
  }
  if (!Array.isArray(categories)) categories = [];
  return {
    logo_url: settings?.logo_url || null,
    accent_color: settings?.accent_color || '#8B5CF6',
    welcome_message: settings?.welcome_message || null,
    categories_enabled: categories,
    geofencing_enabled: settings?.geofencing_enabled !== false
  };
}

function publicMerchant(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    logo_url: row.logo_url,
    description: row.description,
    discount_label: row.discount_label,
    conditions: row.conditions,
    valid_from: row.valid_from,
    valid_until: row.valid_until,
    online_enabled: !!row.online_enabled,
    online_url: row.online_url,
    online_promo_code: row.online_promo_code,
    physical_enabled: !!row.physical_enabled
  };
}

function registerHubPwaRoutes(router) {
  router.get('/hub/bootstrap', async (req, res) => {
    try {
      const auth = resolveHubAuth(req);
      if (auth.error) return res.status(auth.error.status).json({ error: auth.error.message });

      const ctx = await loadHubContext(auth.claims);
      if (ctx.error) return res.status(ctx.error.status).json({ error: ctx.error.message });

      const merchants = await db.listActiveMerchantsForHub(auth.claims.brand_id);
      res.json({
        profile: ctx.profile,
        brand: publicBrand(ctx.brand),
        settings: publicSettings(ctx.settings),
        merchants: merchants.map(publicMerchant)
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/hub/merchants', async (req, res) => {
    try {
      const auth = resolveHubAuth(req);
      if (auth.error) return res.status(auth.error.status).json({ error: auth.error.message });

      const ctx = await loadHubContext(auth.claims);
      if (ctx.error) return res.status(ctx.error.status).json({ error: ctx.error.message });

      const { category, search } = req.query;
      const merchants = await db.listActiveMerchantsForHub(auth.claims.brand_id, { category, search });
      res.json(merchants.map(publicMerchant));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/hub/merchants/:id', async (req, res) => {
    try {
      const auth = resolveHubAuth(req);
      if (auth.error) return res.status(auth.error.status).json({ error: auth.error.message });

      const ctx = await loadHubContext(auth.claims);
      if (ctx.error) return res.status(ctx.error.status).json({ error: ctx.error.message });

      const merchant = await db.getMerchant(req.params.id, auth.claims.brand_id);
      if (!merchant || !merchant.active) {
        return res.status(404).json({ error: 'Merchant non trovato' });
      }

      const todayOk = (
        (!merchant.valid_from || new Date(merchant.valid_from) <= new Date())
        && (!merchant.valid_until || new Date(merchant.valid_until) >= new Date(new Date().toDateString()))
      );
      if (!todayOk) return res.status(404).json({ error: 'Merchant non trovato' });

      const locations = await db.listMerchantLocations(req.params.id, auth.claims.brand_id);
      res.json({
        ...publicMerchant(merchant),
        locations
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/hub/events', async (req, res) => {
    try {
      const auth = resolveHubAuth(req);
      if (auth.error) return res.status(auth.error.status).json({ error: auth.error.message });

      const ctx = await loadHubContext(auth.claims);
      if (ctx.error) return res.status(ctx.error.status).json({ error: ctx.error.message });

      const { merchant_id, activation_type, location_id, metadata } = req.body || {};
      if (!merchant_id || !activation_type) {
        return res.status(400).json({ error: 'merchant_id e activation_type sono obbligatori' });
      }
      if (!HUB_EVENT_TYPES.has(activation_type)) {
        return res.status(400).json({ error: 'activation_type non valido' });
      }

      const merchant = await db.getMerchant(merchant_id, auth.claims.brand_id);
      if (!merchant || !merchant.active) {
        return res.status(404).json({ error: 'Merchant non trovato' });
      }

      const row = await db.logConventionActivation({
        brand_id: auth.claims.brand_id,
        merchant_id,
        pass_serial: auth.claims.pass_serial,
        user_id: auth.claims.user_id,
        activation_type,
        location_id: location_id || null,
        metadata: metadata || null
      });
      res.status(201).json({ success: true, id: row.id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

module.exports = {
  registerHubPwaRoutes,
  resolveHubAuth,
  extractHubToken,
  publicMerchant,
  publicSettings,
  publicBrand
};
