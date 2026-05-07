/**
 * Push Notification Scheduler
 * Runs every 60 seconds, checks for due scheduled_push entries,
 * sends them via the same push logic as manual sends, and updates next_run_at.
 */

const {
  getDueScheduledPush,
  updateScheduledPush,
  getBrand,
  updateBrand,
  listPasses,
  getTemplate,
  touchPass,
  getDevicesForBrand,
  logPush,
  logEvent
} = require('../db');
const { createPkpass } = require('./passkit');
const { sendPushUpdate } = require('./apns');
const googleWallet = require('./google-wallet');
const path = require('path');
const fs = require('fs');

const CACHE_DIR = path.join(__dirname, '..', '..', 'cache');

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  return CACHE_DIR;
}

/**
 * Calculate the next run time based on schedule type
 */
function calculateNextRun(schedule) {
  const [hours, minutes] = (schedule.schedule_time || '09:00').split(':').map(Number);
  const now = new Date();

  if (schedule.schedule_type === 'once') {
    // One-shot: deactivate after run
    return null;
  }

  if (schedule.schedule_type === 'daily') {
    // Next day at schedule_time
    const next = new Date();
    next.setDate(next.getDate() + 1);
    next.setHours(hours, minutes, 0, 0);
    return next;
  }

  if (schedule.schedule_type === 'weekly') {
    // Next occurrence of schedule_days (comma-separated day numbers, 0=Sun)
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

/**
 * Execute a single scheduled push notification
 */
async function executeScheduledPush(schedule, baseUrl) {
  const { brand_id, title, message, target, update_pass } = schedule;

  console.log(`⏰ Executing scheduled push: "${title}" for brand ${brand_id}`);

  const brand = await getBrand(brand_id);
  if (!brand) {
    console.error(`Brand ${brand_id} not found, skipping`);
    return;
  }

  let passesUpdated = 0;

  // If update_pass, update brand config and regenerate passes
  if (update_pass) {
    const updatedConfig = {
      ...(brand.config || {}),
      pushAnnouncement: {
        title,
        message,
        date: new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date().toISOString()
      }
    };
    await updateBrand(brand_id, { config: updatedConfig });

    const passes = await listPasses(brand_id);
    const updatedBrand = await getBrand(brand_id);
    const cacheDir = ensureCacheDir();

    for (const pass of passes) {
      try {
        const pkpassPath = path.join(cacheDir, `${pass.id}.pkpass`);
        if (fs.existsSync(pkpassPath)) fs.unlinkSync(pkpassPath);
        const template = await getTemplate(pass.template_id);
        if (template) {
          const pkpassBuffer = await createPkpass(template, pass, updatedBrand, { baseUrl });
          fs.writeFileSync(pkpassPath, pkpassBuffer);
          await touchPass(pass.id);
          passesUpdated++;
        }
      } catch (err) {
        console.error(`Error regenerating pass ${pass.id}:`, err.message);
      }
    }
  }

  // Keep Google Wallet objects in sync when pass content changes.
  if (update_pass && googleWallet.isConfigured()) {
    try {
      const passes = await listPasses(brand_id);
      const syncedBrand = await getBrand(brand_id);
      for (const pass of passes) {
        if (!pass.google_wallet_object_id) continue;
        try {
          const template = await getTemplate(pass.template_id);
          if (!template) continue;
          const passObject = googleWallet.buildPassObject(syncedBrand, template, pass, pass.customer_data || {});
          await googleWallet.createPassObjectOnServer(passObject);
          await googleWallet.updatePassMessage(pass.serial_number, message);
        } catch (e) {
          console.error(`[GoogleWallet] Scheduled sync failed for ${pass.serial_number}:`, e.message);
        }
      }
    } catch (e) {
      console.error('[GoogleWallet] Scheduled sync error:', e.message);
    }
  }

  // Send APNs push
  const devices = await getDevicesForBrand(brand_id);
  let sentCount = 0;
  for (const device of devices) {
    try {
      const result = await sendPushUpdate(device.push_token);
      if (result.success) sentCount++;
    } catch (err) {
      console.error(`Push failed for ${device.push_token.substring(0, 8)}:`, err.message);
    }
  }

  // Log
  await logPush({ brand_id, title, message, target: target || 'all', sent_count: sentCount });
  await logEvent({
    brand_id,
    event_type: 'scheduled_push_sent',
    metadata: { title, sent_count: sentCount, passes_updated: passesUpdated, schedule_id: schedule.id }
  });

  console.log(`✓ Scheduled push sent: ${sentCount}/${devices.length} devices, ${passesUpdated} passes updated`);
}

/**
 * Main scheduler tick — called every 60 seconds
 */
async function schedulerTick(baseUrl) {
  try {
    const due = await getDueScheduledPush();
    if (due.length === 0) return;

    console.log(`⏰ Scheduler: ${due.length} notification(s) due`);

    for (const schedule of due) {
      try {
        await executeScheduledPush(schedule, baseUrl);

        // Calculate next run
        const nextRun = calculateNextRun(schedule);
        if (nextRun) {
          await updateScheduledPush(schedule.id, { next_run_at: nextRun, last_run_at: new Date() });
        } else {
          // One-shot: deactivate
          await updateScheduledPush(schedule.id, { active: false, last_run_at: new Date() });
        }
      } catch (err) {
        console.error(`Error executing schedule ${schedule.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Scheduler tick error:', err.message);
  }
}

/**
 * Start the scheduler (call once at server boot)
 */
let schedulerInterval = null;

function startScheduler(baseUrl) {
  if (schedulerInterval) return;
  console.log('⏰ Push scheduler started (checking every 60s)');
  // Run immediately once, then every 60s
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

module.exports = { startScheduler, stopScheduler, schedulerTick, calculateNextRun };
