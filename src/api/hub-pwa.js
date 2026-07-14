'use strict';

const QRCode = require('qrcode');
const { verifyHubToken } = require('../engine/hub-jwt');
const { signScanUrl, verifyScanSignature, getPartnerBaseUrl } = require('../engine/hub-qr');
const { redeemExperience, cancelPendingBooking } = require('../engine/pga-redeem');
const {
  sendPgaBookingHrNotification,
  sendPgaBookingEmployeeConfirmation
} = require('../engine/mailer');
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
  // Admin preview: no real pass behind the token — serve brand-scoped content only,
  // with an empty profile (no personal data).
  if (claims.preview) {
    const [brand, settings] = await Promise.all([
      db.getBrand(claims.brand_id),
      db.getHubSettings(claims.brand_id)
    ]);
    if (!brand) return { error: { status: 404, message: 'Brand non trovato' } };
    return {
      pass: null,
      brand,
      settings,
      profile: { user_id: null, pass_serial: null, pass_id: null, member_id: null, preview: true }
    };
  }

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

/** The brand's real logo — the same asset used on the pass and its notifications. */
function brandLogoUrl(brand) {
  const cfg = brand?.config && typeof brand.config === 'object' ? brand.config : {};
  if (brand?.logo_url) return brand.logo_url;
  if (cfg.logo_url) return cfg.logo_url;
  const assets = cfg.brand_identity_assets || {};
  const logos = cfg.logos || {};
  const hasLogo = !!(assets.logo || assets.logo_media_id || logos.logo || logos['logo@2x']);
  if (!hasLogo || !brand?.slug) return null;
  // public (unauthenticated) logo endpoint — the HUB runs on a hub token, not an admin session
  return `/api/v1/brands/by-slug/${encodeURIComponent(brand.slug)}/logo`;
}

function publicBrand(brand) {
  const cfg = brand?.config && typeof brand.config === 'object' ? brand.config : {};
  return {
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    logo_url: brandLogoUrl(brand),
    product_line: cfg.product_line || 'ads'
  };
}

function publicSettings(settings, brand) {
  let categories = settings?.categories_enabled;
  if (typeof categories === 'string') {
    try { categories = JSON.parse(categories); } catch { categories = []; }
  }
  if (!Array.isArray(categories)) categories = [];
  const cfg = brand?.config && typeof brand.config === 'object' ? brand.config : {};
  return {
    // Fall back to the brand's own logo/accent so the HUB is on-brand out of the box;
    // Impostazioni Hub still overrides both.
    logo_url: settings?.logo_url || brandLogoUrl(brand),
    accent_color: settings?.accent_color || cfg.labelColor || cfg.primaryColor || '#8B5CF6',
    welcome_message: settings?.welcome_message || null,
    categories_enabled: categories,
    geofencing_enabled: settings?.geofencing_enabled !== false
  };
}

/** First letters of the first two words — "Caffè della Galleria" → "CD". */
function merchantInitials(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  const a = words[0][0] || '';
  const b = words.length > 1 ? (words[1][0] || '') : (words[0][1] || '');
  return `${a}${b}`.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 2);
}

/** Merchants with no logo get a generated one (initials + category color) so the HUB never
 *  falls back to a bare letter tile. Same-origin URL — works in the PWA and on Google Wallet. */
function merchantLogoUrl(row) {
  if (row?.logo_url) return row.logo_url;
  const params = new URLSearchParams({
    t: merchantInitials(row?.name) || '?',
    cat: String(row?.category || '').toLowerCase()
  });
  return `/assets/logo-placeholder?${params.toString()}`;
}

function publicMerchant(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    logo_url: merchantLogoUrl(row),
    description: row.description,
    discount_label: row.discount_label,
    conditions: row.conditions,
    valid_from: row.valid_from,
    valid_until: row.valid_until,
    online_enabled: !!row.online_enabled,
    online_url: row.online_url,
    online_promo_code: row.online_promo_code,
    physical_enabled: !!row.physical_enabled,
    sponsored: !!row.sponsored,
    sponsored_rank: row.sponsored_rank || 0
  };
}

function publicExperience(row) {
  if (!row) return null;
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    category: row.category,
    coin_cost: row.coin_cost,
    max_per_user_per_year: row.max_per_user_per_year,
    max_total_per_month: row.max_total_per_month,
    requires_booking: !!row.requires_booking,
    internal: !!row.internal,
    image_url: row.image_url,
    display_order: row.display_order
  };
}

function publicPgaSettings(settings) {
  return {
    enabled: !!settings?.enabled,
    welcome_message: settings?.welcome_message || null
  };
}

function publicBooking(row) {
  if (!row) return null;
  return {
    id: row.id,
    experience_id: row.experience_id,
    experience_name: row.experience_name || null,
    coin_amount: row.coin_amount,
    status: row.status,
    scheduled_at: row.scheduled_at,
    notes: row.notes,
    created_at: row.created_at
  };
}

function isWeekday(date) {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

function atNineAm(date) {
  const d = new Date(date);
  d.setHours(9, 0, 0, 0);
  return d;
}

async function buildSuggestedSlots(brandId, experience) {
  if (!experience?.requires_booking) return [];
  const maxMonth = experience.max_total_per_month != null
    ? Number(experience.max_total_per_month)
    : null;
  const monthCounts = new Map();
  const slots = [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() + 1);
  cursor.setHours(0, 0, 0, 0);

  while (slots.length < 8) {
    if (isWeekday(cursor)) {
      const y = cursor.getFullYear();
      const m = cursor.getMonth() + 1;
      const monthKey = `${y}-${m}`;
      if (!monthCounts.has(monthKey)) {
        const count = await db.countExperienceBookingsMonth(brandId, experience.id, y, m);
        monthCounts.set(monthKey, count);
      }
      const monthFull = maxMonth != null && monthCounts.get(monthKey) >= maxMonth;
      if (!monthFull) {
        slots.push(atNineAm(cursor).toISOString());
      }
    }
    cursor.setDate(cursor.getDate() + 1);
    if (slots.length === 0 && cursor.getTime() - Date.now() > 120 * 24 * 60 * 60 * 1000) break;
    if (slots.length > 0 && cursor.getTime() - Date.now() > 90 * 24 * 60 * 60 * 1000) break;
  }
  return slots.slice(0, 8);
}

function mapRedeemError(err) {
  const code = err.code || 'ERROR';
  const statusMap = {
    PGA_DISABLED: 403,
    NOT_FOUND: 404,
    INSUFFICIENT_BALANCE: 402,
    MONTHLY_EXHAUSTED: 409,
    YEARLY_LIMIT: 409,
    NOT_AVAILABLE: 409,
    NOT_CANCELLABLE: 409
  };
  return {
    status: statusMap[code] || 400,
    error: err.message || 'Errore riscatto',
    code
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
      const pgaSettings = await db.getPgaSettings(auth.claims.brand_id);
      let coinBalance = 0;
      let experiences = [];
      if (pgaSettings.enabled && !auth.claims.preview) {
        const bal = await db.getPassCoinBalance(auth.claims.brand_id, auth.claims.pass_serial);
        coinBalance = Number(bal.balance || 0);
        experiences = await db.listExperiences(auth.claims.brand_id, { active: true });
      }
      res.json({
        profile: ctx.profile,
        brand: publicBrand(ctx.brand),
        settings: publicSettings(ctx.settings, ctx.brand),
        pga_settings: publicPgaSettings(pgaSettings),
        coin_balance: coinBalance,
        merchants: merchants.map(publicMerchant),
        experiences: experiences.map(publicExperience)
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

  router.get('/hub/me', async (req, res) => {
    try {
      const auth = resolveHubAuth(req);
      if (auth.error) return res.status(auth.error.status).json({ error: auth.error.message });

      const ctx = await loadHubContext(auth.claims);
      if (ctx.error) return res.status(ctx.error.status).json({ error: ctx.error.message });

      const pgaSettings = await db.getPgaSettings(auth.claims.brand_id);
      const bal = await db.getPassCoinBalance(auth.claims.brand_id, auth.claims.pass_serial);
      const ledger = pgaSettings.enabled
        ? await db.listCoinLedgerForPass(auth.claims.brand_id, auth.claims.pass_serial, 50)
        : [];
      const bookings = pgaSettings.enabled
        ? await db.listBookingsForPass(auth.claims.brand_id, auth.claims.pass_serial, 20)
        : [];

      res.json({
        profile: ctx.profile,
        brand: publicBrand(ctx.brand),
        pga_settings: publicPgaSettings(pgaSettings),
        coin_balance: Number(bal.balance || 0),
        ledger,
        bookings
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/hub/experiences', async (req, res) => {
    try {
      const auth = resolveHubAuth(req);
      if (auth.error) return res.status(auth.error.status).json({ error: auth.error.message });

      const pgaSettings = await db.getPgaSettings(auth.claims.brand_id);
      if (!pgaSettings.enabled) {
        return res.json({ experiences: [] });
      }

      const { category } = req.query;
      const experiences = await db.listExperiences(auth.claims.brand_id, {
        active: true,
        category: category || undefined
      });
      res.json({ experiences: experiences.map(publicExperience) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/hub/experiences/:id', async (req, res) => {
    try {
      const auth = resolveHubAuth(req);
      if (auth.error) return res.status(auth.error.status).json({ error: auth.error.message });

      const pgaSettings = await db.getPgaSettings(auth.claims.brand_id);
      if (!pgaSettings.enabled) {
        return res.status(403).json({ error: 'PGA non attivo' });
      }

      const experience = await db.getExperience(req.params.id, auth.claims.brand_id);
      if (!experience || !experience.active) {
        return res.status(404).json({ error: 'Esperienza non trovata' });
      }

      const availability = await db.getExperienceAvailability(
        auth.claims.brand_id,
        req.params.id,
        auth.claims.pass_serial
      );
      const bal = await db.getPassCoinBalance(auth.claims.brand_id, auth.claims.pass_serial);
      const suggested_slots = experience.requires_booking
        ? await buildSuggestedSlots(auth.claims.brand_id, experience)
        : [];

      res.json({
        experience: publicExperience(experience),
        availability,
        coin_balance: Number(bal.balance || 0),
        suggested_slots
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/hub/experiences/:id/redeem', async (req, res) => {
    try {
      const auth = resolveHubAuth(req);
      if (auth.error) return res.status(auth.error.status).json({ error: auth.error.message });

      const ctx = await loadHubContext(auth.claims);
      if (ctx.error) return res.status(ctx.error.status).json({ error: ctx.error.message });

      const { scheduled_at, notes } = req.body || {};
      let result;
      try {
        result = await redeemExperience({
          brandId: auth.claims.brand_id,
          passSerial: auth.claims.pass_serial,
          userId: auth.claims.user_id,
          experienceId: req.params.id,
          scheduled_at: scheduled_at || null,
          notes: notes || null
        });
      } catch (err) {
        const mapped = mapRedeemError(err);
        return res.status(mapped.status).json({ error: mapped.error, code: mapped.code });
      }

      const pgaSettings = await db.getPgaSettings(auth.claims.brand_id);
      const employeeName = employeeDisplayName(ctx.profile);
      const experienceName = result.experience?.name || 'Esperienza';

      if (ctx.profile.email) {
        sendPgaBookingEmployeeConfirmation({
          to: ctx.profile.email,
          employeeName,
          experienceName,
          coinAmount: result.booking.coin_amount,
          scheduledAt: result.booking.scheduled_at
        }).catch((e) => console.warn('[hub-pwa] employee email failed:', e.message));
      }

      if (pgaSettings.notify_hr_on_booking && pgaSettings.notify_hr_email) {
        sendPgaBookingHrNotification({
          to: pgaSettings.notify_hr_email,
          brandName: ctx.brand.name,
          employeeName,
          experienceName,
          coinAmount: result.booking.coin_amount,
          scheduledAt: result.booking.scheduled_at,
          bookingId: result.booking.id
        }).catch((e) => console.warn('[hub-pwa] HR email failed:', e.message));
      }

      res.status(201).json({
        booking: publicBooking({
          ...result.booking,
          experience_name: experienceName
        }),
        new_balance: result.new_balance
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/hub/bookings/:id/cancel', async (req, res) => {
    try {
      const auth = resolveHubAuth(req);
      if (auth.error) return res.status(auth.error.status).json({ error: auth.error.message });

      const ctx = await loadHubContext(auth.claims);
      if (ctx.error) return res.status(ctx.error.status).json({ error: ctx.error.message });

      let result;
      try {
        result = await cancelPendingBooking({
          brandId: auth.claims.brand_id,
          passSerial: auth.claims.pass_serial,
          bookingId: req.params.id
        });
      } catch (err) {
        const mapped = mapRedeemError(err);
        return res.status(mapped.status).json({ error: mapped.error, code: mapped.code });
      }

      res.json({
        booking: publicBooking(result.booking),
        new_balance: result.new_balance
      });
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
  publicExperience,
  publicPgaSettings,
  publicBooking,
  buildSuggestedSlots,
  buildScanValidation,
  employeeDisplayName
};
