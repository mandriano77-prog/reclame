/**
 * Strip Promo Scheduler
 *
 * Runs every hour. For each active strip promo whose date range is current:
 * 1. Swaps the brand's strip image with the promo strip
 * 2. Regenerates all active passes with the new strip
 * 3. Sends push notification if configured (daily or hourly)
 *
 * When a promo expires:
 * 1. Restores the brand's default strip (stored in config.logos.strip_default)
 * 2. Regenerates passes with default strip
 */

const {
  getActiveStripPromos,
  updateStripPromo,
  getBrand,
  updateBrand,
  listPasses,
  getTemplate,
  touchPass,
  getDevicesForBrand,
  logPush,
  logEvent,
  listStripPromos
} = require('../db');
const { createPkpass } = require('./passkit');
const { sendPushUpdate } = require('./apns');
const googleWallet = require('./google-wallet');
const path = require('path');
const fs = require('fs');

const CACHE_DIR = path.join(__dirname, '..', '..', 'cache');

/**
 * Check and apply active strip promos.
 * Called every hour by server.js
 */
async function runStripPromoCheck() {
  try {
    const activePromos = await getActiveStripPromos();
    console.log(`[StripPromo] Checking... ${activePromos.length} active promo(s) found`);

    for (const promo of activePromos) {
      try {
        await applyStripPromo(promo);
      } catch (e) {
        console.error(`[StripPromo] Error applying promo "${promo.title}" for brand ${promo.brand_name}:`, e.message);
      }
    }

    // Check for expired promos that need strip restored
    await checkExpiredPromos();

  } catch (e) {
    console.error('[StripPromo] Fatal error:', e.message);
  }
}

/**
 * Apply a strip promo: update brand strip, regen passes, send push if due
 */
async function applyStripPromo(promo) {
  const brand = await getBrand(promo.brand_id);
  if (!brand) return;

  const config = brand.config || {};
  const logos = config.logos || {};

  // Save the default strip on first promo activation (so we can restore it later)
  if (!logos.strip_default && logos.strip) {
    const updConfig = { ...config, logos: { ...logos, strip_default: logos.strip } };
    await updateBrand(promo.brand_id, { config: updConfig });
  }

  // Check if strip is already the promo strip (avoid unnecessary regen)
  const currentStripHash = logos.strip ? logos.strip.substring(0, 50) : '';
  const promoStripHash = promo.strip_base64 ? promo.strip_base64.substring(0, 50) : '';

  if (currentStripHash !== promoStripHash) {
    // Swap strip
    const updConfig = {
      ...config,
      logos: { ...logos, strip: promo.strip_base64, strip_default: logos.strip_default || logos.strip }
    };
    await updateBrand(promo.brand_id, { config: updConfig });
    console.log(`[StripPromo] Applied strip for promo "${promo.title}" on brand ${promo.brand_name}`);

    // Regenerate all active passes with new strip
    await regenerateBrandPasses(promo.brand_id);

    await logEvent({
      brand_id: promo.brand_id,
      event_type: 'strip_promo_applied',
      metadata: { promo_id: promo.id, title: promo.title }
    });
  }

  // Send push notification if configured and due
  if (promo.push_message && promo.push_frequency !== 'none') {
    const shouldPush = shouldSendPush(promo);
    if (shouldPush) {
      await sendPromoPush(promo);
      await updateStripPromo(promo.id, { last_push_sent: new Date().toISOString() });
    }
  }
}

/**
 * Determine if a push should be sent based on frequency
 */
function shouldSendPush(promo) {
  if (!promo.last_push_sent) return true; // Never sent

  const lastSent = new Date(promo.last_push_sent);
  const now = new Date();
  const hoursDiff = (now - lastSent) / (1000 * 60 * 60);

  switch (promo.push_frequency) {
    case 'hourly':
      return hoursDiff >= 1;
    case 'daily':
      return hoursDiff >= 24;
    case 'once':
      return false; // Already sent
    default:
      return false;
  }
}

/**
 * Send push notification for a promo to all brand devices
 */
async function sendPromoPush(promo) {
  try {
    const devices = await getDevicesForBrand(promo.brand_id);
    if (!devices || devices.length === 0) return;

    let sent = 0;
    for (const device of devices) {
      try {
        await sendPushUpdate(device.push_token);
        sent++;
      } catch (e) {
        // Silently skip failed pushes
      }
    }

    await logPush({
      brand_id: promo.brand_id,
      type: 'strip_promo',
      message: promo.push_message,
      sent_to: sent,
      total_devices: devices.length
    });

    console.log(`[StripPromo] Push sent for "${promo.title}": ${sent}/${devices.length} devices`);
  } catch (e) {
    console.error(`[StripPromo] Push error for "${promo.title}":`, e.message);
  }
}

/**
 * Check for expired promos and restore default strip
 */
async function checkExpiredPromos() {
  try {
    // Find promos that just expired (end_date passed, still marked active)
    const { pool } = require('../db');
    const expired = await pool.query(`
      SELECT sp.*, b.name as brand_name FROM strip_promos sp
      JOIN brands b ON sp.brand_id = b.id
      WHERE sp.active = true AND sp.end_date < NOW()
    `);

    for (const promo of expired.rows) {
      // Mark as inactive
      await updateStripPromo(promo.id, { active: false });

      // Check if there's another active promo for this brand
      const otherActive = await pool.query(
        `SELECT id FROM strip_promos WHERE brand_id = $1 AND active = true AND start_date <= NOW() AND end_date >= NOW()`,
        [promo.brand_id]
      );

      if (otherActive.rows.length === 0) {
        // No other active promo — restore default strip
        const brand = await getBrand(promo.brand_id);
        const config = brand.config || {};
        const logos = config.logos || {};

        if (logos.strip_default) {
          const updConfig = { ...config, logos: { ...logos, strip: logos.strip_default } };
          delete updConfig.logos.strip_default;
          await updateBrand(promo.brand_id, { config: updConfig });
          console.log(`[StripPromo] Restored default strip for brand ${promo.brand_name}`);

          // Regenerate passes with default strip
          await regenerateBrandPasses(promo.brand_id);
        }
      }

      await logEvent({
        brand_id: promo.brand_id,
        event_type: 'strip_promo_expired',
        metadata: { promo_id: promo.id, title: promo.title }
      });

      console.log(`[StripPromo] Promo "${promo.title}" expired for brand ${promo.brand_name}`);
    }
  } catch (e) {
    console.error('[StripPromo] Expired check error:', e.message);
  }
}

/**
 * Regenerate all active passes for a brand (after strip change)
 */
async function regenerateBrandPasses(brand_id) {
  try {
    const passes = await listPasses(brand_id);
    const activePasses = passes.filter(p => p.status === 'active');
    const brand = await getBrand(brand_id);

    if (!activePasses.length || !brand) return;

    const cacheDir = CACHE_DIR;
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

    let regenerated = 0;
    let googleSynced = 0;
    for (const pass of activePasses) {
      try {
        const template = await getTemplate(pass.template_id);
        if (!template) continue;
        await createPkpass(template, pass, brand);
        await touchPass(pass.id);
        if (googleWallet.isConfigured() && pass.google_wallet_object_id) {
          const passObject = googleWallet.buildPassObject(brand, template, pass, pass.customer_data || {});
          await googleWallet.createPassObjectOnServer(passObject);
          googleSynced++;
        }
        regenerated++;
      } catch (e) {
        // Skip failed passes silently
      }
    }

    console.log(`[StripPromo] Regenerated ${regenerated}/${activePasses.length} passes for brand ${brand.name} (google synced: ${googleSynced})`);

    // Send push to all devices so they update
    const devices = await getDevicesForBrand(brand_id);
    for (const device of devices) {
      try { await sendPushUpdate(device.push_token); } catch(e) {}
    }
  } catch (e) {
    console.error('[StripPromo] Pass regen error:', e.message);
  }
}

module.exports = {
  runStripPromoCheck,
  regenerateBrandPasses
};
