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
const REQUIRED_PWA_FILES = ['index.html', 'app.js', 'hub.css', 'manifest.json', 'sw.js'];

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

function httpPost(url, payload) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const data = JSON.stringify(payload);
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, body, json: () => JSON.parse(body || '{}') });
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

let server;
let baseUrl;

before(async () => {
  process.env.JWT_HUB_SECRET = 'test-hub-secret-hub-pwa';
  server = createHubTestServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

test('PWA shell files exist', () => {
  for (const file of REQUIRED_PWA_FILES) {
    assert.ok(fs.existsSync(path.join(HUB_DIR, file)), `missing ${file}`);
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(HUB_DIR, 'manifest.json'), 'utf8'));
  assert.equal(manifest.name, 'FiloDiretto HUB');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.theme_color);
});

test('hub bootstrap rejects invalid token', async () => {
  const res = await httpGet(`${baseUrl}/api/v1/hub/bootstrap?token=not-a-valid-jwt`);
  assert.equal(res.status, 401);
  const data = res.json();
  assert.match(data.error, /Token/i);
});

test('hub bootstrap rejects missing token', async () => {
  const res = await httpGet(`${baseUrl}/api/v1/hub/bootstrap`);
  assert.equal(res.status, 401);
});

test('hub events accepts valid payload with mocked db', async () => {
  const token = signHubToken({
    user_id: 'user-test-1',
    pass_serial: 'SN-HUB-TEST',
    brand_id: 'brand-test-uuid'
  });

  const origPass = db.getPassBySerial;
  const origMember = db.getMemberForPass;
  const origBrand = db.getBrand;
  const origSettings = db.getHubSettings;
  const origMerchant = db.getMerchant;
  const origLog = db.logConventionActivation;

  let logged = null;
  db.getPassBySerial = async () => ({
    id: 'pass-1',
    brand_id: 'brand-test-uuid',
    serial_number: 'SN-HUB-TEST',
    status: 'active',
    field_values: {}
  });
  db.getMemberForPass = async () => null;
  db.getBrand = async () => ({ id: 'brand-test-uuid', name: 'Acme', slug: 'acme', config: {} });
  db.getHubSettings = async () => ({ accent_color: '#8B5CF6', categories_enabled: ['food'] });
  db.getMerchant = async (id, brandId) => ({
    id,
    brand_id: brandId,
    name: 'Virgin Active',
    active: true,
    category: 'fitness',
    discount_label: '-15%'
  });
  db.logConventionActivation = async (payload) => {
    logged = payload;
    return { id: 'activation-1', ...payload };
  };

  try {
    const res = await httpPost(`${baseUrl}/api/v1/hub/events`, {
      token,
      merchant_id: 'merchant-1',
      activation_type: 'view',
      metadata: { source: 'test' }
    });
    assert.equal(res.status, 201);
    const data = res.json();
    assert.equal(data.success, true);
    assert.ok(logged);
    assert.equal(logged.brand_id, 'brand-test-uuid');
    assert.equal(logged.merchant_id, 'merchant-1');
    assert.equal(logged.pass_serial, 'SN-HUB-TEST');
    assert.equal(logged.activation_type, 'view');
  } finally {
    db.getPassBySerial = origPass;
    db.getMemberForPass = origMember;
    db.getBrand = origBrand;
    db.getHubSettings = origSettings;
    db.getMerchant = origMerchant;
    db.logConventionActivation = origLog;
  }
});

test('hub events rejects invalid activation_type', async () => {
  const token = signHubToken({ pass_serial: 'SN-2', brand_id: 'brand-2' });
  const origPass = db.getPassBySerial;
  const origMember = db.getMemberForPass;
  const origBrand = db.getBrand;
  const origSettings = db.getHubSettings;
  const origMerchant = db.getMerchant;

  db.getPassBySerial = async () => ({ id: 'p2', brand_id: 'brand-2', serial_number: 'SN-2', status: 'active' });
  db.getMemberForPass = async () => null;
  db.getBrand = async () => ({ id: 'brand-2', name: 'B', slug: 'b', config: {} });
  db.getHubSettings = async () => ({ categories_enabled: [] });
  db.getMerchant = async (id, brandId) => ({ id, brand_id: brandId, active: true });

  try {
    const res = await httpPost(`${baseUrl}/api/v1/hub/events`, {
      token,
      merchant_id: 'm1',
      activation_type: 'invalid_type'
    });
    assert.equal(res.status, 400);
  } finally {
    db.getPassBySerial = origPass;
    db.getMemberForPass = origMember;
    db.getBrand = origBrand;
    db.getHubSettings = origSettings;
    db.getMerchant = origMerchant;
  }
});
