'use strict';

/**
 * Coin reward redemption (Reclame / retail).
 *
 * Spending coins does NOT hand out money: it mints a single-use, short-lived CODE that the
 * customer shows at the till. The cashier validates it with the same /redeem endpoints used
 * for coupons, so the till app doesn't need to know the difference.
 *
 * Guarantees:
 *  - coins are debited atomically (advisory lock in atomicDebitCoinLedger) → no double spend;
 *  - one live code per customer at a time;
 *  - a code nobody redeems expires and the coins are credited back;
 *  - burning a code is a guarded UPDATE → two tills can't both consume it.
 */

const QRCode = require('qrcode');
const db = require('../db');
const { verifyRedemptionPin } = require('./coupon-redemption');

const REDEEM_TTL_MIN = Number(process.env.COIN_REDEEM_TTL_MIN || 15);

// No 0/O/1/I — these get read out loud and typed in by a cashier.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LEN = 8;

function generateCode() {
  const bytes = require('crypto').randomBytes(CODE_LEN);
  let out = '';
  for (let i = 0; i < CODE_LEN; i += 1) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

function publicRedemption(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    code: row.code,
    reward_name: row.reward_name,
    coins_spent: Number(row.coins_spent) || 0,
    status: row.status,
    expires_at: row.expires_at,
    used_at: row.used_at || null
  };
}

async function qrDataUrl(text) {
  try {
    return await QRCode.toDataURL(String(text), { margin: 1, width: 320, errorCorrectionLevel: 'M' });
  } catch (err) {
    console.warn('[coin] QR generation failed:', err.message);
    return null;
  }
}

/**
 * Redeem a reward: debit the coins, mint the code.
 * Throws Error with `.code` set for the cases the UI must phrase differently.
 */
async function redeemReward({ brandId, passSerial, passId = null, experienceId }) {
  if (!brandId || !passSerial || !experienceId) {
    const err = new Error('brandId, passSerial e experienceId sono obbligatori');
    err.code = 'bad_request';
    throw err;
  }
  // experience_id is a UUID column — a junk id must 404, not blow up the query.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(experienceId))) {
    const err = new Error('Premio non disponibile');
    err.code = 'reward_unavailable';
    throw err;
  }

  // Sweep this customer's stale codes first, so an abandoned one doesn't block them forever.
  await db.expireStaleCoinRedemptions(brandId).catch(() => {});

  const existing = await db.getActiveCoinRedemption(brandId, passSerial);
  if (existing) {
    const err = new Error('Hai già un premio da ritirare: usalo o aspetta che scada.');
    err.code = 'redemption_pending';
    err.redemption = publicRedemption(existing);
    throw err;
  }

  const reward = await db.getExperience(experienceId, brandId);
  if (!reward || reward.active === false) {
    const err = new Error('Premio non disponibile');
    err.code = 'reward_unavailable';
    throw err;
  }

  const cost = Number(reward.coin_cost) || 0;
  if (!(cost > 0)) {
    // A free reward has no coin flow to speak of; the debit would throw anyway.
    const err = new Error('Premio non riscattabile con i coin');
    err.code = 'reward_unavailable';
    throw err;
  }

  // Atomic: throws if the balance isn't there. Nothing is minted before the coins are gone.
  let debit;
  try {
    debit = await db.atomicDebitCoinLedger({
      brand_id: brandId,
      pass_serial: passSerial,
      amount: cost,
      action_key: 'reward_redemption',
      description: `Riscatto: ${reward.name}`,
      related_entity_type: 'experience',
      related_entity_id: String(reward.id)
    });
  } catch (err) {
    // Match on the machine code, not on an Italian sentence that could be reworded.
    if (err.code === 'INSUFFICIENT_BALANCE') {
      const e = new Error('Coin insufficienti per questo premio');
      e.code = 'insufficient_coins';
      e.balance = err.balance;
      throw e;
    }
    throw err;
  }

  const expiresAt = new Date(Date.now() + REDEEM_TTL_MIN * 60 * 1000).toISOString();

  // The coins are gone at this point, so every exit below MUST either mint a code or put them
  // back. A code collision just means "roll again"; anything else is refunded.
  const refund = async (why) => {
    try {
      await db.insertCoinLedgerEntry({
        brand_id: brandId,
        pass_serial: passSerial,
        action_key: 'reward_refund',
        coin_amount: cost,
        description: `Rimborso: ${why} (${reward.name})`,
        related_entity_type: 'experience',
        related_entity_id: String(reward.id)
      });
    } catch (refundErr) {
      // Never swallow this: the customer has been debited and got nothing. Loud + traceable.
      console.error(
        '[coin] REFUND FAILED — customer debited with no code.',
        JSON.stringify({ brand_id: brandId, pass_serial: passSerial, coins: cost, reward: reward.id }),
        refundErr.message
      );
    }
  };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const row = await db.insertCoinRedemption({
        brand_id: brandId,
        experience_id: reward.id,
        reward_name: reward.name,
        pass_id: passId,
        serial_number: passSerial,
        code: generateCode(),
        coins_spent: cost,
        expires_at: expiresAt,
        ledger_id: debit?.ledger_id || null
      });
      return {
        redemption: publicRedemption(row),
        qr_url: await qrDataUrl(row.code),
        balance: Number(debit?.new_balance ?? 0),
        ttl_minutes: REDEEM_TTL_MIN
      };
    } catch (err) {
      // Lost the race against a concurrent tap: the DB's partial unique index says this
      // customer already has a live code. Give the coins back and say so properly.
      if (err.code === '23505' && String(err.constraint || '').includes('uniq_coin_redemption_live')) {
        await refund('hai già un premio da ritirare');
        const active = await db.getActiveCoinRedemption(brandId, passSerial);
        const e = new Error('Hai già un premio da ritirare: usalo o aspetta che scada.');
        e.code = 'redemption_pending';
        e.redemption = publicRedemption(active);
        throw e;
      }
      // Anything else: retry with a fresh code, then give up and refund.
      if (attempt === 4) {
        await refund('emissione codice fallita');
        throw err;
      }
    }
  }
  return null;
}

/** The customer's live code, if any (so the HUB can show the QR again after a reload). */
async function getActiveRedemption(brandId, passSerial) {
  await db.expireStaleCoinRedemptions(brandId).catch(() => {});
  const row = await db.getActiveCoinRedemption(brandId, passSerial);
  if (!row) return null;
  return {
    redemption: publicRedemption(row),
    qr_url: await qrDataUrl(row.code),
    ttl_minutes: REDEEM_TTL_MIN
  };
}

/* ── Till side ──────────────────────────────────────────────────────────
   Same shape as the coupon preview/confirm so the cashier UI is unchanged. */

/** Accept the brand PIN or, when the till belongs to a merchant, that merchant's own PIN. */
async function resolveBrandAndPin(brandSlug, merchantSlug, pin) {
  const brand = await db.getBrandBySlug(brandSlug);
  if (!brand) return { error: { valid: false, reason: 'Brand non trovato' } };
  const merchant = merchantSlug ? await db.getMerchantBySlug(brand.id, merchantSlug) : null;
  if (!verifyRedemptionPin(brand, merchant, pin)) {
    return { error: { valid: false, code: 'pin_invalid', reason: 'PIN cassa non valido' } };
  }
  return { brand, merchant };
}

/** Is this a coin-reward code? Returns null when it isn't (so the caller falls back to coupons). */
async function previewCoinRedemption({ brandSlug, merchantSlug = null, code, pin }) {
  const clean = String(code || '').trim().toUpperCase();
  if (!clean) return null;
  const brand = await db.getBrandBySlug(brandSlug);
  if (!brand) return null;

  const row = await db.getCoinRedemptionByCode(brand.id, clean);
  if (!row) return null; // not ours — let the coupon flow try

  // From here the code IS a coin reward, so we own the answer (including failures).
  const gate = await resolveBrandAndPin(brandSlug, merchantSlug, pin);
  if (gate.error) return gate.error;

  if (row.status === 'used') {
    return { valid: false, kind: 'coin_reward', reason: 'Premio già ritirato', already_redeemed: true, redeemed_at: row.used_at };
  }
  if (row.status === 'expired' || new Date(row.expires_at) <= new Date()) {
    return { valid: false, kind: 'coin_reward', reason: 'Codice scaduto: i coin sono stati restituiti' };
  }
  return {
    valid: true,
    kind: 'coin_reward',
    reward_name: row.reward_name,
    coins_spent: Number(row.coins_spent) || 0,
    expires_at: row.expires_at,
    offer: { title: row.reward_name }
  };
}

async function confirmCoinRedemption({ brandSlug, merchantSlug = null, code, pin, storeLabel = '', operatorLabel = '' }) {
  const preview = await previewCoinRedemption({ brandSlug, merchantSlug, code, pin });
  if (preview === null) return null; // not a coin code
  if (!preview.valid) return preview;

  const brand = await db.getBrandBySlug(brandSlug);
  const used = await db.markCoinRedemptionUsed(brand.id, code, {
    storeLabel: String(storeLabel || '').trim().slice(0, 120) || null,
    operatorLabel: String(operatorLabel || '').trim().slice(0, 120) || null
  });
  if (!used) {
    // Lost the race, or it expired between preview and confirm.
    return { valid: false, kind: 'coin_reward', reason: 'Codice non più valido' };
  }
  return {
    valid: true,
    kind: 'coin_reward',
    reward_name: used.reward_name,
    coins_spent: Number(used.coins_spent) || 0,
    redeemed_at: used.used_at,
    offer: { title: used.reward_name }
  };
}

module.exports = {
  REDEEM_TTL_MIN,
  generateCode,
  redeemReward,
  getActiveRedemption,
  previewCoinRedemption,
  confirmCoinRedemption,
  publicRedemption
};
