/**
 * Resolve wallet logo/icon sources from Brand Identity media + legacy config.logos.
 */
const sharp = require('sharp');
const { getMedia, listTemplates, updateBrand, updateTemplate, touchPassesForTemplate } = require('../db');

async function resolveBrandLogoRawBuffer(brand) {
  const cfg = brand?.config || {};
  const mediaId = cfg.brand_identity_assets?.logo;
  if (mediaId) {
    const media = await getMedia(mediaId);
    if (media?.image_base64) {
      return {
        buffer: Buffer.from(media.image_base64, 'base64'),
        source: 'brand_identity_media'
      };
    }
  }
  if (cfg.logos?.['logo@2x'] || cfg.logos?.logo) {
    const b64 = cfg.logos['logo@2x'] || cfg.logos.logo;
    return {
      buffer: Buffer.from(b64, 'base64'),
      source: 'config_logos'
    };
  }
  return null;
}

async function applyBrandLogoBase64(brandId, logoBase64, { brand, syncTemplates = false } = {}) {
  const imgBuffer = Buffer.from(logoBase64, 'base64');
  const logo1x = await sharp(imgBuffer).resize(160, 50, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const logo2x = await sharp(imgBuffer).resize(320, 100, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const icon1x = await sharp(imgBuffer).resize(29, 29, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const icon2x = await sharp(imgBuffer).resize(58, 58, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const icon3x = await sharp(imgBuffer).resize(87, 87, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();

  const config = { ...(brand?.config || {}) };
  config.logos = {
    ...(config.logos || {}),
    logo: logo1x.toString('base64'),
    'logo@2x': logo2x.toString('base64'),
    icon: icon1x.toString('base64'),
    'icon@2x': icon2x.toString('base64'),
    'icon@3x': icon3x.toString('base64')
  };
  await updateBrand(brandId, { config });

  if (syncTemplates) {
    const templates = await listTemplates(brandId);
    for (const tpl of templates) {
      const prevStyle = tpl.style && typeof tpl.style === 'object' ? tpl.style : {};
      const prevImages = prevStyle.images && typeof prevStyle.images === 'object' ? prevStyle.images : {};
      await updateTemplate(tpl.id, {
        style: { ...prevStyle, images: { ...prevImages, logo: logoBase64 } }
      });
      await touchPassesForTemplate(tpl.id);
    }
  }

  return config;
}

async function syncWalletLogoFromBrandIdentity(brandId, brand, { syncTemplates = false } = {}) {
  const mediaId = brand?.config?.brand_identity_assets?.logo;
  if (!mediaId) return false;
  const media = await getMedia(mediaId);
  if (!media?.image_base64) return false;
  await applyBrandLogoBase64(brandId, media.image_base64, { brand, syncTemplates });
  return true;
}

async function inspectPkpassIcon(pkpassBuffer) {
  const AdmZip = require('adm-zip');
  const crypto = require('crypto');
  const zip = new AdmZip(pkpassBuffer);
  const entry = zip.getEntry('icon.png') || zip.getEntry('icon@2x.png');
  if (!entry) return null;
  const buffer = entry.getData();
  return {
    file: entry.entryName,
    bytes: buffer.length,
    sha256_prefix: crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16)
  };
}

module.exports = {
  resolveBrandLogoRawBuffer,
  applyBrandLogoBase64,
  syncWalletLogoFromBrandIdentity,
  inspectPkpassIcon
};
