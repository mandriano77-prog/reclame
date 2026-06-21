'use strict';

const crypto = require('crypto');

const QR_TTL_MS = 60 * 60 * 1000;

function getQrHmacSecret() {
  const secret = process.env.QR_HMAC_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'test') return 'test-qr-hmac-secret-sprint3';
    throw new Error('QR_HMAC_SECRET is required for HUB QR signing');
  }
  return secret;
}

function getPartnerBaseUrl() {
  const explicit = String(process.env.PARTNER_BASE_URL || '').trim();
  if (explicit) return explicit.replace(/\/+$/, '');

  const customDomain = String(process.env.CUSTOM_DOMAIN || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
  if (customDomain) {
    const root = customDomain.replace(/^studio\./, '');
    return `https://partner.${root}`;
  }
  return 'https://partner.filodiretto.app';
}

function getApiBaseUrl() {
  const explicit = String(process.env.API_BASE_URL || '').trim();
  if (explicit) return explicit.replace(/\/+$/, '');

  const customDomain = String(process.env.CUSTOM_DOMAIN || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
  if (customDomain) return `https://${customDomain}`;
  return 'https://api.filodiretto.app';
}

function buildHmacPayload(pass_serial, merchant_id, brand_id, timestamp) {
  return `${pass_serial}|${merchant_id}|${brand_id}|${timestamp}`;
}

function computeScanSig({ pass_serial, merchant_id, brand_id, t }) {
  const payload = buildHmacPayload(
    String(pass_serial),
    String(merchant_id),
    String(brand_id),
    String(t)
  );
  return crypto.createHmac('sha256', getQrHmacSecret()).update(payload).digest('hex');
}

function signScanUrl({ pass_serial, merchant_id, brand_id, timestamp = Date.now(), usePartnerUrl = true }) {
  if (!pass_serial || !merchant_id || !brand_id) {
    throw new Error('pass_serial, merchant_id e brand_id sono obbligatori');
  }
  const t = String(timestamp);
  const sig = computeScanSig({ pass_serial, merchant_id, brand_id, t });
  const params = new URLSearchParams({
    serial: String(pass_serial),
    merchant: String(merchant_id),
    t,
    sig
  });
  const base = usePartnerUrl
    ? `${getPartnerBaseUrl()}/scan`
    : `${getApiBaseUrl()}/api/v1/hub/scan`;
  const url = `${base}?${params.toString()}`;
  return {
    url,
    scan_url: url,
    serial: String(pass_serial),
    merchant: String(merchant_id),
    t,
    sig,
    expires_at: new Date(Number(t) + QR_TTL_MS).toISOString()
  };
}

function isTimestampFresh(t, now = Date.now()) {
  const ts = Number(t);
  if (!Number.isFinite(ts)) return false;
  const age = now - ts;
  return age >= 0 && age <= QR_TTL_MS;
}

function verifyScanSignature({ serial, merchant, t, sig, brand_id }) {
  if (!serial || !merchant || !t || !sig || !brand_id) {
    return { valid: false, reason: 'Parametri mancanti' };
  }
  if (!isTimestampFresh(t)) {
    return { valid: false, reason: 'QR scaduto' };
  }
  const expected = computeScanSig({
    pass_serial: serial,
    merchant_id: merchant,
    brand_id,
    t: String(t)
  });
  const a = Buffer.from(String(sig), 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { valid: false, reason: 'Firma non valida' };
  }
  return { valid: true };
}

module.exports = {
  QR_TTL_MS,
  getQrHmacSecret,
  getPartnerBaseUrl,
  getApiBaseUrl,
  buildHmacPayload,
  computeScanSig,
  signScanUrl,
  isTimestampFresh,
  verifyScanSignature
};
