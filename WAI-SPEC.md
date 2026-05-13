# W.AI — Agente AI per Back Office Ads2Wallet

## Spec tecnica per implementazione — v1.0

---

## 1. Overview

W.AI è un agente conversazionale integrato nel back office di Ads2Wallet (studio.ads2wallet.com). Permette al brand manager di eseguire operazioni tramite comandi in linguaggio naturale italiano, con anteprima obbligatoria e conferma esplicita prima dell'esecuzione.

### Principi fondamentali

- **Natural language first**: il manager scrive in italiano, W.AI traduce in azioni strutturate
- **Preview obbligatoria**: ogni azione viene mostrata in anteprima prima dell'esecuzione
- **Confirm before execute**: nessuna azione viene eseguita senza conferma esplicita
- **Read + Create only (v1)**: nessuna operazione distruttiva (delete, reset)
- **Context-aware**: W.AI conosce lo stato attuale del brand (pass attivi, push recenti, reward, campagne)

### Stack

| Componente | Tecnologia |
|------------|-----------|
| AI Engine | Claude Opus 4.6 via Anthropic API (`claude-opus-4-6`) |
| Backend | Node.js / Express — nuovo endpoint in routes.js |
| Frontend | Vanilla JS overlay nel dashboard index.html |
| Hosting | Railway (studio.ads2wallet.com) |
| Auth | JWT esistente — stesso token del dashboard |

---

## 2. Architettura

### Flusso completo

1. Il manager clicca il bottone W.AI nel dashboard → si apre l'overlay
2. Scrive un comando in italiano nella textarea (es. "Crea un reward caffè gratis a 500 punti")
3. Il frontend invia `POST /api/wai/ask` con `{ prompt, brand_id }`
4. Il backend raccoglie il contesto del brand (pass, push, reward, campagne, analytics)
5. Invia il system prompt + contesto + richiesta a Claude Opus 4.6 via Anthropic API
6. Claude risponde con un JSON strutturato: intent, payload, preview, warnings
7. Il backend valida e normalizza la risposta
8. Il frontend mostra l'anteprima con bottoni Conferma / Modifica / Annulla
9. Se il manager conferma: `POST /api/wai/execute` con il payload validato
10. Il backend esegue l'azione chiamando le funzioni DB esistenti e risponde con il risultato

### Diagramma

```
┌─────────────────┐     ┌───────────────────┐     ┌──────────────────┐
│  OVERLAY (UI)   │ ──→ │  ROUTER (Backend)  │ ──→ │  CLAUDE OPUS 4.6 │
│  textarea       │     │  context builder    │     │  Anthropic API   │
│  preview card   │ ←── │  validator          │ ←── │  JSON response   │
│  confirm/cancel │     │  executor           │     └──────────────────┘
└─────────────────┘     └───────────────────┘
                              │
                       ┌──────┴──────────────┐
                       │  PostgreSQL (DB)     │
                       │  funzioni esistenti  │
                       └─────────────────────┘
```

---

## 3. Intent e azioni supportate (v1)

### Matrice intent

| Intent | Tipo | Azione backend | Esempio comando |
|--------|------|---------------|-----------------|
| `push.schedule` | create | `createScheduledPush()` | "Ogni lunedì alle 10 manda una push buon inizio settimana" |
| `push.send` | create | `sendPush()` | "Manda subito una push: oggi 2x1 su tutti i panini" |
| `reward.create` | create | `createReward()` | "Crea un reward caffè gratis a 500 punti" |
| `member.add_points` | create | `addPoints()` | "Aggiungi 200 punti a Marco Rossi" |
| `member.import` | create | `importMembers()` | "Importa questi 50 contatti nel programma" |
| `campaign.create` | create | `createInstantWinCampaign()` | "Crea una ruota della fortuna, premio un dessert, 10% vincita" |
| `strip.create` | create | `createStripPromo()` | "Cambia la strip del pass con la promo estate da lunedì a venerdì" |
| `analytics.query` | query | `getAnalytics()` | "Come siamo andati questa settimana?" |
| `pass.count` | query | `countPasses()` | "Quanti pass attivi ci sono?" |
| `push.history` | query | `listPushes()` | "Che push abbiamo mandato questa settimana?" |
| `member.search` | query | `searchMembers()` | "Trova Marco Rossi" / "Quanti membri Gold abbiamo?" |
| `help` | system | nessuna | "Cosa puoi fare?" / "Aiuto" |
| `unknown` | system | nessuna | Qualsiasi richiesta non classificabile |

---

## 4. API Endpoints

### POST /api/wai/ask

Riceve il prompt del manager, raccoglie il contesto, chiama Claude, restituisce la proposta.

**Request:**
```json
{
  "prompt": "Crea un reward caffè gratis a 500 punti",
  "brand_id": "uuid-del-brand"
}
```

**Response (successo):**
```json
{
  "intent": "reward.create",
  "type": "create",
  "preview": {
    "summary": "Creo il reward 'Caffè gratis' riscattabile a 500 punti.",
    "details": {
      "name": "Caffè gratis",
      "points_required": 500,
      "description": "Un caffè offerto dal locale"
    },
    "warnings": []
  },
  "payload": {
    "brand_id": "uuid",
    "name": "Caffè gratis",
    "points_required": 500,
    "description": "Un caffè offerto dal locale",
    "active": true
  }
}
```

### POST /api/wai/execute

Esegue l'azione confermata. Riceve intent + payload già validati.

**Request:**
```json
{
  "intent": "reward.create",
  "payload": { "..." }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Reward 'Caffè gratis' creato con successo.",
  "data": { "..." }
}
```

### GET /api/wai/history

Storico delle interazioni W.AI per il brand.

```
GET /api/wai/history?brand_id=uuid&limit=20
```

---

## 5. Context Builder

Prima di chiamare Claude, il backend raccoglie lo stato corrente del brand. Questo contesto viene iniettato nel messaggio utente (non nel system prompt).

```javascript
// src/engine/wai.js

async function buildWaiContext(brandId) {
  const [brand, passes, members, rewards, scheduled,
         pushHistory, campaigns, stripPromos] = await Promise.all([
    getBrand(brandId),
    pool.query(`SELECT count(*) as total,
      count(*) FILTER (WHERE push_token IS NOT NULL) as with_push
      FROM pass_instances WHERE brand_id = $1`, [brandId]),
    pool.query(`SELECT count(*) as total FROM members WHERE brand_id = $1`, [brandId]),
    listRewards(brandId),
    listScheduledPush(brandId),
    listPushes(brandId),
    listInstantWinCampaigns(brandId),
    listStripPromos(brandId)
  ]);

  return {
    brand_name: brand.name,
    brand_sector: brand.config?.settore || 'non specificato',
    pass_count: passes.rows[0]?.total || 0,
    pass_with_push: passes.rows[0]?.with_push || 0,
    member_count: members.rows[0]?.total || 0,
    active_rewards: rewards.filter(r => r.active).map(r => ({
      name: r.name, points: r.points_required
    })),
    scheduled_push: scheduled.slice(0, 5).map(s => ({
      title: s.title, message: s.message, schedule_type: s.schedule_type,
      schedule_time: s.schedule_time, active: s.active
    })),
    recent_push: pushHistory.slice(0, 5).map(p => ({
      title: p.title, message: p.message, sent_at: p.created_at
    })),
    active_campaigns: campaigns.filter(c => c.status === 'active').map(c => ({
      name: c.name, game_type: c.game_type
    })),
    active_strip_promos: stripPromos.filter(s => s.active).map(s => ({
      title: s.title, start_date: s.start_date, end_date: s.end_date
    }))
  };
}
```

---

## 6. System Prompt per Claude Opus 4.6

Costante `SYSTEM_PROMPT` in `src/engine/wai.js`:

```
Sei W.AI, l'agente AI del back office Ads2Wallet.
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
6. NO SPAM: mai tutto maiuscolo, mai clickbait vuoto
```

---

## 7. Integrazione Anthropic API

### Chiamata API

```javascript
// src/engine/wai.js
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const WAI_MODEL = 'claude-opus-4-6';

async function callWai(systemPrompt, userMessage) {
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
  if (data.error) throw new Error(data.error.message);
  return data.content[0].text;
}
```

### Composizione messaggio utente

```javascript
function buildUserMessage(prompt, context) {
  return `Stato attuale del brand:\n${JSON.stringify(context, null, 2)}\n\nRichiesta del manager:\n${prompt}`;
}
```

### Variabile d'ambiente

Aggiungere a Railway:
```
ANTHROPIC_API_KEY=sk-ant-api03-...
```

---

## 8. Frontend — Overlay UI

### Bottone di attivazione

Bottone floating fisso in basso a destra nel dashboard. Colore accent green (#00D4AA), 52x52px, border-radius 50%, z-index 9999.

```html
<!-- Aggiungere in fondo al body di dashboard/index.html -->
<button id="waiBtn" onclick="toggleWaiOverlay()"
  style="position:fixed; bottom:24px; right:24px; width:52px; height:52px;
  border-radius:50%; background:#00D4AA; color:#0a0a0a; border:none;
  font-size:16px; font-weight:800; cursor:pointer; z-index:9999;
  box-shadow:0 4px 20px rgba(0,212,170,0.3); font-family:inherit;">
  W.AI
</button>
```

### Overlay panel

```html
<div id="waiOverlay" style="display:none; position:fixed; bottom:88px;
  right:24px; width:400px; max-height:80vh; background:#111;
  border:1px solid rgba(0,212,170,0.2); border-radius:16px;
  box-shadow:0 20px 60px rgba(0,0,0,0.5); z-index:9998;
  font-family:inherit; overflow:hidden;">

  <!-- Header -->
  <div style="padding:16px 20px; border-bottom:1px solid rgba(255,255,255,0.06);
    display:flex; align-items:center; justify-content:space-between;">
    <span style="font-size:15px; font-weight:700; color:#00D4AA;">W.AI</span>
    <span style="font-size:11px; color:#666;">Claude Opus 4.6</span>
  </div>

  <!-- Input area -->
  <div style="padding:16px 20px;">
    <textarea id="waiPrompt" rows="3"
      placeholder="Scrivi cosa vuoi fare..."
      style="width:100%; background:rgba(255,255,255,0.04);
      border:1px solid rgba(255,255,255,0.08); border-radius:10px;
      color:#f4ede2; padding:12px; font-size:13px; resize:vertical;
      font-family:inherit;"></textarea>
    <button id="waiSendBtn" onclick="askWai()"
      style="width:100%; margin-top:8px; padding:10px;
      background:#00D4AA; color:#0a0a0a; border:none;
      border-radius:8px; font-weight:700; font-size:13px;
      cursor:pointer; font-family:inherit;">
      Chiedi a W.AI
    </button>
  </div>

  <!-- Preview area (populated by JS) -->
  <div id="waiPreview" style="display:none; padding:0 20px 16px;"></div>
</div>
```

### JavaScript frontend

```javascript
let waiDraft = null;

function toggleWaiOverlay() {
  const el = document.getElementById('waiOverlay');
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

async function askWai() {
  if (!brandId) return alert('Seleziona un brand');
  const prompt = document.getElementById('waiPrompt').value.trim();
  if (!prompt) return;

  const btn = document.getElementById('waiSendBtn');
  btn.disabled = true;
  btn.textContent = 'W.AI sta pensando...';
  document.getElementById('waiPreview').style.display = 'none';

  try {
    const res = await fetch(`${API}/wai/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, brand_id: brandId })
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error || 'Errore W.AI');
    waiDraft = data;
    renderWaiPreview(data);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Chiedi a W.AI';
  }
}

function renderWaiPreview(data) {
  const box = document.getElementById('waiPreview');
  const isQuery = data.type === 'query' || data.type === 'system';
  const warnings = data.preview?.warnings || [];
  const warnHtml = warnings.length
    ? `<div style="margin-top:8px;font-size:11px;color:#f5a623;">${warnings.join('<br>')}</div>`
    : '';

  if (isQuery) {
    box.innerHTML = `
      <div style="font-size:12px;font-weight:700;color:#f4ede2;margin-bottom:6px;">Risposta</div>
      <p style="font-size:13px;color:#ccc;line-height:1.6;">${data.answer || data.preview?.summary}</p>
      ${warnHtml}
    `;
  } else {
    const details = data.preview?.details || {};
    const detailsHtml = Object.entries(details).map(([k,v]) =>
      `<div style="font-size:12px;color:#999;"><strong style="color:#ccc;">${k}:</strong> ${v}</div>`
    ).join('');

    box.innerHTML = `
      <div style="font-size:12px;font-weight:700;color:#f4ede2;margin-bottom:6px;">Anteprima</div>
      <p style="font-size:13px;color:#00D4AA;margin-bottom:8px;">${data.preview?.summary}</p>
      <div style="margin-bottom:8px;">${detailsHtml}</div>
      ${warnHtml}
      <div style="display:flex;gap:8px;margin-top:12px;">
        <button onclick="confirmWai()" style="flex:1;padding:8px;background:#00D4AA;color:#0a0a0a;
          border:none;border-radius:6px;font-weight:700;font-size:12px;cursor:pointer;">Conferma</button>
        <button onclick="dismissWai()" style="flex:1;padding:8px;background:rgba(255,255,255,0.06);
          color:#999;border:1px solid rgba(255,255,255,0.08);border-radius:6px;font-size:12px;
          cursor:pointer;">Annulla</button>
      </div>
    `;
  }
  box.style.display = 'block';
}

async function confirmWai() {
  if (!waiDraft?.payload) return;
  const res = await fetch(`${API}/wai/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intent: waiDraft.intent, payload: waiDraft.payload })
  });
  const data = await res.json();
  if (!res.ok) return alert(data.error || 'Errore esecuzione');
  toast(data.message || 'Azione completata');
  dismissWai();
  refreshDashboardSection(waiDraft.intent);
}

function dismissWai() {
  waiDraft = null;
  document.getElementById('waiPreview').style.display = 'none';
  document.getElementById('waiPrompt').value = '';
}

function refreshDashboardSection(intent) {
  const prefix = intent.split('.')[0];
  const refreshMap = {
    push: () => { loadPushHistory(); loadScheduledPush(); },
    reward: () => { loadRewards?.(); },
    member: () => { loadMembers?.(); },
    campaign: () => { loadCampaigns?.(); },
    strip: () => { loadStripPromos?.(); },
  };
  (refreshMap[prefix] || (() => {}))();
}
```

---

## 9. Backend — Router e Executor

### File structure

```
src/
  engine/
    wai.js           // NUOVO: SYSTEM_PROMPT + callWai + buildWaiContext
  api/
    routes.js        // Aggiungere: POST /wai/ask, POST /wai/execute, GET /wai/history
  db/
    index.js         // Aggiungere: logWaiInteraction, tabella wai_log
```

### Executor mapping

```javascript
// In routes.js — POST /api/wai/execute
const EXECUTORS = {
  'push.schedule': async (payload) => {
    const item = await createScheduledPush(payload);
    return { message: `Push programmata: ${payload.title}`, data: item };
  },
  'push.send': async (payload) => {
    // Riusa la logica esistente di POST /push/send
    // ...
  },
  'reward.create': async (payload) => {
    const item = await createReward(payload);
    return { message: `Reward '${payload.name}' creato`, data: item };
  },
  'member.add_points': async (payload) => {
    // Cerca membro per nome/email, aggiungi punti
    // ...
  },
  'campaign.create': async (payload) => {
    const item = await createInstantWinCampaign(payload);
    return { message: `Campagna '${payload.name}' creata`, data: item };
  },
  'strip.create': async (payload) => {
    const item = await createStripPromo(payload);
    return { message: `Strip promo '${payload.title}' creata`, data: item };
  }
};

router.post('/wai/execute', async (req, res) => {
  const { intent, payload } = req.body;
  if (!intent || !payload) return res.status(400).json({ error: 'intent e payload richiesti' });
  if (!requireBrandId(req, res, payload.brand_id)) return;

  const executor = EXECUTORS[intent];
  if (!executor) return res.status(400).json({ error: `Intent '${intent}' non eseguibile` });

  try {
    const result = await executor(payload);
    await logWaiInteraction({ brand_id: payload.brand_id, intent, action: 'executed', payload });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

---

## 10. Database — Tabella wai_log

```sql
CREATE TABLE IF NOT EXISTS wai_log (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  user_id TEXT,
  prompt TEXT NOT NULL,
  intent TEXT,
  proposal JSONB,
  action TEXT DEFAULT 'planned',  -- planned | executed | dismissed
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 11. Sicurezza e limiti

- **Auth**: tutti gli endpoint /wai/* richiedono JWT valido (stesso auth del dashboard)
- **Brand isolation**: ogni operazione filtra per brand_id + verifica ownership con requireBrandId()
- **Rate limit**: max 20 chiamate /wai/ask per minuto per brand (Claude Opus è costoso)
- **Max tokens**: 1024 per risposta (sufficiente per JSON strutturato)
- **No delete/update v1**: l'executor rifiuta qualsiasi intent non nella whitelist EXECUTORS
- **Payload validation**: il backend valida e normalizza SEMPRE il JSON di Claude prima dell'esecuzione
- **Fallback**: se Claude non risponde o dà JSON invalido, mostrare errore, mai eseguire

---

## 12. Roadmap

| Versione | Feature | Dettaglio |
|----------|---------|-----------|
| v1.0 | Read + Create | Query analytics, creare push/reward/campagne, cercare membri |
| v1.1 | Update | Modificare reward, pausare campagne, editare push schedulate |
| v1.2 | Multi-turno | Storico sessione, follow-up ("cambia l'orario a 11") |
| v2.0 | Delete + batch | Eliminare membri, azioni su gruppi, double-confirm per distruttive |
| v2.1 | Proattività | W.AI suggerisce azioni ("non mandi push da 5 giorni") |
| v3.0 | Multi-brand | Operazioni cross-brand per agency manager |

---

## 13. Checklist implementazione

### Backend
- [ ] Creare `src/engine/wai.js` con SYSTEM_PROMPT + callWai() + buildWaiContext()
- [ ] Aggiungere `ANTHROPIC_API_KEY` a Railway env vars
- [ ] Aggiungere tabella `wai_log` in `src/db/index.js` (nel blocco getDb)
- [ ] Aggiungere funzioni DB: `logWaiInteraction`, `listWaiLog`
- [ ] Aggiungere endpoint `POST /api/wai/ask` in routes.js
- [ ] Aggiungere endpoint `POST /api/wai/execute` in routes.js con EXECUTORS map
- [ ] Aggiungere endpoint `GET /api/wai/history` in routes.js
- [ ] Aggiungere rate limiter (20 req/min per brand) su /wai/ask

### Frontend
- [ ] Aggiungere bottone floating W.AI in `dashboard/index.html` (bottom-right)
- [ ] Aggiungere overlay panel HTML con textarea + preview area
- [ ] Aggiungere JS: toggleWaiOverlay, askWai, renderWaiPreview, confirmWai, dismissWai
- [ ] Aggiungere refreshDashboardSection() per reload sezione dopo conferma
- [ ] Testare responsive su mobile (overlay full-width sotto 640px)

### Test
- [ ] Testare intent push.schedule con vari formati di richiesta
- [ ] Testare intent analytics.query con domande in italiano
- [ ] Testare intent reward.create con diversi tipi di reward
- [ ] Testare intent unknown con richieste fuori scope
- [ ] Verificare che il JSON di Claude venga sempre validato prima dell'esecuzione
- [ ] Verificare rate limiting
- [ ] Verificare che nessun intent distruttivo passi dall'executor
