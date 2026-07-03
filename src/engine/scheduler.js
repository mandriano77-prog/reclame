/**
 * Push Notification Scheduler
 * Runs every 60 seconds, checks for due scheduled_push entries,
 * sends them via the same push logic as manual sends, and updates next_run_at.
 */

const {
  getDueScheduledPush,
  claimScheduledPushForRun,
  getBrand,
  updateBrand,
  touchPassesByIds,
  unregisterDevice,
  logPush,
  logEvent,
  updatePassDynamicLinks,
  markPassesPushDelivered,
  markPassPushStatus,
} = require('../db');
const { sendPushBatch, shouldPruneApnsRegistration, closeApnsSession } = require('./apns');
const { getTargetPassesForPush, getAppleDevicesForAudience } = require('./audiences');
const { syncGoogleWalletObjectsForPasses } = require('./google-wallet-sync');
const googleWallet = require('./google-wallet');
const samsungWallet = require('./samsung-wallet');

/**
 * First `next_run_at` when saving a scheduled push from the dashboard.
 * Uses Europe/Rome (TZ set at process start in server.js).
 * PostgreSQL stores TIMESTAMPTZ as absolute instants; NOW() compares correctly.
 */
function computeInitialScheduledRun(input) {
  const schedule_time = input.schedule_time || '09:00';
  const [hours, minutesRaw] = String(schedule_time).split(':').map((x) => parseInt(String(x).trim(), 10));
  const minutes = Number.isFinite(minutesRaw) ? minutesRaw : 0;
  const h = Number.isFinite(hours) ? hours : 9;
  const now = Date.now();

  const schedule_type = input.schedule_type || 'once';

  if (schedule_type === 'once') {
    const dateStr = input.date;
    if (!dateStr || String(dateStr).length < 8) return null;
    const parts = String(dateStr).split('-').map((x) => parseInt(String(x).trim(), 10));
    if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return null;
    const [y, m, d] = parts;
    return new Date(y, m - 1, d, h, minutes, 0, 0);
  }

  if (schedule_type === 'daily') {
    const cand = new Date();
    cand.setHours(h, minutes, 0, 0);
    if (cand.getTime() <= now) {
      cand.setDate(cand.getDate() + 1);
      cand.setHours(h, minutes, 0, 0);
    }
    return cand;
  }

  if (schedule_type === 'weekly') {
    let daysStr = input.schedule_days;
    if ((!daysStr || String(daysStr).trim() === '') && Array.isArray(input.days)) {
      daysStr = input.days.map((x) => String(x)).filter(Boolean).join(',');
    }
    const dowList = String(daysStr || '1')
      .split(',')
      .map((x) => parseInt(String(x).trim(), 10))
      .filter((n) => Number.isFinite(n) && n >= 0 && n <= 6);
    if (!dowList.length) return null;

    for (let add = 0; add <= 21; add++) {
      const candidate = new Date();
      candidate.setDate(candidate.getDate() + add);
      candidate.setHours(h, minutes, 0, 0);
      if (!dowList.includes(candidate.getDay())) continue;
      if (candidate.getTime() > now) return candidate;
    }
  }

  return null;
}

function calculateNextRun(schedule) {
  const [hours, minutes] = (schedule.schedule_time || '09:00').split(':').map(Number);
  const now = new Date();

  if (schedule.schedule_type === 'once') {
    return null;
  }

  if (schedule.schedule_type === 'daily') {
    const next = new Date();
    next.setDate(next.getDate() + 1);
    next.setHours(hours, minutes, 0, 0);
    return next;
  }

  if (schedule.schedule_type === 'weekly') {
    const days = (schedule.schedule_days || '1').split(',').map(Number);
    const today = now.getDay();
    let minDaysAhead = 8;
    for (const d of days) {
      let diff = d - today;
      if (diff <= 0) diff += 7;
      if (diff < minDaysAhead) minDaysAhead = diff;
    }
    const next = new Date();
    next.setDate(next.getDate() + minDaysAhead);
    next.setHours(hours, minutes, 0, 0);
    return next;
  }

  return null;
}

async function applyScheduledApplePushResults(devices, batchResults) {
  const deliveredSerials = [];
  let sentCount = 0;

  for (let i = 0; i < devices.length; i++) {
    const device = devices[i];
    const result = batchResults[i] || { success: false, reason: 'missing_result' };
    if (result.success) {
      sentCount++;
      if (device.serial_number) deliveredSerials.push(device.serial_number);
    } else if (shouldPruneApnsRegistration(result) && device.device_library_id && device.serial_number) {
      try {
        await unregisterDevice(device.device_library_id, device.serial_number);
      } catch (cleanupErr) {
        console.warn('[scheduler] failed cleanup invalid registration:', cleanupErr.message);
      }
      if (device.serial_number) await markPassPushStatus(device.serial_number, result.reason || 'failed');
    } else if (device.serial_number) {
      await markPassPushStatus(device.serial_number, result.reason || 'failed');
    }
  }

  if (deliveredSerials.length) {
    await markPassesPushDelivered(deliveredSerials);
  }

  return sentCount;
}

async function executeScheduledPush(schedule, baseUrl) {
  const {
    brand_id, title, message, target, update_pass, channel = 'apple', campaign_id, audience_id,
    include_pass_link, pass_link_url, pass_link_label, pass_link_expires_at,
  } = schedule;
  const pushTargetOpts = { campaign_id, audience_id };
  const legacyBoth = channel === 'both';
  const sendApple = channel === 'apple' || legacyBoth || channel === 'all';
  const sendGoogle = channel === 'google' || legacyBoth || channel === 'all';
  const sendSamsung = channel === 'samsung' || channel === 'all';

  console.log(`⏰ Executing scheduled push: "${title}" for brand ${brand_id}`);

  const brand = await getBrand(brand_id);
  if (!brand) {
    console.error(`Brand ${brand_id} not found, skipping`);
    return;
  }

  let passesUpdated = 0;
  const targetPasses = await getTargetPassesForPush(brand_id, pushTargetOpts);

  if (update_pass) {
    const { syncWalletLogoFromBrandIdentity, syncWalletIconFromBrandIdentity } = require('./brand-wallet-logo');
    const hrDeploy = String(process.env.DASHBOARD_PRODUCT_LINE || '').toLowerCase() === 'hr';
    try {
      await syncWalletLogoFromBrandIdentity(brand_id, brand, {
        syncTemplates: hrDeploy || brand?.config?.product_line === 'hr',
      });
      await syncWalletIconFromBrandIdentity(brand_id, brand, { touchPasses: false });
    } catch (syncErr) {
      console.warn('[Scheduler] wallet logo sync skipped:', syncErr.message);
    }

    const updatedConfig = {
      ...(brand.config || {}),
      pushAnnouncement: {
        title,
        message,
        date: new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date().toISOString(),
      },
    };
    await updateBrand(brand_id, { config: updatedConfig });

    if (include_pass_link && pass_link_url) {
      const defaultExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await updatePassDynamicLinks(targetPasses.map((p) => p.id), {
        label: pass_link_label || title.slice(0, 40),
        url: pass_link_url,
        expiresAt: pass_link_expires_at || defaultExpiry,
      });
    }

    const touched = await touchPassesByIds(targetPasses.map((p) => p.id));
    passesUpdated = touched.touched || 0;
  }

  if (update_pass && sendGoogle && googleWallet.isConfigured()) {
    try {
      const syncedBrand = await getBrand(brand_id);
      const googleSync = await syncGoogleWalletObjectsForPasses({
        brand: syncedBrand,
        passes: targetPasses,
        message,
      });
      console.log('[GoogleWallet] Scheduled sync', googleSync);
    } catch (e) {
      console.error('[GoogleWallet] Scheduled sync error:', e.message);
    }
  }

  let samsungNotify = { attempted: 0, notified: 0, skipped: !sendSamsung || !samsungWallet.isConfigured() };
  if (update_pass && sendSamsung && samsungWallet.isConfigured()) {
    try {
      samsungNotify = await samsungWallet.notifySavedPassesUpdates(targetPasses);
      console.log('[SamsungWallet] Scheduled notify', samsungNotify);
    } catch (e) {
      console.error('[SamsungWallet] Scheduled notify error:', e.message);
    }
  }

  let devices = [];
  let sentCount = 0;
  if (sendApple) {
    devices = await getAppleDevicesForAudience(brand_id, pushTargetOpts);
    if (devices.length) {
      const batchResults = await sendPushBatch(devices.map((d) => d.push_token));
      sentCount = await applyScheduledApplePushResults(devices, batchResults);
    }
    closeApnsSession();
  }

  await logPush({ brand_id, title, message, target: target || 'all', sent_count: sentCount, channel });
  await logEvent({
    brand_id,
    event_type: 'scheduled_push_sent',
    metadata: {
      title,
      channel,
      sent_count: sentCount,
      samsung_notify: samsungNotify,
      passes_updated: passesUpdated,
      schedule_id: schedule.id,
    },
  });

  console.log(`✓ Scheduled push sent: ${sentCount}/${devices.length} devices, ${passesUpdated} passes touched`);
}

let tickInFlight = false;

async function schedulerTick(baseUrl) {
  // Skip if a previous tick is still running: a slow tick (many APNs sends) could otherwise
  // overlap the next 60s interval and process the same schedules twice.
  if (tickInFlight) {
    console.log('⏰ Scheduler: previous tick still running, skipping this interval');
    return;
  }
  tickInFlight = true;
  try {
    const due = await getDueScheduledPush();
    if (due.length === 0) return;

    console.log(`⏰ Scheduler: ${due.length} notification(s) due`);

    for (const schedule of due) {
      try {
        // Claim atomically BEFORE sending: advance next_run_at (or deactivate one-shots) with a
        // conditional UPDATE. If another overlapping tick or app instance already claimed it, skip.
        const nextRun = calculateNextRun(schedule);
        const claimed = await claimScheduledPushForRun(
          schedule.id,
          nextRun ? { next_run_at: nextRun } : { active: false }
        );
        if (!claimed) continue;

        await executeScheduledPush(schedule, baseUrl);
      } catch (err) {
        console.error(`Error executing schedule ${schedule.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Scheduler tick error:', err.message);
  } finally {
    tickInFlight = false;
  }
}

let schedulerInterval = null;

function startScheduler(baseUrl) {
  if (schedulerInterval) return;
  console.log('⏰ Push scheduler started (checking every 60s)');
  schedulerTick(baseUrl);
  schedulerInterval = setInterval(() => schedulerTick(baseUrl), 60 * 1000);
}

function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('⏰ Push scheduler stopped');
  }
}

module.exports = { startScheduler, stopScheduler, schedulerTick, calculateNextRun, computeInitialScheduledRun };
