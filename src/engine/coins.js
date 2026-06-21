'use strict';

const {
  getCoinActionConfig,
  insertCoinLedgerEntry,
  getPassCoinBalance
} = require('../db');

/**
 * Grant coins for a configured action (accrual).
 * @returns {{ success: boolean, new_balance: number, ledger_id: string|null, skipped?: boolean, reason?: string }}
 */
async function grantCoin(brandId, passSerial, actionKey, options = {}) {
  if (!brandId || !passSerial || !actionKey) {
    throw new Error('brandId, passSerial e actionKey sono obbligatori');
  }

  const rule = await getCoinActionConfig(brandId, actionKey);
  if (!rule) {
    return { success: false, skipped: true, reason: 'action_not_configured', new_balance: null, ledger_id: null };
  }

  const coinAmount = options.coin_amount != null ? options.coin_amount : rule.coin_amount;
  if (!coinAmount || coinAmount <= 0) {
    return { success: false, skipped: true, reason: 'zero_amount', new_balance: null, ledger_id: null };
  }

  const entry = await insertCoinLedgerEntry({
    brand_id: brandId,
    pass_serial: passSerial,
    user_id: options.user_id || null,
    action_key: actionKey,
    coin_amount: coinAmount,
    description: options.description || rule.description || null,
    related_entity_type: options.related_entity_type || null,
    related_entity_id: options.related_entity_id || null,
    metadata: options.metadata || null
  });

  const balanceRow = await getPassCoinBalance(brandId, passSerial);
  return {
    success: true,
    new_balance: Number(balanceRow.balance || 0),
    ledger_id: entry.id
  };
}

/**
 * Debit coins (redemption). Fails if balance insufficient.
 */
async function debitCoin(brandId, passSerial, coinAmount, options = {}) {
  if (!brandId || !passSerial) throw new Error('brandId e passSerial sono obbligatori');
  const amount = Math.abs(Number(coinAmount));
  if (!amount || amount <= 0) throw new Error('coinAmount deve essere positivo');

  const balanceRow = await getPassCoinBalance(brandId, passSerial);
  const current = Number(balanceRow.balance || 0);
  if (current < amount) {
    const err = new Error('Saldo coin insufficiente');
    err.code = 'INSUFFICIENT_BALANCE';
    err.balance = current;
    throw err;
  }

  const actionKey = options.action_key || 'redemption';
  const entry = await insertCoinLedgerEntry({
    brand_id: brandId,
    pass_serial: passSerial,
    user_id: options.user_id || null,
    action_key: actionKey,
    coin_amount: -amount,
    description: options.description || null,
    related_entity_type: options.related_entity_type || null,
    related_entity_id: options.related_entity_id || null,
    metadata: options.metadata || null
  });

  const after = await getPassCoinBalance(brandId, passSerial);
  return {
    success: true,
    new_balance: Number(after.balance || 0),
    ledger_id: entry.id
  };
}

async function getCurrentBalance(brandId, passSerial) {
  const row = await getPassCoinBalance(brandId, passSerial);
  return Number(row.balance || 0);
}

module.exports = {
  grantCoin,
  debitCoin,
  getCurrentBalance
};
