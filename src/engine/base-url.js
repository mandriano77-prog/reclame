function normalizeHost(raw) {
  let value = String(raw || '').trim();
  if (!value) return null;
  value = value.replace(/^https?:\/\//i, '');
  value = value.replace(/^\/+/, '').replace(/\/+$/, '');
  const slash = value.indexOf('/');
  if (slash >= 0) value = value.slice(0, slash);
  return value || null;
}

function resolveBaseUrlFromEnv(options = {}) {
  const localhostPort = options.localhostPort || process.env.PORT || 3000;

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
  resolveBaseUrlFromEnv,
  resolveBaseUrl
};
