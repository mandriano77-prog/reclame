'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const NAV_SOURCE = fs.readFileSync(path.join(__dirname, '../src/dashboard/lib/nav.js'), 'utf8');
const HUB_MERCHANTS_SOURCE = fs.readFileSync(path.join(__dirname, '../src/api/hub-merchants.js'), 'utf8');
const DB_SOURCE = fs.readFileSync(path.join(__dirname, '../src/db/index.js'), 'utf8');
const RBAC_SOURCE = fs.readFileSync(path.join(__dirname, '../src/engine/rbac.js'), 'utf8');
const FD_RBAC_SOURCE = fs.readFileSync(path.join(__dirname, '../src/filodiretto/fd-rbac.js'), 'utf8');
const BUILD_SOURCE = fs.readFileSync(path.join(__dirname, 'build-fd-bundles.js'), 'utf8');
const INDEX_SOURCE = fs.readFileSync(path.join(__dirname, '../src/dashboard/index.html'), 'utf8');
const SERVER_SOURCE = fs.readFileSync(path.join(__dirname, '../src/server.js'), 'utf8');
const SUBNAV_SOURCE = fs.readFileSync(path.join(__dirname, '../src/dashboard/js/dashboard-subnav.js'), 'utf8');

test('nav catalog includes conventions under Growth Activation and leads under Brand & Pass', () => {
  assert.match(NAV_SOURCE, /id:\s*'conventions'/);
  assert.match(NAV_SOURCE, /label:\s*'Convenzioni'/);
  assert.match(NAV_SOURCE, /label:\s*'Growth Activation'/);
  assert.match(NAV_SOURCE, /id:\s*'comunicazione'[\s\S]*conventions/);
  assert.match(NAV_SOURCE, /id:\s*'brand-pass'[\s\S]*id:\s*'leads'/);
});

test('hub-analytics endpoint registered with aggregate handler', () => {
  assert.match(HUB_MERCHANTS_SOURCE, /\/brands\/:id\/hub-analytics/);
  assert.match(HUB_MERCHANTS_SOURCE, /getHubBrandAnalytics/);
});

test('getHubBrandAnalytics returns GDPR-safe aggregate shape', () => {
  assert.match(DB_SOURCE, /async function getHubBrandAnalytics/);
  const fnMatch = DB_SOURCE.match(/async function getHubBrandAnalytics[\s\S]*?(?=\nasync function |\n\/\*\* Group SQL)/);
  assert.ok(fnMatch, 'getHubBrandAnalytics function body found');
  const fnBody = fnMatch[0];
  assert.match(fnBody, /by_merchant/);
  assert.match(fnBody, /by_category/);
  assert.match(fnBody, /top_10/);
  assert.match(fnBody, /daily:/);
  assert.doesNotMatch(fnBody, /pass_serial/);
});

test('RBAC conventions permission mapped for manager and reporter', () => {
  assert.match(RBAC_SOURCE, /conventions:\s*'full'/);
  assert.match(RBAC_SOURCE, /conventions:\s*'read'/);
  assert.match(RBAC_SOURCE, /conventions:\s*'conventions'/);
  assert.match(FD_RBAC_SOURCE, /conventions:\s*'full'/);
  assert.match(FD_RBAC_SOURCE, /conventions:\s*'read'/);
});

test('fd-conventions files in bundle manifest and index.html nobundle arrays', () => {
  assert.match(BUILD_SOURCE, /fd-conventions\.css/);
  assert.match(BUILD_SOURCE, /fd-conventions\.js/);
  assert.match(INDEX_SOURCE, /fd-conventions\.css/);
  assert.match(INDEX_SOURCE, /fd-conventions\.js/);
  assert.match(INDEX_SOURCE, /loadConventionsHub/);
  assert.match(INDEX_SOURCE, /id="conventions"/);
});

test('dashboard SPA route and CSV template exist', () => {
  assert.match(SERVER_SOURCE, /\/dashboard\/convenzioni/);
  assert.match(SUBNAV_SOURCE, /\/dashboard\/convenzioni/);
  const templatePath = path.join(__dirname, '../public/hub-merchant-import-template.csv');
  assert.ok(fs.existsSync(templatePath), 'CSV template missing');
  const csv = fs.readFileSync(templatePath, 'utf8');
  assert.match(csv, /merchant_name;category;discount_label/);
});

test('fd-conventions module exposes loader and tab switcher', () => {
  const convSource = fs.readFileSync(path.join(__dirname, '../src/filodiretto/fd-conventions.js'), 'utf8');
  assert.match(convSource, /global\.loadConventionsHub/);
  assert.match(convSource, /global\.switchConventionsTab/);
  assert.match(convSource, /hub-analytics/);
});
