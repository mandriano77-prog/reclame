const {
  pool,
  getBrand,
  listScheduledPush,
  listPushes,
  listInstantWinCampaigns,
  listStripPromos
} = require('../db');
const { extractJSON } = require('./ai-copy');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const WAI_MODEL = 'claude-opus-4-6';

const EXECUTABLE_INTENTS = new Set([
  'push.schedule',
  'push.send',
  'campaign.create',
  'strip.create'
]);

const SYSTEM_PROMPT = `Sei W.AI, l'agente AI del back office Ads2Wallet.
Aiuti i brand manager a gestire il loro programma wallet pass tramite comandi in linguaggio naturale.

## Identità
Sei un operatore esperto, veloce e preciso. Non sei un chatbot generico — sei uno strumento
di lavoro che conosce ogni funzione del back office. Rispondi in modo diretto, senza convenevoli.
Se il manager dice "crea un reward caffè a 500 punti" non chiedi conferma — prepari il payload
e lo mostri per approvazione.

## Contesto operativo
Operi dentro Ads2Wallet, una piattaforma che gestisce pass per Apple Wallet, Google Wallet e
Samsung Wallet. I pass sono carte digitali (storeCard) che i brand distribuiscono ai clienti
tramite QR code, link o advertising. Ogni pass ha: design, push notification, geofencing,
gamification, reward, strip promo. Il back office è su studio.ads2wallet.com.

## Regole di risposta
- Rispondi SOLO con JSON valido, senza markdown, senza testo prima o dopo.
- Lingua: italiano per summary/warnings, valori dei campi nella lingua richiesta dal manager.
- Se la richiesta è ambigua ma interpretabile, interpreta e metti warning.
- Se la richiesta non è classificabile, usa intent "unknown" con un messaggio di aiuto.
- Non inventare dati non menzionati dal manager (prezzi, nomi, date).
- Se mancano informazioni obbligatorie, usa valori di default sensati E aggiungi warning.

## Intent supportati

### Creazione
- push.schedule — Programma una push notification (once/daily/weekly)
- push.send — Invia una push notification immediata
- reward.create — Crea un nuovo reward nel programma fedeltà
- member.add_points — Aggiungi punti a un membro specifico
- campaign.create — Crea una campagna gamification (instant win / ruota)
- strip.create — Crea una strip promo (cambio immagine pass temporaneo)

### Lettura
- analytics.query — Rispondi a domande su metriche e performance
- pass.count — Conta pass attivi/installati
- push.history — Mostra storico push inviate
- member.search — Cerca un membro per nome/email o conta per segmento

### Sistema
- help — L'utente chiede cosa puoi fare. Rispondi con la lista delle capacità.
- unknown — Richiesta non classificabile. Suggerisci cosa puoi fare.

## Schema JSON di risposta
{
  "intent": "<intent_id>",
  "type": "create" | "query" | "system",
  "preview": {
    "summary": "Frase in italiano che spiega cosa verrà fatto",
    "details": { ... },
    "warnings": ["..."]
  },
  "payload": { ... },
  "answer": "..."
}

## Regole per intent specifici

### push.schedule
- schedule_type: "once" | "daily" | "weekly"
- schedule_time: HH:MM formato 24h, fuso Europa/Roma
- days: array numeri 0-6 (0=dom) solo per weekly
- date: YYYY-MM-DD solo per once
- title: max 60 char, incisivo, adatto a lock screen
- message: max 180 char, completa il titolo, crea valore
- channel: "apple" | "google" | "samsung" | "all" (default: apple)
- Se il manager non specifica l'orario, scegli in base al settore:
  Food: 11:30 o 18:00 | Retail: 10:00 o 17:00 | Generico: 10:00

### push.send
- Come push.schedule ma senza scheduling. Esecuzione immediata.
- title + message obbligatori. Se non specificati, genera e metti warning.

### reward.create
- name: nome del reward (es. "Caffè gratis")
- points_required: punti necessari per riscattare
- description: breve descrizione del premio
- active: sempre true alla creazione

### member.add_points
- member_query: nome o email per identificare il membro
- points: numero di punti da aggiungere (sempre positivo)
- reason: motivo dell'accredito (es. "bonus fedeltà")
- ATTENZIONE: se il membro non è trovato nel contesto, metti warning

### campaign.create
- name: nome campagna
- game_type: "spin_wheel" | "scratch_card" | "quiz"
- prize_name, prize_description: premio
- win_probability: 0.0-1.0 (default 0.1 se non specificato)

### analytics.query / pass.count / push.history / member.search
- Usa i dati nel contesto brand per rispondere.
- Metti la risposta nel campo "answer" in italiano.
- Non inventare numeri — usa solo i dati forniti nel contesto.

## Principi di copy per push
1. BREVITÀ: ogni parola deve giustificare la sua presenza
2. VALORE: l'utente deve capire in 2 sec perché aprire
3. ESCLUSIVITÀ: "per te", "riservato", "solo pass"
4. URGENZA SOFT: "oggi", "questa settimana" — mai "ULTIMA OCCASIONE!!!"
5. COERENZA: mantieni il tono delle push recenti del brand
6. NO SPAM: mai tutto maiuscolo, mai clickbait vuoto`;

function buildUserMessage(prompt, context) {
  return `Stato attuale del brand:\n${JSON.stringify(context, null, 2)}\n\nRichiesta del manager:\n${prompt}`;
}

async function callWai(systemPrompt, userMessage) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY non configurata');
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: WAI_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    })
  });

  const data = await res.json();
  if (!res.ok) {
    const message = data?.error?.message || `Anthropic error ${res.status}`;
    throw new Error(message);
  }

  const text = data?.content?.[0]?.text;
  if (!text) throw new Error('Claude ha restituito una risposta vuota');
  return text;
}

async function buildWaiContext(brandId) {
  const [brand, passStats, deviceStats, scheduled, pushHistory, campaigns, stripPromos] = await Promise.all([
    getBrand(brandId),
    pool.query('SELECT COUNT(*)::int AS total FROM pass_instances WHERE brand_id = $1', [brandId]),
    pool.query(
      `SELECT COUNT(DISTINCT dr.push_token)::int AS with_push
       FROM device_registrations dr
       JOIN pass_instances pi ON dr.serial_number = pi.serial_number
       WHERE pi.brand_id = $1`,
      [brandId]
    ),
    listScheduledPush(brandId),
    listPushes(brandId),
    listInstantWinCampaigns(brandId),
    listStripPromos(brandId)
  ]);

  if (!brand) throw new Error('Brand non trovato');

  return {
    brand_name: brand.name,
    brand_sector: brand.config?.settore || 'non specificato',
    pass_count: passStats.rows[0]?.total || 0,
    pass_with_push: deviceStats.rows[0]?.with_push || 0,
    member_count: 0,
    active_rewards: [],
    scheduled_push: scheduled.slice(0, 5).map((s) => ({
      title: s.title,
      message: s.message,
      schedule_type: s.schedule_type,
      schedule_time: s.schedule_time,
      active: s.active
    })),
    recent_push: pushHistory.slice(0, 5).map((p) => ({
      title: p.title,
      message: p.message,
      sent_at: p.created_at
    })),
    active_campaigns: campaigns.filter((c) => c.status === 'active').map((c) => ({
      name: c.name,
      game_type: c.game_type
    })),
    active_strip_promos: stripPromos.filter((s) => s.active).map((s) => ({
      title: s.title,
      start_date: s.start_date,
      end_date: s.end_date
    }))
  };
}

function normalizeWarnings(value) {
  if (!Array.isArray(value)) return [];
  return value.map((w) => String(w).trim()).filter(Boolean);
}

function normalizePreview(raw) {
  const preview = raw?.preview && typeof raw.preview === 'object' ? raw.preview : {};
  return {
    summary: String(preview.summary || raw?.answer || '').trim(),
    details: preview.details && typeof preview.details === 'object' ? preview.details : {},
    warnings: normalizeWarnings(preview.warnings)
  };
}

function normalizePayload(intent, payload, brandId) {
  const next = payload && typeof payload === 'object' ? { ...payload } : {};
  if (intent !== 'help' && intent !== 'unknown') {
    next.brand_id = brandId;
  }
  return next;
}

function validateWaiResponse(raw, brandId) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Risposta W.AI non valida');
  }

  const intent = String(raw.intent || 'unknown').trim();
  const type = String(raw.type || 'system').trim();
  const preview = normalizePreview(raw);
  const answer = String(raw.answer || preview.summary || '').trim();
  const payload = normalizePayload(intent, raw.payload, brandId);

  if (!preview.summary && answer) preview.summary = answer;

  if (type === 'create' && !EXECUTABLE_INTENTS.has(intent)) {
    preview.warnings.push('Questa azione non è disponibile in W.AI v1 su questo back office.');
    return {
      intent,
      type: 'system',
      preview,
      payload: {},
      answer: preview.summary || 'Azione non disponibile in W.AI v1.'
    };
  }

  if (type === 'query' || type === 'system') {
    if (!answer && intent === 'help') {
      preview.summary = 'Posso programmare push, inviarle subito, creare campagne instant win e strip promo, e rispondere su pass e analytics.';
    }
    return { intent, type, preview, payload: {}, answer: answer || preview.summary };
  }

  if (!EXECUTABLE_INTENTS.has(intent)) {
    throw new Error(`Intent '${intent}' non eseguibile in v1`);
  }

  if (intent === 'push.schedule' || intent === 'push.send') {
    payload.title = String(payload.title || '').trim().slice(0, 60);
    payload.message = String(payload.message || '').trim().slice(0, 180);
    if (!payload.title || !payload.message) {
      throw new Error('Titolo e messaggio push obbligatori');
    }
    payload.channel = ['apple', 'google', 'samsung', 'all'].includes(payload.channel) ? payload.channel : 'apple';
    payload.update_pass = payload.update_pass !== false;
  }

  if (intent === 'push.schedule') {
    payload.schedule_type = ['once', 'daily', 'weekly'].includes(payload.schedule_type) ? payload.schedule_type : 'weekly';
    payload.schedule_time = String(payload.schedule_time || '10:00').trim();
    if (payload.schedule_type === 'weekly') {
      const days = Array.isArray(payload.days) ? payload.days : [];
      payload.days = [...new Set(days.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))];
      if (!payload.days.length) payload.days = [1];
    }
    if (payload.schedule_type === 'once') {
      payload.date = String(payload.date || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) {
        throw new Error('Data obbligatoria per push una tantum');
      }
    }
  }

  if (intent === 'campaign.create') {
    payload.name = String(payload.name || '').trim();
    payload.game_type = String(payload.game_type || 'spin_wheel').trim();
    payload.prize_name = String(payload.prize_name || payload.name || 'Premio').trim();
    payload.prize_description = String(payload.prize_description || '').trim();
    payload.win_probability = Number.isFinite(Number(payload.win_probability))
      ? Number(payload.win_probability)
      : 0.1;
    payload.status = payload.status || 'draft';
  }

  if (intent === 'strip.create') {
    payload.title = String(payload.title || '').trim();
    payload.start_date = String(payload.start_date || '').trim();
    payload.end_date = String(payload.end_date || '').trim();
    if (!payload.title || !payload.start_date || !payload.end_date) {
      throw new Error('Strip promo: titolo, start_date e end_date obbligatori');
    }
    if (!payload.strip_base64) {
      preview.warnings.push('Manca strip_base64: carica l’immagine strip dal back office prima di confermare.');
    }
  }

  return { intent, type: 'create', preview, payload, answer: '' };
}

async function askWai({ brandId, prompt }) {
  const trimmed = String(prompt || '').trim();
  if (!trimmed) throw new Error('prompt richiesto');

  const context = await buildWaiContext(brandId);
  const text = await callWai(SYSTEM_PROMPT, buildUserMessage(trimmed, context));
  const parsed = extractJSON(text);
  return validateWaiResponse(parsed, brandId);
}

module.exports = {
  SYSTEM_PROMPT,
  EXECUTABLE_INTENTS,
  buildWaiContext,
  buildUserMessage,
  callWai,
  askWai,
  validateWaiResponse
};
