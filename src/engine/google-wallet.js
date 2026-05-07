/**
 * Google Wallet Pass Engine
 *
 * Creates and manages Google Wallet passes (Generic type).
 * Uses JWT-based "Add to Google Wallet" links — no file download needed.
 *
 * Flow:
 * 1. createPassClass() — create a template (once per brand/template)
 * 2. createPassObject() — create an instance for a user
 * 3. generateSaveLink() — generate the "Add to Google Wallet" URL
 * 4. updatePassObject() — update pass content in real-time
 */

const crypto = require('crypto');
const https = require('https');

// ── Config ────────────────────────────────────────────────────────────
const ISSUER_ID = process.env.GOOGLE_WALLET_ISSUER_ID || '';

// Support both raw JSON and base64-encoded JSON
function loadServiceAccount() {
  // Option 1: base64 encoded (recommended in managed hosting env files)
  if (process.env.GOOGLE_WALLET_SA_BASE64) {
    try {
      const decoded = Buffer.from(process.env.GOOGLE_WALLET_SA_BASE64, 'base64').toString('utf8');
      return JSON.parse(decoded);
    } catch (e) {
      console.error('[GoogleWallet] Failed to decode GOOGLE_WALLET_SA_BASE64:', e.message);
    }
  }
  // Option 2: raw JSON string
  if (process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON) {
    try {
      return JSON.parse(process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON);
    } catch (e) {
      console.error('[GoogleWallet] Failed to parse GOOGLE_WALLET_SERVICE_ACCOUNT_JSON:', e.message);
    }
  }
  return null;
}
const SERVICE_ACCOUNT_JSON = loadServiceAccount();

const WALLET_API_BASE = 'https://walletobjects.googleapis.com/walletobjects/v1';
const SAVE_LINK_BASE = 'https://pay.google.com/gp/v/save';
const API_BASE = `https://${process.env.CUSTOM_DOMAIN || 'www.nudj.studio'}/api/v1`;

// ── JWT helpers ───────────────────────────────────────────────────────

/**
 * Create a signed JWT for Google Wallet API auth (OAuth2 service account)
 */
function createServiceAccountJWT() {
  if (!SERVICE_ACCOUNT_JSON) throw new Error('GOOGLE_WALLET_SERVICE_ACCOUNT_JSON not configured');

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

/**
 * Get an OAuth2 access token from Google
 */
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
 * Create a signed JWT for "Add to Google Wallet" save link
 */
function createSaveJWT(passObject) {
  if (!SERVICE_ACCOUNT_JSON) throw new Error('GOOGLE_WALLET_SERVICE_ACCOUNT_JSON not configured');

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: SERVICE_ACCOUNT_JSON.client_email,
    aud: 'google',
    origins: [],
    typ: 'savetowallet',
    iat: now,
    payload: {
      genericObjects: [passObject]
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
 * Create or update a Google Wallet pass class (template).
 * One class per brand template.
 */
async function createOrUpdatePassClass(brand, template) {
  const classId = `${ISSUER_ID}.${brand.slug}_${template.id}`;

  const classObj = {
    id: classId,
    classTemplateInfo: {
      cardTemplateOverride: {
        cardRowTemplateInfos: [
          {
            twoItems: {
              startItem: {
                firstValue: { fields: [{ fieldPath: 'object.textModulesData["points"]' }] }
              },
              endItem: {
                firstValue: { fields: [{ fieldPath: 'object.textModulesData["tier"]' }] }
              }
            }
          }
        ]
      }
    },
    imageModulesData: [],
    textModulesData: [],
    linksModuleData: { uris: [] },
    // Callback for save/delete events — Google POSTs here when user adds/removes pass
    callbackOptions: {
      url: `${API_BASE}/google-wallet/callback`
    }
  };

  // Brand logo
  if (brand.config?.logo_base64 || brand.config?.logos?.logo) {
    classObj.logo = {
      sourceUri: { uri: `${API_BASE}/brands/${brand.id}/logo` },
      contentDescription: { defaultValue: { language: 'it', value: brand.name } }
    };
  }

  // Hero image (strip equivalent)
  if (brand.config?.strip_base64 || brand.config?.logos?.strip || template.style?.stripImage) {
    classObj.heroImage = {
      sourceUri: { uri: `${API_BASE}/brands/${brand.id}/strip` },
      contentDescription: { defaultValue: { language: 'it', value: 'Banner' } }
    };
  }

  // Colors from template
  const bgColor = template.style?.backgroundColor || '#0D0B1A';
  classObj.hexBackgroundColor = rgbToHex(bgColor);

  // Try to get existing class first
  try {
    const existing = await walletApiGet(`/genericClass/${classId}`);
    if (existing && existing.id) {
      const updated = await walletApiPatch(`/genericClass/${classId}`, classObj);
      console.log(`[GoogleWallet] Updated class ${classId}`);
      return updated;
    }
  } catch (e) {
    // 404 = doesn't exist, create it
  }

  const created = await walletApiPost('/genericClass', classObj);
  console.log(`[GoogleWallet] Created class ${classId}`);
  return created;
}

// ── Pass Object (instance) ────────────────────────────────────────────

/**
 * Create a Google Wallet pass object for a specific user.
 * Returns the object data (not yet saved — user must click the link).
 */
function buildPassObject(brand, template, instance, member) {
  const classId = `${ISSUER_ID}.${brand.slug}_${template.id}`;
  const objectId = `${ISSUER_ID}.${instance.serial_number}`;

  const firstName = member?.first_name || instance.customer_data?.name || 'Guest';
  const lastName = member?.last_name || '';

  const obj = {
    id: objectId,
    classId: classId,
    state: 'ACTIVE',
    cardTitle: {
      defaultValue: { language: 'it', value: brand.name }
    },
    subheader: {
      defaultValue: { language: 'it', value: 'Membro' }
    },
    header: {
      defaultValue: { language: 'it', value: `${firstName} ${lastName}`.trim() }
    },
    barcode: {
      type: 'QR_CODE',
      value: instance.serial_number,
      alternateText: instance.serial_number
    },
    hexBackgroundColor: rgbToHex(template.style?.backgroundColor || '#0D0B1A'),
    textModulesData: [],
    linksModuleData: { uris: [] },
    imageModulesData: []
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

  // Hero image
  if (brand.config?.strip_base64 || brand.config?.logos?.strip || template.style?.stripImage) {
    obj.heroImage = {
      sourceUri: { uri: `${API_BASE}/brands/${brand.id}/strip` },
      contentDescription: { defaultValue: { language: 'it', value: 'Banner' } }
    };
  }

  // Logo
  if (brand.config?.logo_base64 || brand.config?.logos?.logo) {
    obj.logo = {
      sourceUri: { uri: `${API_BASE}/brands/${brand.id}/logo` },
      contentDescription: { defaultValue: { language: 'it', value: brand.name } }
    };
  }

  return obj;
}

/**
 * Generate the "Add to Google Wallet" save URL
 */
function generateSaveLink(passObject) {
  const jwt = createSaveJWT(passObject);
  return `${SAVE_LINK_BASE}/${jwt}`;
}

/**
 * Create the pass object on Google's servers (for updates later)
 */
async function createPassObjectOnServer(passObject) {
  try {
    const existing = await walletApiGet(`/genericObject/${passObject.id}`);
    if (existing && existing.id) {
      const updated = await walletApiPatch(`/genericObject/${passObject.id}`, passObject);
      console.log(`[GoogleWallet] Updated object ${passObject.id}`);
      return updated;
    }
  } catch (e) {
    // 404 = doesn't exist
  }

  const created = await walletApiPost('/genericObject', passObject);
  console.log(`[GoogleWallet] Created object ${passObject.id}`);
  return created;
}

/**
 * Update an existing pass object
 */
async function updatePassObject(serialNumber, updates) {
  const objectId = `${ISSUER_ID}.${serialNumber}`;

  try {
    const updated = await walletApiPatch(`/genericObject/${objectId}`, updates);
    console.log(`[GoogleWallet] Updated object ${objectId}`);
    return updated;
  } catch (e) {
    console.error(`[GoogleWallet] Failed to update ${objectId}:`, e.message);
    throw e;
  }
}

/**
 * Update the pass message (equivalent to Apple's changeMessage)
 */
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

// ── HTTP client (native, no deps) ────────────────────────────────────

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

// ── Check if Google Wallet is configured ──────────────────────────────

function isConfigured() {
  return !!(ISSUER_ID && SERVICE_ACCOUNT_JSON);
}

module.exports = {
  isConfigured,
  createOrUpdatePassClass,
  buildPassObject,
  generateSaveLink,
  createPassObjectOnServer,
  updatePassObject,
  updatePassMessage
};
