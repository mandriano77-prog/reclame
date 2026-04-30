/**
 * Challenge Evaluator Engine
 *
 * Runs after Playtomic booking sync to automatically evaluate
 * and complete challenges based on booking data.
 *
 * Trigger types:
 * - booking_count:    N bookings in a period (week/month/lifetime)
 * - booking_streak:   Consecutive weeks with at least 1 booking
 * - booking_time:     N bookings in specific time slots
 * - booking_day:      N bookings on specific weekdays
 * - booking_partners: N unique partners in a period
 * - manual:           Operator completes manually (no auto-evaluation)
 *
 * trigger_config examples:
 * { "count": 3, "period": "week" }
 * { "count": 10, "period": "month" }
 * { "count": 1, "period": "lifetime" }
 * { "weeks": 4 }
 * { "count": 3, "period": "month", "time_start": "08:00", "time_end": "12:00" }
 * { "count": 1, "period": "week", "days": [1,2,3,4] }
 * { "count": 5, "period": "month" }  (for partners)
 */

const db = require('../db');

// ─── Period Helpers ─────────────────────────────────────

function getWeekBounds() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

function getMonthBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function getCustomRangeBounds(config) {
  // For seasonal challenges like "Estate in Campo" (Jun-Aug)
  if (config.start_month !== undefined && config.end_month !== undefined) {
    const now = new Date();
    const year = now.getFullYear();
    const start = new Date(year, config.start_month - 1, 1);
    const end = new Date(year, config.end_month, 0, 23, 59, 59, 999);
    return { start, end };
  }
  return null;
}

function getPeriodBounds(period, config = {}) {
  switch (period) {
    case 'week': return getWeekBounds();
    case 'month': return getMonthBounds();
    case 'custom': return getCustomRangeBounds(config);
    case 'lifetime': return { start: new Date('2020-01-01'), end: new Date() };
    default: return { start: new Date('2020-01-01'), end: new Date() };
  }
}

function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  return `${d.getFullYear()}-${String(weekNum).padStart(2, '0')}`;
}

// ─── Evaluators per trigger type ────────────────────────

async function evaluateBookingCount(challenge, member, brand_id) {
  const config = challenge.trigger_config || {};
  const targetCount = config.count || 1;
  const period = config.period || 'lifetime';
  const bounds = getPeriodBounds(period, config);

  const { count } = await db.countMemberBookings(brand_id, member.id, bounds.start, bounds.end);

  return {
    current_count: count,
    target_count: targetCount,
    period_start: bounds.start,
    period_end: bounds.end,
    completed: count >= targetCount
  };
}

async function evaluateBookingStreak(challenge, member, brand_id) {
  const config = challenge.trigger_config || {};
  const targetWeeks = config.weeks || 4;

  const weeks = await db.getMemberBookingWeeks(brand_id, member.id, targetWeeks + 4);

  // Check consecutive weeks from current week backwards
  const currentWeek = getISOWeek(new Date());
  let streak = 0;

  // Start from current week and go backwards
  const d = new Date();
  for (let i = 0; i < targetWeeks + 4; i++) {
    const checkDate = new Date(d);
    checkDate.setDate(d.getDate() - (i * 7));
    const weekKey = getISOWeek(checkDate);

    if (weeks.includes(weekKey)) {
      streak++;
    } else if (i === 0) {
      // Current week might not have a booking yet, skip it
      continue;
    } else {
      break; // Streak broken
    }
  }

  return {
    current_count: streak,
    target_count: targetWeeks,
    streak_weeks: streak,
    last_booking_week: weeks[0] || null,
    period_start: new Date('2020-01-01'),
    period_end: new Date(),
    completed: streak >= targetWeeks
  };
}

async function evaluateBookingTime(challenge, member, brand_id) {
  const config = challenge.trigger_config || {};
  const targetCount = config.count || 1;
  const period = config.period || 'month';
  const timeStart = config.time_start || '00:00';
  const timeEnd = config.time_end || '23:59';
  const bounds = getPeriodBounds(period, config);

  // Get all bookings in period, then filter by time
  const { count: totalCount, bookings } = await db.countMemberBookings(brand_id, member.id, bounds.start, bounds.end);

  // Filter by booking time (from booking_date field)
  let filteredCount = 0;
  if (bookings && Array.isArray(bookings)) {
    for (const b of bookings) {
      if (!b.booking_date) continue;
      const bookingDate = new Date(b.booking_date);
      const hours = bookingDate.getHours();
      const minutes = bookingDate.getMinutes();
      const bookingTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

      if (bookingTime >= timeStart && bookingTime <= timeEnd) {
        filteredCount++;
      }
    }
  }

  return {
    current_count: filteredCount,
    target_count: targetCount,
    period_start: bounds.start,
    period_end: bounds.end,
    completed: filteredCount >= targetCount
  };
}

async function evaluateBookingDay(challenge, member, brand_id) {
  const config = challenge.trigger_config || {};
  const targetCount = config.count || 1;
  const period = config.period || 'week';
  const allowedDays = config.days || [1, 2, 3, 4]; // Mon-Thu by default
  const bounds = getPeriodBounds(period, config);

  const { count: totalCount, bookings } = await db.countMemberBookings(brand_id, member.id, bounds.start, bounds.end);

  let filteredCount = 0;
  if (bookings && Array.isArray(bookings)) {
    for (const b of bookings) {
      if (!b.booking_date) continue;
      const bookingDay = new Date(b.booking_date).getDay(); // 0=Sun, 1=Mon...
      if (allowedDays.includes(bookingDay)) {
        filteredCount++;
      }
    }
  }

  return {
    current_count: filteredCount,
    target_count: targetCount,
    period_start: bounds.start,
    period_end: bounds.end,
    completed: filteredCount >= targetCount
  };
}

async function evaluateBookingPartners(challenge, member, brand_id) {
  const config = challenge.trigger_config || {};
  const targetCount = config.count || 5;
  const period = config.period || 'month';
  const bounds = getPeriodBounds(period, config);

  const partnerCount = await db.countMemberUniquePartners(brand_id, member.id, bounds.start, bounds.end);

  return {
    current_count: partnerCount,
    target_count: targetCount,
    period_start: bounds.start,
    period_end: bounds.end,
    completed: partnerCount >= targetCount
  };
}

// ─── Main Evaluator ────────────────────────────────────

const EVALUATORS = {
  booking_count: evaluateBookingCount,
  booking_streak: evaluateBookingStreak,
  booking_time: evaluateBookingTime,
  booking_day: evaluateBookingDay,
  booking_partners: evaluateBookingPartners,
};

/**
 * Evaluate all Playtomic challenges for all members of a brand.
 * Called after booking sync completes.
 */
async function evaluateChallenges(brand_id) {
  try {
    // Get all active Playtomic challenges for this brand
    const allChallenges = await db.listChallenges(brand_id);
    const playtomicChallenges = allChallenges.filter(c =>
      c.active && c.trigger_type !== 'manual' && EVALUATORS[c.trigger_type]
    );

    if (playtomicChallenges.length === 0) {
      return { evaluated: 0, completed: 0, message: 'Nessuna sfida Playtomic attiva' };
    }

    // Get all members with Playtomic data
    const members = await db.getMembersByPlaytomicEmail(brand_id);
    if (members.length === 0) {
      return { evaluated: 0, completed: 0, message: 'Nessun membro Playtomic' };
    }

    let totalEvaluated = 0;
    let totalCompleted = 0;
    const completions = [];

    for (const member of members) {
      for (const challenge of playtomicChallenges) {
        try {
          const evaluator = EVALUATORS[challenge.trigger_type];
          if (!evaluator) continue;

          const result = await evaluator(challenge, member, brand_id);
          totalEvaluated++;

          // Upsert progress
          await db.upsertChallengeProgress({
            challenge_id: challenge.id,
            member_id: member.id,
            brand_id,
            current_count: result.current_count,
            target_count: result.target_count,
            period_start: result.period_start,
            period_end: result.period_end,
            streak_weeks: result.streak_weeks || 0,
            last_booking_week: result.last_booking_week || null,
            status: result.completed ? 'completed' : 'in_progress'
          });

          // If completed, award points (if not already awarded)
          if (result.completed) {
            const awarded = await db.completeChallengeForMember({
              challenge_id: challenge.id,
              member_id: member.id,
              brand_id
            });
            if (awarded) {
              totalCompleted++;
              completions.push({
                member: `${member.first_name} ${member.last_name}`,
                challenge: challenge.title,
                points: challenge.points
              });
            }
          }
        } catch (e) {
          console.error(`[Challenges] Error evaluating ${challenge.title} for member ${member.id}:`, e.message);
        }
      }
    }

    if (totalCompleted > 0) {
      console.log(`[Challenges] ✓ ${totalCompleted} sfide completate automaticamente:`);
      completions.forEach(c => console.log(`  → ${c.member}: ${c.challenge} (+${c.points} pts)`));
    }

    return { evaluated: totalEvaluated, completed: totalCompleted, completions };
  } catch (error) {
    console.error('[Challenges] Fatal error in evaluateChallenges:', error.message);
    return { evaluated: 0, completed: 0, error: error.message };
  }
}

module.exports = {
  evaluateChallenges
};
