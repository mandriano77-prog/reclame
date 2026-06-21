'use strict';

const QRCode = require('qrcode');
const { verifyHubToken } = require('../engine/hub-jwt');
const { signScanUrl, verifyScanSignature, getPartnerBaseUrl } = require('../engine/hub-qr');
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

function employeeDisplayName(profile) {
  const parts = [profile?.first_name, profile?.last_name].filter(Boolean);
  return parts.length ? parts.join(' ') : (profile?.email || 'Dipendente');
}

async function buildScanValidation(serial, merchantId) {
  const pass = await db.getPassBySerial(serial);
  if (!pass || pass.status !== 'active') {
    return { valid: false, reason: 'Pass non valido' };
  }

  const merchant = await db.getMerchant(merchantId, pass.brand_id);
  if (!merchant || !merchant.active) {
    return { valid: false, reason: 'Merchant non attivo' };
  }

  const todayOk = (
    (!merchant.valid_from || new Date(merchant.valid_from) <= new Date())
    && (!merchant.valid_until || new Date(merchant.valid_until) >= new Date(new Date().toDateString()))
  );
  if (!todayOk) {
    return { valid: false, reason: 'Convenzione scaduta' };
  }

  const [brand, member] = await Promise.all([
    db.getBrand(pass.brand_id),
    db.getMemberForPass(pass.id)
  ]);

  const fieldValues = parseFieldValues(pass.field_values);
  const profile = {
    first_name: member?.first_name || fieldValues.first_name || fieldValues.nome || null,
    last_name: member?.last_name || fieldValues.last_name || fieldValues.cognome || null,
    email: member?.email || fieldValues.email || null
  };

  return {
    valid: true,
    pass,
    merchant,
    brand,
    profile,
    employee_name: employeeDisplayName(profile),
    company: brand?.name || 'Azienda',
    discount_label: merchant.discount_label
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

  router.get('/hub/merchants/nearby', async (req, res) => {
    try {
      const auth = resolveHubAuth(req);
      if (auth.error) return res.status(auth.error.status).json({ error: auth.error.message });

      const ctx = await loadHubContext(auth.claims);
      if (ctx.error) return res.status(ctx.error.status).json({ error: ctx.error.message });

      const { lat, lon, radius_km } = req.query;
      if (lat == null || lon == null) {
        return res.status(400).json({ error: 'lat e lon sono obbligatori' });
      }

      const radius = radius_km != null ? parseFloat(radius_km) : 5;
      const merchants = await db.findMerchantsNearby(auth.claims.brand_id, lat, lon, radius);
      res.json(merchants.map((row) => ({
        ...publicMerchant(row),
        distance_km: row.distance_km,
        locations: row.locations || []
      })));
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

  router.get('/hub/qr-token', async (req, res) => {
    try {
      const auth = resolveHubAuth(req);
      if (auth.error) return res.status(auth.error.status).json({ error: auth.error.message });

      const ctx = await loadHubContext(auth.claims);
      if (ctx.error) return res.status(ctx.error.status).json({ error: ctx.error.message });

      const { merchant_id } = req.query;
      if (!merchant_id) {
        return res.status(400).json({ error: 'merchant_id obbligatorio' });
      }

      const merchant = await db.getMerchant(merchant_id, auth.claims.brand_id);
      if (!merchant || !merchant.active || !merchant.physical_enabled) {
        return res.status(404).json({ error: 'Merchant non trovato o attivazione fisica non abilitata' });
      }

      const signed = signScanUrl({
        pass_serial: auth.claims.pass_serial,
        merchant_id,
        brand_id: auth.claims.brand_id
      });

      const qr_url = await QRCode.toDataURL(signed.scan_url, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 320
      });

      await db.logConventionActivation({
        brand_id: auth.claims.brand_id,
        merchant_id,
        pass_serial: auth.claims.pass_serial,
        user_id: auth.claims.user_id,
        activation_type: 'show_qr',
        metadata: { expires_at: signed.expires_at }
      });

      res.json({
        qr_url,
        scan_url: signed.scan_url,
        expires_at: signed.expires_at
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/hub/scan', async (req, res) => {
    try {
      const { serial, merchant, t, sig } = req.query;
      if (!serial || !merchant || !t || !sig) {
        const payload = { valid: false, reason: 'Parametri mancanti' };
        if (req.accepts('json')) return res.status(400).json(payload);
        return res.redirect(302, `${getPartnerBaseUrl()}/scan?${new URLSearchParams(req.query).toString()}`);
      }

      const pass = await db.getPassBySerial(serial);
      if (!pass) {
        const payload = { valid: false, reason: 'Pass non valido' };
        if (req.accepts('json')) return res.status(404).json(payload);
        return res.redirect(302, `${getPartnerBaseUrl()}/scan?${new URLSearchParams(req.query).toString()}`);
      }

      const sigCheck = verifyScanSignature({
        serial,
        merchant,
        t,
        sig,
        brand_id: pass.brand_id
      });
      if (!sigCheck.valid) {
        const payload = { valid: false, reason: sigCheck.reason };
        if (req.accepts('json')) return res.status(403).json(payload);
        return res.redirect(302, `${getPartnerBaseUrl()}/scan?${new URLSearchParams(req.query).toString()}`);
      }

      const validation = await buildScanValidation(serial, merchant);
      if (!validation.valid) {
        const payload = { valid: false, reason: validation.reason };
        if (req.accepts('json')) return res.status(403).json(payload);
        return res.redirect(302, `${getPartnerBaseUrl()}/scan?${new URLSearchParams(req.query).toString()}`);
      }

      await db.logConventionActivation({
        brand_id: validation.pass.brand_id,
        merchant_id: merchant,
        pass_serial: serial,
        user_id: null,
        activation_type: 'scan_qr',
        metadata: { scanned_at: new Date().toISOString() }
      });

      const payload = {
        valid: true,
        employee_name: validation.employee_name,
        company: validation.company,
        discount_label: validation.discount_label
      };
      if (req.accepts('json')) return res.json(payload);

      const partnerQs = new URLSearchParams({
        serial,
        merchant,
        t,
        sig,
        ok: '1'
      });
      return res.redirect(302, `${getPartnerBaseUrl()}/scan?${partnerQs.toString()}`);
    } catch (err) {
      if (req.accepts('json')) return res.status(500).json({ valid: false, reason: err.message });
      return res.status(500).send('Errore di validazione');
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
  publicBrand,
  buildScanValidation,
  employeeDisplayName
};
