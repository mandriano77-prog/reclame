/**
 * Resolve wallet logo/icon sources from Brand Identity media + legacy config.logos.
 */
const sharp = require('sharp');
const { getMedia, getBrand, listTemplates, updateBrand, updateTemplate, touchPassesForTemplate, listPasses, touchPass } = require('../db');

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

const INVITE_EMAIL_LOGO_CID = 'brand-invite-logo';

/** PNG inline attachment for dashboard invite emails (Resend CID). */
async function buildInviteEmailLogoAttachment(rawBuffer) {
  if (!rawBuffer?.length) return null;
  try {
    const png = await sharp(rawBuffer)
      .png()
      .resize(120, 120, { fit: 'inside', withoutEnlargement: true })
      .toBuffer();
    return {
      cid: INVITE_EMAIL_LOGO_CID,
      filename: 'brand-logo.png',
      content_type: 'image/png',
      content: png.toString('base64'),
    };
  } catch (err) {
    console.warn('[invite-email] logo normalize failed:', err.message);
    return null;
  }
}

/** Square icon for push notifications — dedicated asset, not the wide pass logo. */
async function resolveNotificationIconRawBuffer(brand) {
  const mediaId = brand?.config?.brand_identity_assets?.wallet_icon;
  if (mediaId) {
    const media = await getMedia(mediaId);
    if (media?.image_base64) {
      return {
        buffer: Buffer.from(media.image_base64, 'base64'),
        source: 'brand_identity_wallet_icon'
      };
    }
  }
  return null;
}

function readIconPackFromConfig(logos) {
  if (!logos?.icon) return null;
  return {
    icon: Buffer.from(logos.icon, 'base64'),
    icon2x: Buffer.from(logos['icon@2x'] || logos.icon, 'base64'),
    icon3x: Buffer.from(logos['icon@3x'] || logos['icon@2x'] || logos.icon, 'base64')
  };
}

/**
 * Resolve notification icon buffers for .pkpass (icon.png).
 * Prefers dedicated wallet_icon media, then synced config.logos, then wide logo crop.
 */
async function resolvePassIconBuffers(brand, resolvedLogo) {
  const cfg = brand?.config || {};
  const fromMedia = await resolveNotificationIconRawBuffer(brand);
  if (fromMedia) {
    return {
      iconBuffers: await buildNotificationIconFromRaw(fromMedia.buffer),
      source: fromMedia.source
    };
  }
  if (cfg.brand_identity_assets?.wallet_icon) {
    const synced = readIconPackFromConfig(cfg.logos);
    if (synced) {
      return { iconBuffers: synced, source: 'config_logos_synced' };
    }
  }
  if (resolvedLogo?.buffer) {
    return {
      iconBuffers: await buildNotificationIconFromRaw(resolvedLogo.buffer),
      source: 'logo_derived'
    };
  }
  return { iconBuffers: null, source: null };
}

/** Canonical wide logo for pass logo.png (Brand Identity → template → config). */
async function resolveWalletLogoRawBuffer(brand, template) {
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
  const tplLogo = template?.style?.images?.logo;
  if (tplLogo) {
    return {
      buffer: Buffer.from(tplLogo, 'base64'),
      source: 'template_logo'
    };
  }
  return resolveBrandLogoRawBuffer(brand);
}

/**
 * Build icon.png sizes for Apple Wallet push.
 * Wide wordmarks are center-cropped; near-square sources are only resized.
 */
async function buildNotificationIconFromRaw(rawBuffer) {
  const meta = await sharp(rawBuffer).metadata();
  const w = meta.width || 100;
  const h = meta.height || 100;
  const ratio = w / Math.max(h, 1);
  let source = rawBuffer;
  if (ratio > 1.2 || ratio < 0.83) {
    const size = Math.max(1, Math.min(w, h));
    const left = Math.max(0, Math.floor((w - size) / 2));
    const top = Math.max(0, Math.floor((h - size) / 2));
    source = await sharp(rawBuffer)
      .extract({ left, top, width: size, height: size })
      .png()
      .toBuffer();
  }
  const [icon, icon2x, icon3x] = await Promise.all([
    sharp(source).resize(29, 29, { fit: 'cover', position: 'centre' }).png().toBuffer(),
    sharp(source).resize(58, 58, { fit: 'cover', position: 'centre' }).png().toBuffer(),
    sharp(source).resize(87, 87, { fit: 'cover', position: 'centre' }).png().toBuffer()
  ]);
  return { icon, icon2x, icon3x };
}

async function buildPassLogoBuffersFromRaw(rawLogoBuffer) {
  const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
  const [logo, logo2x] = await Promise.all([
    sharp(rawLogoBuffer).resize(160, 50, { fit: 'contain', position: 'left', background: transparent }).png().toBuffer(),
    sharp(rawLogoBuffer).resize(320, 100, { fit: 'contain', position: 'left', background: transparent }).png().toBuffer()
  ]);
  return { logo, logo2x };
}

async function buildWalletLogoAndIconFromRaw(rawLogoBuffer, brand) {
  const logoBuffers = await buildPassLogoBuffersFromRaw(rawLogoBuffer);
  const dedicated = brand ? await resolveNotificationIconRawBuffer(brand) : null;
  const iconSource = dedicated?.buffer || rawLogoBuffer;
  const iconBuffers = await buildNotificationIconFromRaw(iconSource);
  return { logoBuffers, iconBuffers };
}

async function applyWalletIconBase64(brandId, iconBase64, { brand, touchPasses = true } = {}) {
  const imgBuffer = Buffer.from(iconBase64, 'base64');
  const iconPack = await buildNotificationIconFromRaw(imgBuffer);
  const config = { ...(brand?.config || {}) };
  config.logos = {
    ...(config.logos || {}),
    icon: iconPack.icon.toString('base64'),
    'icon@2x': iconPack.icon2x.toString('base64'),
    'icon@3x': iconPack.icon3x.toString('base64')
  };
  config.wallet_icon_rev = (Number(config.wallet_icon_rev) || 0) + 1;
  config.wallet_icon_synced_at = new Date().toISOString();
  await updateBrand(brandId, { config });
  if (touchPasses) {
    const passes = await listPasses(brandId);
    for (const p of passes) await touchPass(p.id);
  }
  return config;
}

async function applyBrandLogoBase64(brandId, logoBase64, { brand, syncTemplates = false } = {}) {
  const imgBuffer = Buffer.from(logoBase64, 'base64');
  const logoBuffers = await buildPassLogoBuffersFromRaw(imgBuffer);
  const cfg = brand?.config || {};
  const hasDedicatedIconAsset = !!cfg.brand_identity_assets?.wallet_icon;
  const dedicated = await resolveNotificationIconRawBuffer(brand);
  let iconPack;
  if (dedicated) {
    iconPack = await buildNotificationIconFromRaw(dedicated.buffer);
  } else if (hasDedicatedIconAsset) {
    iconPack = readIconPackFromConfig(cfg.logos) || await buildNotificationIconFromRaw(imgBuffer);
  } else {
    iconPack = await buildNotificationIconFromRaw(imgBuffer);
  }

  const config = { ...(brand?.config || {}) };
  config.logos = {
    ...(config.logos || {}),
    logo: logoBuffers.logo.toString('base64'),
    'logo@2x': logoBuffers.logo2x.toString('base64'),
    icon: iconPack.icon.toString('base64'),
    'icon@2x': iconPack.icon2x.toString('base64'),
    'icon@3x': iconPack.icon3x.toString('base64')
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

async function syncWalletIconFromBrandIdentity(brandId, brand, { touchPasses = true, mediaId: mediaIdOverride } = {}) {
  const mediaId = mediaIdOverride || brand?.config?.brand_identity_assets?.wallet_icon;
  if (!mediaId) return false;
  const media = await getMedia(mediaId);
  if (!media?.image_base64) return false;
  const refreshedBrand = await getBrand(brandId);
  const config = { ...(refreshedBrand?.config || brand?.config || {}) };
  config.brand_identity_assets = {
    ...(config.brand_identity_assets || {}),
    wallet_icon: mediaId
  };
  await updateBrand(brandId, { config });
  const latest = await getBrand(brandId);
  await applyWalletIconBase64(brandId, media.image_base64, { brand: latest, touchPasses });
  return true;
}

async function assignWalletIconMedia(brandId, mediaId, { touchPasses = true } = {}) {
  const media = await getMedia(mediaId);
  if (!media?.image_base64) return false;
  const brand = await getBrand(brandId);
  if (!brand || String(media.brand_id) !== String(brandId)) return false;
  const config = { ...(brand.config || {}) };
  config.brand_identity_assets = {
    ...(config.brand_identity_assets || {}),
    wallet_icon: mediaId
  };
  await updateBrand(brandId, { config });
  const latest = await getBrand(brandId);
  await applyWalletIconBase64(brandId, media.image_base64, { brand: latest, touchPasses });
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
  buildInviteEmailLogoAttachment,
  INVITE_EMAIL_LOGO_CID,
  resolveNotificationIconRawBuffer,
  resolveWalletLogoRawBuffer,
  resolvePassIconBuffers,
  readIconPackFromConfig,
  buildNotificationIconFromRaw,
  buildPassLogoBuffersFromRaw,
  buildWalletLogoAndIconFromRaw,
  applyBrandLogoBase64,
  applyWalletIconBase64,
  syncWalletLogoFromBrandIdentity,
  syncWalletIconFromBrandIdentity,
  assignWalletIconMedia,
  inspectPkpassIcon
};
