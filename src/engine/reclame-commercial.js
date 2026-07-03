/**
 * Reclame — commercial calendar, package inventory, billing take-rate.
 */
const { pool, getBrand, updateBrand } = require('../db');
const { runBookingFormatActions, bookingOfferId } = require('./reclame-booking-actions');

const PACKAGE_CATALOG = Object.freeze({
  starter: {
    key: 'starter',
    label: 'Starter',
    description: 'Entry — 1 push + 1 slot HUB sponsor',
    inventory: { push_lockscreen: 1, hub_sponsored: 1, geofence_recall: 0, coupon_cpa: 1 },
    suggested_price_cents: 250000
  },
  pro: {
    key: 'pro',
    label: 'Pro',
    description: 'Campagna multi-canale con geofence',
    inventory: { push_lockscreen: 3, hub_sponsored: 2, geofence_recall: 2, coupon_cpa: 3 },
    suggested_price_cents: 750000
  },
  premium: {
    key: 'premium',
    label: 'Premium',
    description: 'Massima visibilità + CPA',
    inventory: { push_lockscreen: 6, hub_sponsored: 4, geofence_recall: 4, coupon_cpa: 6 },
    suggested_price_cents: 1500000
  },
  burst: {
    key: 'burst',
    label: 'Burst',
    description: 'Weekend / evento flash',
    inventory: { push_lockscreen: 2, hub_sponsored: 1, geofence_recall: 1, coupon_cpa: 2 },
    suggested_price_cents: 400000
  },
  annual: {
    key: 'annual',
    label: 'Annual',
    description: 'Presenza continuativa brand-tenant',
    inventory: { push_lockscreen: 24, hub_sponsored: 12, geofence_recall: 12, coupon_cpa: 24 },
    suggested_price_cents: 6000000
  }
});

const FORMAT_LABELS = Object.freeze({
  push_lockscreen: 'Push lockscreen',
  hub_sponsored: 'HUB sponsorizzato',
  geofence_recall: 'Geofencing richiamo',
  coupon_cpa: 'Coupon CPA cassa'
});

const DEFAULT_TAKE_RATE_PCT = Number(process.env.RECLAME_TAKE_RATE_PCT || 15);
const DEFAULT_RETAILER_SHARE_PCT = Number(process.env.RECLAME_RETAILER_SHARE_PCT || 70);

function listPackages() {
  return Object.values(PACKAGE_CATALOG);
}

function getPackage(key) {
  return PACKAGE_CATALOG[String(key || '').toLowerCase()] || null;
}

function computeBillingSplit(grossCents, retailerSharePct = DEFAULT_RETAILER_SHARE_PCT, takeRatePct = DEFAULT_TAKE_RATE_PCT) {
  const gross = Math.max(0, parseInt(grossCents, 10) || 0);
  const reclame = Math.round(gross * (takeRatePct / 100));
  const retailer = Math.round(gross * (retailerSharePct / 100));
  return { gross_cents: gross, retailer_cents: retailer, reclame_cents: reclame, take_rate_pct: takeRatePct, retailer_share_pct: retailerSharePct };
}

async function countOverlappingBookings(brandId, format, startAt, endAt, excludeBookingId = null) {
  const start = startAt ? new Date(startAt) : new Date();
  let end = endAt ? new Date(endAt) : new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(start.getTime())) throw new Error('Data inizio non valida');
  if (Number.isNaN(end.getTime())) end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);

  const params = [brandId, format, end.toISOString(), start.toISOString()];
  let sql = `SELECT COUNT(*)::int AS cnt FROM commercial_bookings
    WHERE brand_id = $1 AND format = $2 AND status NOT IN ('cancelled')
    AND (start_at IS NULL OR start_at <= $3)
    AND (end_at IS NULL OR end_at >= $4)`;
  if (excludeBookingId) {
    params.push(excludeBookingId);
    sql += ` AND id <> $${params.length}`;
  }
  const res = await pool.query(sql, params);
  return res.rows[0]?.cnt || 0;
}

function getFormatCapacity(brand, format) {
  const custom = brand?.config?.commercial_inventory?.[format];
  if (custom != null && custom !== '') {
    const n = parseInt(custom, 10);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return PACKAGE_CATALOG.annual.inventory[format] || 1;
}

async function assertFormatInventoryAvailable(brandId, format, startAt, endAt) {
  const brand = await getBrand(brandId);
  if (!brand) throw new Error('Brand non trovato');
  const capacity = getFormatCapacity(brand, format);
  const booked = await countOverlappingBookings(brandId, format, startAt, endAt);
  if (booked >= capacity) {
    throw new Error(
      `Inventory esaurito per ${FORMAT_LABELS[format] || format}: ${booked}/${capacity} slot nel periodo`
    );
  }
  return { capacity, booked, available: capacity - booked };
}

async function countBookingsByFormat(brandId, { from, to } = {}) {
  const params = [brandId];
  let windowSql = '';
  if (from) {
    params.push(from);
    windowSql += ` AND (end_at IS NULL OR end_at >= $${params.length})`;
  }
  if (to) {
    params.push(to);
    windowSql += ` AND (start_at IS NULL OR start_at <= $${params.length})`;
  }
  const res = await pool.query(
    `SELECT format, COUNT(*)::int AS booked
     FROM commercial_bookings
     WHERE brand_id = $1 AND status NOT IN ('cancelled')
     ${windowSql}
     GROUP BY format`,
    params
  );
  const map = {};
  res.rows.forEach((r) => { map[r.format] = r.booked; });
  return map;
}

async function getCommercialCalendar(brandId, { from, to } = {}) {
  const brand = await getBrand(brandId);
  const takeRate = brand?.config?.reclame_take_rate_pct ?? DEFAULT_TAKE_RATE_PCT;
  const retailerShare = brand?.config?.retailer_share_pct ?? DEFAULT_RETAILER_SHARE_PCT;
  const booked = await countBookingsByFormat(brandId, { from, to });
  const packages = listPackages();
  const formatCapacities = {};
  Object.keys(FORMAT_LABELS).forEach((f) => {
    formatCapacities[f] = getFormatCapacity(brand, f);
  });
  const inventory = packages.map((pkg) => ({
    ...pkg,
    formats: Object.entries(pkg.inventory).map(([format, slots]) => {
      const bookedN = booked[format] || 0;
      const cap = formatCapacities[format] || slots;
      return {
        format,
        label: FORMAT_LABELS[format] || format,
        package_slots: slots,
        capacity: cap,
        booked: bookedN,
        available: Math.max(0, cap - bookedN),
      };
    })
  }));
  const bookings = await listCommercialBookings(brandId, { from, to, limit: 200 });
  const billing = await getCommercialBillingSummary(brandId);
  const billingEntries = await listCommercialBillingEntries(brandId, { limit: 100 });
  const tenantPerformance = await getTenantPerformanceSummary(brandId, { from, to });
  return {
    packages: inventory,
    bookings,
    billing,
    billing_entries: billingEntries,
    tenant_performance: tenantPerformance,
    take_rate_pct: takeRate,
    retailer_share_pct: retailerShare
  };
}

async function listCommercialBookings(brandId, { status, from, to, limit = 100 } = {}) {
  const params = [brandId];
  let sql = `SELECT * FROM commercial_bookings WHERE brand_id = $1`;
  if (status) {
    params.push(status);
    sql += ` AND status = $${params.length}`;
  }
  if (from) {
    params.push(from);
    sql += ` AND (end_at IS NULL OR end_at >= $${params.length})`;
  }
  if (to) {
    params.push(to);
    sql += ` AND (start_at IS NULL OR start_at <= $${params.length})`;
  }
  params.push(Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500));
  sql += ` ORDER BY start_at ASC NULLS LAST, created_at DESC LIMIT $${params.length}`;
  const res = await pool.query(sql, params);
  return res.rows;
}

async function createCommercialBooking(brandId, data) {
  const pkg = getPackage(data.package_key);
  if (!pkg) throw new Error('Pacchetto non valido');
  const format = String(data.format || '').trim();
  if (!FORMAT_LABELS[format]) throw new Error('Formato non valido');
  if (!pkg.inventory[format]) throw new Error('Formato non incluso nel pacchetto');
  const tenant = String(data.tenant_name || '').trim();
  if (!tenant) throw new Error('Nome brand-tenant obbligatorio');

  const startAt = data.start_at || new Date().toISOString();
  const endAt = data.end_at || null;
  await assertFormatInventoryAvailable(brandId, format, startAt, endAt);

  const gross = data.amount_cents != null ? parseInt(data.amount_cents, 10) : pkg.suggested_price_cents;
  const retailerPct = data.retailer_share_pct ?? DEFAULT_RETAILER_SHARE_PCT;
  const takeRate = data.reclame_take_rate_pct ?? DEFAULT_TAKE_RATE_PCT;
  const split = computeBillingSplit(gross, retailerPct, takeRate);
  const id = data.id || `cb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const res = await pool.query(
    `INSERT INTO commercial_bookings (
      id, brand_id, tenant_name, package_key, format, status,
      start_at, end_at, amount_cents, retailer_share_pct, reclame_take_rate_pct,
      merchant_id, metadata
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    RETURNING *`,
    [
      id,
      brandId,
      tenant.slice(0, 120),
      pkg.key,
      format,
      data.status || 'confirmed',
      startAt,
      endAt,
      split.gross_cents,
      split.retailer_share_pct,
      split.take_rate_pct,
      data.merchant_id || null,
      JSON.stringify(data.metadata || {})
    ]
  );
  const booking = res.rows[0];

  await pool.query(
    `INSERT INTO commercial_billing_entries (
      brand_id, booking_id, tenant_name, gross_cents, retailer_cents, reclame_cents, status
    ) VALUES ($1,$2,$3,$4,$5,$6,'pending')`,
    [brandId, booking.id, tenant, split.gross_cents, split.retailer_cents, split.reclame_cents]
  );

  if (format === 'hub_sponsored' && data.merchant_id) {
    await pool.query(
      `UPDATE merchants SET sponsored = TRUE, sponsored_rank = COALESCE(sponsored_rank, 0) + 10
       WHERE id = $1 AND brand_id = $2`,
      [data.merchant_id, brandId]
    );
  }

  if (format === 'geofence_recall') {
    await applyGeofenceFromBooking(brandId, booking, data);
  }

  let actions = {};
  try {
    actions = await runBookingFormatActions(brandId, booking, data);
  } catch (actionErr) {
    console.warn('[commercial] booking actions:', actionErr.message);
    actions = { error: actionErr.message };
  }

  const refreshed = await pool.query(
    'SELECT * FROM commercial_bookings WHERE id = $1 AND brand_id = $2',
    [booking.id, brandId]
  );
  const row = refreshed.rows[0] || booking;
  row._actions = actions;
  return row;
}

function parseBookingMeta(booking) {
  if (!booking) return {};
  if (typeof booking.metadata === 'object' && booking.metadata) return booking.metadata;
  try { return JSON.parse(booking.metadata || '{}'); } catch (_) { return {}; }
}

async function applyGeofenceFromBooking(brandId, booking, data) {
  const brand = await getBrand(brandId);
  if (!brand) return;
  const cfg = brand.config || {};
  const locations = Array.isArray(cfg.locations) ? [...cfg.locations] : [];
  const meta = parseBookingMeta(booking);
  const poi = data.poi || meta.poi || {};
  const lat = parseFloat(poi.latitude);
  const lon = parseFloat(poi.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
  locations.push({
    latitude: lat,
    longitude: lon,
    relevantText: String(poi.relevantText || booking.tenant_name || 'Offerta vicina').slice(0, 120),
    name: String(poi.name || booking.tenant_name || 'POI').slice(0, 80),
    radius: parseInt(poi.radius, 10) || 300,
    address: String(poi.address || '').slice(0, 500),
    booking_id: booking.id
  });
  cfg.locations = locations.slice(-40);
  cfg.geofencing_channel = cfg.geofencing_channel || 'apple';
  await updateBrand(brandId, { config: cfg });
}

async function getCommercialBillingSummary(brandId) {
  const res = await pool.query(
    `SELECT
      COUNT(*)::int AS entries,
      COALESCE(SUM(gross_cents), 0)::int AS gross_cents,
      COALESCE(SUM(retailer_cents), 0)::int AS retailer_cents,
      COALESCE(SUM(reclame_cents), 0)::int AS reclame_cents,
      COUNT(*) FILTER (WHERE status = 'pending')::int AS pending
     FROM commercial_billing_entries
     WHERE brand_id = $1`,
    [brandId]
  );
  return res.rows[0] || { entries: 0, gross_cents: 0, retailer_cents: 0, reclame_cents: 0, pending: 0 };
}

async function updateBookingStatus(brandId, bookingId, status) {
  const allowed = new Set(['pending', 'confirmed', 'live', 'completed', 'cancelled']);
  if (!allowed.has(status)) throw new Error('Stato non valido');
  const res = await pool.query(
    `UPDATE commercial_bookings SET status = $3, updated_at = NOW()
     WHERE id = $1 AND brand_id = $2 RETURNING *`,
    [bookingId, brandId, status]
  );
  if (!res.rows.length) throw new Error('Prenotazione non trovata');
  if (status === 'cancelled') {
    const row = res.rows[0];
    if (row.format === 'hub_sponsored' && row.merchant_id) {
      await pool.query(
        `UPDATE merchants SET sponsored = FALSE WHERE id = $1 AND brand_id = $2`,
        [row.merchant_id, brandId]
      );
    }
  }
  return res.rows[0];
}

async function getBookingPerformance(brandId, bookingId) {
  const res = await pool.query(
    'SELECT * FROM commercial_bookings WHERE brand_id = $1 AND id = $2',
    [brandId, bookingId]
  );
  const booking = res.rows[0];
  if (!booking) return null;

  const offerId = bookingOfferId(bookingId);
  const meta = parseBookingMeta(booking);

  const [clicksRes, redeemRes, redeemEvtRes] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS cnt FROM holder_events
       WHERE brand_id = $1 AND event_action = 'link_click'
         AND (metadata->>'booking_id' = $2)`,
      [brandId, bookingId]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS cnt, COUNT(DISTINCT serial_number)::int AS unique_holders
       FROM coupon_redemptions WHERE brand_id = $1 AND offer_id = $2`,
      [brandId, offerId]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS cnt FROM holder_events
       WHERE brand_id = $1 AND event_action = 'coupon_redeemed'
         AND metadata->>'booking_id' = $2`,
      [brandId, bookingId]
    ),
  ]);

  const linkClicks = clicksRes.rows[0]?.cnt || 0;
  const couponRedemptions = Math.max(
    redeemRes.rows[0]?.cnt || 0,
    redeemEvtRes.rows[0]?.cnt || 0
  );
  const pushSent = parseInt(meta.push_sent, 10) || 0;

  return {
    booking_id: bookingId,
    tenant_name: booking.tenant_name,
    format: booking.format,
    status: booking.status,
    link_clicks: linkClicks,
    coupon_redemptions: couponRedemptions,
    unique_redeemers: redeemRes.rows[0]?.unique_holders || 0,
    push_sent: pushSent,
    tap_to_redeem_pct: linkClicks > 0 ? Math.round((couponRedemptions / linkClicks) * 1000) / 10 : null,
    metadata: meta,
  };
}

async function getTenantPerformanceSummary(brandId, { from, to } = {}) {
  const bookings = await listCommercialBookings(brandId, { from, to, limit: 200 });
  const rows = await Promise.all(
    bookings.map((b) => getBookingPerformance(brandId, b.id))
  );
  return rows.filter(Boolean);
}

async function listCommercialBillingEntries(brandId, { status, limit = 200 } = {}) {
  const params = [brandId];
  let sql = `SELECT * FROM commercial_billing_entries WHERE brand_id = $1`;
  if (status) {
    params.push(status);
    sql += ` AND status = $${params.length}`;
  }
  params.push(Math.min(Math.max(parseInt(limit, 10) || 200, 1), 500));
  sql += ` ORDER BY created_at DESC LIMIT $${params.length}`;
  const res = await pool.query(sql, params);
  return res.rows;
}

async function updateBillingEntryStatus(brandId, entryId, status) {
  const allowed = new Set(['pending', 'paid', 'cancelled']);
  if (!allowed.has(status)) throw new Error('Stato fatturazione non valido');
  const paidAt = status === 'paid' ? new Date().toISOString() : null;
  const res = await pool.query(
    `UPDATE commercial_billing_entries
     SET status = $3, paid_at = COALESCE($4::timestamptz, paid_at)
     WHERE id = $1 AND brand_id = $2
     RETURNING *`,
    [entryId, brandId, status, paidAt]
  );
  if (!res.rows.length) throw new Error('Voce fatturazione non trovata');
  return res.rows[0];
}

function billingEntriesToCsv(rows) {
  const header = ['id', 'booking_id', 'tenant_name', 'gross_eur', 'retailer_eur', 'reclame_eur', 'status', 'paid_at', 'created_at'];
  const lines = [header.join(';')];
  (rows || []).forEach((r) => {
    lines.push([
      r.id,
      r.booking_id || '',
      `"${String(r.tenant_name || '').replace(/"/g, '""')}"`,
      (r.gross_cents / 100).toFixed(2),
      (r.retailer_cents / 100).toFixed(2),
      (r.reclame_cents / 100).toFixed(2),
      r.status,
      r.paid_at ? new Date(r.paid_at).toISOString() : '',
      r.created_at ? new Date(r.created_at).toISOString() : '',
    ].join(';'));
  });
  return lines.join('\n');
}

async function exportCommercialBillingCsv(brandId) {
  const rows = await listCommercialBillingEntries(brandId, { limit: 500 });
  return billingEntriesToCsv(rows);
}

module.exports = {
  PACKAGE_CATALOG,
  FORMAT_LABELS,
  listPackages,
  getPackage,
  computeBillingSplit,
  getFormatCapacity,
  assertFormatInventoryAvailable,
  countOverlappingBookings,
  getCommercialCalendar,
  listCommercialBookings,
  createCommercialBooking,
  updateBookingStatus,
  getCommercialBillingSummary,
  listCommercialBillingEntries,
  updateBillingEntryStatus,
  exportCommercialBillingCsv,
  getBookingPerformance,
  getTenantPerformanceSummary,
  applyGeofenceFromBooking,
  DEFAULT_TAKE_RATE_PCT,
  DEFAULT_RETAILER_SHARE_PCT
};
