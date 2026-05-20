/**
 * Parse time windows from natural-language audience prompts (Italian + common shorthand).
 */

const TZ = 'Europe/Rome';

function stripAudiencePrefix(prompt) {
  return String(prompt || '')
    .replace(/^\[Audience platform\]\s*/i, '')
    .trim();
}

function todayInTimezone(timeZone = TZ) {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
}

function dateDaysAgoInTimezone(days, timeZone = TZ) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(d);
}

/**
 * @returns {number|null} days window if detected in prompt
 */
function parseSinceDaysFromPrompt(prompt) {
  const text = stripAudiencePrefix(prompt).toLowerCase();
  if (!text) return null;

  const patterns = [
    /(?:ultim[oi]?|negli?|nei?|nell['’]?\s*ultim[oi]?|last|past)\s+(\d{1,3})\s*(?:gg|giorni?|days?|d\b)/i,
    /(\d{1,3})\s*(?:gg|giorni?|days?)\b/i,
    /(?:ultim[oi]?|negli?)\s+(\d{1,3})\s*(?:gg|giorni?)/i
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > 0) return Math.min(n, 365);
    }
  }

  if (/\b(un[a']?\s+)?settimana\b/.test(text) || /\b7\s*gg\b/.test(text)) return 7;
  if (/\b(un[a']?\s+)?mese\b/.test(text) || /\b30\s*gg\b/.test(text)) return 30;
  if (/\b(oggi|today)\b/.test(text) && !/\b(\d+)\s*(?:gg|giorni)/.test(text)) return 1;

  return null;
}

function applySinceDaysToQuerySpec(spec, prompt) {
  if (!spec || typeof spec !== 'object') return { spec, sinceDays: null, overridden: false };
  const parsed = parseSinceDaysFromPrompt(prompt);
  if (!parsed) return { spec, sinceDays: null, overridden: false };

  const next = {
    ...spec,
    behavior: { ...(spec.behavior || {}) }
  };
  const prev = next.behavior.since_days;
  next.behavior.since_days = parsed;
  if (!next.behavior.min_count) next.behavior.min_count = 1;

  const today = todayInTimezone(TZ);
  const fromDate = dateDaysAgoInTimezone(parsed, TZ);
  const descBase = String(next.description || spec.description || '').trim();
  if (!descBase.toLowerCase().includes(`${parsed} giorn`)) {
    next.description = descBase
      ? `${descBase} (ultimi ${parsed} giorni, dal ${fromDate} al ${today})`
      : `Segmento ultimi ${parsed} giorni (dal ${fromDate} al ${today})`;
  }

  return {
    spec: next,
    sinceDays: parsed,
    fromDate,
    toDate: today,
    overridden: Number.isFinite(prev) && prev !== parsed
  };
}

/**
 * Applica la finestra dai giorni nel prompt; se manca, usa behavior.since_days nel query_spec
 * così fromDate/toDate sono sempre valorizzati quando il modello ha messo i giorni nella spec.
 */
function resolveAudienceQueryWindow(spec, prompt) {
  const w = applySinceDaysToQuerySpec(spec, prompt);
  let outSpec = w.spec;
  let sinceDays = w.sinceDays;
  let fromDate = w.fromDate;
  let toDate = w.toDate;
  let overridden = w.overridden;

  const fromBehavior = parseInt(outSpec?.behavior?.since_days, 10);
  if ((!sinceDays || !fromDate || !toDate) && Number.isFinite(fromBehavior) && fromBehavior > 0) {
    const d = Math.min(fromBehavior, 365);
    sinceDays = d;
    fromDate = dateDaysAgoInTimezone(d, TZ);
    toDate = todayInTimezone(TZ);
    outSpec = {
      ...outSpec,
      behavior: { ...(outSpec.behavior || {}), since_days: d, min_count: outSpec.behavior?.min_count || 1 }
    };
    if (!w.sinceDays) overridden = false;
  }

  return {
    spec: outSpec,
    sinceDays,
    fromDate,
    toDate,
    overridden
  };
}

const STALE_AUDIENCE_WARNING = [
  /audience_behavior_30d/i,
  /30 giorni aggregat/i,
  /contesto disponibile/i,
  /copre solo aggregat/i,
  /impossibile isolare/i,
  /senza query diretta/i,
  /query diretta al database/i,
  /granularit[aà]/i,
  /necessaria una query sul server/i,
  /non possono essere filtrati/i,
  /dati disponibili nel contesto/i,
  /Query spec generata automaticamente/i,
  /estratto da audience_behavior/i,
  /filtro temporale.*server/i,
  /scheduled_sent/i,
  /batch di invio/i,
  /destinatari singol/i,
  /stima\s*~?/i,
  /media lineare/i,
  /aperture\/settimana/i
];

function sanitizeAudienceQueryWarnings(warnings) {
  return (Array.isArray(warnings) ? warnings : [])
    .map((w) => String(w).trim())
    .filter((w) => w && !STALE_AUDIENCE_WARNING.some((re) => re.test(w)));
}

const ACTION_LABELS = {
  opened: 'apertura pass',
  link_click: 'click su link retro',
  installed: 'installazione pass',
  instant_win_played: 'giocato instant win',
  gamification_played: 'giocato gamification'
};

function buildAudienceQueryServerWarnings({ behavior }) {
  const lines = ['Numero da tabella eventi holder_events (non da testo W.AI).'];
  if (behavior?.did_action === 'opened') {
    lines.push(
      'Pass aperti = possessori con almeno un evento "opened" nel periodo (apertura nel Wallet; non distingue tap notifica vs apertura manuale).'
    );
  }
  return lines;
}

function formatAudienceQueryAnswer({ count, sinceDays, fromDate, toDate, behavior }) {
  if (behavior?.did_action === 'opened') {
    return `${count} possessori con almeno un’apertura pass nel periodo ${fromDate}–${toDate} (ultimi ${sinceDays} giorni, evento opened).`;
  }
  const action = behavior?.did_action ? ACTION_LABELS[behavior.did_action] || behavior.did_action : 'criteri richiesti';
  return `${count} possessori nel periodo ${fromDate}–${toDate} (ultimi ${sinceDays} giorni) · filtro: ${action}.`;
}

module.exports = {
  TZ,
  stripAudiencePrefix,
  todayInTimezone,
  dateDaysAgoInTimezone,
  parseSinceDaysFromPrompt,
  applySinceDaysToQuerySpec,
  resolveAudienceQueryWindow,
  sanitizeAudienceQueryWarnings,
  buildAudienceQueryServerWarnings,
  formatAudienceQueryAnswer,
  ACTION_LABELS
};
