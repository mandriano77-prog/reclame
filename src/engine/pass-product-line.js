'use strict';

const { isHrEmployeePass } = require('./employee-pass');

function getBrandProductLine(brand) {
  const line = String(brand?.config?.product_line || '').trim().toLowerCase();
  if (line) return line;
  const deploy = String(process.env.DASHBOARD_PRODUCT_LINE || '').trim().toLowerCase();
  return deploy || 'ads';
}

/** Employee HR pass layout + portal/hub back sections. */
function isHrPassBrand(brand) {
  return isHrEmployeePass(brand);
}

/** Passwordless holder portal — HR only (not Reclame / Ads media passes). */
function isPortalPassBrand(brand) {
  return getBrandProductLine(brand) === 'hr';
}

function isAdsPassBrand(brand) {
  return getBrandProductLine(brand) === 'ads';
}

function isPersonalAreaBackLink(label, url) {
  const blob = `${label || ''} ${url || ''}`.toLowerCase();
  return /\barea\s*personale\b|\bil mio profilo\b|\bprofilo personale\b|\/portal\b/.test(blob);
}

function brandHasWalletLogoAsset(brand, template) {
  if (template?.style?.images?.logo) return true;
  const cfg = brand?.config || {};
  if (cfg.logos?.logo) return true;
  const assets = cfg.brand_identity_assets || {};
  return !!(assets.logo || assets.logo_media_id);
}

module.exports = {
  getBrandProductLine,
  isHrPassBrand,
  isPortalPassBrand,
  isAdsPassBrand,
  isPersonalAreaBackLink,
  brandHasWalletLogoAsset
};
