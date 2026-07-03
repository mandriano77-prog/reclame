/**
 * Reclame — CPA coupon redemption at physical checkout (closed-loop).
 * Cashier accepts checkout code from pass back (preferred) or legacy pass serial QR.
 */
const {
  pool,
  getBrand,
  getBrandBySlug,
  getPassBySerial,
  getMerchant,
  getMerchantBySlug,
  updateBrand
} = require('../db');
const { logHolderEvent } = require('./holder-events');
const {
  normalizeCheckoutCode,
  lookupRedemptionByCode,
  markRedemptionCodeUsed
} = require('./redemption-codes');

function parseBrandConfig(brand) {
  const cfg = brand?.config;
  if (!cfg) return {};
  if (typeof cfg === 'object') return cfg;
  try {
    return JSON.parse(cfg);
  } catch {
    return {};
  }
}

function generateCashierPin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizePin(pin) {
  return String(pin || '').trim().replace(/\s/g, '');
}

function verifyCashierPin(brand, pin) {
  const cfg = parseBrandConfig(brand);
  const expected = normalizePin(cfg.cashier_pin);
  const given = normalizePin(pin);
  if (!expected || !given) return false;
  return expected === given;
}

function verifyMerchantCashierPin(merchant, pin) {
  const expected = normalizePin(merchant?.merchant_cashier_pin);
  const given = normalizePin(pin);
  if (!expected || !given) return false;
  return expected === given;
}

function verifyRedemptionPin(brand, merchant, pin) {
  if (merchant && merchant.merchant_cashier_pin) {
    return verifyMerchantCashierPin(merchant, pin);
  }
  return verifyCashierPin(brand, pin);
}

/** Active offer from latest push announcement on brand config. */
function resolveActiveCouponOffer(brand) {
  const cfg = parseBrandConfig(brand);
  const ann = cfg.pushAnnouncement;
  if (!ann?.message) return null;
  const coupon = ann.coupon || {};
  if (coupon.redeemable === false) return null;
  const offerId = String(coupon.offer_id || ann.ts || ann.title || 'active');
  const expiresAt = coupon.expires_at || ann.expires_at || null;
  if (expiresAt && new Date(expiresAt) <= new Date()) return null;
  return {
    offer_id: offerId,
    title: String(ann.title || 'Offerta').trim().slice(0, 120),
    message: String(ann.message || '').trim().slice(0, 1200),
    push_ts: ann.ts || null,
    merchant_id: coupon.merchant_id || null,
    merchant_name: coupon.merchant_name || null,
    merchant_discount: coupon.merchant_discount || null,
    merchant_slug: coupon.merchant_slug || null
  };
}

function maskSerial(serial) {
  const s = String(serial || '');
  if (s.length <= 8) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function maskCheckoutCode(code) {
  const c = normalizeCheckoutCode(code);
  if (c.length <= 6) return c;
  return `${c.slice(0, 4)}…${c.slice(-3)}`;
}

async function getExistingRedemption(brandId, serialNumber, offerId) {
  const result = await pool.query(
    `SELECT id, created_at, store_label, operator_label, checkout_code
     FROM coupon_redemptions
     WHERE brand_id = $1 AND serial_number = $2 AND offer_id = $3
     LIMIT 1`,
    [brandId, serialNumber, offerId]
  );
  return result.rows[0] || null;
}

async function resolveRedemptionContext({
  brandSlug,
  merchantSlug,
  checkoutCode,
  serialNumber
}) {
  const brand = await getBrandBySlug(brandSlug);
  if (!brand) return { error: 'Centro commerciale non trovato' };

  let merchant = null;
  if (merchantSlug) {
    merchant = await getMerchantBySlug(brand.id, merchantSlug);
    if (!merchant) return { error: 'Negozio non trovato' };
  }

  const code = normalizeCheckoutCode(checkoutCode);
  if (code) {
    const row = await lookupRedemptionByCode({
      brandId: brand.id,
      merchantId: merchant?.id || null,
      checkoutCode: code
    });
    if (!row) return { error: 'Codice riscatto non valido' };
    if (row.redeemed_at) {
      return {
        error: 'Codice già utilizzato',
        already_redeemed: true,
        redeemed_at: row.redeemed_at,
        checkout_code_masked: maskCheckoutCode(code)
      };
    }
    const pass = await getPassBySerial(row.serial_number);
    if (!pass || pass.brand_id !== brand.id) {
      return { error: 'Pass non valido per questo centro' };
    }
    if (!merchant) {
      merchant = await getMerchant(row.merchant_id, brand.id);
    }
    return {
      brand,
      merchant,
      pass,
      serial: row.serial_number,
      codeRow: row,
      checkout_code: code
    };
  }

  const serial = String(serialNumber || '').trim();
  if (!serial) return { error: 'Codice riscatto mancante' };

  const pass = await getPassBySerial(serial);
  if (!pass || pass.brand_id !== brand.id) {
    return { error: 'Pass non valido per questo centro' };
  }
  if (pass.status && pass.status !== 'active') {
    return { error: 'Pass non attivo' };
  }

  return { brand, merchant, pass, serial, checkout_code: null, codeRow: null };
}

async function previewCouponRedemption({
  brandSlug,
  merchantSlug,
  checkoutCode,
  serialNumber,
  pin
}) {
  const ctx = await resolveRedemptionContext({
    brandSlug,
    merchantSlug,
    checkoutCode,
    serialNumber
  });
  if (ctx.error) {
    return {
      valid: false,
      reason: ctx.error,
      already_redeemed: !!ctx.already_redeemed,
      redeemed_at: ctx.redeemed_at || null,
      checkout_code_masked: ctx.checkout_code_masked || null
    };
  }

  const { brand, merchant, pass, serial, checkout_code: code } = ctx;
  if (!verifyRedemptionPin(brand, merchant, pin)) {
    return { valid: false, reason: 'PIN cassa non valido' };
  }

  const offer = resolveActiveCouponOffer(brand);
  if (!offer) {
    return { valid: false, reason: 'Nessuna offerta attiva da riscattare' };
  }

  if (offer.merchant_id && merchant && offer.merchant_id !== merchant.id) {
    return { valid: false, reason: 'Codice non valido per questo negozio' };
  }

  if (offer.merchant_id && !merchant) {
    const offerMerchant = await getMerchant(offer.merchant_id, brand.id);
    if (offerMerchant) {
      return {
        valid: false,
        reason: `Usa la cassa del negozio ${offerMerchant.name}`,
        merchant_slug: offerMerchant.slug
      };
    }
  }

  const existing = await getExistingRedemption(brand.id, serial, offer.offer_id);
  if (existing) {
    return {
      valid: false,
      already_redeemed: true,
      reason: 'Coupon già riscattato per questa offerta',
      offer,
      serial_masked: maskSerial(serial),
      checkout_code_masked: existing.checkout_code ? maskCheckoutCode(existing.checkout_code) : maskCheckoutCode(code),
      redeemed_at: existing.created_at
    };
  }

  return {
    valid: true,
    brand_name: brand.name,
    merchant_name: merchant?.name || offer.merchant_name || null,
    merchant_discount: merchant?.discount_label || offer.merchant_discount || null,
    offer,
    serial_masked: maskSerial(serial),
    checkout_code_masked: code ? maskCheckoutCode(code) : null,
    pass_id: pass.id,
    checkout_code: code || null
  };
}

async function confirmCouponRedemption({
  brandSlug,
  merchantSlug,
  checkoutCode,
  serialNumber,
  pin,
  storeLabel = '',
  operatorLabel = ''
}) {
  const preview = await previewCouponRedemption({
    brandSlug,
    merchantSlug,
    checkoutCode,
    serialNumber,
    pin
  });
  if (!preview.valid) return preview;

  const ctx = await resolveRedemptionContext({
    brandSlug,
    merchantSlug,
    checkoutCode: checkoutCode || preview.checkout_code,
    serialNumber
  });
  const { brand, merchant, pass, serial, codeRow, checkout_code: code } = ctx;
  const offer = preview.offer;

  const insert = await pool.query(
    `INSERT INTO coupon_redemptions (
      brand_id, pass_id, serial_number, offer_id, offer_title,
      store_label, operator_label, metadata, merchant_id, checkout_code
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT (brand_id, serial_number, offer_id) DO NOTHING
    RETURNING id, created_at`,
    [
      brand.id,
      pass.id,
      serial,
      offer.offer_id,
      offer.title,
      String(storeLabel || '').trim().slice(0, 120) || null,
      String(operatorLabel || '').trim().slice(0, 120) || null,
      JSON.stringify({
        push_ts: offer.push_ts,
        checkout_code: code || null,
        merchant_id: merchant?.id || offer.merchant_id || null
      }),
      merchant?.id || offer.merchant_id || null,
      code || null
    ]
  );

  if (!insert.rows.length) {
    const existing = await getExistingRedemption(brand.id, serial, offer.offer_id);
    return {
      valid: false,
      already_redeemed: true,
      reason: 'Coupon già riscattato',
      redeemed_at: existing?.created_at || null
    };
  }

  if (codeRow?.id) {
    await markRedemptionCodeUsed(codeRow.id, insert.rows[0].id);
  }

  await logHolderEvent({
    brand_id: brand.id,
    pass_id: pass.id,
    serial_number: serial,
    event_category: 'coupon',
    event_action: 'coupon_redeemed',
    target_type: 'cpa_offer',
    target_key: offer.offer_id,
    target_label: offer.title,
    metadata: {
      store_label: storeLabel || null,
      operator_label: operatorLabel || null,
      redemption_id: insert.rows[0].id,
      checkout_code: code || null,
      merchant_id: merchant?.id || offer.merchant_id || null,
      booking_id: String(offer.offer_id || '').startsWith('booking_')
        ? String(offer.offer_id).replace(/^booking_/, '')
        : null
    }
  });

  return {
    valid: true,
    redeemed: true,
    redemption_id: insert.rows[0].id,
    redeemed_at: insert.rows[0].created_at,
    offer,
    serial_masked: maskSerial(serial),
    checkout_code_masked: code ? maskCheckoutCode(code) : null,
    merchant_name: merchant?.name || offer.merchant_name || null,
    brand_name: brand.name
  };
}

async function ensureBrandCashierPin(brandId) {
  const brand = await getBrand(brandId);
  if (!brand) throw new Error('Brand non trovato');
  const cfg = parseBrandConfig(brand);
  if (cfg.cashier_pin) {
    return { pin: cfg.cashier_pin, rotated: false };
  }
  const pin = generateCashierPin();
  const next = { ...cfg, cashier_pin: pin };
  await updateBrand(brandId, { config: next });
  return { pin, rotated: true };
}

async function rotateBrandCashierPin(brandId) {
  const brand = await getBrand(brandId);
  if (!brand) throw new Error('Brand non trovato');
  const cfg = parseBrandConfig(brand);
  const pin = generateCashierPin();
  await updateBrand(brandId, { config: { ...cfg, cashier_pin: pin } });
  return { pin };
}

async function countCouponRedemptions(brandId, days = 30) {
  const sinceDays = Math.min(Math.max(parseInt(days, 10) || 30, 1), 365);
  const result = await pool.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(DISTINCT serial_number)::int AS unique_holders
     FROM coupon_redemptions
     WHERE brand_id = $1
       AND created_at >= NOW() - INTERVAL '${sinceDays} days'`,
    [brandId]
  );
  return result.rows[0] || { total: 0, unique_holders: 0 };
}

async function listRecentCouponRedemptions(brandId, limit = 20) {
  const lim = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const result = await pool.query(
    `SELECT cr.id, cr.serial_number, cr.offer_id, cr.offer_title, cr.store_label,
            cr.operator_label, cr.created_at, cr.checkout_code, m.name AS merchant_name
     FROM coupon_redemptions cr
     LEFT JOIN merchants m ON m.id = cr.merchant_id
     WHERE cr.brand_id = $1
     ORDER BY cr.created_at DESC
     LIMIT $2`,
    [brandId, lim]
  );
  return result.rows.map((r) => ({
    ...r,
    serial_masked: maskSerial(r.serial_number),
    checkout_code_masked: r.checkout_code ? maskCheckoutCode(r.checkout_code) : null
  }));
}

async function listMerchantCashierEndpoints(brandId, baseUrl, brandSlug) {
  const res = await pool.query(
    `SELECT id, name, slug, merchant_cashier_pin, checkout_prefix, discount_label
     FROM merchants
     WHERE brand_id = $1 AND active = TRUE
       AND (checkout_prefix IS NOT NULL OR physical_enabled = TRUE)
     ORDER BY name ASC`,
    [brandId]
  );
  const brandPin = (await ensureBrandCashierPin(brandId)).pin;
  return res.rows.map((m) => ({
    merchant_id: m.id,
    name: m.name,
    slug: m.slug,
    discount_label: m.discount_label,
    pin: m.merchant_cashier_pin || brandPin,
    cashier_url: `${baseUrl}/cashier/${encodeURIComponent(brandSlug)}/${encodeURIComponent(m.slug || m.id)}`
  }));
}

module.exports = {
  generateCashierPin,
  verifyCashierPin,
  verifyRedemptionPin,
  resolveActiveCouponOffer,
  previewCouponRedemption,
  confirmCouponRedemption,
  ensureBrandCashierPin,
  rotateBrandCashierPin,
  countCouponRedemptions,
  listRecentCouponRedemptions,
  listMerchantCashierEndpoints,
  maskSerial,
  maskCheckoutCode
};
