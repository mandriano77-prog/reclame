/**
 * Points Decay Engine (Loop module)
 *
 * Runs monthly: members with no activity in the last 30 days lose 10 points.
 * Points cannot go below 0. Decay is logged in points_log with reason 'decay'.
 */

const { pool } = require('../db');
const { v4: uuidv4 } = require('uuid');

const DECAY_POINTS = 10;
const INACTIVITY_DAYS = 30;

/**
 * Run decay for all brands
 */
async function runPointsDecay() {
  console.log('[PointsDecay] Starting monthly points decay check...');

  try {
    // Get all active brands
    const brandsRes = await pool.query('SELECT id, name FROM brands');
    const brands = brandsRes.rows;

    let totalDecayed = 0;

    for (const brand of brands) {
      const count = await runBrandDecay(brand);
      totalDecayed += count;
    }

    console.log(`[PointsDecay] Done — ${totalDecayed} members decayed across ${brands.length} brands`);
    return totalDecayed;
  } catch (err) {
    console.error('[PointsDecay] Error:', err.message);
    return 0;
  }
}

/**
 * Run decay for a single brand
 */
async function runBrandDecay(brand) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - INACTIVITY_DAYS);

  // Find members with active passes who had NO points_log activity in the last 30 days
  // and whose current points (field_values->>'punti') > 0
  const res = await pool.query(`
    SELECT m.id as member_id, p.id as pass_id,
           COALESCE(CAST(p.field_values->>'punti' AS INTEGER), 0) as current_points
    FROM members m
    JOIN pass_instances p ON (
      p.customer_data->>'member_id' = m.id
      OR p.field_values->>'member_id' = m.id
    )
    WHERE m.brand_id = $1
      AND p.status = 'active'
      AND COALESCE(CAST(p.field_values->>'punti' AS INTEGER), 0) > 0
      AND NOT EXISTS (
        SELECT 1 FROM points_log pl
        WHERE pl.member_id = m.id
          AND pl.brand_id = $1
          AND pl.reason != 'decay'
          AND pl.created_at > $2
      )
  `, [brand.id, cutoffDate.toISOString()]);

  let decayed = 0;

  for (const row of res.rows) {
    const newPoints = Math.max(0, row.current_points - DECAY_POINTS);
    const pointsLost = row.current_points - newPoints;

    if (pointsLost <= 0) continue;

    try {
      // Log the decay
      const logId = uuidv4();
      await pool.query(
        `INSERT INTO points_log (id, brand_id, member_id, pass_id, points, reason, details) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [logId, brand.id, row.member_id, row.pass_id, -pointsLost, 'decay', `Decadimento mensile: -${pointsLost} punti per inattività`]
      );

      // Update pass points
      await pool.query(
        `UPDATE pass_instances
         SET field_values = jsonb_set(field_values, '{punti}', $1::jsonb),
             last_updated = NOW()
         WHERE id = $2`,
        [JSON.stringify(String(newPoints)), row.pass_id]
      );

      decayed++;
      console.log(`[PointsDecay] ${brand.name}: member ${row.member_id} — ${row.current_points} → ${newPoints} (-${pointsLost})`);
    } catch (e) {
      console.error(`[PointsDecay] Error decaying member ${row.member_id}:`, e.message);
    }
  }

  if (decayed > 0) {
    console.log(`[PointsDecay] ${brand.name}: ${decayed} members decayed`);
  }

  return decayed;
}

/**
 * Start the monthly decay cron
 * Runs on the 1st of every month at 3:00 AM
 */
function startDecayCron() {
  function scheduleNext() {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1, 3, 0, 0, 0);
    const ms = next.getTime() - now.getTime();
    console.log(`[PointsDecay] Next decay scheduled for ${next.toISOString()} (in ${Math.round(ms / 3600000)}h)`);
    setTimeout(async () => {
      await runPointsDecay();
      scheduleNext();
    }, ms);
  }
  scheduleNext();
}

module.exports = { runPointsDecay, startDecayCron };
