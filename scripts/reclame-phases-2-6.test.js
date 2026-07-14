'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'src/dashboard/index.html'), 'utf8');
const passkit = fs.readFileSync(path.join(root, 'src/engine/passkit.js'), 'utf8');
const hubApp = fs.readFileSync(path.join(root, 'src/hub/app.js'), 'utf8');
const hubCss = fs.readFileSync(path.join(root, 'src/hub/hub.css'), 'utf8');
const dbJs = fs.readFileSync(path.join(root, 'src/db/index.js'), 'utf8');
const routes = fs.readFileSync(path.join(root, 'src/api/routes.js'), 'utf8');
const commercialJs = fs.readFileSync(path.join(root, 'src/engine/reclame-commercial.js'), 'utf8');
const presetsJs = fs.readFileSync(path.join(root, 'src/engine/audience-presets.js'), 'utf8');
const rbac = fs.readFileSync(path.join(root, 'src/engine/rbac.js'), 'utf8');

test('commercial engine exposes packages, billing split, geofence booking', () => {
  const {
    listPackages,
    computeBillingSplit,
    FORMAT_LABELS,
    assertFormatInventoryAvailable,
    exportCommercialBillingCsv,
  } = require('../src/engine/reclame-commercial');
  const actions = require('../src/engine/reclame-booking-actions');
  assert.ok(listPackages().length >= 5);
  assert.ok(FORMAT_LABELS.hub_sponsored);
  const split = computeBillingSplit(100000, 70, 15);
  assert.equal(split.gross_cents, 100000);
  assert.equal(split.reclame_cents, 15000);
  assert.match(commercialJs, /applyGeofenceFromBooking/);
  assert.match(commercialJs, /assertFormatInventoryAvailable/);
  assert.match(commercialJs, /getBookingPerformance/);
  assert.match(commercialJs, /exportCommercialBillingCsv/);
  assert.match(commercialJs, /paid_at/);
  assert.ok(typeof actions.syncBrandGeofencePasses === 'function');
  assert.ok(typeof actions.runBookingFormatActions === 'function');
});

test('audience presets cover closed-loop segments', () => {
  const { listAudiencePresets, getAudiencePreset } = require('../src/engine/audience-presets');
  const keys = listAudiencePresets().map((p) => p.key);
  assert.ok(keys.includes('clicked_no_redeem'));
  assert.ok(keys.includes('redeemed'));
  const preset = getAudiencePreset('high_intent');
  assert.ok(preset.rules.behavior.did_action === 'link_click');
});

test('DB schema supports commercial bookings and sponsored merchants', () => {
  assert.match(dbJs, /commercial_bookings/);
  assert.match(dbJs, /commercial_billing_entries/);
  assert.match(dbJs, /sponsored BOOLEAN/);
  // Sponsorship ordering now respects the campaign window (booking-driven featuring with
  // read-time expiry via sponsored_until), so it sorts by the effective flag.
  assert.match(dbJs, /sponsored_until/);
  assert.match(dbJs, /ORDER BY sponsored_effective DESC/);
});

test('API registers commercial and audience preset routes', () => {
  assert.match(routes, /registerCommercialRoutes/);
  const commercialRoutes = fs.readFileSync(path.join(root, 'src/api/commercial-routes.js'), 'utf8');
  assert.match(commercialRoutes, /\/commercial\/calendar/);
  assert.match(commercialRoutes, /\/audience-presets/);
  assert.match(commercialRoutes, /billing\/export\.csv/);
  assert.match(commercialRoutes, /\/performance/);
});

test('pass link tracking supports booking attribution', () => {
  assert.match(routes, /booking_id: bookingId/);
  assert.match(passkit, /commercial_booking_id/);
  assert.match(fs.readFileSync(path.join(root, 'src/engine/push-dispatch.js'), 'utf8'), /booking_id/);
});

test('passkit enables HUB link for ads product line', () => {
  assert.match(passkit, /isAdsPassBrand/);
  assert.match(passkit, /Scopri le offerte/);
});

test('HUB PWA shows sponsored merchant cards', () => {
  assert.match(hubApp, /hub-card--sponsored/);
  assert.match(hubApp, /hub-sponsored-badge/);
  assert.match(hubCss, /\.hub-card--sponsored/);
});

test('dashboard exposes commercial section and audience presets UI', () => {
  assert.match(indexHtml, /id="commercial"/);
  assert.match(indexHtml, /loadCommercialCalendar/);
  assert.match(indexHtml, /audiencePresetsList/);
  assert.match(indexHtml, /nav-item--reclame-ads/);
  assert.match(indexHtml, /a2w-commercial\.js/);
  assert.match(indexHtml, /name="sponsored"/);
  assert.match(indexHtml, /commercialBillingEntries/);
  assert.match(indexHtml, /commercialFilterFrom/);
  assert.match(indexHtml, /commercialPushFields/);
});

test('RBAC includes commercial section', () => {
  assert.match(rbac, /commercial: 'commercial'/);
  assert.match(rbac, /commercial: 'full'/);
});
