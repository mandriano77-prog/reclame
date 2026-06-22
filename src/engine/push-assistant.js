const { callAI, extractJSON } = require('./ai-copy');
const { computeInitialScheduledRun } = require('./scheduler');
const { getProductBrandName } = require('./base-url');

const VALID_CHANNELS = new Set(['apple', 'google', 'samsung', 'all']);
const VALID_TYPES = new Set(['once', 'daily', 'weekly']);
const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

function buildPushAssistantSystemPrompt() {
  const brand = getProductBrandName();
  return `Sei l'assistente push di ${brand}, integrato nel back office della piattaforma.
Aiuti i brand manager a creare notifiche push schedulate per i pass Apple Wallet, Google Wallet e Samsung Wallet dei loro clienti.

## Chi sei
Un copywriter strategico specializzato in push notification per wallet pass. Scrivi copy brevi, incisivi, che generano apertura e azione. Mai banale, mai aggressivo. Il tono è quello di un brand che parla a un cliente che ha già scelto di tenersi il pass — quindi è già dentro, non devi convincerlo. Devi farlo sentire privilegiato.

## Contesto tecnico
I pass wallet sono carte digitali (storeCard) installate nel wallet nativo dello smartphone. Quando il brand invia una push, l'utente vede una notifica sulla lock screen associata al pass. Il tasso di apertura medio è 85-95% — molto più alto di email o SMS. Questo significa che ogni push deve meritare l'attenzione: se mandi contenuti deboli, l'utente rimuove il pass.

## Come funziona lo scheduling
Il manager descrive in linguaggio naturale (italiano) cosa vuole programmare. Tu traduci in un piano tecnico JSON.

Tipi di scheduling:
- "once": una tantum, richiede una data specifica (YYYY-MM-DD)
- "daily": ogni giorno alla stessa ora
- "weekly": giorni specifici della settimana (es. lunedì e giovedì)

## Regole di output
- Rispondi SOLO con JSON valido, senza markdown, senza commenti, senza testo prima o dopo.
- Ogni campo stringa in italiano a meno che il manager non chieda esplicitamente l'inglese.

## Schema JSON obbligatorio
{
  "schedule_type": "once" | "daily" | "weekly",
  "schedule_time": "HH:MM",
  "days": [0-6],
  "date": "YYYY-MM-DD" | null,
  "title": "...",
  "message": "...",
  "channel": "apple" | "google" | "samsung" | "all",
  "update_pass": true | false,
  "summary": "...",
  "warnings": []
}

## Vincoli per campo

### schedule_time
- Formato HH:MM, 24 ore, fuso Europa/Roma.
- Se il manager non specifica un orario, scegli un orario intelligente in base al contesto:
  - Ristorazione/food: 11:30 (pre-pranzo) o 18:00 (pre-cena)
  - Retail/moda: 10:00 (apertura negozi) o 17:00 (uscita lavoro)
  - Sport/eventi: 09:00 (mattina) o 19:00 (pre-serata)
  - Generico/non specificato: 10:00
- Aggiungi un warning se hai scelto tu l'orario.

### days
- Array di numeri 0-6 (0=domenica, 1=lunedì, ..., 6=sabato).
- Solo per schedule_type "weekly". Vuoto per "once" e "daily".
- Se il manager dice "ogni lunedì" → [1]. Se dice "lunedì e giovedì" → [1, 4].
- Se dice "weekend" → [0, 6]. Se dice "giorni feriali" → [1, 2, 3, 4, 5].

### date
- Solo per schedule_type "once". Formato YYYY-MM-DD.
- Se il manager dice "domani", calcola la data. Se dice "venerdì prossimo", calcola.
- Se non specifica la data per una push "once", usa domani e aggiungi un warning.

### title
- Max 60 caratteri. È il titolo della notifica push che appare sulla lock screen.
- Deve essere breve, diretto, con un hook. No emoji salvo contesto giovanile/informale.
- Esempi buoni: "Il tuo -20% ti aspetta", "Novità per te", "Ci sei mancato"
- Esempi cattivi: "Notifica promozionale importante!!!", "Aggiornamento", "Ciao"

### message
- Max 180 caratteri. È il body della notifica.
- Deve completare il titolo, dare il dettaglio, creare urgenza soft o senso di esclusività.
- Scrivi come se parlassi a un cliente abituale, non a un lead freddo.
- Se il brand ha un tono specifico (indicato nel contesto), adattati.
- Se ci sono esempi recenti del brand, mantieni coerenza di stile.

### channel
- "apple" se il manager non specifica. "all" se dice "tutti" o "tutti i wallet".
- "google" o "samsung" solo se esplicitamente richiesto.

### update_pass
- true di default. Metti false solo se il manager dice esplicitamente di non aggiornare il pass.
- Quando è true, il retro del pass viene aggiornato con il contenuto della push.

### summary
- Una frase in italiano che spiega al manager cosa verrà programmato.
- Deve essere chiara e completa: "Push settimanale ogni lunedì alle 10:00 — reminder promo pranzo."
- Il manager legge questa frase per decidere se confermare o modificare.

### warnings
- Array di stringhe. Ogni warning segnala un'assunzione che hai fatto o un dettaglio mancante.
- Esempi: "Orario non specificato: impostato 11:30 (pre-pranzo)", "Giorno non specificato: impostato lunedì"
- Se la richiesta NON riguarda una push programmata (es. chiede info, aiuto generico, cose non correlate), inserisci il warning "azione_non_supportata" e lascia i campi con valori di default.
- Se la richiesta è ambigua ma interpretabile, interpreta e metti warning con la tua interpretazione.

## Principi di copy

1. BREVITÀ: Una push non è un'email. Ogni parola deve giustificare la sua presenza.
2. VALORE: L'utente deve capire in 2 secondi perché gli conviene aprire.
3. ESCLUSIVITÀ: Il pass è un canale privilegiato. Usa "per te", "riservato", "solo pass".
4. URGENZA SOFT: "Oggi", "questa settimana", "ultimi posti" — mai "ULTIMA OCCASIONE!!!"
5. COERENZA: Se il brand ha già mandato push con un certo tono, mantienilo.
6. NO SPAM VIBES: Mai tutto maiuscolo, mai punti esclamativi multipli, mai clickbait vuoto.

## Cosa NON fare
- Non inventare campagne, promozioni o segmentazioni non menzionate dal manager.
- Non suggerire sconti o prezzi specifici se il manager non li ha indicati.
- Non usare emoji nel titolo se il brand ha un tono formale/luxury.
- Non impostare push alle 3 di notte o in orari irragionevoli.
- Non creare push troppo generiche tipo "Novità in arrivo!" senza contesto.`;
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function parseTimeFromText(text) {
  const atMatch = text.match(/\b(?:alle|ore)\s*(\d{1,2})(?::(\d{2}))?\b/);
  if (atMatch) {
    const h = Math.min(23, Math.max(0, parseInt(atMatch[1], 10)));
    const m = atMatch[2] ? Math.min(59, Math.max(0, parseInt(atMatch[2], 10))) : 0;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const hhmm = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (hhmm) return `${String(parseInt(hhmm[1], 10)).padStart(2, '0')}:${hhmm[2]}`;
  return null;
}

function parseDaysFromText(text) {
  const dayMap = [
    { re: /\bdom(?:enica)?\b/, value: 0 },
    { re: /\blun(?:ed[iì])?\b/, value: 1 },
    { re: /\bmar(?:ted[iì])?\b/, value: 2 },
    { re: /\bmer(?:coled[iì])?\b/, value: 3 },
    { re: /\bgio(?:ved[iì])?\b/, value: 4 },
    { re: /\bven(?:erd[iì])?\b/, value: 5 },
    { re: /\bsab(?:ato)?\b/, value: 6 }
  ];
  const days = [];
  for (const entry of dayMap) {
    if (entry.re.test(text)) days.push(entry.value);
  }
  return days;
}

function inferScheduleType(text) {
  if (/\b(una tantum|una volta|solo il|il giorno)\b/.test(text)) return 'once';
  if (/\b(ogni giorno|quotidian|giornalier)\b/.test(text)) return 'daily';
  if (/\b(ogni settimana|settimanal|lun|mar|mer|gio|ven|sab|dom)\b/.test(text)) return 'weekly';
  return 'weekly';
}

function inferCopy(text, brandName) {
  const name = brandName || 'Team';
  if (/\bbuon(?:a)?\s+inizio\s+settimana\b/.test(text)) {
    return {
      title: 'Buon inizio settimana',
      message: `Buon inizio settimana da ${name}!`
    };
  }
  if (/\bbuon(?:a)?\s+settimana\b/.test(text)) {
    return { title: 'Buona settimana', message: `Buona settimana da ${name}!` };
  }
  if (/\bbuongiorno\b/.test(text)) {
    return { title: 'Buongiorno', message: `Buongiorno da ${name}!` };
  }
  return {
    title: 'Novità per te',
    message: `Un aggiornamento da ${name}.`
  };
}

function heuristicPlan(prompt, brand) {
  const text = normalizeText(prompt);
  const schedule_type = inferScheduleType(text);
  const schedule_time = parseTimeFromText(text) || '09:00';
  const days = parseDaysFromText(text);
  const copy = inferCopy(text, brand?.name);
  const warnings = ['Interpretazione automatica senza AI: controlla titolo e messaggio.'];

  if (schedule_type === 'weekly' && !days.length) {
    days.push(1);
    warnings.push('Giorno non specificato: impostato lunedì.');
  }

  let date = null;
  if (schedule_type === 'once') {
    const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
    if (iso) {
      date = iso[0];
    } else {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      date = tomorrow.toISOString().slice(0, 10);
      warnings.push('Data non specificata: impostato domani.');
    }
  }

  return {
    schedule_type,
    schedule_time,
    days,
    date,
    title: copy.title,
    message: copy.message,
    channel: 'apple',
    update_pass: true,
    summary: 'Piano generato con regole di base.',
    warnings
  };
}

function buildRecentExamples(scheduled = [], history = []) {
  const rows = [];
  for (const item of scheduled.slice(0, 4)) {
    rows.push({
      title: item.title,
      message: item.message,
      schedule_type: item.schedule_type,
      schedule_time: item.schedule_time,
      schedule_days: item.schedule_days || ''
    });
  }
  for (const item of history.slice(0, 4)) {
    rows.push({ title: item.title, message: item.message, sent: true });
  }
  return rows;
}

function normalizeProposal(raw, brand) {
  const proposal = { ...(raw || {}) };
  proposal.schedule_type = VALID_TYPES.has(proposal.schedule_type) ? proposal.schedule_type : 'weekly';
  proposal.channel = VALID_CHANNELS.has(proposal.channel) ? proposal.channel : 'apple';
  proposal.update_pass = proposal.update_pass !== false;
  proposal.title = String(proposal.title || '').trim().slice(0, 60);
  proposal.message = String(proposal.message || '').trim().slice(0, 180);
  proposal.summary = String(proposal.summary || '').trim();
  proposal.warnings = Array.isArray(proposal.warnings)
    ? proposal.warnings.map((w) => String(w).trim()).filter(Boolean)
    : [];

  const timeMatch = String(proposal.schedule_time || '09:00').match(/^(\d{1,2}):(\d{2})$/);
  if (!timeMatch) {
    proposal.schedule_time = '09:00';
    proposal.warnings.push('Orario non valido: impostato 09:00.');
  } else {
    const h = Math.min(23, Math.max(0, parseInt(timeMatch[1], 10)));
    const m = Math.min(59, Math.max(0, parseInt(timeMatch[2], 10)));
    proposal.schedule_time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  if (proposal.schedule_type === 'weekly') {
    let days = Array.isArray(proposal.days) ? proposal.days : [];
    if (!days.length && proposal.schedule_days) {
      days = String(proposal.schedule_days)
        .split(',')
        .map((x) => parseInt(String(x).trim(), 10))
        .filter((n) => Number.isFinite(n));
    }
    days = [...new Set(days.filter((n) => n >= 0 && n <= 6))];
    if (!days.length) {
      days = [1];
      proposal.warnings.push('Giorno settimanale mancante: impostato lunedì.');
    }
    proposal.days = days;
    proposal.schedule_days = days.join(',');
  } else {
    proposal.days = [];
    proposal.schedule_days = '';
  }

  if (proposal.schedule_type === 'once') {
    const dateStr = String(proposal.date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const fallback = new Date();
      fallback.setDate(fallback.getDate() + 1);
      proposal.date = fallback.toISOString().slice(0, 10);
      proposal.warnings.push('Data mancante o non valida: impostato domani.');
    } else {
      proposal.date = dateStr;
    }
  } else {
    proposal.date = null;
  }

  if (!proposal.title || !proposal.message) {
    const copy = inferCopy(normalizeText(proposal.summary || brand?.name || ''), brand?.name);
    if (!proposal.title) proposal.title = copy.title;
    if (!proposal.message) proposal.message = copy.message;
    proposal.warnings.push('Titolo o messaggio generati automaticamente.');
  }

  if (!proposal.summary) {
    proposal.summary = describeSchedule(proposal);
  }

  return proposal;
}

function describeSchedule(proposal) {
  const typeLabel = proposal.schedule_type === 'once'
    ? 'una tantum'
    : proposal.schedule_type === 'daily'
      ? 'ogni giorno'
      : 'ogni settimana';
  const dayPart = proposal.schedule_type === 'weekly'
    ? ` (${proposal.days.map((d) => DAY_LABELS[d] || d).join(', ')})`
    : '';
  const datePart = proposal.schedule_type === 'once' ? ` il ${proposal.date}` : '';
  return `Push ${typeLabel}${dayPart}${datePart} alle ${proposal.schedule_time}.`;
}

function buildPreview(proposal, nextRunAt) {
  const nextRunLabel = nextRunAt
    ? new Date(nextRunAt).toLocaleString('it-IT', { timeZone: 'Europe/Rome' })
    : null;
  return {
    summary: proposal.summary,
    schedule_label: describeSchedule(proposal),
    next_run_at: nextRunAt ? new Date(nextRunAt).toISOString() : null,
    next_run_label: nextRunLabel,
    title: proposal.title,
    message: proposal.message,
    channel: proposal.channel,
    update_pass: proposal.update_pass,
    warnings: proposal.warnings
  };
}

async function extractFromAI(brand, prompt, recentExamples, voiceHint) {
  const examplesBlock = recentExamples.length
    ? `Esempi recenti del brand (tono e stile):\n${JSON.stringify(recentExamples, null, 2)}`
    : 'Nessun esempio recente: usa tono professionale, caldo e sintetico.';
  const voiceBlock = voiceHint
    ? `Contesto brand: ${voiceHint}`
    : 'Contesto brand: non specificato.';

  const userPrompt = `Brand: ${brand.name}
${voiceBlock}
${examplesBlock}

Richiesta del manager:
${prompt}`;

  const text = await callAI(buildPushAssistantSystemPrompt(), userPrompt, 768);
  return extractJSON(text);
}

async function planScheduledPush({ brand, prompt, scheduled = [], history = [] }) {
  const trimmed = String(prompt || '').trim();
  if (!trimmed) throw new Error('Descrivi la push che vuoi programmare');

  const recentExamples = buildRecentExamples(scheduled, history);
  const voiceHint = [
    brand.config?.settore ? `settore ${brand.config.settore}` : '',
    brand.config?.pushVoice ? `tono push: ${brand.config.pushVoice}` : ''
  ].filter(Boolean).join('; ');

  let raw;
  try {
    raw = await extractFromAI(brand, trimmed, recentExamples, voiceHint);
  } catch (err) {
    console.warn('[push-assistant] AI planning failed, using heuristic fallback:', err.message);
    raw = heuristicPlan(trimmed, brand);
  }

  const proposal = normalizeProposal(raw, brand);
  const nextRun = computeInitialScheduledRun({
    schedule_type: proposal.schedule_type,
    schedule_time: proposal.schedule_time,
    schedule_days: proposal.schedule_days,
    days: proposal.days,
    date: proposal.date
  });

  if (!nextRun) {
    throw new Error('Non è stato possibile calcolare la prossima esecuzione');
  }
  if (proposal.schedule_type === 'once' && nextRun.getTime() <= Date.now()) {
    throw new Error('La data e l\'ora proposte sono già passate (fuso Europa/Roma)');
  }

  return {
    prompt: trimmed,
    proposal,
    preview: buildPreview(proposal, nextRun),
    payload: {
      brand_id: brand.id,
      title: proposal.title,
      message: proposal.message,
      channel: proposal.channel,
      schedule_type: proposal.schedule_type,
      schedule_time: proposal.schedule_time,
      update_pass: proposal.update_pass,
      ...(proposal.schedule_type === 'weekly' ? { days: proposal.days } : {}),
      ...(proposal.schedule_type === 'once' ? { date: proposal.date } : {})
    }
  };
}

module.exports = { planScheduledPush, normalizeProposal, heuristicPlan };
