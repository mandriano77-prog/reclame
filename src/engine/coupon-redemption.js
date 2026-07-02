/**
 * Reclame — CPA coupon redemption at physical checkout (closed-loop).
 * Pass QR encodes serial_number → cashier confirms → verified redemption event.
 */
const crypto = require('crypto');
const { pool, getBrand, getBrandBySlug, getPassBySerial, updateBrand } = require('../db');
const { logHolderEvent } = require('./holder-events');

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
    push_ts: ann.ts || null
  };
}

function maskSerial(serial) {
  const s = String(serial || '');
  if (s.length <= 8) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

async function getExistingRedemption(brandId, serialNumber, offerId) {
  const result = await pool.query(
    `SELECT id, created_at, store_label, operator_label
     FROM coupon_redemptions
     WHERE brand_id = $1 AND serial_number = $2 AND offer_id = $3
     LIMIT 1`,
    [brandId, serialNumber, offerId]
  );
  return result.rows[0] || null;
}

async function previewCouponRedemption({ brandSlug, serialNumber, pin }) {
  const brand = await getBrandBySlug(brandSlug);
  if (!brand) return { valid: false, reason: 'Centro commerciale non trovato' };
  if (!verifyCashierPin(brand, pin)) {
    return { valid: false, reason: 'PIN cassa non valido' };
  }

  const serial = String(serialNumber || '').trim();
  if (!serial) return { valid: false, reason: 'Codice pass mancante' };

  const pass = await getPassBySerial(serial);
  if (!pass || pass.brand_id !== brand.id) {
    return { valid: false, reason: 'Pass non valido per questo centro' };
  }
  if (pass.status && pass.status !== 'active') {
    return { valid: false, reason: 'Pass non attivo' };
  }

  const offer = resolveActiveCouponOffer(brand);
  if (!offer) {
    return { valid: false, reason: 'Nessuna offerta attiva da riscattare' };
  }

  const existing = await getExistingRedemption(brand.id, serial, offer.offer_id);
  if (existing) {
    return {
      valid: false,
      already_redeemed: true,
      reason: 'Coupon già riscattato per questa offerta',
      offer,
      serial_masked: maskSerial(serial),
      redeemed_at: existing.created_at
    };
  }

  return {
    valid: true,
    brand_name: brand.name,
    offer,
    serial_masked: maskSerial(serial),
    pass_id: pass.id
  };
}

async function confirmCouponRedemption({
  brandSlug,
  serialNumber,
  pin,
  storeLabel = '',
  operatorLabel = ''
}) {
  const preview = await previewCouponRedemption({ brandSlug, serialNumber, pin });
  if (!preview.valid) return preview;

  const brand = await getBrandBySlug(brandSlug);
  const serial = String(serialNumber || '').trim();
  const pass = await getPassBySerial(serial);
  const offer = preview.offer;

  const insert = await pool.query(
    `INSERT INTO coupon_redemptions (
      brand_id, pass_id, serial_number, offer_id, offer_title,
      store_label, operator_label, metadata
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
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
      JSON.stringify({ push_ts: offer.push_ts })
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
      redemption_id: insert.rows[0].id
    }
  });

  return {
    valid: true,
    redeemed: true,
    redemption_id: insert.rows[0].id,
    redeemed_at: insert.rows[0].created_at,
    offer,
    serial_masked: maskSerial(serial),
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
    `SELECT id, serial_number, offer_id, offer_title, store_label, operator_label, created_at
     FROM coupon_redemptions
     WHERE brand_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [brandId, lim]
  );
  return result.rows.map((r) => ({
    ...r,
    serial_masked: maskSerial(r.serial_number)
  }));
}

module.exports = {
  generateCashierPin,
  verifyCashierPin,
  resolveActiveCouponOffer,
  previewCouponRedemption,
  confirmCouponRedemption,
  ensureBrandCashierPin,
  rotateBrandCashierPin,
  countCouponRedemptions,
  listRecentCouponRedemptions,
  maskSerial
};
