'use strict';

const db = require('../db');
const coins = require('./coins');

function availabilityError(reason) {
  const err = new Error(
    reason === 'MONTHLY_EXHAUSTED'
      ? 'Esaurito questo mese'
      : reason === 'YEARLY_LIMIT'
        ? 'Limite annuale raggiunto'
        : 'Riscatto non disponibile'
  );
  err.code = reason || 'NOT_AVAILABLE';
  return err;
}

/**
 * Redeem an experience: validate limits, debit coins, create pending booking.
 */
async function redeemExperience({
  brandId,
  passSerial,
  userId,
  experienceId,
  scheduled_at = null,
  notes = null
}) {
  if (!brandId || !passSerial || !experienceId) {
    throw new Error('brandId, passSerial e experienceId sono obbligatori');
  }

  const pgaSettings = await db.getPgaSettings(brandId);
  if (!pgaSettings.enabled) {
    const err = new Error('PGA non attivo');
    err.code = 'PGA_DISABLED';
    throw err;
  }

  const experience = await db.getExperience(experienceId, brandId);
  if (!experience || !experience.active) {
    const err = new Error('Esperienza non trovata');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const availability = await db.getExperienceAvailability(brandId, experienceId, passSerial);
  if (!availability.can_redeem) {
    throw availabilityError(availability.reason);
  }

  const coinAmount = Number(experience.coin_cost);
  let debitResult;
  try {
    debitResult = await coins.debitCoin(brandId, passSerial, coinAmount, {
      user_id: userId,
      action_key: 'redemption',
      description: `Riscatto: ${experience.name}`,
      related_entity_type: 'booking'
    });
  } catch (err) {
    if (err.code === 'INSUFFICIENT_BALANCE') {
      const e = new Error('Saldo coin insufficiente');
      e.code = 'INSUFFICIENT_BALANCE';
      throw e;
    }
    throw err;
  }

  let booking;
  try {
    booking = await db.createExperienceBooking({
      brand_id: brandId,
      experience_id: experienceId,
      pass_serial: passSerial,
      user_id: userId,
      coin_amount: coinAmount,
      status: 'pending',
      scheduled_at: scheduled_at || null,
      notes: notes || null,
      metadata: { experience_key: experience.key }
    });
  } catch (err) {
    await db.insertCoinLedgerEntry({
      brand_id: brandId,
      pass_serial: passSerial,
      user_id: userId,
      action_key: 'booking_refund',
      coin_amount: coinAmount,
      description: `Rimborso riscatto fallito: ${experience.name}`,
      related_entity_type: 'booking',
      metadata: { reason: 'create_booking_failed' }
    }).catch(() => {});
    throw err;
  }

  return {
    booking,
    new_balance: debitResult.new_balance,
    experience
  };
}

/**
 * Cancel a pending booking and refund coins.
 */
async function cancelPendingBooking({ brandId, passSerial, bookingId }) {
  if (!brandId || !passSerial || !bookingId) {
    throw new Error('brandId, passSerial e bookingId sono obbligatori');
  }

  const booking = await db.getExperienceBookingForPass(bookingId, brandId, passSerial);
  if (!booking) {
    const err = new Error('Prenotazione non trovata');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (booking.status !== 'pending') {
    const err = new Error('Solo le prenotazioni in attesa possono essere annullate');
    err.code = 'NOT_CANCELLABLE';
    throw err;
  }

  // Cancel + refund atomically. The status flip is a compare-and-set inside the
  // transaction, so two concurrent cancels of the same booking can't double-refund:
  // the loser gets null and is reported as NOT_CANCELLABLE.
  const updated = await db.atomicCancelBookingRefund({ bookingId, brandId, passSerial });
  if (!updated) {
    const err = new Error('Solo le prenotazioni in attesa possono essere annullate');
    err.code = 'NOT_CANCELLABLE';
    throw err;
  }

  const balanceRow = await db.getPassCoinBalance(brandId, passSerial);

  return {
    booking: updated,
    new_balance: Number(balanceRow.balance || 0)
  };
}

module.exports = {
  redeemExperience,
  cancelPendingBooking
};
