/**
 * Reclame — post-booking automation: geofence sync, push/CPA activation.
 */
'use strict';

const {
  pool,
  getBrand,
  touchPassesByIds,
  getDevicesForBrand,
  createScheduledPush,
} = require('../db');
const { sendPushBatch } = require('./apns');
const { syncGoogleWalletObjectsForPasses } = require('./google-wallet-sync');
const samsungWallet = require('./samsung-wallet');
const { executeWalletPush } = require('./push-dispatch');

function parseWalletPushFlags(channel) {
  const raw = String(channel || 'apple').trim().toLowerCase();
  const keys = ['apple', 'google', 'samsung'];
  if (raw === 'all') return { sendApple: true, sendGoogle: true, sendSamsung: true };
  if (raw === 'both') return { sendApple: true, sendGoogle: true, sendSamsung: false };
  const parts = raw.split(',').map((s) => s.trim()).filter((k) => keys.includes(k));
  const set = parts.length ? parts : ['apple'];
  return {
    sendApple: set.includes('apple'),
    sendGoogle: set.includes('google'),
    sendSamsung: set.includes('samsung'),
  };
}

function bookingOfferId(bookingId) {
  return `booking_${String(bookingId || '').trim()}`;
}

async function syncBrandGeofencePasses(brandId, { message } = {}) {
  const brand = await getBrand(brandId);
  if (!brand) return { pushes_sent: 0, google: { skipped: true }, samsung: { skipped: true } };

  const channel = brand.config?.geofencing_channel || 'apple';
  const { sendApple, sendGoogle, sendSamsung } = parseWalletPushFlags(channel);
    const passRows = await pool.query('SELECT * FROM pass_instances WHERE brand_id = $1', [brandId]);
  const passes = passRows.rows;

  await touchPassesByIds(passes.map((p) => p.id));

  let pushCount = 0;
  if (sendApple) {
    const devices = await getDevicesForBrand(brandId);
    if (devices.length) {
      const batch = await sendPushBatch(devices.map((d) => d.push_token));
      pushCount = batch.filter((r) => r.success).length;
    }
  }

  const geoMsg = message
    || (brand.config?.locations?.[0]?.relevantText)
    || 'Aggiornamento geolocalizzazione';

  let googleSync = { attempted: 0, updated: 0, errors: 0, skipped: !sendGoogle };
  let samsungSync = { attempted: 0, notified: 0, skipped: !sendSamsung || !samsungWallet.isConfigured() };

  if (sendGoogle) {
    googleSync = await syncGoogleWalletObjectsForPasses({ brand, passes, message: geoMsg });
  }
  if (sendSamsung && samsungWallet.isConfigured()) {
    samsungSync = await samsungWallet.notifySavedPassesUpdates(passes);
  }

  return { pushes_sent: pushCount, google: googleSync, samsung: samsungSync };
}

async function patchBookingMetadata(brandId, bookingId, patch) {
  const res = await pool.query(
    `UPDATE commercial_bookings
     SET metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb,
         updated_at = NOW()
     WHERE id = $1 AND brand_id = $2
     RETURNING *`,
    [bookingId, brandId, JSON.stringify(patch || {})]
  );
  return res.rows[0] || null;
}

function resolvePushSchedule(startAt) {
  if (!startAt) return { immediate: true, nextRunAt: null };
  const t = new Date(startAt);
  if (Number.isNaN(t.getTime())) return { immediate: true, nextRunAt: null };
  if (t.getTime() <= Date.now() + 60_000) return { immediate: true, nextRunAt: null };
  return { immediate: false, nextRunAt: t.toISOString() };
}

async function activatePushLockscreenBooking(brandId, booking, data) {
  const title = String(data.push_title || data.title || booking.tenant_name || 'Offerta').trim().slice(0, 120);
  const message = String(data.push_message || data.message || `Scopri l'offerta ${booking.tenant_name}`).trim().slice(0, 1200);
  const linkUrl = String(data.push_link_url || data.link_url || '').trim() || null;
  const linkLabel = String(data.push_link_label || data.link_label || 'Scopri di più').trim().slice(0, 64);
  const channel = data.channel || 'apple';
  const schedule = resolvePushSchedule(booking.start_at);

  if (schedule.immediate) {
    const result = await executeWalletPush({
      brand_id: brandId,
      title,
      message,
      channel,
      update_pass: true,
      include_pass_link: !!linkUrl,
      pass_link_url: linkUrl,
      pass_link_label: linkLabel,
      back_link_url: linkUrl,
      back_link_label: linkLabel,
      coupon_redeemable: false,
      booking_id: booking.id,
    });
    await patchBookingMetadata(brandId, booking.id, {
      push_activated_at: new Date().toISOString(),
      push_sent: result.sent || result.sent_apns || 0,
      push_mode: 'immediate',
    });
    return { mode: 'immediate', result };
  }

  const sched = await createScheduledPush({
    brand_id: brandId,
    title,
    message,
    channel,
    schedule_type: 'once',
    next_run_at: schedule.nextRunAt,
    update_pass: true,
    include_pass_link: !!linkUrl,
    pass_link_url: linkUrl,
    pass_link_label: linkLabel,
  });
  await patchBookingMetadata(brandId, booking.id, {
    scheduled_push_id: sched.id,
    push_mode: 'scheduled',
    push_scheduled_for: schedule.nextRunAt,
  });
  return { mode: 'scheduled', scheduled_push_id: sched.id };
}

async function activateCouponCpaBooking(brandId, booking, data) {
  const title = String(data.push_title || data.title || booking.tenant_name || 'Coupon esclusivo').trim().slice(0, 120);
  const message = String(
    data.push_message || data.message || `Presenta il pass in cassa per riscattare l'offerta ${booking.tenant_name}`
  ).trim().slice(0, 1200);
  const linkUrl = String(data.push_link_url || data.link_url || '').trim() || null;
  const linkLabel = String(data.push_link_label || data.link_label || 'Vai allo store').trim().slice(0, 64);
  const channel = data.channel || 'apple';
  const schedule = resolvePushSchedule(booking.start_at);
  const offerId = bookingOfferId(booking.id);

  const pushBody = {
    brand_id: brandId,
    title,
    message,
    channel,
    update_pass: true,
    coupon_redeemable: true,
    include_pass_link: !!linkUrl,
    pass_link_url: linkUrl,
    pass_link_label: linkLabel,
    back_link_url: linkUrl,
    back_link_label: linkLabel,
    booking_id: booking.id,
  };

  if (schedule.immediate) {
    const result = await executeWalletPush(pushBody);
    await patchBookingMetadata(brandId, booking.id, {
      push_activated_at: new Date().toISOString(),
      push_sent: result.sent || result.sent_apns || 0,
      push_mode: 'immediate',
      offer_id: offerId,
    });
    return { mode: 'immediate', offer_id: offerId, result };
  }

  const sched = await createScheduledPush({
    brand_id: brandId,
    title,
    message,
    channel,
    schedule_type: 'once',
    next_run_at: schedule.nextRunAt,
    update_pass: true,
    include_pass_link: !!linkUrl,
    pass_link_url: linkUrl,
    pass_link_label: linkLabel,
  });
  await patchBookingMetadata(brandId, booking.id, {
    scheduled_push_id: sched.id,
    push_mode: 'scheduled',
    push_scheduled_for: schedule.nextRunAt,
    offer_id: offerId,
    coupon_cpa: true,
  });
  return { mode: 'scheduled', scheduled_push_id: sched.id, offer_id: offerId };
}

async function runBookingFormatActions(brandId, booking, data) {
  const format = booking.format;
  const outcomes = {};

  if (format === 'geofence_recall') {
    const poiText = data.poi?.relevantText || booking.tenant_name;
    outcomes.geofence = await syncBrandGeofencePasses(brandId, { message: poiText });
    await patchBookingMetadata(brandId, booking.id, {
      geofence_synced_at: new Date().toISOString(),
      geofence_pushes_sent: outcomes.geofence.pushes_sent || 0,
    });
  }

  if (format === 'push_lockscreen') {
    outcomes.push = await activatePushLockscreenBooking(brandId, booking, data);
  }

  if (format === 'coupon_cpa') {
    outcomes.coupon = await activateCouponCpaBooking(brandId, booking, data);
  }

  return outcomes;
}

module.exports = {
  syncBrandGeofencePasses,
  runBookingFormatActions,
  patchBookingMetadata,
  bookingOfferId,
  resolvePushSchedule,
};
