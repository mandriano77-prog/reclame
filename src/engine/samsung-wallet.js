/**
 * Samsung Wallet — loyalty card (Partner program)
 *
 * Documentazione: https://developer.samsung.com/wallet/api/server-interaction.html
 * JWT AUTH (firma outbound): https://developer.samsung.com/wallet/api/security.html
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const jwt = require('jsonwebtoken');

const LOYALTY_SUBTYPE = process.env.SAMSUNG_WALLET_LOYALTY_SUBTYPE || 'others';
const ADD_LINK_HOST = process.env.SAMSUNG_WALLET_ADD_LINK_HOST || 'https://a.swallet.link';
const SKIP_JWT_VERIFY = process.env.SAMSUNG_WALLET_SKIP_JWT_VERIFY === '1';

/** Host tsapi pubblico Update Notification — {cc2} minuscolo (es. it, kr, us). */
const TSAPI_HOST_TEMPLATE =
  process.env.SAMSUNG_WALLET_TSAPI_HOST_TEMPLATE || 'https://{cc2}-tsapi.walletsvc.samsung.com';

const JWT_KID = process.env.SAMSUNG_WALLET_JWT_KID || 'WLT.PRIKEY';

function expandUserPath(p) {
  if (!p || typeof p !== 'string') return '';
  const t = p.trim();
  if (t.startsWith('~/')) return path.join(os.homedir(), t.slice(2));
  return path.resolve(t);
}

function resolveEnv(primary, aliases, fallback = '') {
  const keys = [primary, ...aliases];
  for (const k of keys) {
    const v = process.env[k];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return fallback;
}

function getSamsungCardId() {
  return resolveEnv('SAMSUNG_WALLET_CARD_ID', ['SAMSUNG_CARD_ID']);
}

function getCertificateId() {
  return resolveEnv('SAMSUNG_WALLET_CERTIFICATE_ID', ['SAMSUNG_CERTIFICATE_ID']);
}

function getPartnerId() {
  return resolveEnv('SAMSUNG_WALLET_PARTNER_ID', ['SAMSUNG_PARTNER_ID']);
}

/** Chiave pubblica / cert per verifica JWT inbound (Get Card Data / Send Card State). */
function getInboundJwtPublicPem() {
  const inline = process.env.SAMSUNG_WALLET_JWT_PUBLIC_KEY_PEM;
  if (inline) return inline.replace(/\\n/g, '\n');

  const cert = resolveEnv('SAMSUNG_SIGNED_CERT', ['SAMSUNG_WALLET_INBOUND_CERT_PATH']);
  if (!cert) return '';
  if (cert.includes('-----BEGIN')) return cert.replace(/\\n/g, '\n');
  const fp = expandUserPath(cert);
  try {
    if (fs.existsSync(fp)) return fs.readFileSync(fp, 'utf8');
  } catch (_) {}
  return '';
}

function getOutboundPrivateKeyPem() {
  const inline =
    process.env.SAMSUNG_PRIVATE_KEY_PEM ||
    process.env.SAMSUNG_WALLET_PRIVATE_KEY_PEM ||
    '';
  if (inline) return inline.replace(/\\n/g, '\n');

  const keyPath = resolveEnv('SAMSUNG_PRIVATE_KEY', ['SAMSUNG_WALLET_PRIVATE_KEY_PATH']);
  if (!keyPath) return '';
  const fp = expandUserPath(keyPath);
  try {
    if (fs.existsSync(fp)) return fs.readFileSync(fp, 'utf8');
    console.error('[SamsungWallet] File chiave privata non trovato:', fp);
  } catch (e) {
    console.error('[SamsungWallet] Lettura chiave privata fallita:', e.message);
  }
  return '';
}

function publicApiBase() {
  const d = process.env.CUSTOM_DOMAIN || '';
  return d ? `https://${d}/api/v1` : '';
}

function isConfigured() {
  return !!(getSamsungCardId() && getCertificateId() && getPartnerId());
}

function outboundAuthReady() {
  const tok = resolveEnv('SAMSUNG_WALLET_ACCESS_TOKEN', ['SAMSUNG_ACCESS_TOKEN']);
  if (tok) return true;
  return !!getOutboundPrivateKeyPem();
}

function getStatusInfo() {
  const base = publicApiBase();
  const pub = !!getInboundJwtPublicPem() || SKIP_JWT_VERIFY;
  return {
    configured: isConfigured(),
    outbound_auth_ready: outboundAuthReady(),
    inbound_jwt_verify_ready: pub,
    card_id: getSamsungCardId() || null,
    certificate_id: getCertificateId() || null,
    partner_id: getPartnerId() || null,
    partner_cards_base_url: base ? `${base}/samsung-wallet` : null,
    partner_get_path: '/samsung-wallet/cards/{cardId}/{refId}',
    env_aliases:
      'Card: SAMSUNG_WALLET_CARD_ID | SAMSUNG_CARD_ID · Cert: SAMSUNG_WALLET_CERTIFICATE_ID | SAMSUNG_CERTIFICATE_ID · Partner: SAMSUNG_WALLET_PARTNER_ID | SAMSUNG_PARTNER_ID · Token statico: SAMSUNG_WALLET_ACCESS_TOKEN | SAMSUNG_ACCESS_TOKEN · Chiave privata: SAMSUNG_PRIVATE_KEY (path) o *_PEM · Inbound cert/PEM: SAMSUNG_SIGNED_CERT (path o PEM) o SAMSUNG_WALLET_JWT_PUBLIC_KEY_PEM',
    note:
      'Update Notification: POST su {cc2}-tsapi…/wltex/cards/{cardId}/updates con Bearer = SAMSUNG_WALLET_ACCESS_TOKEN oppure JWT AUTH (RS256) firmato con SAMSUNG_PRIVATE_KEY. cc2 da Send Card State (salvato su pass) o SAMSUNG_WALLET_DEFAULT_CC2.'
  };
}

function refIdForPass(passInternalId) {
  return crypto.createHash('sha256').update(String(passInternalId)).digest('hex').slice(0, 32);
}

function generateDataFetchLink(refId) {
  if (!isConfigured()) throw new Error('Samsung Wallet non configurato');
  const pdata = encodeURIComponent(refId);
  const cert = getCertificateId();
  const card = getSamsungCardId();
  return `${ADD_LINK_HOST}/atw/v3/${cert}/${card}#Clip?pdata=${pdata}`;
}

function rgbToHex(color) {
  if (!color) return '#0D0B1A';
  if (String(color).startsWith('#')) return String(color);
  const match = String(color).match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) return '#0D0B1A';
  const r = parseInt(match[1], 10).toString(16).padStart(2, '0');
  const g = parseInt(match[2], 10).toString(16).padStart(2, '0');
  const b = parseInt(match[3], 10).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

function buildLoyaltyCardResponse(brand, template, instance, refId, cardState = 'ACTIVE', member = null) {
  const api = publicApiBase();
  const now = Date.now();

  const { buildEmployeePass, toSamsungPass, isHrEmployeePass } = require('./employee-pass');
  if (isHrEmployeePass(brand)) {
    const employeePass = buildEmployeePass({
      brand,
      template,
      instance,
      member,
      brandConfig: brand.config,
      apiBase: api
    });
    const samsung = toSamsungPass(employeePass);

    let logoImage = samsung.logoImage
      || 'https://gpp.walletsvc.samsung.com/mcs/images/contents/wallet_intro_logo.png';

    const attrs = {
      title: samsung.title,
      providerName: samsung.providerName,
      noticeDesc: samsung.noticeDesc,
      logoImage,
      'logoImage.darkUrl': logoImage,
      bgColor: samsung.bgColor,
      'barcode.value': String(samsung.barcode.value || refId).slice(0, 64),
      'barcode.serialType': 'QRCODE',
      'barcode.ptFormat': 'QRCODESERIAL',
      'barcode.ptSubFormat': 'QR_CODE'
    };
    if (samsung.cardSubTitle) attrs.amount = samsung.cardSubTitle.slice(0, 32);
    if (samsung.bannerImage) attrs.bannerImage = samsung.bannerImage;

    samsung.links.slice(0, 5).forEach((link, i) => {
      attrs[`link${i}.name`] = String(link.name || '').slice(0, 64);
      attrs[`link${i}.url`] = link.url;
    });

    return {
      card: {
        type: 'loyalty',
        subType: LOYALTY_SUBTYPE,
        data: [
          {
            refId,
            createdAt: now,
            updatedAt: now,
            state: cardState,
            language: 'it',
            attributes: attrs
          }
        ]
      }
    };
  }

  const fv = instance.field_values && typeof instance.field_values === 'object' ? instance.field_values : {};
  const points =
    fv.points != null
      ? String(fv.points)
      : fv.balance != null
        ? String(fv.balance)
        : '';
  const tier = fv.tier != null ? String(fv.tier) : '';

  const title = (brand.name || 'Loyalty').slice(0, 64);
  const providerName = (brand.name || 'Brand').slice(0, 32);
  const barcodeVal = String(instance.serial_number || refId).slice(0, 64);

  let logoImage = 'https://gpp.walletsvc.samsung.com/mcs/images/contents/wallet_intro_logo.png';
  if (api) {
    logoImage = `${api}/brands/${brand.id}/logo`;
  }

  const balanceStr = points ? `${points} pt` : '';
  const amountStr = tier ? `${tier}` : balanceStr;

  const attrs = {
    title,
    providerName,
    noticeDesc: `<p>${(template?.name || '').slice(0, 200)}</p>`,
    logoImage,
    'logoImage.darkUrl': logoImage,
    bgColor: rgbToHex(template?.style?.backgroundColor),
    'barcode.value': barcodeVal,
    'barcode.serialType': 'QRCODE',
    'barcode.ptFormat': 'QRCODESERIAL',
    'barcode.ptSubFormat': 'QR_CODE'
  };
  if (amountStr) attrs.amount = amountStr.slice(0, 32);
  if (balanceStr) attrs.balance = balanceStr.slice(0, 32);

  return {
    card: {
      type: 'loyalty',
      subType: LOYALTY_SUBTYPE,
      data: [
        {
          refId,
          createdAt: now,
          updatedAt: now,
          state: cardState,
          language: 'it',
          attributes: attrs
        }
      ]
    }
  };
}

function verifyInboundAuth(authHeader, method, pathForLog) {
  if (!authHeader || !/^Bearer\s+/i.test(authHeader)) return false;
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (SKIP_JWT_VERIFY) {
    console.warn('[SamsungWallet] SKIP_JWT_VERIFY active — non usare in produzione');
    return true;
  }
  const pem = getInboundJwtPublicPem();
  if (!pem) {
    console.error(
      '[SamsungWallet] Manca chiave/cert per verifica inbound: SAMSUNG_WALLET_JWT_PUBLIC_KEY_PEM, SAMSUNG_SIGNED_CERT (file o PEM), oppure SKIP_JWT_VERIFY=1 in test'
    );
    return false;
  }
  try {
    jwt.verify(token, pem, { algorithms: ['RS256'] });
    return true;
  } catch (e) {
    console.error('[SamsungWallet] JWT verify failed:', method, pathForLog, e.message);
    return false;
  }
}

function buildTsapiBaseUrl(cc2) {
  const code = String(cc2 || process.env.SAMSUNG_WALLET_DEFAULT_CC2 || 'US')
    .trim()
    .toLowerCase();
  return TSAPI_HOST_TEMPLATE.replace(/\{cc2\}/g, code);
}

function getUpdateApiPath() {
  const cardId = getSamsungCardId();
  const pathTpl =
    process.env.SAMSUNG_WALLET_UPDATE_PATH_TEMPLATE || '/wltex/cards/{cardId}/updates';
  return pathTpl.replace(/\{cardId\}/g, cardId);
}

function signAuthJwtForUpdate(refId) {
  const privateKeyPem = getOutboundPrivateKeyPem();
  if (!privateKeyPem) return null;

  const utc = Date.now();
  const certId = getCertificateId();
  const partnerId = getPartnerId();
  const apiPath = getUpdateApiPath();

  const payload = {
    API: {
      method: 'POST',
      path: apiPath
    },
    refId,
    updatedAt: utc
  };

  return jwt.sign(payload, privateKeyPem, {
    algorithm: 'RS256',
    header: {
      typ: 'JWT',
      alg: 'RS256',
      cty: 'AUTH',
      ver: 3,
      certificateId: certId,
      partnerId,
      utc,
      kid: JWT_KID
    }
  });
}

/**
 * Notifica Samsung (Update Notification) — Bearer = access token oppure JWT AUTH firmato.
 */
async function requestCardDataUpdate(refId, options = {}) {
  if (!isConfigured()) return { ok: false, skipped: true, reason: 'not_configured' };

  const cc2 = String(options.cc2 || process.env.SAMSUNG_WALLET_DEFAULT_CC2 || 'US').trim();
  if (cc2.length !== 2) {
    return { ok: false, skipped: true, reason: 'invalid_cc2', detail: cc2 };
  }

  const staticToken = resolveEnv('SAMSUNG_WALLET_ACCESS_TOKEN', ['SAMSUNG_ACCESS_TOKEN']);
  let bearer = staticToken || null;
  if (!bearer) {
    bearer = signAuthJwtForUpdate(refId);
  }
  if (!bearer) {
    return {
      ok: false,
      skipped: true,
      reason: 'no_outbound_auth',
      detail: 'Imposta SAMSUNG_WALLET_ACCESS_TOKEN o SAMSUNG_PRIVATE_KEY (path al .key)'
    };
  }

  const baseUrl = buildTsapiBaseUrl(cc2);
  const apiPath = getUpdateApiPath();
  const urlPath = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
  const url = `${baseUrl}${urlPath}`;
  const partnerId = getPartnerId();
  const reqId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');

  const body = {
    card: {
      type: 'loyalty',
      subType: LOYALTY_SUBTYPE,
      data: [{ refId, state: 'UPDATED' }]
    }
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bearer}`,
        'x-smcs-partner-id': partnerId,
        'x-request-id': reqId
      },
      body: JSON.stringify(body)
    });

    const ok = res.status === 200 || res.status === 204;
    if (!ok) {
      const text = await res.text().catch(() => '');
      console.error(
        '[SamsungWallet] Update Notification failed',
        res.status,
        url,
        text.slice(0, 400)
      );
    } else {
      console.log('[SamsungWallet] Update Notification OK', refId.slice(0, 8), cc2);
    }
    return { ok, status: res.status, skipped: false };
  } catch (e) {
    console.error('[SamsungWallet] Update Notification error:', e.message);
    return { ok: false, skipped: false, reason: 'fetch_error', detail: e.message };
  }
}

async function notifySavedPassesUpdates(passes) {
  if (!isConfigured()) return { attempted: 0, notified: 0, skipped: true };
  if (!Array.isArray(passes) || passes.length === 0) return { attempted: 0, notified: 0, skipped: false };

  let attempted = 0;
  let notified = 0;
  for (const p of passes) {
    if (!p.samsung_wallet_ref_id || !p.samsung_wallet_saved) continue;
    attempted++;
    const cc2 = p.samsung_wallet_cc2 || process.env.SAMSUNG_WALLET_DEFAULT_CC2 || 'US';
    const r = await requestCardDataUpdate(p.samsung_wallet_ref_id, { cc2 });
    if (r && r.ok) notified++;
  }
  return { attempted, notified, skipped: false };
}

module.exports = {
  isConfigured,
  getStatusInfo,
  refIdForPass,
  generateDataFetchLink,
  buildLoyaltyCardResponse,
  verifyInboundAuth,
  requestCardDataUpdate,
  notifySavedPassesUpdates,
  get CARD_ID() {
    return getSamsungCardId();
  }
};
