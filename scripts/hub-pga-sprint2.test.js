'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const { registerHubPwaRoutes } = require('../src/api/hub-pwa');
const { signHubToken } = require('../src/engine/hub-jwt');
const db = require('../src/db');

const HUB_DIR = path.join(__dirname, '../src/hub');
const APP_JS = fs.readFileSync(path.join(HUB_DIR, 'app.js'), 'utf8');
const INDEX_HTML = fs.readFileSync(path.join(HUB_DIR, 'index.html'), 'utf8');
const SERVER_JS = fs.readFileSync(path.join(__dirname, '../src/server.js'), 'utf8');
const HUB_PWA_JS = fs.readFileSync(path.join(__dirname, '../src/api/hub-pwa.js'), 'utf8');
const DB_SOURCE = fs.readFileSync(path.join(__dirname, '../src/db/index.js'), 'utf8');

function createHubTestServer() {
  const app = express();
  app.use(express.json());
  const router = express.Router();
  registerHubPwaRoutes(router);
  app.use('/api/v1', router);
  return http.createServer(app);
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, body, json: () => JSON.parse(body || '{}') });
      });
    }).on('error', reject);
  });
}

let server;
let baseUrl;

before(async () => {
  process.env.JWT_HUB_SECRET = 'test-hub-secret-sprint2';
  server = createHubTestServer();
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

test('Sprint 2: PWA routes conv / pga / me in app.js', () => {
  assert.match(APP_JS, /navigate\('\/conv'\)/);
  assert.match(APP_JS, /navigate\('\/pga'\)/);
  assert.match(APP_JS, /navigate\('\/me'\)/);
  assert.match(APP_JS, /\/qr\/conv\//);
  assert.match(APP_JS, /renderMe\(/);
  assert.match(APP_JS, /renderPga\(/);
  assert.match(APP_JS, /hub-tabbar/);
});

test('Sprint 2: index.html coin pill and tab bar shell', () => {
  assert.match(INDEX_HTML, /id="hub-coin-pill"/);
  assert.match(INDEX_HTML, /id="hub-tabbar"/);
});

test('Sprint 2: server SPA routes for conv, pga, me', () => {
  assert.match(SERVER_JS, /\/hub\/conv/);
  assert.match(SERVER_JS, /\/hub\/pga/);
  assert.match(SERVER_JS, /\/hub\/me/);
  assert.match(SERVER_JS, /\/qr\/conv/);
});

test('Sprint 2: hub-pwa bootstrap includes PGA fields', () => {
  assert.match(HUB_PWA_JS, /pga_settings/);
  assert.match(HUB_PWA_JS, /coin_balance/);
  assert.match(HUB_PWA_JS, /experiences/);
  assert.match(HUB_PWA_JS, /router\.get\('\/hub\/me'/);
  assert.match(HUB_PWA_JS, /router\.get\('\/hub\/experiences'/);
});

test('Sprint 2: db exports ledger and booking helpers for pass', () => {
  assert.match(DB_SOURCE, /async function listCoinLedgerForPass/);
  assert.match(DB_SOURCE, /async function listBookingsForPass/);
  assert.match(DB_SOURCE, /listCoinLedgerForPass,/);
  assert.match(DB_SOURCE, /listBookingsForPass,/);
});

test('Sprint 2: hub bootstrap returns PGA payload when enabled', async () => {
  const token = signHubToken({
    user_id: 'user-s2',
    pass_serial: 'SN-S2',
    brand_id: 'brand-s2'
  });

  const origPass = db.getPassBySerial;
  const origMember = db.getMemberForPass;
  const origBrand = db.getBrand;
  const origSettings = db.getHubSettings;
  const origMerchants = db.listActiveMerchantsForHub;
  const origPga = db.getPgaSettings;
  const origBal = db.getPassCoinBalance;
  const origExp = db.listExperiences;

  db.getPassBySerial = async () => ({
    id: 'pass-s2',
    brand_id: 'brand-s2',
    serial_number: 'SN-S2',
    status: 'active',
    field_values: { first_name: 'Mario', last_name: 'Rossi' }
  });
  db.getMemberForPass = async () => null;
  db.getBrand = async () => ({ id: 'brand-s2', name: 'Acme HR', slug: 'acme', config: {} });
  db.getHubSettings = async () => ({ accent_color: '#8B5CF6', categories_enabled: ['food'] });
  db.listActiveMerchantsForHub = async () => ([{
    id: 'm1',
    name: 'Test Merchant',
    category: 'food',
    discount_label: '-10%',
    active: true,
    online_enabled: false,
    physical_enabled: true
  }]);
  db.getPgaSettings = async () => ({ enabled: true, welcome_message: 'Benvenuto PGA' });
  db.getPassCoinBalance = async () => ({ balance: 42 });
  db.listExperiences = async () => ([{
    id: 'exp-1',
    key: 'colazione_ceo',
    name: 'Colazione CEO',
    description: 'Test',
    category: 'food',
    coin_cost: 15,
    requires_booking: true,
    internal: false,
    display_order: 1
  }]);

  try {
    const res = await httpGet(`${baseUrl}/api/v1/hub/bootstrap?token=${encodeURIComponent(token)}`);
    assert.equal(res.status, 200);
    const data = res.json();
    assert.equal(data.coin_balance, 42);
    assert.equal(data.pga_settings.enabled, true);
    assert.equal(data.experiences.length, 1);
    assert.equal(data.experiences[0].name, 'Colazione CEO');
    assert.equal(data.merchants.length, 1);
  } finally {
    db.getPassBySerial = origPass;
    db.getMemberForPass = origMember;
    db.getBrand = origBrand;
    db.getHubSettings = origSettings;
    db.listActiveMerchantsForHub = origMerchants;
    db.getPgaSettings = origPga;
    db.getPassCoinBalance = origBal;
    db.listExperiences = origExp;
  }
});

test('Sprint 2: hub/me returns balance ledger and bookings', async () => {
  const token = signHubToken({
    user_id: 'user-me',
    pass_serial: 'SN-ME',
    brand_id: 'brand-me'
  });

  const origPass = db.getPassBySerial;
  const origMember = db.getMemberForPass;
  const origBrand = db.getBrand;
  const origSettings = db.getHubSettings;
  const origPga = db.getPgaSettings;
  const origBal = db.getPassCoinBalance;
  const origLedger = db.listCoinLedgerForPass;
  const origBookings = db.listBookingsForPass;

  db.getPassBySerial = async () => ({
    id: 'pass-me',
    brand_id: 'brand-me',
    serial_number: 'SN-ME',
    status: 'active',
    field_values: {}
  });
  db.getMemberForPass = async () => ({ first_name: 'Luigi', last_name: 'Verdi' });
  db.getBrand = async () => ({ id: 'brand-me', name: 'Beta', slug: 'beta', config: {} });
  db.getHubSettings = async () => ({ categories_enabled: [] });
  db.getPgaSettings = async () => ({ enabled: true });
  db.getPassCoinBalance = async () => ({ balance: 7 });
  db.listCoinLedgerForPass = async () => ([{
    id: 'l1',
    action_key: 'birthday',
    coin_amount: 5,
    description: 'Compleanno',
    created_at: '2026-06-01T10:00:00.000Z'
  }]);
  db.listBookingsForPass = async () => ([{
    id: 'b1',
    experience_name: 'Colazione CEO',
    status: 'pending',
    created_at: '2026-06-02T12:00:00.000Z'
  }]);

  try {
    const res = await httpGet(`${baseUrl}/api/v1/hub/me?token=${encodeURIComponent(token)}`);
    assert.equal(res.status, 200);
    const data = res.json();
    assert.equal(data.coin_balance, 7);
    assert.equal(data.ledger.length, 1);
    assert.equal(data.bookings.length, 1);
    assert.equal(data.profile.first_name, 'Luigi');
  } finally {
    db.getPassBySerial = origPass;
    db.getMemberForPass = origMember;
    db.getBrand = origBrand;
    db.getHubSettings = origSettings;
    db.getPgaSettings = origPga;
    db.getPassCoinBalance = origBal;
    db.listCoinLedgerForPass = origLedger;
    db.listBookingsForPass = origBookings;
  }
});
