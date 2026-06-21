'use strict';

const jwt = require('jsonwebtoken');

const HUB_TOKEN_TTL_SEC = 90 * 24 * 60 * 60;

function getHubSecret() {
  const secret = process.env.JWT_HUB_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_HUB_SECRET (or JWT_SECRET) is required for HUB Convenzioni');
  }
  if (!process.env.JWT_HUB_SECRET) {
    console.warn('[hub-jwt] JWT_HUB_SECRET not set — falling back to JWT_SECRET');
  }
  return secret;
}

function getHubBaseUrl() {
  const explicit = String(process.env.HUB_BASE_URL || '').trim();
  if (explicit) return explicit.replace(/\/+$/, '');

  const customDomain = String(process.env.CUSTOM_DOMAIN || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
  if (customDomain) return `https://hub.${customDomain.replace(/^studio\./, '')}`;

  return 'https://hub.filodiretto.app';
}

function signHubToken({ user_id, pass_serial, brand_id }) {
  if (!pass_serial || !brand_id) {
    throw new Error('pass_serial and brand_id are required for hub JWT');
  }
  return jwt.sign(
    {
      typ: 'hub',
      user_id: user_id != null ? String(user_id) : null,
      pass_serial: String(pass_serial),
      brand_id: String(brand_id)
    },
    getHubSecret(),
    { algorithm: 'HS256', expiresIn: HUB_TOKEN_TTL_SEC }
  );
}

function verifyHubToken(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const decoded = jwt.verify(token, getHubSecret(), { algorithms: ['HS256'] });
    if (decoded.typ !== 'hub' || !decoded.pass_serial || !decoded.brand_id) return null;
    return {
      user_id: decoded.user_id || null,
      pass_serial: String(decoded.pass_serial),
      brand_id: String(decoded.brand_id)
    };
  } catch {
    return null;
  }
}

function buildHubUrl(token, brandSlug) {
  if (!token) return null;
  const base = getHubBaseUrl();
  const params = new URLSearchParams({ token: String(token) });
  if (brandSlug) params.set('brand', String(brandSlug));
  return `${base}/?${params.toString()}`;
}

module.exports = {
  HUB_TOKEN_TTL_SEC,
  getHubSecret,
  getHubBaseUrl,
  signHubToken,
  verifyHubToken,
  buildHubUrl
};
