/**
 * Magic-link URL on Wallet pass back — token stored in field_values.__portal_token
 */
const { getPassInstance, updatePassInstance, getBrand } = require('../db');
const { isPortalPassBrand } = require('./pass-product-line');
const {
  issuePortalToken,
  verifyPortalToken,
  buildPortalUrl,
  getPortalBaseUrl
} = require('./portal-auth');

const PORTAL_TOKEN_FIELD = '__portal_token';

function parseFieldValues(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return { ...raw };
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function readPassPortalToken(passId) {
  const pass = await getPassInstance(passId);
  if (!pass) return null;
  const fv = parseFieldValues(pass.field_values);
  return fv[PORTAL_TOKEN_FIELD] || null;
}

async function savePassPortalToken(passId, token) {
  const pass = await getPassInstance(passId);
  if (!pass) throw new Error('Pass not found');
  const fv = parseFieldValues(pass.field_values);
  if (token) fv[PORTAL_TOKEN_FIELD] = token;
  else delete fv[PORTAL_TOKEN_FIELD];
  await updatePassInstance(passId, { field_values: fv });
}

function isPortalLinkEnabled() {
  try {
    return !!getPortalBaseUrl();
  } catch {
    return false;
  }
}

/**
 * Reuse active JWT on pass when possible; issue + persist when missing or rotate=true.
 */
async function resolvePortalLinkForPass(passId, options = {}) {
  const { rotate = false } = options;
  if (!isPortalLinkEnabled()) return null;

  const pass = await getPassInstance(passId);
  if (!pass) return null;

  const brand = pass.brand_id ? await getBrand(pass.brand_id) : null;
  if (brand && !isPortalPassBrand(brand)) return null;

  if (!rotate) {
    const stored = await readPassPortalToken(passId);
    if (stored) {
      const session = await verifyPortalToken(stored);
      if (session) {
        return {
          token: stored,
          portal_url: buildPortalUrl(stored),
          rotated: false
        };
      }
    }
  }

  const issued = await issuePortalToken(passId, pass.brand_id);
  await savePassPortalToken(passId, issued.token);
  return {
    token: issued.token,
    portal_url: issued.portal_url,
    rotated: true
  };
}

async function rotatePortalLinkForPass(passId) {
  return resolvePortalLinkForPass(passId, { rotate: true });
}

module.exports = {
  PORTAL_TOKEN_FIELD,
  isPortalLinkEnabled,
  readPassPortalToken,
  savePassPortalToken,
  resolvePortalLinkForPass,
  rotatePortalLinkForPass
};
