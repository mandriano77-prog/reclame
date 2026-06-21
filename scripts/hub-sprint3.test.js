'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const { registerHubPwaRoutes } = require('../src/api/hub-pwa');
const { signHubToken } = require('../src/engine/hub-jwt');
const {
  signScanUrl,
  verifyScanSignature,
  computeScanSig,
  isTimestampFresh,
  QR_TTL_MS
} = require('../src/engine/hub-qr');
const db = require('../src/db');

const PARTNER_DIR = path.join(__dirname, '../src/partner');

function createHubTestServer() {
  const app = express();
  app.use(express.json());
  const router = express.Router();
  registerHubPwaRoutes(router);
  app.use('/api/v1', router);
  return http.createServer(app);
}

function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    http.get({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      headers
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          body,
          json: () => JSON.parse(body || '{}')
        });
      });
    }).on('error', reject);
  });
}

let server;
let baseUrl;

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_HUB_SECRET = 'test-hub-secret-sprint3';
  process.env.QR_HMAC_SECRET = 'test-qr-hmac-secret-sprint3';
  process.env.PARTNER_BASE_URL = 'https://partner.test.local';
  server = createHubTestServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

test('haversineKm computes known distance', () => {
  const milan = { lat: 45.4642, lon: 9.19 };
  const nearby = { lat: 45.5021, lon: 9.2147 };
  const km = db.haversineKm(milan.lat, milan.lon, nearby.lat, nearby.lon);
  assert.ok(km > 4 && km < 6, `expected ~5km, got ${km}`);
});

test('groupNearbyMerchantRows filters by radius', () => {
  const rows = [
    {
      id: 'm1',
      brand_id: 'b1',
      name: 'Near',
      category: 'fitness',
      discount_label: '-10%',
      online_enabled: false,
      physical_enabled: true,
      location_id: 'l1',
      address: 'Via A',
      city: 'Milano',
      province: null,
      postal_code: null,
      country: 'IT',
      latitude: '45.5021',
      longitude: '9.2147',
      geofence_radius_m: 150,
      distance_km: '2.5'
    },
    {
      id: 'm2',
      brand_id: 'b1',
      name: 'Far',
      category: 'retail',
      discount_label: '-5%',
      online_enabled: false,
      physical_enabled: true,
      location_id: 'l2',
      address: 'Via B',
      city: 'Roma',
      province: null,
      postal_code: null,
      country: 'IT',
      latitude: '41.9028',
      longitude: '12.4964',
      geofence_radius_m: 150,
      distance_km: '480'
    }
  ];

  const result = db.groupNearbyMerchantRows(rows, 5);
  assert.equal(result.length, 1);
  assert.equal(result[0].name, 'Near');
  assert.equal(result[0].distance_km, 2.5);
  assert.equal(result[0].locations.length, 1);
});

test('signScanUrl and verifyScanSignature round-trip', () => {
  const signed = signScanUrl({
    pass_serial: 'SN-ABC',
    merchant_id: 'merchant-1',
    brand_id: 'brand-1',
    timestamp: Date.now()
  });
  assert.match(signed.scan_url, /^https:\/\/partner\.test\.local\/scan\?/);
  assert.ok(signed.expires_at);

  const url = new URL(signed.scan_url);
  const check = verifyScanSignature({
    serial: url.searchParams.get('serial'),
    merchant: url.searchParams.get('merchant'),
    t: url.searchParams.get('t'),
    sig: url.searchParams.get('sig'),
    brand_id: 'brand-1'
  });
  assert.equal(check.valid, true);
});

test('verifyScanSignature rejects expired QR', () => {
  const oldTs = Date.now() - QR_TTL_MS - 1000;
  const sig = computeScanSig({
    pass_serial: 'SN-OLD',
    merchant_id: 'm1',
    brand_id: 'b1',
    t: String(oldTs)
  });
  const check = verifyScanSignature({
    serial: 'SN-OLD',
    merchant: 'm1',
    t: String(oldTs),
    sig,
    brand_id: 'b1'
  });
  assert.equal(check.valid, false);
  assert.equal(check.reason, 'QR scaduto');
  assert.equal(isTimestampFresh(String(oldTs)), false);
});

test('verifyScanSignature rejects invalid signature', () => {
  const t = String(Date.now());
  const check = verifyScanSignature({
    serial: 'SN-X',
    merchant: 'm1',
    t,
    sig: 'deadbeef',
    brand_id: 'b1'
  });
  assert.equal(check.valid, false);
  assert.equal(check.reason, 'Firma non valida');
});

test('hub scan endpoint accepts valid signature', async () => {
  const serial = 'SN-SCAN-OK';
  const merchantId = 'merchant-scan-1';
  const brandId = 'brand-scan-1';
  const signed = signScanUrl({ pass_serial: serial, merchant_id: merchantId, brand_id: brandId });

  const origPass = db.getPassBySerial;
  const origMerchant = db.getMerchant;
  const origBrand = db.getBrand;
  const origMember = db.getMemberForPass;
  const origLog = db.logConventionActivation;

  let logged = null;
  db.getPassBySerial = async () => ({
    id: 'pass-scan',
    brand_id: brandId,
    serial_number: serial,
    status: 'active',
    field_values: JSON.stringify({ first_name: 'Marco', last_name: 'Rossi' })
  });
  db.getMerchant = async (id, bid) => ({
    id,
    brand_id: bid,
    name: 'Virgin Active',
    active: true,
    discount_label: '-15%',
    valid_from: null,
    valid_until: null
  });
  db.getBrand = async () => ({ id: brandId, name: 'Acme S.r.l.' });
  db.getMemberForPass = async () => ({ first_name: 'Marco', last_name: 'Rossi' });
  db.logConventionActivation = async (payload) => {
    logged = payload;
    return { id: 'act-1', ...payload };
  };

  try {
    const url = new URL(signed.scan_url);
    const qs = url.search;
    const res = await httpGet(`${baseUrl}/api/v1/hub/scan${qs}`, { Accept: 'application/json' });
    assert.equal(res.status, 200);
    const data = res.json();
    assert.equal(data.valid, true);
    assert.equal(data.employee_name, 'Marco Rossi');
    assert.equal(data.company, 'Acme S.r.l.');
    assert.equal(data.discount_label, '-15%');
    assert.ok(logged);
    assert.equal(logged.activation_type, 'scan_qr');
  } finally {
    db.getPassBySerial = origPass;
    db.getMerchant = origMerchant;
    db.getBrand = origBrand;
    db.getMemberForPass = origMember;
    db.logConventionActivation = origLog;
  }
});

test('hub scan endpoint rejects invalid signature', async () => {
  const origPass = db.getPassBySerial;
  db.getPassBySerial = async () => ({
    id: 'p1',
    brand_id: 'brand-x',
    status: 'active'
  });
  try {
    const qs = new URLSearchParams({
      serial: 'SN-BAD',
      merchant: 'm-bad',
      t: String(Date.now()),
      sig: 'not-valid'
    });
    const res = await httpGet(`${baseUrl}/api/v1/hub/scan?${qs}`, { Accept: 'application/json' });
    assert.equal(res.status, 403);
    const data = res.json();
    assert.equal(data.valid, false);
    assert.equal(data.reason, 'Firma non valida');
  } finally {
    db.getPassBySerial = origPass;
  }
});

test('hub nearby endpoint returns merchants with distance', async () => {
  const token = signHubToken({
    user_id: 'u1',
    pass_serial: 'SN-NEAR',
    brand_id: 'brand-near'
  });

  const origPass = db.getPassBySerial;
  const origMember = db.getMemberForPass;
  const origBrand = db.getBrand;
  const origSettings = db.getHubSettings;
  const origNearby = db.findMerchantsNearby;

  db.getPassBySerial = async () => ({
    id: 'p-near',
    brand_id: 'brand-near',
    serial_number: 'SN-NEAR',
    status: 'active',
    field_values: {}
  });
  db.getMemberForPass = async () => null;
  db.getBrand = async () => ({ id: 'brand-near', name: 'Acme', slug: 'acme', config: {} });
  db.getHubSettings = async () => ({ categories_enabled: ['fitness'] });
  db.findMerchantsNearby = async () => ([{
    id: 'm-near',
    name: 'Gym',
    category: 'fitness',
    discount_label: '-10%',
    online_enabled: false,
    physical_enabled: true,
    distance_km: 1.2,
    locations: [{ id: 'loc1', address: 'Via X', city: 'Milano', distance_km: 1.2 }]
  }]);

  try {
    const qs = new URLSearchParams({ token, lat: '45.46', lon: '9.19', radius_km: '5' });
    const res = await httpGet(`${baseUrl}/api/v1/hub/merchants/nearby?${qs}`);
    assert.equal(res.status, 200);
    const data = res.json();
    assert.equal(data.length, 1);
    assert.equal(data[0].distance_km, 1.2);
    assert.equal(data[0].locations[0].distance_km, 1.2);
  } finally {
    db.getPassBySerial = origPass;
    db.getMemberForPass = origMember;
    db.getBrand = origBrand;
    db.getHubSettings = origSettings;
    db.findMerchantsNearby = origNearby;
  }
});

test('hub qr-token returns signed payload', async () => {
  const token = signHubToken({
    user_id: 'u-qr',
    pass_serial: 'SN-QR',
    brand_id: 'brand-qr'
  });

  const origPass = db.getPassBySerial;
  const origMember = db.getMemberForPass;
  const origBrand = db.getBrand;
  const origSettings = db.getHubSettings;
  const origMerchant = db.getMerchant;
  const origLog = db.logConventionActivation;

  db.getPassBySerial = async () => ({
    id: 'p-qr',
    brand_id: 'brand-qr',
    serial_number: 'SN-QR',
    status: 'active',
    field_values: {}
  });
  db.getMemberForPass = async () => null;
  db.getBrand = async () => ({ id: 'brand-qr', name: 'Acme', slug: 'acme', config: {} });
  db.getHubSettings = async () => ({ categories_enabled: [] });
  db.getMerchant = async (id, brandId) => ({
    id,
    brand_id: brandId,
    name: 'Store',
    active: true,
    physical_enabled: true,
    category: 'retail',
    discount_label: '-10%'
  });
  db.logConventionActivation = async (payload) => ({ id: 'ev-qr', ...payload });

  try {
    const qs = new URLSearchParams({ token, merchant_id: 'm-qr-1' });
    const res = await httpGet(`${baseUrl}/api/v1/hub/qr-token?${qs}`);
    assert.equal(res.status, 200);
    const data = res.json();
    assert.match(data.qr_url, /^data:image\/png;base64,/);
    assert.match(data.scan_url, /partner\.test\.local\/scan/);
    assert.ok(data.expires_at);
  } finally {
    db.getPassBySerial = origPass;
    db.getMemberForPass = origMember;
    db.getBrand = origBrand;
    db.getHubSettings = origSettings;
    db.getMerchant = origMerchant;
    db.logConventionActivation = origLog;
  }
});

test('partner PWA shell files exist', () => {
  for (const file of ['index.html', 'scan.js', 'partner.css']) {
    assert.ok(fs.existsSync(path.join(PARTNER_DIR, file)), `missing partner/${file}`);
  }
});
