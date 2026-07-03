/**
 * Reclame — per-pass checkout codes for CPA redemption at merchant cashier.
 */
'use strict';

const { pool, getMerchant, mergePassFieldValues } = require('../db');

const CODE_CHARSET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function normalizeCheckoutCode(code) {
  return String(code || '').trim().toUpperCase().replace(/\s+/g, '');
}

function normalizePrefix(prefix, fallbackName) {
  const raw = String(prefix || fallbackName || 'OFF')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
  return raw || 'OFF';
}

function randomSuffix(length = 4) {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += CODE_CHARSET[Math.floor(Math.random() * CODE_CHARSET.length)];
  }
  return out;
}

function buildCheckoutCode(prefix, suffix) {
  return `${normalizePrefix(prefix)}-${suffix}`;
}

async function codeExists(brandId, code) {
  const res = await pool.query(
    'SELECT 1 FROM redemption_codes WHERE brand_id = $1 AND checkout_code = $2 LIMIT 1',
    [brandId, code]
  );
  return res.rows.length > 0;
}

async function generateUniqueCheckoutCode(brandId, prefix) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = buildCheckoutCode(prefix, randomSuffix(4));
    if (!(await codeExists(brandId, code))) return code;
  }
  throw new Error('Impossibile generare codice riscatto univoco');
}

async function upsertRedemptionCodeRow({
  brandId,
  merchantId,
  passId,
  serialNumber,
  offerId,
  checkoutCode
}) {
  const res = await pool.query(
    `INSERT INTO redemption_codes (
      brand_id, merchant_id, pass_id, serial_number, offer_id, checkout_code
    ) VALUES ($1,$2,$3,$4,$5,$6)
    ON CONFLICT (brand_id, serial_number, offer_id, merchant_id)
    DO UPDATE SET
      checkout_code = EXCLUDED.checkout_code,
      pass_id = EXCLUDED.pass_id,
      redeemed_at = NULL,
      redemption_id = NULL
    RETURNING *`,
    [brandId, merchantId, passId, serialNumber, offerId, checkoutCode]
  );
  return res.rows[0];
}

async function issueCodesForPush({ brandId, merchantId, offerId, passes }) {
  const merchant = await getMerchant(merchantId, brandId);
  if (!merchant) throw new Error('Merchant non trovato per generazione codici');

  const prefix = normalizePrefix(merchant.checkout_prefix, merchant.name);
  const mode = merchant.checkout_mode === 'static' ? 'static' : 'dynamic_per_pass';
  const list = Array.isArray(passes) ? passes.filter((p) => p?.serial_number) : [];
  if (!list.length) return { issued: 0, mode };

  let staticCode = null;
  if (mode === 'static') {
    staticCode = normalizeCheckoutCode(merchant.checkout_static_code);
    if (!staticCode) {
      staticCode = await generateUniqueCheckoutCode(brandId, prefix);
    }
  }

  let issued = 0;
  for (const pass of list) {
    const checkoutCode = mode === 'static'
      ? staticCode
      : await generateUniqueCheckoutCode(brandId, prefix);

    await upsertRedemptionCodeRow({
      brandId,
      merchantId,
      passId: pass.id,
      serialNumber: pass.serial_number,
      offerId,
      checkoutCode
    });

    await mergePassFieldValues(pass.id, {
      __checkout_code: checkoutCode,
      __checkout_merchant: merchant.name,
      __checkout_discount: merchant.discount_label
    });
    issued += 1;
  }

  return { issued, mode, merchant_name: merchant.name };
}

async function lookupRedemptionByCode({ brandId, merchantId, checkoutCode }) {
  const code = normalizeCheckoutCode(checkoutCode);
  if (!code) return null;
  const params = [brandId, code];
  let sql = `SELECT rc.*, m.name AS merchant_name, m.discount_label, m.slug AS merchant_slug
             FROM redemption_codes rc
             JOIN merchants m ON m.id = rc.merchant_id
             WHERE rc.brand_id = $1 AND rc.checkout_code = $2`;
  if (merchantId) {
    sql += ' AND rc.merchant_id = $3';
    params.push(merchantId);
  }
  sql += ' LIMIT 1';
  const res = await pool.query(sql, params);
  return res.rows[0] || null;
}

async function markRedemptionCodeUsed(codeRowId, redemptionId) {
  if (!codeRowId) return;
  await pool.query(
    `UPDATE redemption_codes
     SET redeemed_at = NOW(), redemption_id = $2
     WHERE id = $1`,
    [codeRowId, redemptionId || null]
  );
}

async function getCheckoutCodeForPass({ brandId, serialNumber, offerId, merchantId }) {
  const res = await pool.query(
    `SELECT * FROM redemption_codes
     WHERE brand_id = $1 AND serial_number = $2 AND offer_id = $3 AND merchant_id = $4
     LIMIT 1`,
    [brandId, serialNumber, offerId, merchantId]
  );
  return res.rows[0] || null;
}

module.exports = {
  normalizeCheckoutCode,
  normalizePrefix,
  buildCheckoutCode,
  generateUniqueCheckoutCode,
  issueCodesForPush,
  lookupRedemptionByCode,
  markRedemptionCodeUsed,
  getCheckoutCodeForPass
};
