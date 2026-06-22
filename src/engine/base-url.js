function normalizeHost(raw) {
  let value = String(raw || '').trim();
  if (!value) return null;
  value = value.replace(/^https?:\/\//i, '');
  value = value.replace(/^\/+/, '').replace(/\/+$/, '');
  const slash = value.indexOf('/');
  if (slash >= 0) value = value.slice(0, slash);
  return value || null;
}

function isHrProductLine() {
  return String(process.env.DASHBOARD_PRODUCT_LINE || '').trim().toLowerCase() === 'hr';
}

function getProductBrandName() {
  const explicit = String(process.env.PRODUCT_BRAND_NAME || process.env.DASHBOARD_PRODUCT_TITLE || '').trim();
  if (explicit) return explicit;
  return isHrProductLine() ? 'FiloDiretto' : 'Ads2Wallet';
}

function resolveBaseUrlFromEnv(options = {}) {
  const localhostPort = options.localhostPort || process.env.PORT || 3000;

  const publicBase = String(process.env.PUBLIC_BASE_URL || '').trim();
  if (publicBase) {
    if (/^https?:\/\//i.test(publicBase)) return publicBase.replace(/\/+$/, '');
    const host = normalizeHost(publicBase);
    if (host) return `https://${host}`;
  }

  const baseUrl = String(process.env.BASE_URL || '').trim();
  if (baseUrl) {
    if (/^https?:\/\//i.test(baseUrl)) return baseUrl.replace(/\/+$/, '');
    const host = normalizeHost(baseUrl);
    if (host) return `https://${host}`;
  }

  const customDomain = normalizeHost(process.env.CUSTOM_DOMAIN);
  if (customDomain) return `https://${customDomain}`;

  const appUrl = String(process.env.APP_URL || '').trim();
  if (appUrl) {
    if (/^https?:\/\//i.test(appUrl)) return appUrl.replace(/\/+$/, '');
    const host = normalizeHost(appUrl);
    if (host) return `https://${host}`;
  }

  const railwayDomain = normalizeHost(process.env.RAILWAY_PUBLIC_DOMAIN);
  if (railwayDomain) return `https://${railwayDomain}`;

  return `http://localhost:${localhostPort}`;
}

function buildPublicLandingUrl(slug, options = {}) {
  const safeSlug = String(slug || '').trim().replace(/^\/+|\/+$/g, '');
  if (!safeSlug) return '';
  const base = resolveBaseUrlFromEnv(options).replace(/\/+$/, '');
  const path = options.path ? String(options.path).replace(/^\/+/, '') : safeSlug;
  return `${base}/${path}`;
}

function buildPublicPathUrl(path, options = {}) {
  const clean = String(path || '').trim().replace(/^\/+/, '');
  if (!clean) return resolveBaseUrlFromEnv(options).replace(/\/+$/, '');
  const base = resolveBaseUrlFromEnv(options).replace(/\/+$/, '');
  return `${base}/${clean}`;
}

function resolveBaseUrl(req, options = {}) {
  const fromEnv = resolveBaseUrlFromEnv(options);
  if (fromEnv) return fromEnv;
  if (req && typeof req.get === 'function') {
    const host = req.get('host');
    if (host) return `${req.protocol}://${host}`;
  }
  return null;
}

module.exports = {
  normalizeHost,
  isHrProductLine,
  getProductBrandName,
  resolveBaseUrlFromEnv,
  buildPublicLandingUrl,
  buildPublicPathUrl,
  resolveBaseUrl
};
