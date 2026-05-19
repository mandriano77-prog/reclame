/**
 * Unified behavioral event store for pass holders (opens, clicks, games, ads).
 */
const { pool } = require('../db');

const LEGACY_EVENT_MAP = {
  pass_created: { category: 'pass', action: 'created' },
  pass_downloaded: { category: 'pass', action: 'downloaded' },
  pass_installed: { category: 'pass', action: 'installed' },
  pass_removed: { category: 'pass', action: 'removed' },
  pass_fetched: { category: 'pass', action: 'opened' },
  google_wallet_link_generated: { category: 'pass', action: 'google_link_created' },
  google_wallet_installed: { category: 'pass', action: 'google_installed' },
  google_wallet_removed: { category: 'pass', action: 'google_removed' },
  samsung_wallet_link_generated: { category: 'pass', action: 'samsung_link_created' },
  scheduled_push_sent: { category: 'push', action: 'scheduled_sent' }
};

function mapLegacyEventType(eventType) {
  if (!eventType) return null;
  if (LEGACY_EVENT_MAP[eventType]) return LEGACY_EVENT_MAP[eventType];
  if (eventType.startsWith('instant_win_')) {
    return { category: 'game', action: eventType === 'instant_win_win' ? 'instant_win_won' : 'instant_win_played', target_type: 'instant_win' };
  }
  if (eventType.startsWith('gamification_')) {
    return { category: 'game', action: 'gamification_played', target_type: 'gamification' };
  }
  return { category: 'system', action: eventType };
}

async function logHolderEvent(data) {
  const {
    brand_id,
    pass_id = null,
    serial_number = null,
    event_category,
    event_action,
    target_type = null,
    target_key = null,
    target_label = null,
    target_url = null,
    device_id = null,
    session_id = null,
    metadata = {}
  } = data;
  if (!brand_id || !event_category || !event_action) {
    throw new Error('brand_id, event_category and event_action required');
  }
  const meta = typeof metadata === 'string' ? JSON.parse(metadata) : (metadata || {});
  await pool.query(
    `INSERT INTO holder_events (
      brand_id, pass_id, serial_number, event_category, event_action,
      target_type, target_key, target_label, target_url, device_id, session_id, metadata
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      brand_id,
      pass_id,
      serial_number,
      event_category,
      event_action,
      target_type,
      target_key,
      target_label,
      target_url,
      device_id,
      session_id,
      JSON.stringify(meta)
    ]
  );
  return { success: true };
}

async function mirrorLegacyEvent(legacy) {
  if (!legacy?.brand_id || !legacy?.event_type) return;
  const exists = await pool.query(
    `SELECT 1 FROM holder_events WHERE brand_id = $1 AND metadata->>'legacy_event_id' = $2 LIMIT 1`,
    [legacy.brand_id, String(legacy.id)]
  );
  if (exists.rows.length) return;
  const mapped = mapLegacyEventType(legacy.event_type);
  if (!mapped) return;
  const meta = legacy.metadata && typeof legacy.metadata === 'object' ? legacy.metadata : {};
  let serial = meta.serial_number || null;
  if (!serial && legacy.pass_id) {
    const p = await pool.query('SELECT serial_number FROM pass_instances WHERE id = $1', [legacy.pass_id]);
    serial = p.rows[0]?.serial_number || null;
  }
  await logHolderEvent({
    brand_id: legacy.brand_id,
    pass_id: legacy.pass_id,
    serial_number: serial,
    event_category: mapped.category,
    event_action: mapped.action,
    target_type: mapped.target_type || meta.target_type || null,
    target_key: meta.target_key || null,
    target_label: meta.target_label || null,
    target_url: meta.target_url || null,
    device_id: legacy.device_id,
    metadata: { ...meta, legacy_event_id: legacy.id, legacy_event_type: legacy.event_type }
  });
}

async function backfillHolderEventsForBrand(brandId, limit = 5000) {
  const result = await pool.query(
    `SELECT e.* FROM events e
     WHERE e.brand_id = $1
       AND NOT EXISTS (
         SELECT 1 FROM holder_events h
         WHERE h.brand_id = e.brand_id
           AND h.metadata->>'legacy_event_id' = e.id::text
       )
     ORDER BY e.created_at ASC
     LIMIT $2`,
    [brandId, limit]
  );
  for (const row of result.rows) {
    try {
      await mirrorLegacyEvent(row);
    } catch (err) {
      console.error('[holder-events] backfill row', row.id, err.message);
    }
  }
  return { imported: result.rows.length };
}

async function getHolderBehaviorInsights(brandId, days = 30) {
  await backfillHolderEventsForBrand(brandId).catch(() => {});

  const interval = `${Math.min(Math.max(parseInt(days, 10) || 30, 1), 365)} days`;
  const [
    totals,
    uniqueActors,
    byAction,
    topLinks,
    funnel
  ] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS total FROM holder_events
       WHERE brand_id = $1 AND created_at >= NOW() - $2::interval`,
      [brandId, interval]
    ),
    pool.query(
      `SELECT COUNT(DISTINCT COALESCE(serial_number, pass_id::text))::int AS actors
       FROM holder_events
       WHERE brand_id = $1 AND created_at >= NOW() - $2::interval AND serial_number IS NOT NULL`,
      [brandId, interval]
    ),
    pool.query(
      `SELECT event_action, COUNT(*)::int AS count
       FROM holder_events
       WHERE brand_id = $1 AND created_at >= NOW() - $2::interval
       GROUP BY event_action
       ORDER BY count DESC
       LIMIT 20`,
      [brandId, interval]
    ),
    pool.query(
      `SELECT target_key, target_label, target_url, COUNT(*)::int AS clicks
       FROM holder_events
       WHERE brand_id = $1 AND event_action = 'link_click'
         AND created_at >= NOW() - $2::interval
       GROUP BY target_key, target_label, target_url
       ORDER BY clicks DESC
       LIMIT 15`,
      [brandId, interval]
    ),
    pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE event_action = 'created')::int AS created,
        COUNT(*) FILTER (WHERE event_action = 'installed')::int AS installed,
        COUNT(*) FILTER (WHERE event_action = 'opened')::int AS opened,
        COUNT(*) FILTER (WHERE event_action = 'link_click')::int AS link_clicks,
        COUNT(DISTINCT serial_number) FILTER (WHERE event_action = 'link_click')::int AS unique_clickers
       FROM holder_events
       WHERE brand_id = $1 AND created_at >= NOW() - $2::interval`,
      [brandId, interval]
    )
  ]);

  const linkFunnels = await getLinkFunnels(brandId, days);

  return {
    period_days: parseInt(days, 10) || 30,
    total_events: totals.rows[0].total,
    unique_holders_active: uniqueActors.rows[0].actors,
    by_action: byAction.rows,
    top_link_clicks: topLinks.rows,
    funnel: funnel.rows[0],
    link_funnels: linkFunnels
  };
}

async function getLinkFunnels(brandId, days = 30) {
  const sinceDays = Math.min(Math.max(parseInt(days, 10) || 30, 1), 365);
  const [passTotal, installed, opened, linkRows] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS total FROM pass_instances WHERE brand_id = $1', [brandId]),
    pool.query(
      `SELECT COUNT(DISTINCT serial_number)::int AS count FROM holder_events
       WHERE brand_id = $1 AND event_action = 'installed'
         AND serial_number IS NOT NULL
         AND created_at >= NOW() - INTERVAL '${sinceDays} days'`,
      [brandId]
    ),
    pool.query(
      `SELECT COUNT(DISTINCT serial_number)::int AS count FROM holder_events
       WHERE brand_id = $1 AND event_action = 'opened'
         AND serial_number IS NOT NULL
         AND created_at >= NOW() - INTERVAL '${sinceDays} days'`,
      [brandId]
    ),
    pool.query(
      `SELECT target_key,
        MAX(target_label) AS target_label,
        COUNT(*)::int AS click_events,
        COUNT(DISTINCT serial_number)::int AS unique_clickers
       FROM holder_events
       WHERE brand_id = $1 AND event_action = 'link_click'
         AND target_key IS NOT NULL AND target_key <> ''
         AND created_at >= NOW() - INTERVAL '${sinceDays} days'
       GROUP BY target_key
       ORDER BY click_events DESC`,
      [brandId]
    )
  ]);

  const holders = passTotal.rows[0].total;
  const installedN = installed.rows[0].count;
  const openedN = opened.rows[0].count;

  return linkRows.rows.map((row) => {
    const clickers = row.unique_clickers;
    return {
      target_key: row.target_key,
      target_label: row.target_label,
      pass_holders: holders,
      installed: installedN,
      opened: openedN,
      click_events: row.click_events,
      unique_clickers: clickers,
      ctr_from_opened_pct: openedN > 0 ? Math.round((clickers / openedN) * 1000) / 10 : 0,
      ctr_from_holders_pct: holders > 0 ? Math.round((clickers / holders) * 1000) / 10 : 0
    };
  });
}

async function exportHolderEvents(brandId, { days = 30, limit = 10000, action = null } = {}) {
  const sinceDays = Math.min(Math.max(parseInt(days, 10) || 30, 1), 365);
  const lim = Math.min(Math.max(parseInt(limit, 10) || 10000, 1), 50000);
  const params = [brandId];
  let actionSql = '';
  if (action) {
    params.push(action);
    actionSql = ` AND h.event_action = $${params.length}`;
  }
  params.push(lim);
  const result = await pool.query(
    `SELECT h.id, h.brand_id, h.pass_id, h.serial_number, h.event_category, h.event_action,
      h.target_type, h.target_key, h.target_label, h.target_url, h.device_id, h.created_at
     FROM holder_events h
     WHERE h.brand_id = $1
       AND h.created_at >= NOW() - INTERVAL '${sinceDays} days'${actionSql}
     ORDER BY h.created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return result.rows;
}

async function listRecentHolderEvents(brandId, { limit = 50, action = null } = {}) {
  const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const params = [brandId];
  let actionSql = '';
  if (action) {
    params.push(action);
    actionSql = ` AND event_action = $${params.length}`;
  }
  params.push(lim);
  const result = await pool.query(
    `SELECT h.*, p.campaign_id
     FROM holder_events h
     LEFT JOIN pass_instances p ON p.id = h.pass_id
     WHERE h.brand_id = $1${actionSql}
     ORDER BY h.created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return result.rows;
}

module.exports = {
  logHolderEvent,
  mirrorLegacyEvent,
  backfillHolderEventsForBrand,
  getHolderBehaviorInsights,
  getLinkFunnels,
  exportHolderEvents,
  listRecentHolderEvents,
  mapLegacyEventType,
  LEGACY_EVENT_MAP
};
