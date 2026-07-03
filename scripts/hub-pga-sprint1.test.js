'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const DB_SOURCE = fs.readFileSync(path.join(__dirname, '../src/db/index.js'), 'utf8');
const COINS_SOURCE = fs.readFileSync(path.join(__dirname, '../src/engine/coins.js'), 'utf8');

test('Sprint 1: PGA schema tables and pass_coin_balance view in getDb()', () => {
  assert.match(DB_SOURCE, /CREATE TABLE IF NOT EXISTS coin_actions_config/);
  assert.match(DB_SOURCE, /CREATE TABLE IF NOT EXISTS coin_ledger/);
  assert.match(DB_SOURCE, /CREATE OR REPLACE VIEW pass_coin_balance/);
  assert.match(DB_SOURCE, /CREATE TABLE IF NOT EXISTS experiences_catalog/);
  assert.match(DB_SOURCE, /CREATE TABLE IF NOT EXISTS experience_bookings/);
  assert.match(DB_SOURCE, /CREATE TABLE IF NOT EXISTS pga_settings/);
});

test('Sprint 1: db exports coin ledger helpers', () => {
  assert.match(DB_SOURCE, /async function getCoinActionConfig/);
  assert.match(DB_SOURCE, /async function insertCoinLedgerEntry/);
  assert.match(DB_SOURCE, /async function getPassCoinBalance/);
  assert.match(DB_SOURCE, /getCoinActionConfig,/);
  assert.match(DB_SOURCE, /insertCoinLedgerEntry,/);
});

test('Sprint 1: coins.js exposes grantCoin, debitCoin, getCurrentBalance', () => {
  assert.match(COINS_SOURCE, /async function grantCoin/);
  assert.match(COINS_SOURCE, /async function debitCoin/);
  assert.match(COINS_SOURCE, /async function getCurrentBalance/);
  // debitCoin delegates to the atomic ledger debit; INSUFFICIENT_BALANCE is raised there.
  assert.match(COINS_SOURCE, /atomicDebitCoinLedger/);
  assert.match(DB_SOURCE, /INSUFFICIENT_BALANCE/);
  assert.match(DB_SOURCE, /pg_advisory_xact_lock/);
});

test('Sprint 1: grantCoin skips when action not configured', async () => {
  const db = require('../src/db');
  const origGet = db.getCoinActionConfig;
  db.getCoinActionConfig = async () => null;
  delete require.cache[require.resolve('../src/engine/coins')];
  try {
    const { grantCoin } = require('../src/engine/coins');
    const out = await grantCoin('brand-1', 'SN-1', 'birthday');
    assert.equal(out.success, false);
    assert.equal(out.skipped, true);
    assert.equal(out.reason, 'action_not_configured');
  } finally {
    db.getCoinActionConfig = origGet;
    delete require.cache[require.resolve('../src/engine/coins')];
  }
});

test('Sprint 1: debitCoin propagates insufficient balance from atomic debit', async () => {
  // The balance check now lives inside the atomic transaction (atomicDebitCoinLedger);
  // debitCoin must surface its INSUFFICIENT_BALANCE code unchanged.
  const db = require('../src/db');
  const origAtomic = db.atomicDebitCoinLedger;
  db.atomicDebitCoinLedger = async () => {
    const err = new Error('Saldo coin insufficiente');
    err.code = 'INSUFFICIENT_BALANCE';
    err.balance = 5;
    throw err;
  };
  delete require.cache[require.resolve('../src/engine/coins')];
  try {
    const { debitCoin } = require('../src/engine/coins');
    await assert.rejects(
      () => debitCoin('brand-1', 'SN-1', 10, { action_key: 'redemption' }),
      (err) => err && err.code === 'INSUFFICIENT_BALANCE'
    );
  } finally {
    db.atomicDebitCoinLedger = origAtomic;
    delete require.cache[require.resolve('../src/engine/coins')];
  }
});
