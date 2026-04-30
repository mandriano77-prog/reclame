/**
 * Playtomic Sync Engine
 *
 * Handles:
 * 1. OAuth authentication with token refresh
 * 2. Player sync — match Playtomic players with Nudj members by email
 * 3. Booking sync — fetch completed bookings, award points to matched members
 *
 * API Reference: https://third-party.playtomic.io/
 * Rate limit: 400 requests / 10 minutes
 * Token expires: 1 hour
 */

const db = require('../db');
const { evaluateChallenges } = require('./challenges');

const PLAYTOMIC_BASE = 'https://thirdparty.playtomic.io';

// ─── Token Cache (per brand) ────────────────────────────

const tokenCache = new Map(); // brand_id → { token, expires_at }

async function getToken(brand_id, client_id, secret) {
  const cached = tokenCache.get(brand_id);
  // Refresh 5 minutes before expiry
  if (cached && cached.expires_at > Date.now() + 5 * 60 * 1000) {
    return cached.token;
  }

  const resp = await fetchWithRetry(`${PLAYTOMIC_BASE}/api/v1/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id, secret })
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Playtomic auth failed (${resp.status}): ${err}`);
  }

  const data = await resp.json();
  tokenCache.set(brand_id, {
    token: data.token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000
  });

  return data.token;
}

// ─── Fetch with Exponential Backoff ─────────────────────

async function fetchWithRetry(url, options, maxRetries = 3) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const resp = await fetch(url, options);
      if (resp.status === 429) {
        // Rate limited — wait and retry
        const waitMs = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s, 16s
        console.log(`[Playtomic] Rate limited, waiting ${waitMs}ms...`);
        await sleep(waitMs);
        continue;
      }
      return resp;
    } catch (e) {
      lastError = e;
      if (attempt < maxRetries) {
        const waitMs = Math.pow(2, attempt) * 1000;
        console.log(`[Playtomic] Request failed, retrying in ${waitMs}ms...`, e.message);
        await sleep(waitMs);
      }
    }
  }
  throw lastError || new Error('Max retries exceeded');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Player Sync ────────────────────────────────────────

/**
 * Sync Playtomic players with Nudj members.
 * Matches by email (playtomic_email), saves playtomic_player_id for future direct matching.
 */
async function syncPlayers(brand_id, config) {
  const { client_id, secret, tenant_id } = config;
  const token = await getToken(brand_id, client_id, secret);

  // Get all Nudj members with playtomic_email set
  const members = await db.getMembersByPlaytomicEmail(brand_id);
  if (members.length === 0) {
    return { matched: 0, total_players: 0, message: 'Nessun membro con email Playtomic' };
  }

  // Build email → member map (lowercase for matching)
  const emailMap = new Map();
  members.forEach(m => {
    if (m.playtomic_email) emailMap.set(m.playtomic_email.toLowerCase(), m);
    if (m.email) emailMap.set(m.email.toLowerCase(), m);
  });

  let matched = 0;
  let totalPlayers = 0;
  const matchDetails = []; // { member_name, email, player_id }
  let cursor = null;
  let hasMore = true;

  while (hasMore) {
    let url = `${PLAYTOMIC_BASE}/api/v1/venues/${tenant_id}/players?limit=100`;
    if (cursor) url += `&cursor_id=${cursor}`;

    const resp = await fetchWithRetry(url, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!resp.ok) {
      if (resp.status === 401 || resp.status === 403) {
        tokenCache.delete(brand_id);
        const newToken = await getToken(brand_id, client_id, secret);
        const retryResp = await fetchWithRetry(url, {
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${newToken}` }
        });
        if (!retryResp.ok) throw new Error(`Player fetch failed: ${retryResp.status}`);
        var result = await retryResp.json();
      } else {
        throw new Error(`Player fetch failed: ${resp.status}`);
      }
    } else {
      var result = await resp.json();
    }

    const players = result.data || [];
    totalPlayers += players.length;

    for (const player of players) {
      if (!player.email) continue;
      const member = emailMap.get(player.email.toLowerCase());
      if (member && member.playtomic_player_id !== player.player_id) {
        await db.updateMemberPlaytomic(member.id, {
          playtomic_player_id: player.player_id,
          playtomic_accepts_marketing: player.accepts_commercial_communications || false
        });
        matched++;
        matchDetails.push({
          member_name: `${member.first_name || ''} ${member.last_name || ''}`.trim(),
          email: player.email,
          player_id: player.player_id
        });
      }
    }

    hasMore = result.has_more === true;
    cursor = result.next_cursor_id || null;
  }

  return { matched, total_players: totalPlayers, match_details: matchDetails };
}

// ─── Booking Sync ───────────────────────────────────────

/**
 * Fetch completed bookings and log them for challenge evaluation.
 * Only processes FINISHED bookings not yet in sync_log.
 * Points are awarded by the challenge evaluator, not here.
 */
async function syncBookings(brand_id, config) {
  const { client_id, secret, tenant_id } = config;
  const token = await getToken(brand_id, client_id, secret);

  // Get all members with playtomic data for matching
  const members = await db.getMembersByPlaytomicEmail(brand_id);
  if (members.length === 0) {
    return { processed: 0, message: 'Nessun membro con email Playtomic' };
  }

  // Build lookup maps
  const playerIdMap = new Map(); // playtomic_player_id → member
  const emailMap = new Map();    // email → member
  members.forEach(m => {
    if (m.playtomic_player_id) playerIdMap.set(m.playtomic_player_id, m);
    if (m.playtomic_email) emailMap.set(m.playtomic_email.toLowerCase(), m);
    if (m.email) emailMap.set(m.email.toLowerCase(), m);
  });

  // Query bookings from last 7 days (adjustable)
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startDate = weekAgo.toISOString().replace('Z', '').split('.')[0];
  const endDate = now.toISOString().replace('Z', '').split('.')[0];

  let processed = 0;
  let page = 0;
  let hasMore = true;

  // Collect raw data for report
  const allBookings = [];      // every booking found from Playtomic
  const matchedBookings = [];  // bookings where participant matched a Nudj member (new)
  const skippedBookings = [];  // bookings already synced (duplicate)
  const unmatchedParticipants = []; // participants with no Nudj member

  while (hasMore) {
    const url = `${PLAYTOMIC_BASE}/api/v1/bookings?tenant_id=${tenant_id}&start_booking_date=${startDate}&end_booking_date=${endDate}&status=FINISHED&page=${page}&size=200`;

    const resp = await fetchWithRetry(url, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!resp.ok) {
      if (resp.status === 401 || resp.status === 403) {
        tokenCache.delete(brand_id);
        const newToken = await getToken(brand_id, client_id, secret);
        const retryResp = await fetchWithRetry(url, {
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${newToken}` }
        });
        if (!retryResp.ok) throw new Error(`Booking fetch failed: ${retryResp.status}`);
        var bookings = await retryResp.json();
      } else {
        throw new Error(`Booking fetch failed: ${resp.status}`);
      }
    } else {
      var bookings = await resp.json();
    }

    // bookings endpoint returns array directly (page-based)
    const bookingList = Array.isArray(bookings) ? bookings : (bookings.data || bookings);

    for (const booking of bookingList) {
      if (booking.is_canceled) continue;
      if (!booking.participant_info || !booking.participant_info.participants) continue;

      // Collect raw booking info
      const bookingInfo = {
        booking_id: booking.booking_id,
        date: booking.booking_start_date,
        end_date: booking.booking_end_date,
        sport: booking.sport_id || 'N/A',
        court: booking.resource_name || 'N/A',
        participants: (booking.participant_info.participants || []).map(p => ({
          email: p.email || 'N/A',
          name: p.name || p.full_name || '',
          player_id: p.participant_id || ''
        }))
      };
      allBookings.push(bookingInfo);

      for (const participant of booking.participant_info.participants) {
        // Match by player_id first (fast), then by email (fallback)
        let member = null;
        if (participant.participant_id) {
          member = playerIdMap.get(participant.participant_id);
        }
        if (!member && participant.email) {
          member = emailMap.get(participant.email.toLowerCase());
        }

        if (!member) {
          unmatchedParticipants.push({
            email: participant.email || 'N/A',
            name: participant.name || participant.full_name || '',
            booking_id: booking.booking_id,
            date: booking.booking_start_date,
            court: booking.resource_name || 'N/A'
          });
          continue;
        }

        // Check if already synced
        const alreadySynced = await db.isBookingSynced(brand_id, booking.booking_id, member.id);
        if (alreadySynced) {
          skippedBookings.push({
            booking_id: booking.booking_id,
            member_name: `${member.first_name || ''} ${member.last_name || ''}`.trim(),
            email: participant.email || '',
            date: booking.booking_start_date,
            court: booking.resource_name || 'N/A',
            reason: 'già sincronizzato'
          });
          continue;
        }

        // Log the booking (points are awarded by challenge evaluator)
        await db.addSyncLogEntry({
          brand_id,
          booking_id: booking.booking_id,
          member_id: member.id,
          participant_email: participant.email || '',
          points_awarded: 0,
          booking_date: booking.booking_start_date,
          sport_id: booking.sport_id,
          resource_name: booking.resource_name
        });

        matchedBookings.push({
          booking_id: booking.booking_id,
          member_name: `${member.first_name || ''} ${member.last_name || ''}`.trim(),
          member_id: member.id,
          email: participant.email || '',
          date: booking.booking_start_date,
          court: booking.resource_name || 'N/A',
          sport: booking.sport_id || 'N/A'
        });

        processed++;
      }
    }

    // Page-based: if we got fewer than requested size, we're done
    if (bookingList.length < 200) {
      hasMore = false;
    } else {
      page++;
    }
  }

  return {
    processed,
    all_bookings: allBookings,
    matched_bookings: matchedBookings,
    skipped_bookings: skippedBookings,
    unmatched_participants: unmatchedParticipants
  };
}

// ─── Full Sync (Players + Bookings) ────────────────────

async function runFullSync(brand_id) {
  const brand = await db.getBrand(brand_id);
  if (!brand) throw new Error('Brand non trovato');

  const config = brand.config?.playtomic;
  if (!config || !config.client_id || !config.secret || !config.tenant_id) {
    throw new Error('Configurazione Playtomic incompleta. Imposta client_id, secret e tenant_id nelle impostazioni del brand.');
  }

  if (!config.sync_enabled) {
    return { success: false, message: 'Sync Playtomic disabilitato per questo brand' };
  }

  console.log(`[Playtomic] Starting sync for brand ${brand.name} (${brand_id})`);

  // Step 1: Sync players (match emails → player_ids)
  const playerResult = await syncPlayers(brand_id, config);
  console.log(`[Playtomic] Player sync: ${playerResult.matched} matched out of ${playerResult.total_players} players`);

  // Step 2: Sync bookings (award points)
  const bookingResult = await syncBookings(brand_id, config);
  console.log(`[Playtomic] Booking sync: ${bookingResult.processed} bookings logged`);

  // Step 3: Evaluate challenges based on booking data
  const challengeResult = await evaluateChallenges(brand_id);
  console.log(`[Playtomic] Challenge eval: ${challengeResult.evaluated} evaluated, ${challengeResult.completed} completed`);

  return {
    success: true,
    players: playerResult,
    bookings: bookingResult,
    challenges: challengeResult,
    synced_at: new Date().toISOString()
  };
}

// ─── Cron Runner (for all brands) ───────────────────────

async function runPlaytomicCron() {
  try {
    const brands = await db.listBrands();
    for (const brand of brands) {
      const config = brand.config?.playtomic;
      if (!config || !config.sync_enabled) continue;

      try {
        const result = await runFullSync(brand.id);
        console.log(`[Playtomic Cron] Brand ${brand.name}: ${result.bookings.processed} bookings, ${result.challenges.completed} missions completed`);
      } catch (e) {
        console.error(`[Playtomic Cron] Error for brand ${brand.name}:`, e.message);
      }
    }
  } catch (e) {
    console.error('[Playtomic Cron] Fatal error:', e.message);
  }
}

module.exports = {
  runFullSync,
  syncPlayers,
  syncBookings,
  runPlaytomicCron
};
