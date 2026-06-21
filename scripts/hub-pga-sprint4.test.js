'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const NAV_SOURCE = fs.readFileSync(path.join(__dirname, '../src/dashboard/lib/nav.js'), 'utf8');
const PGA_DASH_SOURCE = fs.readFileSync(path.join(__dirname, '../src/api/pga-dashboard.js'), 'utf8');
const DB_SOURCE = fs.readFileSync(path.join(__dirname, '../src/db/index.js'), 'utf8');
const RBAC_SOURCE = fs.readFileSync(path.join(__dirname, '../src/engine/rbac.js'), 'utf8');
const FD_RBAC_SOURCE = fs.readFileSync(path.join(__dirname, '../src/filodiretto/fd-rbac.js'), 'utf8');
const BUILD_SOURCE = fs.readFileSync(path.join(__dirname, 'build-fd-bundles.js'), 'utf8');
const INDEX_SOURCE = fs.readFileSync(path.join(__dirname, '../src/dashboard/index.html'), 'utf8');
const FD_PGA_SOURCE = fs.readFileSync(path.join(__dirname, '../src/filodiretto/fd-pga.js'), 'utf8');
const FD_ENG_SOURCE = fs.readFileSync(path.join(__dirname, '../src/filodiretto/fd-pga-engagement.js'), 'utf8');

test('nav catalog includes pga-catalog and pga-engagement under Growth Activation', () => {
  assert.match(NAV_SOURCE, /id:\s*'pga-catalog'/);
  assert.match(NAV_SOURCE, /label:\s*'PGA Catalog'/);
  assert.match(NAV_SOURCE, /id:\s*'pga-engagement'/);
  assert.match(NAV_SOURCE, /label:\s*'Engagement Coin'/);
  assert.match(NAV_SOURCE, /label:\s*'Growth Activation'/);
  assert.match(NAV_SOURCE, /id:\s*'comunicazione'[\s\S]*pga-catalog/);
});

test('fd-nav.js includes icons for PGA menu items', () => {
  const navJs = fs.readFileSync(path.join(__dirname, '../src/filodiretto/fd-nav.js'), 'utf8');
  assert.match(navJs, /'pga-catalog':/);
  assert.match(navJs, /'pga-engagement':/);
});

test('index.html wires PGA sections and nav loaders', () => {
  assert.match(INDEX_SOURCE, /id="pga-catalog"/);
  assert.match(INDEX_SOURCE, /id="pga-engagement"/);
  assert.match(INDEX_SOURCE, /loadPgaCatalog/);
  assert.match(INDEX_SOURCE, /loadPgaEngagement/);
  assert.match(INDEX_SOURCE, /data-requires-perm="pga_catalog"/);
  assert.match(INDEX_SOURCE, /data-requires-perm="pga_engagement"/);
  assert.match(INDEX_SOURCE, /conventionsTab_onboarding/);
});

test('fd-pga modules expose loaders', () => {
  assert.match(FD_PGA_SOURCE, /global\.loadPgaCatalog/);
  assert.match(FD_PGA_SOURCE, /global\.switchPgaTab/);
  assert.match(FD_ENG_SOURCE, /global\.loadPgaEngagement/);
});

test('RBAC maps PGA API routes to pga_catalog and pga_engagement', () => {
  assert.match(RBAC_SOURCE, /pga_catalog:\s*'full'/);
  assert.match(RBAC_SOURCE, /pga_engagement:\s*'full'/);
  assert.match(RBAC_SOURCE, /pga_catalog:\s*'read'/);
  assert.match(RBAC_SOURCE, /'pga-catalog':\s*'pga_catalog'/);
  assert.match(RBAC_SOURCE, /'pga-engagement':\s*'pga_engagement'/);
  assert.match(RBAC_SOURCE, /pga-settings/);
  assert.match(RBAC_SOURCE, /engagement-analytics/);
  assert.match(RBAC_SOURCE, /\/experiences/);
  assert.ok(RBAC_SOURCE.includes('manual-grant') && RBAC_SOURCE.includes("section: 'pga_catalog'"));
  assert.match(RBAC_SOURCE, /section: 'pga_catalog'/);
  assert.match(RBAC_SOURCE, /section: 'pga_engagement'/);
  assert.match(FD_RBAC_SOURCE, /pga_catalog:\s*'full'/);
  assert.match(FD_RBAC_SOURCE, /pga_engagement:\s*'read'/);
});

test('listBrandBookings db helper and brand bookings API', () => {
  assert.match(DB_SOURCE, /async function listBrandBookings/);
  const fnMatch = DB_SOURCE.match(/async function listBrandBookings[\s\S]*?(?=\nasync function |\nconst EXPERIENCE_MUTABLE)/);
  assert.ok(fnMatch, 'listBrandBookings body found');
  assert.match(fnMatch[0], /experience_name/);
  assert.match(fnMatch[0], /ORDER BY b\.created_at DESC/);
  assert.match(PGA_DASH_SOURCE, /\/brands\/:id\/bookings/);
  assert.match(PGA_DASH_SOURCE, /listBrandBookings/);
});

test('getEngagementAnalytics includes top_actions and by_weekday without pass_serial', () => {
  const fnMatch = DB_SOURCE.match(/async function getEngagementAnalytics[\s\S]*?(?=\nasync function hasCoinGrantToday)/);
  assert.ok(fnMatch, 'getEngagementAnalytics body found');
  assert.match(fnMatch[0], /top_actions/);
  assert.match(fnMatch[0], /by_weekday/);
  assert.doesNotMatch(fnMatch[0], /pass_serial/);
});

test('bundle manifest includes fd-pga files', () => {
  assert.match(BUILD_SOURCE, /fd-pga\.css/);
  assert.match(BUILD_SOURCE, /fd-pga\.js/);
  assert.match(BUILD_SOURCE, /fd-pga-engagement\.js/);
  assert.match(INDEX_SOURCE, /fd-pga\.css/);
  assert.match(INDEX_SOURCE, /fd-pga\.js/);
  assert.match(INDEX_SOURCE, /fd-pga-engagement\.js/);
});
