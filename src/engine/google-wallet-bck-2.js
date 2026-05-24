/**
 * Google Wallet Pass Engine
 *
 * Creates and manages Google Wallet passes (Loyalty type).
 * Uses JWT-based "Add to Google Wallet" links — no file download needed.
 *
 * Flow (no pre-registration):
 * 1. buildPassClass()   — build class object (NOT sent to API, embedded in JWT)
 * 2. buildPassObject()  — build instance for a user
 * 3. generateSaveLink() — embed both class+object in JWT → "Add to Google Wallet" URL
 * 4. updatePassObject() — update pass content in real-time (still uses API for updates)
 *
 * NOTE: By embedding loyaltyClasses inside the JWT payload (same as the Laravel approach),
 * we skip Google's class pre-registration/approval flow and avoid the
 * "This pass is only used for testing" restriction.
 */

const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ── Config ────────────────────────────────────────────────────────────
const ISSUER_ID = process.env.GOOGLE_WALLET_ISSUER_ID || '';
const DEFAULT_SERVICE_ACCOUNT_FILE = path.join(__dirname, '..', '..', 'google-pass-credentials.json');

function parseServiceAccount(raw, sourceLabel) {
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error(`[GoogleWallet] Failed to parse ${sourceLabel}:`, e.message);
    return null;
  }
}

// Support both raw JSON and base64-encoded JSON
function loadServiceAccount() {
  if (process.env.GOOGLE_WALLET_SA_BASE64) {
    try {
      const decoded = Buffer.from(process.env.GOOGLE_WALLET_SA_BASE64, 'base64').toString('utf8');
      const parsed = parseServiceAccount(decoded, 'GOOGLE_WALLET_SA_BASE64 decoded payload');
      if (parsed) return parsed;
    } catch (e) {
      console.error('[GoogleWallet] Failed to decode GOOGLE_WALLET_SA_BASE64:', e.message);
    }
  }
  if (process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON) {
    const parsed = parseServiceAccount(process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON, 'GOOGLE_WALLET_SERVICE_ACCOUNT_JSON');
    if (parsed) return parsed;
  }
  const configuredFile = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_FILE;
  if (configuredFile) {
    try {
      const fileText = fs.readFileSync(configuredFile, 'utf8');
      const parsed = parseServiceAccount(fileText, `GOOGLE_WALLET_SERVICE_ACCOUNT_FILE (${configuredFile})`);
      if (parsed) return parsed;
    } catch (e) {
      console.error('[GoogleWallet] Failed to read GOOGLE_WALLET_SERVICE_ACCOUNT_FILE:', e.message);
    }
  }
  if (fs.existsSync(DEFAULT_SERVICE_ACCOUNT_FILE)) {
    try {
      const fileText = fs.readFileSync(DEFAULT_SERVICE_ACCOUNT_FILE, 'utf8');
      const parsed = parseServiceAccount(fileText, DEFAULT_SERVICE_ACCOUNT_FILE);
      if (parsed) return parsed;
    } catch (e) {
      console.error('[GoogleWallet] Failed to read default service account file:', e.message);
    }
  }
  return null;
}
const SERVICE_ACCOUNT_JSON = loadServiceAccount();

const WALLET_API_BASE = 'https://walletobjects.googleapis.com/walletobjects/v1';
const SAVE_LINK_BASE = 'https://pay.google.com/gp/v/save';

function resolveApiBase() {
  const rawHost =
    (process.env.CUSTOM_DOMAIN && process.env.CUSTOM_DOMAIN.trim()) ||
    (process.env.RAILWAY_PUBLIC_DOMAIN && process.env.RAILWAY_PUBLIC_DOMAIN.trim()) ||
    (process.env.APP_PUBLIC_DOMAIN && process.env.APP_PUBLIC_DOMAIN.trim()) ||
    '';
  const host = rawHost.replace(/^https?:\/\//i, '').replace(/\/+$/g, '');
  return host ? `https://${host}/api/v1` : '';
}
const API_BASE = resolveApiBase();

function walletPublicBrandAssetUri(brand, asset) {
  if (!API_BASE || !brand?.slug) return null;
  return `${API_BASE}/brands/by-slug/${encodeURIComponent(brand.slug)}/${asset}`;
}

// ── JWT helpers ───────────────────────────────────────────────────────

function createServiceAccountJWT() {
  if (!SERVICE_ACCOUNT_JSON) throw new Error('Google Wallet service account not configured');

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: SERVICE_ACCOUNT_JSON.client_email,
    scope: 'https://www.googleapis.com/auth/wallet_object.issuer',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };

  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signInput = `${headerB64}.${payloadB64}`;

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signInput);
  const signature = sign.sign(SERVICE_ACCOUNT_JSON.private_key);

  return `${signInput}.${base64url(signature)}`;
}

let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const jwt = createServiceAccountJWT();
  const body = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`;

  const res = await httpRequest('POST', 'https://oauth2.googleapis.com/token', body, {
    'Content-Type': 'application/x-www-form-urlencoded'
  });

  cachedToken = res.access_token;
  tokenExpiry = Date.now() + (res.expires_in - 60) * 1000;
  return cachedToken;
}

/**
 * Create a signed JWT for "Add to Google Wallet" save link.
 *
 * KEY CHANGE: Now accepts both classObject and passObject and embeds
 * loyaltyClasses + loyaltyObjects in the payload — exactly like the Laravel code.
 * This avoids the "testing only" restriction from pre-registered classes.
 */
function createSaveJWT(classObject, passObject) {
  if (!SERVICE_ACCOUNT_JSON) throw new Error('Google Wallet service account not configured');

  const rawHost =
    (process.env.CUSTOM_DOMAIN && process.env.CUSTOM_DOMAIN.trim()) ||
    (process.env.RAILWAY_PUBLIC_DOMAIN && process.env.RAILWAY_PUBLIC_DOMAIN.trim()) ||
    (process.env.APP_PUBLIC_DOMAIN && process.env.APP_PUBLIC_DOMAIN.trim()) ||
    '';
  const host = rawHost.replace(/^https?:\/\//i, '').replace(/\/+$/g, '');
  const origin = host ? `https://${host}` : 'https://localhost';

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: SERVICE_ACCOUNT_JSON.client_email,
    aud: 'google',
    origins: [origin],
    typ: 'savetowallet',
    iat: now,
    payload: {
      loyaltyClasses: [classObject],  // embed class (skips pre-registration)
      loyaltyObjects: [passObject]    // embed object
    }
  };

  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signInput = `${headerB64}.${payloadB64}`;

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signInput);
  const signature = sign.sign(SERVICE_ACCOUNT_JSON.private_key);

  return `${signInput}.${base64url(signature)}`;
}

// ── Pass Class (template) ─────────────────────────────────────────────

/**
 * Build a pass class object.
 *
 * KEY CHANGE: This no longer calls the Google API.
 * It just returns the class object to be embedded in the JWT.
 */
function buildPassClass(brand, template) {
  const classId = `${ISSUER_ID}.${brand.slug}_${template.id}`;

  const classObj = {
    id: classId,
    reviewStatus: 'DRAFT',
    issuerName: brand.name,
    programName: (template.name || brand.name || 'Loyalty Program').slice(0, 64)
  };

  // Loyalty classes use programLogo (not logo/heroImage as in generic-like payloads).
  const logoUri = walletPublicBrandAssetUri(brand, 'logo');
  if (logoUri && (brand.config?.logo_base64 || brand.config?.logos?.logo)) {
    classObj.programLogo = {
      sourceUri: { uri: logoUri },
      contentDescription: { defaultValue: { language: 'it', value: brand.name } }
    };
  }

  // Background color
  classObj.hexBackgroundColor = rgbToHex(template.style?.backgroundColor || '#0D0B1A');

  return classObj;
}

/**
 * @deprecated Use buildPassClass() instead.
 * Kept for backward compatibility — now just builds without API call.
 */
async function createOrUpdatePassClass(brand, template) {
  console.warn('[GoogleWallet] createOrUpdatePassClass() is deprecated. Use buildPassClass() — no API pre-registration needed.');
  return buildPassClass(brand, template);
}

// ── Pass Object (instance) ────────────────────────────────────────────

function buildPassObject(brand, template, instance, member) {
  const classId = `${ISSUER_ID}.${brand.slug}_${template.id}`;
  const objectId = `${ISSUER_ID}.${instance.serial_number}`;

  const firstName = member?.first_name || instance.customer_data?.name || 'Guest';
  const lastName = member?.last_name || '';

  const obj = {
    id: objectId,
    classId: classId,
    state: 'ACTIVE',
    accountId: instance.serial_number,
    accountName: (`${firstName} ${lastName}`.trim() || 'Guest').slice(0, 64),
    barcode: {
      type: 'QR_CODE',
      value: instance.serial_number,
      alternateText: instance.serial_number
    },
    textModulesData: [],
    linksModuleData: { uris: [] }
  };

  const pointsValue = instance.field_values?.points || '0';
  const parsedPoints = Number.parseInt(String(pointsValue).replace(/[^0-9-]/g, ''), 10);
  obj.loyaltyPoints = {
    label: 'Points',
    balance: Number.isFinite(parsedPoints)
      ? { int: parsedPoints }
      : { string: String(pointsValue).slice(0, 32) }
  };

  // Map template fields to text modules
  if (template.fields && Array.isArray(template.fields)) {
    template.fields.forEach(field => {
      if (field.type === 'back') {
        const value = instance.field_values?.[field.key] || field.value || '';
        if (value.startsWith('http')) {
          obj.linksModuleData.uris.push({
            uri: value,
            description: field.label || field.key,
            id: field.key
          });
        } else if (value) {
          obj.textModulesData.push({
            id: field.key,
            header: field.label || field.key,
            body: value
          });
        }
      } else if (['secondary', 'auxiliary'].includes(field.type)) {
        const value = instance.field_values?.[field.key] || field.value || '';
        if (value) {
          obj.textModulesData.push({
            id: field.key,
            header: field.label || field.key,
            body: String(value)
          });
        }
      }
    });
  }

  return obj;
}

/**
 * Generate the "Add to Google Wallet" URL.
 *
 * KEY CHANGE: Now takes brand+template to build the class inline,
 * then embeds both class and object in the JWT — no pre-registration needed.
 */
function generateSaveLink(brand, template, passObject) {
  const classObject = buildPassClass(brand, template);
  const jwt = createSaveJWT(classObject, passObject);
  return `${SAVE_LINK_BASE}/${jwt}`;
}

/**
 * @deprecated Old signature: generateSaveLink(passObject)
 * If you were calling generateSaveLink with just a passObject,
 * switch to: generateSaveLink(brand, template, passObject)
 */
function generateSaveLinkLegacy(passObject) {
  console.warn('[GoogleWallet] generateSaveLinkLegacy() embeds only the object (old behaviour). Switch to generateSaveLink(brand, template, passObject).');
  if (!SERVICE_ACCOUNT_JSON) throw new Error('Google Wallet service account not configured');

  const rawHost =
    (process.env.CUSTOM_DOMAIN && process.env.CUSTOM_DOMAIN.trim()) ||
    (process.env.RAILWAY_PUBLIC_DOMAIN && process.env.RAILWAY_PUBLIC_DOMAIN.trim()) ||
    (process.env.APP_PUBLIC_DOMAIN && process.env.APP_PUBLIC_DOMAIN.trim()) ||
    '';
  const host = rawHost.replace(/^https?:\/\//i, '').replace(/\/+$/g, '');
  const origin = host ? `https://${host}` : 'https://localhost';

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: SERVICE_ACCOUNT_JSON.client_email,
    aud: 'google',
    origins: [origin],
    typ: 'savetowallet',
    iat: now,
    payload: { loyaltyObjects: [passObject] }
  };

  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signInput = `${headerB64}.${payloadB64}`;

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signInput);
  const signature = sign.sign(SERVICE_ACCOUNT_JSON.private_key);

  return `${SAVE_LINK_BASE}/${signInput}.${base64url(signature)}`;
}

/**
 * Create or update the pass object on Google's servers.
 * Still useful if you want server-side push updates later.
 */
async function createPassObjectOnServer(passObject) {
  try {
    const existing = await walletApiGet(`/loyaltyObject/${passObject.id}`);
    if (existing && existing.id) {
      const updated = await walletApiPatch(`/loyaltyObject/${passObject.id}`, passObject);
      console.log(`[GoogleWallet] Updated object ${passObject.id}`);
      return updated;
    }
  } catch (e) {
    // 404 = doesn't exist
  }

  const created = await walletApiPost('/loyaltyObject', passObject);
  console.log(`[GoogleWallet] Created object ${passObject.id}`);
  return created;
}

async function updatePassObject(serialNumber, updates) {
  const objectId = `${ISSUER_ID}.${serialNumber}`;

  try {
    const updated = await walletApiPatch(`/loyaltyObject/${objectId}`, updates);
    console.log(`[GoogleWallet] Updated object ${objectId}`);
    return updated;
  } catch (e) {
    console.error(`[GoogleWallet] Failed to update ${objectId}:`, e.message);
    throw e;
  }
}

async function updatePassMessage(serialNumber, message) {
  return updatePassObject(serialNumber, {
    textModulesData: [{
      id: 'latest_message',
      header: 'Novità',
      body: message
    }]
  });
}

// ── Google Wallet API helpers ─────────────────────────────────────────

async function walletApiGet(path) {
  const token = await getAccessToken();
  return httpRequest('GET', `${WALLET_API_BASE}${path}`, null, {
    'Authorization': `Bearer ${token}`
  });
}

async function walletApiPost(path, body) {
  const token = await getAccessToken();
  return httpRequest('POST', `${WALLET_API_BASE}${path}`, JSON.stringify(body), {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  });
}

async function walletApiPatch(path, body) {
  const token = await getAccessToken();
  return httpRequest('PATCH', `${WALLET_API_BASE}${path}`, JSON.stringify(body), {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  });
}

// ── HTTP client ───────────────────────────────────────────────────────

function httpRequest(method, url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method,
      headers: { ...headers }
    };
    if (body) options.headers['Content-Length'] = Buffer.byteLength(body);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 400) {
            const err = new Error(`Google Wallet API ${res.statusCode}: ${JSON.stringify(json.error || json)}`);
            err.statusCode = res.statusCode;
            err.body = json;
            reject(err);
          } else {
            resolve(json);
          }
        } catch (e) {
          if (res.statusCode >= 400) {
            reject(new Error(`Google Wallet API ${res.statusCode}: ${data}`));
          } else {
            resolve(data);
          }
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// ── Utilities ─────────────────────────────────────────────────────────

function base64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function rgbToHex(color) {
  if (!color) return '#0D0B1A';
  if (color.startsWith('#')) return color;
  const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) return '#0D0B1A';
  const r = parseInt(match[1]).toString(16).padStart(2, '0');
  const g = parseInt(match[2]).toString(16).padStart(2, '0');
  const b = parseInt(match[3]).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

// ── Status ────────────────────────────────────────────────────────────

function isConfigured() {
  return !!(ISSUER_ID && SERVICE_ACCOUNT_JSON);
}

function getStatusInfo() {
  const rawDomain =
    (process.env.CUSTOM_DOMAIN && process.env.CUSTOM_DOMAIN.trim()) ||
    (process.env.RAILWAY_PUBLIC_DOMAIN && process.env.RAILWAY_PUBLIC_DOMAIN.trim()) ||
    (process.env.APP_PUBLIC_DOMAIN && process.env.APP_PUBLIC_DOMAIN.trim()) ||
    '';
  const domain = rawDomain.replace(/^https?:\/\//i, '').replace(/\/+$/g, '');
  const base = domain ? `https://${domain}/api/v1` : '';
  return {
    configured: isConfigured(),
    issuer_id: ISSUER_ID || null,
    custom_domain: domain || null,
    callback_url: base ? `${base}/google-wallet/callback` : null,
    callback_path: '/api/v1/google-wallet/callback',
    registration_mode: 'jwt-embedded (no pre-registration)',
    warning:
      !domain
        ? 'No public domain configured (CUSTOM_DOMAIN/RAILWAY_PUBLIC_DOMAIN/APP_PUBLIC_DOMAIN).'
        : null
  };
}

module.exports = {
  isConfigured,
  getStatusInfo,
  buildPassClass,
  createOrUpdatePassClass, // deprecated, kept for compatibility
  buildPassObject,
  generateSaveLink,
  generateSaveLinkLegacy,
  createPassObjectOnServer,
  updatePassObject,
  updatePassMessage
};