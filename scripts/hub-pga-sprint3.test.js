'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const { registerHubPwaRoutes } = require('../src/api/hub-pwa');
const { signHubToken } = require('../src/engine/hub-jwt');
const { redeemExperience, cancelPendingBooking } = require('../src/engine/pga-redeem');
const db = require('../src/db');

const HUB_DIR = path.join(__dirname, '../src/hub');
const APP_JS = fs.readFileSync(path.join(HUB_DIR, 'app.js'), 'utf8');
const HUB_PWA_JS = fs.readFileSync(path.join(__dirname, '../src/api/hub-pwa.js'), 'utf8');
const DB_SOURCE = fs.readFileSync(path.join(__dirname, '../src/db/index.js'), 'utf8');
const PGA_REDEEM_SOURCE = fs.readFileSync(path.join(__dirname, '../src/engine/pga-redeem.js'), 'utf8');
const MAILER_SOURCE = fs.readFileSync(path.join(__dirname, '../src/engine/mailer.js'), 'utf8');

function createHubTestServer() {
  const app = express();
  app.use(express.json());
  const router = express.Router();
  registerHubPwaRoutes(router);
  app.use('/api/v1', router);
  return http.createServer(app);
}

function httpRequest(method, url, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const opts = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          body: data,
          json: () => JSON.parse(data || '{}')
        });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function httpGet(url) {
  return httpRequest('GET', url);
}

function httpPost(url, body) {
  return httpRequest('POST', url, body);
}

let server;
let baseUrl;

before(async () => {
  process.env.JWT_HUB_SECRET = 'test-hub-secret-sprint3';
  server = createHubTestServer();
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

test('Sprint 3: source files and db exports present', () => {
  assert.match(DB_SOURCE, /async function createExperienceBooking/);
  assert.match(DB_SOURCE, /async function getExperienceAvailability/);
  assert.match(DB_SOURCE, /createExperienceBooking,/);
  assert.match(DB_SOURCE, /getExperienceAvailability,/);
  assert.match(PGA_REDEEM_SOURCE, /async function redeemExperience/);
  assert.match(PGA_REDEEM_SOURCE, /async function cancelPendingBooking/);
  assert.match(MAILER_SOURCE, /sendPgaBookingHrNotification/);
  assert.match(MAILER_SOURCE, /sendPgaBookingEmployeeConfirmation/);
});

test('Sprint 3: hub-pwa redemption routes registered', () => {
  assert.match(HUB_PWA_JS, /router\.get\('\/hub\/experiences\/:id'/);
  assert.match(HUB_PWA_JS, /router\.post\('\/hub\/experiences\/:id\/redeem'/);
  assert.match(HUB_PWA_JS, /router\.post\('\/hub\/bookings\/:id\/cancel'/);
  assert.match(HUB_PWA_JS, /category: category \|\| undefined/);
});

test('Sprint 3: PWA redemption UI hooks in app.js', () => {
  assert.match(APP_JS, /hub-pga-redeem/);
  assert.match(APP_JS, /hub-booking-cancel/);
  assert.match(APP_JS, /showModal\(/);
  assert.match(APP_JS, /\/hub\/experiences\//);
  assert.match(APP_JS, /display_order/);
});

test('Sprint 3: redeemExperience debits coins and creates booking', async () => {
  const origPga = db.getPgaSettings;
  const origExp = db.getExperience;
  const origAvail = db.getExperienceAvailability;
  const origCreate = db.createExperienceBooking;
  const debitCalls = [];

  const coins = require('../src/engine/coins');
  const origDebit = coins.debitCoin;
  coins.debitCoin = async (...args) => {
    debitCalls.push(args);
    return { success: true, new_balance: 85, ledger_id: 'led-1' };
  };

  db.getPgaSettings = async () => ({ enabled: true });
  db.getExperience = async () => ({
    id: 'exp-r1',
    key: 'ceo_lunch',
    name: 'Colazione CEO',
    active: true,
    coin_cost: 15
  });
  db.getExperienceAvailability = async () => ({
    can_redeem: true,
    reason: null
  });
  db.createExperienceBooking = async (data) => ({
    id: 'book-1',
    ...data,
    status: 'pending',
    created_at: new Date().toISOString()
  });

  try {
    const out = await redeemExperience({
      brandId: 'brand-r1',
      passSerial: 'SN-R1',
      userId: 'user-r1',
      experienceId: 'exp-r1',
      scheduled_at: '2026-08-01T09:00:00.000Z'
    });
    assert.equal(out.new_balance, 85);
    assert.equal(out.booking.status, 'pending');
    assert.equal(out.booking.coin_amount, 15);
    assert.equal(debitCalls.length, 1);
    assert.equal(debitCalls[0][2], 15);
  } finally {
    db.getPgaSettings = origPga;
    db.getExperience = origExp;
    db.getExperienceAvailability = origAvail;
    db.createExperienceBooking = origCreate;
    coins.debitCoin = origDebit;
  }
});

test('Sprint 3: redeemExperience fails when monthly limit reached', async () => {
  const origPga = db.getPgaSettings;
  const origExp = db.getExperience;
  const origAvail = db.getExperienceAvailability;

  db.getPgaSettings = async () => ({ enabled: true });
  db.getExperience = async () => ({
    id: 'exp-r2',
    name: 'Sabbatical',
    active: true,
    coin_cost: 5000
  });
  db.getExperienceAvailability = async () => ({
    can_redeem: false,
    reason: 'MONTHLY_EXHAUSTED'
  });

  try {
    await assert.rejects(
      () => redeemExperience({
        brandId: 'brand-r2',
        passSerial: 'SN-R2',
        userId: 'user-r2',
        experienceId: 'exp-r2'
      }),
      (err) => err.code === 'MONTHLY_EXHAUSTED'
    );
  } finally {
    db.getPgaSettings = origPga;
    db.getExperience = origExp;
    db.getExperienceAvailability = origAvail;
  }
});

test('Sprint 3: cancelPendingBooking refunds pending booking', async () => {
  // Cancel + refund are now one atomic transaction (atomicCancelBookingRefund); the
  // compare-and-set on status prevents double refunds. The ledger insert happens inside
  // that transaction, so the test asserts the atomic call is made and its result surfaces.
  const origGet = db.getExperienceBookingForPass;
  const origAtomic = db.atomicCancelBookingRefund;
  const origBal = db.getPassCoinBalance;
  const atomicCalls = [];

  db.getExperienceBookingForPass = async () => ({
    id: 'book-cancel',
    brand_id: 'brand-c1',
    pass_serial: 'SN-C1',
    experience_id: 'exp-c1',
    user_id: 'user-c1',
    coin_amount: 20,
    status: 'pending'
  });
  db.atomicCancelBookingRefund = async (args) => {
    atomicCalls.push(args);
    return { id: 'book-cancel', status: 'cancelled', coin_amount: 20 };
  };
  db.getPassCoinBalance = async () => ({ balance: 120 });

  try {
    const out = await cancelPendingBooking({
      brandId: 'brand-c1',
      passSerial: 'SN-C1',
      bookingId: 'book-cancel'
    });
    assert.equal(out.new_balance, 120);
    assert.equal(out.booking.status, 'cancelled');
    assert.equal(atomicCalls.length, 1);
    assert.equal(atomicCalls[0].bookingId, 'book-cancel');
    assert.equal(atomicCalls[0].brandId, 'brand-c1');
    assert.equal(atomicCalls[0].passSerial, 'SN-C1');
  } finally {
    db.getExperienceBookingForPass = origGet;
    db.atomicCancelBookingRefund = origAtomic;
    db.getPassCoinBalance = origBal;
  }
});

test('Sprint 3: cancelPendingBooking rejects when the atomic cancel loses the race', async () => {
  // atomicCancelBookingRefund returns null when the booking was no longer pending
  // (a concurrent cancel won). cancelPendingBooking must then reject, never refund.
  const origGet = db.getExperienceBookingForPass;
  const origAtomic = db.atomicCancelBookingRefund;

  db.getExperienceBookingForPass = async () => ({
    id: 'book-race',
    brand_id: 'brand-c1',
    pass_serial: 'SN-C1',
    experience_id: 'exp-c1',
    user_id: 'user-c1',
    coin_amount: 20,
    status: 'pending'
  });
  db.atomicCancelBookingRefund = async () => null;

  try {
    await assert.rejects(
      () => cancelPendingBooking({ brandId: 'brand-c1', passSerial: 'SN-C1', bookingId: 'book-race' }),
      (err) => err && err.code === 'NOT_CANCELLABLE'
    );
  } finally {
    db.getExperienceBookingForPass = origGet;
    db.atomicCancelBookingRefund = origAtomic;
  }
});

test('Sprint 3: POST redeem API returns booking and new balance', async () => {
  const token = signHubToken({
    user_id: 'user-api',
    pass_serial: 'SN-API',
    brand_id: 'brand-api'
  });

  const origPass = db.getPassBySerial;
  const origMember = db.getMemberForPass;
  const origBrand = db.getBrand;
  const origSettings = db.getHubSettings;
  const origPga = db.getPgaSettings;
  const origExp = db.getExperience;
  const origAvail = db.getExperienceAvailability;
  const origCreate = db.createExperienceBooking;

  const coins = require('../src/engine/coins');
  const origDebit = coins.debitCoin;
  coins.debitCoin = async () => ({ success: true, new_balance: 90, ledger_id: 'led-api' });

  db.getPassBySerial = async () => ({
    id: 'pass-api',
    brand_id: 'brand-api',
    serial_number: 'SN-API',
    status: 'active',
    field_values: { email: 'mario@acme.it' }
  });
  db.getMemberForPass = async () => null;
  db.getBrand = async () => ({ id: 'brand-api', name: 'Acme', slug: 'acme', config: {} });
  db.getHubSettings = async () => ({ categories_enabled: [] });
  db.getPgaSettings = async () => ({
    enabled: true,
    notify_hr_on_booking: false,
    notify_hr_email: null
  });
  db.getExperience = async () => ({
    id: 'exp-api',
    key: 'workshop',
    name: 'Workshop',
    active: true,
    coin_cost: 10
  });
  db.getExperienceAvailability = async () => ({ can_redeem: true, reason: null });
  db.createExperienceBooking = async (data) => ({
    id: 'b-api',
    ...data,
    status: 'pending',
    created_at: new Date().toISOString()
  });

  try {
    const res = await httpPost(
      `${baseUrl}/api/v1/hub/experiences/exp-api/redeem?token=${encodeURIComponent(token)}`,
      {}
    );
    assert.equal(res.status, 201);
    const data = res.json();
    assert.equal(data.new_balance, 90);
    assert.equal(data.booking.status, 'pending');
    assert.equal(data.booking.coin_amount, 10);
  } finally {
    coins.debitCoin = origDebit;
    db.getPassBySerial = origPass;
    db.getMemberForPass = origMember;
    db.getBrand = origBrand;
    db.getHubSettings = origSettings;
    db.getPgaSettings = origPga;
    db.getExperience = origExp;
    db.getExperienceAvailability = origAvail;
    db.createExperienceBooking = origCreate;
  }
});

test('Sprint 3: GET experience detail includes availability', async () => {
  const token = signHubToken({
    user_id: 'user-det',
    pass_serial: 'SN-DET',
    brand_id: 'brand-det'
  });

  const origPga = db.getPgaSettings;
  const origExp = db.getExperience;
  const origAvail = db.getExperienceAvailability;
  const origBal = db.getPassCoinBalance;
  const origCount = db.countExperienceBookingsMonth;

  db.getPgaSettings = async () => ({ enabled: true });
  db.getExperience = async () => ({
    id: 'exp-det',
    key: 'mentoring',
    name: 'Mentoring',
    description: 'Test',
    category: 'career',
    coin_cost: 100,
    max_per_user_per_year: 2,
    max_total_per_month: 5,
    requires_booking: true,
    internal: true,
    display_order: 20,
    active: true
  });
  db.getExperienceAvailability = async () => ({
    user_bookings_this_year: 0,
    max_per_user_per_year: 2,
    bookings_this_month: 1,
    max_total_per_month: 5,
    slots_remaining_this_month: 4,
    can_redeem: true,
    reason: null
  });
  db.getPassCoinBalance = async () => ({ balance: 200 });
  db.countExperienceBookingsMonth = async () => 1;

  try {
    const res = await httpGet(
      `${baseUrl}/api/v1/hub/experiences/exp-det?token=${encodeURIComponent(token)}`
    );
    assert.equal(res.status, 200);
    const data = res.json();
    assert.equal(data.experience.name, 'Mentoring');
    assert.equal(data.availability.can_redeem, true);
    assert.equal(data.coin_balance, 200);
    assert.ok(Array.isArray(data.suggested_slots));
  } finally {
    db.getPgaSettings = origPga;
    db.getExperience = origExp;
    db.getExperienceAvailability = origAvail;
    db.getPassCoinBalance = origBal;
    db.countExperienceBookingsMonth = origCount;
  }
});
