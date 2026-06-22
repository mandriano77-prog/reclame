# Filodiretto · Cursor Build Brief
## HUB Convenzioni + PGA (People Growth Activator) — Sprint Lug-Ago 2026

**Target audience:** Cursor AI / agente dev autonomo + sviluppatori Digital Builders (Nando Bocca + Simone Ricci)
**Versione:** 1.0
**Data:** giugno 2026
**Repo:** [github.com/mandriano77-prog/Filo_Diretto](https://github.com/mandriano77-prog/Filo_Diretto)
**Branch consigliato:** `feature/hub-convenzioni-pga`
**Launch target:** **1 Settembre 2026** (lancio commerciale Filodiretto live)

---

## ⚡ TL;DR per Cursor

Stai per implementare 2 moduli interconnessi in 9 settimane (luglio + agosto 2026) su un repo Node.js/Express/PostgreSQL esistente:

1. **HUB Convenzioni** — pass aziendale diventa attivatore di sconti merchant convenzionati (online + fisico via QR)
2. **PGA · People Growth Activator** — sistema gamificato che trasforma engagement (survey, recognition, anniversari) in coin riscattabili in 10 esperienze di crescita personale (mentoring CEO, formazione, sabbatical, ecc.)

Entrambi i moduli condividono:
- Stessa PWA white-label `hub.filodiretto.app` (sub-app + sub-routes)
- Stesso JWT auth pattern (token nel back field del pass)
- Stesso pattern di analytics events
- Stessa filosofia di pricing flat (incluso nel tier, no PEPM)

Output finale: Filodiretto v2 con HUB Convenzioni + PGA live, deployato in produzione DigitalOcean, pronto per onboarding 3 clienti lighthouse Q4 2026.

---

## 1. Contesto progetto

### 1.1 Cos'è Filodiretto

Filodiretto è una piattaforma multi-tenant che fa di Apple/Google/Samsung Wallet il canale di comunicazione proprietario tra HR aziendali e dipendenti. Ogni dipendente riceve un pass digitale (`.pkpass` o equivalente) che vive nel wallet del telefono e funziona da:

- Canale push HR (lockscreen native, lettura misurata >95%)
- Badge fisico opzionale (NFC accessi uffici/timbratura)
- **(NUOVO)** Attivatore convenzioni aziendali (online + fisico)
- **(NUOVO)** People Growth Activator (coin engagement + marketplace 10 esperienze)

Brand consumer-facing: **Filodiretto**
NewCo legale: **Filodiretto S.r.l.** (in costituzione Q3 2026, Startup Innovativa)
Holding IP attuale: **Precise Advertising S.r.l.** (100% Adriano Coccia)

### 1.2 Stack tecnico (verificato da repo)

- **Runtime:** Node.js 20+ / Express (`src/server.js`)
- **DB:** PostgreSQL (`pg`), schema auto-applicato in `getDb()` in `src/db/index.js`. Pattern: ALTER incrementali nel blocco di init, **no migration CLI separato**
- **Pass signing:** OpenSSL `cms -sign` (NON node-forge). Vedi `src/engine/passkit.js`
- **Push:** APNs HTTP/2 nativa con JWT auth. Vedi `src/engine/apns.js`
- **Google Wallet:** servizio account JWT signing. Vedi `src/engine/google-wallet.js`
- **Email:** Resend. Vedi `src/engine/mailer.js`
- **Images:** Sharp
- **AI strip generation:** fal API. Vedi `src/engine/strip-promo.js`
- **Cron:** booted da `server.js`. Vedi `src/engine/scheduler.js`
- **Custom domain:** definito in env `CUSTOM_DOMAIN` (no scheme), es. `studio.filodiretto.app`
- **Hosting prod:** DigitalOcean App Platform (o Droplet + Nginx)
- **Multi-tenancy:** **sempre filtrare per `brand_id`** in ogni query
- **Dashboard admin:** single `index.html` in `src/dashboard/`, vanilla JS, inline

### 1.3 Cosa NON toccare (preservare)

- Sistema autenticazione esistente (JWT dashboard, login email/password)
- Logica core `passkit.js`, `apns.js`, `mailer.js`, `scheduler.js`, `google-wallet.js`, `strip-promo.js` — **estendere**, non riscrivere
- Multi-tenancy pattern: ogni query SQL filtra per `brand_id`
- Schema esistente tabelle: `brands`, `pass_templates`, `pass_instances`, `events`, `device_registrations`, `members`, `rewards`, `scheduled_pushes`, `instant_win_campaigns`, `strip_promos`, `wai_log`
- W.AI agent (in produzione) — estendere con nuovi intent, non rifare
- Dashboard layout esistente — aggiungere sezioni nuove, non rifare UI

### 1.4 File CLAUDE.md / WAI-SPEC.md nel repo

Leggere per contesto se necessario:
- `CLAUDE.md` — overview architettura completa
- `WAI-SPEC.md` — spec agente AI backoffice (estendibile con nuovi intent)
- `DEVELOPER_QUICK_START.md` — esempi codice integrazione

---

## 2. Architettura nuova (sintesi visiva)

```
┌──────────────────────────────────────────────────────────────────┐
│  PASS FILODIRETTO (Apple/Google/Samsung Wallet — esistente)      │
│                                                                  │
│  STORE CARD FIELDS:                                              │
│  ├── primary: COIN BALANCE (es. "247 punti")  ← NUOVO            │
│  └── secondary: dipendente · azienda                             │
│                                                                  │
│  BACK FIELDS:                                                    │
│  ├── 👤 Profilo dipendente                                       │
│  ├── 📢 HR News (esistente)                                      │
│  ├── 🛒 HUB CONVENZIONI ← link a hub.filodiretto.app/conv        │
│  ├── 🪙 PGA · GROWTH MARKETPLACE ← link a hub.filodiretto.app/pga│
│  ├── 📈 Activity & Coin Ledger ← link a hub.filodiretto.app/me   │
│  └── 🏢 Badge fisico (esistente)                                 │
└──────────────────────────────────────────────────────────────────┘
                              ↓ tap dipendente
┌──────────────────────────────────────────────────────────────────┐
│  PWA hub.filodiretto.app (NUOVA · responsive · white-label)      │
│                                                                  │
│  ROUTES:                                                         │
│  ├── /conv          → HUB Convenzioni (lista merchant, search,  │
│  │                    filtri, geolocation, dettaglio merchant)  │
│  ├── /conv/{id}     → dettaglio merchant + bottoni "vai sito" + │
│  │                    "mostra QR" (Pattern A activation)         │
│  ├── /pga           → marketplace 10 esperienze + dettaglio +    │
│  │                    booking flow + redemption coin             │
│  ├── /pga/{id}      → dettaglio esperienza + slot booking        │
│  ├── /me            → profilo dipendente: coin balance + ledger │
│  │                    activity history + booking storico         │
│  └── /qr/{type}/{id}→ schermata fullscreen QR per attivazione   │
│                       fisica (merchant scan)                     │
└──────────────────────────────────────────────────────────────────┘
                              ↓ API calls
┌──────────────────────────────────────────────────────────────────┐
│  BACKEND ESTESO (Node.js + Express + PostgreSQL)                 │
│                                                                  │
│  NUOVE TABELLE DB:                                               │
│  ├── merchants                                                   │
│  ├── merchant_locations                                          │
│  ├── convention_activations                                      │
│  ├── hub_settings                                                │
│  ├── coin_actions_config       ← PGA                             │
│  ├── coin_ledger               ← PGA                             │
│  ├── experiences_catalog       ← PGA                             │
│  ├── experience_bookings       ← PGA                             │
│  └── pga_settings              ← PGA                             │
│                                                                  │
│  NUOVE ROUTES API (/api/v1/):                                    │
│  ├── /merchants/*       (CRUD dashboard HR)                      │
│  ├── /hub/*             (read-only PWA conv)                     │
│  ├── /coins/*           (ledger + accrual triggers)              │
│  ├── /experiences/*     (CRUD dashboard HR catalog)              │
│  ├── /pga/*             (PWA marketplace + booking)              │
│  └── /partner/scan      (web app merchant QR validation)         │
│                                                                  │
│  CRON NUOVI:                                                     │
│  ├── coinAnniversariesJob    (giornaliero: assegna coin per     │
│  │                            compleanni e anniversari)         │
│  └── pgaBookingRemindersJob  (giornaliero: notifiche pre-event) │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│  DASHBOARD HR ESTESO (src/dashboard/index.html — esistente)      │
│                                                                  │
│  NUOVE SEZIONI:                                                  │
│  ├── 🛒 Convenzioni    (form add merchant, CSV import, analytics)│
│  ├── 🪙 PGA Catalog    (gestione 10 esperienze, slot calendar)   │
│  ├── 📊 Engagement     (dashboard coin distributed + activity)  │
│  └── ⚙️  Hub Settings  (white-label PWA, accent color, logo)    │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  PARTNER WEB APP (NUOVA · partner.filodiretto.app)               │
│  Usata da MERCHANT per scansionare QR del pass dipendente        │
│                                                                  │
│  Routes:                                                         │
│  └── /scan/{token}  → mostra OK/KO convenzione attiva            │
│                       (validazione HMAC server-side)             │
└──────────────────────────────────────────────────────────────────┘
```

### 2.1 Domini DNS

| Sub-dominio | Cosa | App backing |
|---|---|---|
| `studio.filodiretto.app` | Dashboard HR (esistente) | Backend principale |
| `hub.filodiretto.app` | PWA dipendente (NUOVA) | Stesso backend, sub-route o sub-app |
| `partner.filodiretto.app` | Web app merchant scan QR (NUOVA) | Stesso backend, sub-route minimal |

### 2.2 Auth model

| Componente | Auth |
|---|---|
| Dashboard HR | JWT esistente (login email/password admin) — **invariato** |
| PWA dipendente | JWT signed con `JWT_HUB_SECRET` — encoded nel URL back field pass: `?token={JWT}` |
| Partner web app | HMAC signed URL: `?serial={pass_serial}&merchant={id}&t={timestamp}&sig={hmac}` — no login |

JWT PWA claims:
```json
{
  "user_id": "uuid-pass-instance",
  "pass_serial": "1777058145062-14xh84pj3",
  "brand_id": "uuid-brand",
  "iat": 1782000000,
  "exp": 1789776000  // 90 giorni
}
```

Refresh: JWT rinnovato automaticamente quando pass si aggiorna via `webServiceURL` (sfruttare hook esistente APNs registration).

---

## 3. DB Schema completo (PostgreSQL)

Aggiungere nel blocco `getDb()` di `src/db/index.js` (pattern incremental DDL esistente). Tutto con `CREATE TABLE IF NOT EXISTS` per idempotenza.

### 3.1 HUB Convenzioni — 4 tabelle

```sql
-- Merchant convenzionati per brand
CREATE TABLE IF NOT EXISTS merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,  -- food | fitness | retail | salute | viaggi | tech | servizi | altro
  logo_url TEXT,
  description TEXT,
  discount_label TEXT NOT NULL,  -- es. "-15% su abbonamento annuale"
  conditions TEXT,
  valid_from DATE,
  valid_until DATE,
  active BOOLEAN DEFAULT TRUE,
  -- Online activation (Pattern A)
  online_enabled BOOLEAN DEFAULT FALSE,
  online_url TEXT,
  online_promo_code TEXT,
  -- Physical activation
  physical_enabled BOOLEAN DEFAULT FALSE,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_merchants_brand ON merchants(brand_id);
CREATE INDEX IF NOT EXISTS idx_merchants_active ON merchants(brand_id, active) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_merchants_category ON merchants(brand_id, category);

-- Indirizzi fisici merchant (1 merchant → N locations)
CREATE TABLE IF NOT EXISTS merchant_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  city TEXT,
  province TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'IT',
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  geofence_radius_m INTEGER DEFAULT 150,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_merchant_locations_merchant ON merchant_locations(merchant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_locations_geo ON merchant_locations(latitude, longitude);

-- Log eventi convenzioni (analytics)
CREATE TABLE IF NOT EXISTS convention_activations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  pass_serial TEXT NOT NULL,
  user_id TEXT,
  activation_type TEXT NOT NULL,  -- view | search_found | click_site | copy_code | show_qr | scan_qr | geofence_push
  location_id UUID REFERENCES merchant_locations(id),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activations_brand_merchant ON convention_activations(brand_id, merchant_id);
CREATE INDEX IF NOT EXISTS idx_activations_pass ON convention_activations(pass_serial);
CREATE INDEX IF NOT EXISTS idx_activations_created ON convention_activations(created_at DESC);

-- White-label PWA settings per brand
CREATE TABLE IF NOT EXISTS hub_settings (
  brand_id UUID PRIMARY KEY REFERENCES brands(id) ON DELETE CASCADE,
  logo_url TEXT,
  accent_color TEXT DEFAULT '#8B5CF6',
  welcome_message TEXT,
  categories_enabled JSONB DEFAULT '["food","fitness","retail","salute","viaggi","tech","servizi"]'::jsonb,
  geofencing_enabled BOOLEAN DEFAULT TRUE,
  geofencing_max_per_day INTEGER DEFAULT 3,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.2 PGA Coin & Marketplace — 5 tabelle

```sql
-- Configurazione regole accrual coin per brand
CREATE TABLE IF NOT EXISTS coin_actions_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  action_key TEXT NOT NULL,
  -- Valori action_key:
  --   onboarding | birthday | anniversary_1y | anniversary_5y | anniversary_10y |
  --   quiz_completed | survey_completed | recognition_received | recognition_given |
  --   convention_first_use | challenge_completed | custom_*
  coin_amount INTEGER NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT TRUE,
  UNIQUE(brand_id, action_key),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ledger transazioni coin (accrual + redemption)
CREATE TABLE IF NOT EXISTS coin_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  pass_serial TEXT NOT NULL,
  user_id TEXT,
  action_key TEXT NOT NULL,
  coin_amount INTEGER NOT NULL,  -- positivo = accredito, negativo = debito (redemption)
  description TEXT,  -- es. "Compleanno", "Riscatto: Colazione con CEO"
  related_entity_type TEXT,  -- recognition_id | booking_id | quiz_id | ...
  related_entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coin_ledger_pass ON coin_ledger(pass_serial, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coin_ledger_brand ON coin_ledger(brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coin_ledger_action ON coin_ledger(brand_id, action_key);

-- View per balance corrente
CREATE OR REPLACE VIEW pass_coin_balance AS
SELECT
  pass_serial,
  brand_id,
  SUM(coin_amount) AS balance,
  MAX(created_at) AS last_activity,
  COUNT(*) FILTER (WHERE coin_amount > 0) AS total_accruals,
  COUNT(*) FILTER (WHERE coin_amount < 0) AS total_redemptions
FROM coin_ledger
GROUP BY pass_serial, brand_id;

-- Catalogo esperienze marketplace (10 default + custom HR)
CREATE TABLE IF NOT EXISTS experiences_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  -- Identità
  key TEXT NOT NULL,  -- es. "ceo_lunch", "linkedin_learning", "growth_day", "sabbatical_mini"
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,  -- career | learning | softskill | time | purpose | brand | external
  -- Costo / vincoli
  coin_cost INTEGER NOT NULL,
  max_per_user_per_year INTEGER,  -- es. 1 sabbatical/anno
  max_total_per_month INTEGER,  -- es. 2 colazioni CEO/mese aziendalmente
  -- Operativo
  internal BOOLEAN DEFAULT TRUE,  -- TRUE = esperienza interna (no cash); FALSE = esterna (provider)
  external_provider TEXT,  -- es. "LinkedIn Learning", "BetterUp"
  external_cost_eur DECIMAL(10,2),  -- costo cash per HR cliente
  requires_booking BOOLEAN DEFAULT TRUE,  -- TRUE = serve slot scheduling, FALSE = redemption immediata (es. libro)
  active BOOLEAN DEFAULT TRUE,
  -- UI
  image_url TEXT,
  display_order INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brand_id, key)
);

CREATE INDEX IF NOT EXISTS idx_experiences_brand_active ON experiences_catalog(brand_id, active) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_experiences_category ON experiences_catalog(brand_id, category);

-- Booking esperienze
CREATE TABLE IF NOT EXISTS experience_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  experience_id UUID NOT NULL REFERENCES experiences_catalog(id) ON DELETE CASCADE,
  pass_serial TEXT NOT NULL,
  user_id TEXT,
  coin_amount INTEGER NOT NULL,  -- coin scalati per questa booking
  status TEXT NOT NULL DEFAULT 'pending',
  -- Valori status:
  --   pending     | confermo coin scalati, in attesa di approval HR/scheduling
  --   confirmed   | HR ha confermato slot/attivazione
  --   delivered   | esperienza completata (per esterne) o evento avvenuto (per interne)
  --   cancelled   | annullata (coin rimborsati)
  scheduled_at TIMESTAMPTZ,  -- per esperienze con scheduling (cena CEO, mentoring)
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_brand ON experience_bookings(brand_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_pass ON experience_bookings(pass_serial, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_experience ON experience_bookings(experience_id, status);

-- PGA settings per brand
CREATE TABLE IF NOT EXISTS pga_settings (
  brand_id UUID PRIMARY KEY REFERENCES brands(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT FALSE,  -- HR deve abilitare esplicitamente PGA
  welcome_message TEXT,
  -- Budget allocation annuo per esperienze esterne (cash cap)
  annual_budget_external_eur DECIMAL(10,2),
  annual_budget_used_eur DECIMAL(10,2) DEFAULT 0,
  -- Notifiche HR
  notify_hr_on_booking BOOLEAN DEFAULT TRUE,
  notify_hr_email TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.3 Seed iniziale (10 esperienze default per ogni nuovo brand che attiva PGA)

Quando HR del nuovo brand attiva PGA per la prima volta (PUT `/api/v1/brands/{id}/pga-settings { enabled: true }`), eseguire seed automatico in `experiences_catalog` con questi 10 record default:

```javascript
const PGA_DEFAULT_EXPERIENCES = [
  {
    key: 'ceo_lunch', name: 'Colazione/pranzo con il CEO',
    description: 'Un\'ora con il/la CEO per parlare di carriera, idee, futuro. Un\'occasione che difficilmente arriva nel quotidiano.',
    category: 'career', coin_cost: 1500, max_per_user_per_year: 1, max_total_per_month: 2,
    internal: true, requires_booking: true, display_order: 10
  },
  {
    key: 'mentoring_leader', name: 'Mentoring 1:1 con un leader (3 sessioni)',
    description: 'Scegli un leader interno con cui vuoi confrontarti. 3 incontri da 1 ora distribuiti su 3 mesi.',
    category: 'career', coin_cost: 1000, max_per_user_per_year: 2, max_total_per_month: 5,
    internal: true, requires_booking: true, display_order: 20
  },
  {
    key: 'growth_day_half', name: 'Mezza giornata "Growth day"',
    description: 'Mezza giornata di permesso pagato dedicata a un progetto personale di crescita: corso, lettura, esplorazione.',
    category: 'time', coin_cost: 300, max_per_user_per_year: 6,
    internal: true, requires_booking: true, display_order: 30
  },
  {
    key: 'linkedin_learning', name: 'LinkedIn Learning · abbonamento annuale',
    description: 'Accesso a tutta la piattaforma LinkedIn Learning per 12 mesi.',
    category: 'learning', coin_cost: 800, max_per_user_per_year: 1,
    internal: false, external_provider: 'LinkedIn', external_cost_eur: 240, requires_booking: false, display_order: 40
  },
  {
    key: 'workshop_softskill', name: 'Workshop interno · soft skill',
    description: 'Workshop interno mensile su soft skill: negoziazione, public speaking, leadership emergente. Gruppo max 10 partecipanti.',
    category: 'softskill', coin_cost: 600, max_per_user_per_year: 3, max_total_per_month: 10,
    internal: true, requires_booking: true, display_order: 50
  },
  {
    key: 'library_book', name: 'Library aziendale · 1 libro/audiolibro',
    description: 'Scegli un libro o audiolibro da catalogo curato. Consegna in azienda o digitale.',
    category: 'learning', coin_cost: 100, max_per_user_per_year: 12,
    internal: false, external_provider: 'Amazon', external_cost_eur: 20, requires_booking: false, display_order: 60
  },
  {
    key: 'volunteer_day', name: '1 giornata di volontariato pagata',
    description: 'Una giornata di permesso pagato per fare volontariato presso un\'associazione di tua scelta o partner CSR aziendale.',
    category: 'purpose', coin_cost: 500, max_per_user_per_year: 2,
    internal: true, requires_booking: true, display_order: 70
  },
  {
    key: 'sabbatical_mini', name: 'Sabbatical mini · 1 settimana',
    description: 'Una settimana di permesso pagato aggiuntiva per dedicarsi a un progetto personale significativo.',
    category: 'time', coin_cost: 5000, max_per_user_per_year: 1, max_total_per_month: 1,
    internal: true, requires_booking: true, display_order: 80
  },
  {
    key: 'coaching_external', name: 'Coaching professionale · 3 sessioni',
    description: '3 sessioni di coaching 1:1 con coach professionista certificato (BetterUp / CoachHub).',
    category: 'softskill', coin_cost: 1500, max_per_user_per_year: 2,
    internal: false, external_provider: 'BetterUp', external_cost_eur: 400, requires_booking: true, display_order: 90
  },
  {
    key: 'personal_spotlight', name: 'Personal Spotlight · Meet the Team',
    description: 'Sei in evidenza nel "Meet the team" del sito aziendale per 30 giorni + boost sui canali social aziendali.',
    category: 'brand', coin_cost: 300, max_per_user_per_year: 1, max_total_per_month: 4,
    internal: true, requires_booking: true, display_order: 100
  }
];
```

E coin actions default:

```javascript
const COIN_ACTIONS_DEFAULT = [
  { action_key: 'onboarding', coin_amount: 200, description: 'Welcome bonus al primo onboarding' },
  { action_key: 'birthday', coin_amount: 50, description: 'Compleanno' },
  { action_key: 'anniversary_1y', coin_amount: 100, description: '1 anno in azienda' },
  { action_key: 'anniversary_5y', coin_amount: 500, description: '5 anni in azienda' },
  { action_key: 'anniversary_10y', coin_amount: 1500, description: '10 anni in azienda' },
  { action_key: 'quiz_completed', coin_amount: 20, description: 'Quiz compliance completato' },
  { action_key: 'survey_completed', coin_amount: 5, description: 'Survey compilato' },
  { action_key: 'recognition_received', coin_amount: 10, description: 'Recognition ricevuta da un collega' },
  { action_key: 'recognition_given', coin_amount: 0, description: 'Recognition data (no coin perso)' },
  { action_key: 'convention_first_use', coin_amount: 5, description: 'Prima attivazione di una convenzione' },
  { action_key: 'challenge_completed', coin_amount: 50, description: 'Sfida team completata' }
];
```

---

## 4. API endpoints completi

Tutti sotto `/api/v1/`. Pattern routes.js esistente.

### 4.1 Dashboard HR (auth JWT admin)

#### Merchants
| Metodo | Path | Descrizione |
|---|---|---|
| `GET` | `/merchants?brand_id={uuid}&category={cat}&search={q}&active={bool}` | Lista merchant filtrabile |
| `POST` | `/merchants` | Crea merchant singolo |
| `PUT` | `/merchants/{id}` | Aggiorna merchant |
| `DELETE` | `/merchants/{id}` | Soft delete (active=false) |
| `POST` | `/merchants/import-csv` | Bulk import CSV (multipart) |
| `GET` | `/merchants/{id}/locations` | Lista indirizzi fisici |
| `POST` | `/merchants/{id}/locations` | Aggiungi indirizzo |
| `DELETE` | `/locations/{id}` | Rimuovi indirizzo |
| `GET` | `/merchants/{id}/analytics?days={n}` | Analytics merchant (default 30gg) |

#### Hub Settings
| Metodo | Path | Descrizione |
|---|---|---|
| `GET` | `/brands/{id}/hub-settings` | Recupera settings white-label |
| `PUT` | `/brands/{id}/hub-settings` | Aggiorna logo/colore/categorie |

#### PGA
| Metodo | Path | Descrizione |
|---|---|---|
| `GET` | `/brands/{id}/pga-settings` | Recupera PGA settings |
| `PUT` | `/brands/{id}/pga-settings` | Aggiorna PGA (incluso `enabled: true` → triggera seed 10 esperienze) |
| `GET` | `/experiences?brand_id={uuid}` | Lista esperienze del brand |
| `POST` | `/experiences` | Crea esperienza custom |
| `PUT` | `/experiences/{id}` | Aggiorna (es. attiva/disattiva, cambia coin_cost) |
| `DELETE` | `/experiences/{id}` | Soft delete |
| `GET` | `/experiences/{id}/bookings?status={s}` | Lista booking di un'esperienza |
| `PUT` | `/bookings/{id}/status` | HR conferma/cancel booking (status: confirmed/delivered/cancelled) |
| `GET` | `/coins/actions?brand_id={uuid}` | Lista regole accrual coin del brand |
| `PUT` | `/coins/actions/{id}` | Aggiorna regola (es. cambia coin per anniversary_5y) |
| `POST` | `/coins/manual-grant` | HR concede coin manualmente a un dipendente (es. riconoscimento speciale) |
| `GET` | `/brands/{id}/engagement-analytics?days={n}` | Dashboard aggregato: coin distribuiti, redemption, top esperienze richieste, top dipendenti by activity (aggregato — no individual tracking) |

### 4.2 PWA dipendente (auth JWT hub)

| Metodo | Path | Descrizione |
|---|---|---|
| `GET` | `/hub/bootstrap?token={jwt}` | Init PWA: profilo + balance + white-label + esperienze + merchants |
| `GET` | `/hub/merchants?token={jwt}&category={cat}&search={q}` | Lista merchant filtrabile |
| `GET` | `/hub/merchants/{id}?token={jwt}` | Dettaglio merchant + locations |
| `GET` | `/hub/merchants/nearby?token={jwt}&lat={lat}&lon={lon}&radius_km={r}` | Merchant entro raggio |
| `POST` | `/hub/events` | Log evento (view, click_site, copy_code, show_qr) |
| `GET` | `/hub/me?token={jwt}` | Profilo dipendente: coin balance + ledger ultimi 50 eventi + booking history |
| `GET` | `/hub/experiences?token={jwt}&category={cat}` | Lista esperienze marketplace |
| `GET` | `/hub/experiences/{id}?token={jwt}` | Dettaglio esperienza + slot disponibili (se requires_booking) |
| `POST` | `/hub/experiences/{id}/redeem?token={jwt}` | Riscatta esperienza (debita coin + crea booking) |
| `GET` | `/hub/bookings?token={jwt}` | Booking history dipendente |
| `POST` | `/hub/bookings/{id}/cancel?token={jwt}` | Cancella booking (rimborsa coin se status pending) |

### 4.3 Partner web app (auth HMAC)

| Metodo | Path | Descrizione |
|---|---|---|
| `GET` | `/partner/scan?serial={s}&merchant={m}&t={timestamp}&sig={hmac}` | Validate QR + log scan_qr event |

### 4.4 Coin accrual triggers (interni)

Funzioni helper esposte solo internamente (richiamate da cron, webhook, altri moduli):

```javascript
// src/engine/coins.js
async function grantCoin(brandId, passSerial, actionKey, options = {}) {
  // 1. Verifica regola attiva in coin_actions_config
  // 2. Recupera coin_amount
  // 3. INSERT in coin_ledger
  // 4. Trigger push notification opzionale se coin_amount >= threshold (es. anniversario)
  // 5. Aggiorna saldo pass via APNs push (rigenera pass con nuovo balance)
  // Return: { success, new_balance, ledger_id }
}

async function debitCoin(brandId, passSerial, coinAmount, options = {}) {
  // Per redemption: verifica balance sufficiente, debita, return new balance
}

async function getCurrentBalance(brandId, passSerial) {
  // Query pass_coin_balance view
}
```

### 4.5 Cron jobs nuovi (in `src/engine/scheduler.js`)

```javascript
// Daily 06:00 — assegna coin per compleanni e anniversari
cron.schedule('0 6 * * *', async () => {
  // Query members con birthday = oggi → grantCoin('birthday')
  // Query members con anniversary = oggi (1y, 5y, 10y) → grantCoin('anniversary_Xy')
});

// Daily 09:00 — promemoria booking PGA imminenti (24h prima)
cron.schedule('0 9 * * *', async () => {
  // Query experience_bookings con scheduled_at tra ora+23h e ora+25h
  // Invio push notification "Ricordati: domani hai colazione con il CEO"
});
```

---

## 5. CSV import format (merchants)

Schema CSV bulk upload merchant. UTF-8, separatore `;`, header obbligatorio.

```csv
merchant_name;category;logo_url;description;discount_label;conditions;valid_until;online_enabled;online_url;online_promo_code;physical_enabled;address;city;latitude;longitude
Virgin Active;fitness;https://logos.example/virgin.png;Palestre premium;-15% abbonamento annuale;Solo nuovi abbonamenti;2026-12-31;true;https://virginactive.it;ACME15;true;Via Sarca 22;Milano;45.5021;9.2147
Mondadori Store;retail;https://logos.example/mondadori.png;Libreria;-10% libri non scolastici;Escluso bestseller;2026-12-31;true;https://mondadoristore.it;ACME10;true;Piazza Duomo 1;Milano;45.4642;9.1900
```

Parser deve:
- Validare colonne obbligatorie (`merchant_name`, `category`, `discount_label`)
- Skip righe con errori, report a UI righe importate vs scartate
- Idempotente: se `name` già esiste per brand → UPDATE
- Geocoding fallback: se `latitude`/`longitude` mancanti ma `address` presente, usa Nominatim OpenStreetMap (free, no API key)

---

## 6. PWA Frontend (hub.filodiretto.app)

### 6.1 Stack

- **Coerenza con dashboard esistente:** vanilla JavaScript (no React/Vue). Riusa lo stesso pattern del `dashboard/index.html` esistente.
- **Mobile-first:** breakpoint 640px
- **PWA manifest:** `public/hub-manifest.json` con icon, theme color dinamico da `hub_settings.accent_color`, display `standalone`
- **Service Worker:** cache base + cache lista merchant/esperienze in localStorage
- **No framework heavy:** vanilla JS + CSS utility-like inline (coerente con dashboard)
- **Font:** Inter + JetBrains Mono (design system Filodiretto)

### 6.2 Page structure

| Route | Componente | Note |
|---|---|---|
| `/` | redirect → `/conv` | Default landing |
| `/conv` | Lista merchant | Search + filtri categoria + toggle "vicino a me" |
| `/conv/{id}` | Dettaglio merchant | Foto, condizioni, locations, bottoni "vai sito" + "mostra QR" |
| `/qr/conv/{merchant_id}` | QR fullscreen attivazione fisica | URL signed HMAC, refresh ogni 60min |
| `/pga` | Marketplace 10 esperienze | Card grid, filtro categoria, mostra coin cost + balance attuale top |
| `/pga/{id}` | Dettaglio esperienza | Image, description, conditions, max/year, slot disponibili (se requires_booking), bottone "Riscatta con X coin" |
| `/me` | Profilo dipendente | Coin balance prominente, ledger ultimi 30 movimenti, booking history, cancel pending bookings |
| `/error` | Error page | Token invalido/scaduto/brand non attivo |

### 6.3 Componenti chiave

**Bootstrap flow (load PWA):**
```
1. Read ?token=... from URL
2. POST /hub/bootstrap?token=... 
3. Receive: profile + brand + hub_settings + pga_settings + merchants[] + experiences[]
4. Store in localStorage (offline cache)
5. Apply white-label CSS variables (logo + accent color)
6. Render default route (/conv)
```

**Coin balance widget (always visible top right su tutte le pagine):**
```html
<div class="coin-widget">
  <span class="coin-icon">🪙</span>
  <span class="coin-amount">247</span>
  <a href="/me" class="coin-link">→</a>
</div>
```

**Marketplace card esperienza:**
```
┌─────────────────────────────┐
│ [Image]                     │
│                             │
│ 🪙 1.500 coin               │
│                             │
│ Colazione con il CEO        │
│ Career · Internal           │
│                             │
│ Max 1/anno · 2 slot/mese    │
│                             │
│ [SCOPRI]                    │
└─────────────────────────────┘
```

**Redemption flow:**
```
1. User tap esperienza → dettaglio
2. Se requires_booking: mostra slot disponibili → user seleziona slot
3. Confirm modal: "Riscatti 'Colazione CEO' per 1.500 coin? Balance dopo: 247 - 1.500 = ... insufficiente"
4. Se balance sufficient: POST /hub/experiences/{id}/redeem
5. Backend: debita coin + crea booking (status pending) + email a HR cliente + email/push a dipendente conferma
6. UI: success state "Booking confermato! HR ti contatterà entro 48h"
```

**Geofencing nativo Apple Wallet:**
- Nel `passkit.js`, generare `pass.json` con array `locations[]` popolato con coordinate di tutti i merchant convenzionati attivi del brand del dipendente
- Apple/iOS gestisce push automaticamente quando device entra nel raggio `geofence_radius_m`
- Backend: aggiornamento pass quando merchant attivi cambiano (cron settimanale o trigger on add/remove merchant)

---

## 7. Estensione dashboard HR (src/dashboard/index.html)

Aggiungere 4 nuove sezioni alla sidebar/nav esistente:

### 7.1 Sezione "🛒 Convenzioni"

- Form aggiungi merchant manuale (campi DB)
- Upload CSV bulk import + preview prima del commit
- Tabella merchant esistenti con colonne: name, category, status, online_url, click_count_30d, copy_code_30d, scan_qr_30d
- Filtri per categoria + search
- Modal modifica merchant
- Modal aggiungi indirizzo fisico (con geocoding automatico se serve)
- View analytics merchant singolo (chart eventi ultimi 30/60/90gg)

### 7.2 Sezione "🪙 PGA Catalog"

- Toggle "Attiva PGA per questo brand" (PUT pga-settings.enabled) — triggera seed 10 esperienze
- Tabella 10 esperienze default + custom: name, category, coin_cost, internal/external, active, max/year
- Modal modifica esperienza (cambia coin_cost, attiva/disattiva, max_per_user_per_year)
- Tabella bookings pending: dipendente, esperienza, scheduled_at, status, azioni (confirm/cancel/mark delivered)
- Calendar view bookings (vista mensile semplice)
- Sezione "Regole coin accrual" — tabella `coin_actions_config` modificabile (HR può modificare coin per ogni action)
- Bottone "Concedi coin manuali" (form: dipendente, coin, motivo)

### 7.3 Sezione "📊 Engagement"

Dashboard aggregato per HR (NO individual tracking — solo aggregati):
- Coin distribuiti questo mese / quarter / anno
- Coin redempti (mese / trimestre / anno)
- Top 5 esperienze più richieste (count bookings)
- Top 5 azioni che generano più coin (per `action_key`)
- Heatmap activity by day-of-week
- Cohort retention: % dipendenti attivi (almeno 1 evento coin/mese) ultimi 6 mesi
- Export CSV dati aggregati per CDA/report

### 7.4 Sezione "⚙️ Hub Settings"

- Upload logo PWA (file picker)
- Color picker accent color
- Categorie convenzioni abilitate (checkbox per ognuna)
- Toggle geofencing on/off + max push/giorno
- Toggle PGA enabled + setup budget annuale esterno (cap cash)
- Welcome message PWA (sia HUB Convenzioni sia PGA)
- Preview live della PWA con settings applicati

---

## 8. Partner web app (partner.filodiretto.app)

Web app minimal per merchant. Una sola route, no login.

### 8.1 Route

`GET /scan?serial={s}&merchant={m}&t={timestamp}&sig={hmac}`

### 8.2 Logica

```javascript
async function scanHandler(req, res) {
  const { serial, merchant, t, sig } = req.query;
  
  // 1. Verifica HMAC
  const expectedSig = crypto.createHmac('sha256', QR_HMAC_SECRET)
    .update(`${serial}:${merchant}:${t}`)
    .digest('hex');
  if (sig !== expectedSig) return renderError('QR non valido');
  
  // 2. Verifica timestamp (max 60 min)
  const now = Date.now() / 1000;
  if (now - parseInt(t) > 3600) return renderError('QR scaduto');
  
  // 3. Verifica pass + merchant attivi
  const pass = await getPassBySerial(serial);
  if (!pass || pass.status !== 'active') return renderError('Pass non attivo');
  
  const merchantData = await getMerchant(merchant);
  if (!merchantData || !merchantData.active) return renderError('Convenzione non attiva');
  
  // 4. Verifica match brand
  if (pass.brand_id !== merchantData.brand_id) return renderError('Convenzione non valida');
  
  // 5. Log evento
  await logActivation({ ...args, type: 'scan_qr' });
  
  // 6. Render OK con dettagli
  return renderSuccess({
    dipendente: pass.customer_data.name,
    azienda: pass.brand.name,
    sconto: merchantData.discount_label,
    condizioni: merchantData.conditions
  });
}
```

### 8.3 UI

Pagina super-minimal:

```html
<!-- Versione OK -->
<div class="result ok">
  ✅ CONVENZIONE ATTIVA
  
  Marco Rossi
  dipendente Acme S.r.l.
  
  SCONTO: -15% su abbonamento annuale
  Condizioni: Solo nuovi abbonamenti
</div>

<!-- Versione KO -->
<div class="result ko">
  ❌ CONVENZIONE NON VALIDA
  
  Motivo: QR scaduto (>60 min dalla generazione)
</div>
```

Stile dark, font monospace, full-screen, easy-to-read da merchant in qualsiasi condizione.

---

## 9. W.AI integration (opzionale, sprint 4)

Estensione `src/engine/wai.js` SYSTEM_PROMPT con nuovi intent:

```
INTENT NUOVI HUB CONVENZIONI:
- merchant.create — Aggiungere convenzione: "Aggiungi convenzione Virgin -15% per abbonamenti"
- merchant.list — Lista convenzioni attive: "Quante convenzioni abbiamo?"
- merchant.analytics — Analytics utilizzo: "Quale convenzione viene usata di più?"
- merchant.deactivate — Disattivare: "Disattiva la convenzione Mondadori"

INTENT NUOVI PGA:
- pga.enable — Attivare PGA per il brand
- experience.create — Creare esperienza custom: "Aggiungi esperienza: corso AI per 2000 coin"
- experience.modify — Modificare: "Cambia il costo della cena CEO a 2000 coin"
- coin.grant_manual — Concedere coin: "Dai 100 coin a Marco Rossi per riconoscimento speciale"
- engagement.report — Report aggregati: "Quanti coin abbiamo distribuito questo mese?"
- booking.list — Lista booking pending: "Quali esperienze sono in attesa di conferma?"
```

Estendere mappa `EXECUTORS` in `routes.js`.

---

## 10. Sicurezza & privacy (GDPR + Statuto Lavoratori)

### 10.1 Consensi richiesti

- **Geolocation tracking PWA** (push geofencing) — opt-in nelle settings PWA dipendente
- **Tracking eventi utilizzo** (analytics PGA + convenzioni) — informativa al primo accesso PWA
- **PGA opt-in** dipendente — alla prima visita `/pga`, mostra informativa privacy + consenso

### 10.2 Data retention

- `convention_activations`: 24 mesi rolling
- `coin_ledger`: 60 mesi rolling (per certificazione anzianità coin)
- `experience_bookings`: 36 mesi rolling

### 10.3 Art. 88 GDPR (dati lavoratori)

- Dashboard HR mostra **SOLO dati aggregati per merchant/esperienza/categoria**
- NESSUN dato individuale visibile a HR (chi è andato in palestra, chi ha riscattato cena CEO)
- Eccezione: HR vede booking dipendente solo se status=pending e serve approval o scheduling

### 10.4 Art. 4 Statuto Lavoratori

- Geofencing = controllo a distanza → richiede consenso esplicito dipendente o accordo sindacale
- Documentazione onboarding: HR cliente dichiara di avere consenso prima di abilitare geofencing
- Se geofencing OFF (default per nuovi brand): PWA funziona ma niente push location-based

### 10.5 JWT PWA

- Algorithm: HS256 con `JWT_HUB_SECRET` (separato da `JWT_SECRET` dashboard)
- Expiry: 90 giorni
- Refresh: triggered da pass `webServiceURL` update
- Revocabile lato server (blacklist `pass_serial` se dipendente lascia azienda)

### 10.6 QR HMAC signing

- HMAC SHA256 con `QR_HMAC_SECRET`
- Payload: `${serial}:${merchant}:${timestamp}`
- Validità: 60 minuti
- Evita screenshot riusabili

---

## 11. Acceptance Criteria (34 totali, machine-readable)

### 11.1 HR backoffice — HUB Convenzioni (6)

- [ ] AC-001: HR può creare merchant manualmente via form
- [ ] AC-002: HR può uploadare CSV con 50 merchant → tutti importati in <30 sec con report errori
- [ ] AC-003: HR vede dashboard real-time eventi ultimi 30 giorni per merchant
- [ ] AC-004: HR può cambiare logo PWA e accent color (white-label)
- [ ] AC-005: HR può disattivare merchant (soft delete, no eliminazione)
- [ ] AC-006: Solo HR del proprio brand vede merchant del proprio brand (multi-tenancy enforced)

### 11.2 Pass dipendente (4)

- [ ] AC-007: Pass back fields include link "HUB CONVENZIONI" + "PGA GROWTH MARKETPLACE" + "ATTIVITY & COINS"
- [ ] AC-008: Tap link apre PWA con token nel URL
- [ ] AC-009: Pass include `locations[]` con coordinate merchant attivi (per geofencing Apple Wallet)
- [ ] AC-010: Pass primary field mostra "🪙 COIN: 247" che si aggiorna real-time

### 11.3 PWA HUB Convenzioni (6)

- [ ] AC-011: Bootstrap PWA <2 sec su 4G mobile
- [ ] AC-012: Search merchant funziona per name, description, category
- [ ] AC-013: Filtri categoria funzionano
- [ ] AC-014: "Vicino a me" mostra solo merchant entro 5 km
- [ ] AC-015: Dettaglio merchant: logo, sconto, condizioni, locations, bottoni "vai al sito" + "mostra QR"
- [ ] AC-016: "Vai al sito" copia codice in clipboard + apre nuova tab + log evento

### 11.4 PGA Marketplace (8)

- [ ] AC-017: HR attiva PGA tramite toggle → 10 esperienze default seedate automaticamente
- [ ] AC-018: Dipendente vede balance coin sempre visibile in PWA (widget top right)
- [ ] AC-019: Lista marketplace mostra 10 esperienze ordinate per `display_order` con coin cost prominente
- [ ] AC-020: Dettaglio esperienza mostra: descrizione, max/year, slot disponibili (se booking)
- [ ] AC-021: Redemption flow: conferma modal → POST /redeem → debit coin + crea booking pending
- [ ] AC-022: Booking pending notifica HR via email automatica
- [ ] AC-023: Dipendente può cancellare booking pending (rimborso coin automatico)
- [ ] AC-024: Esperienza con max_total_per_month raggiunto → CTA disabilitato con messaggio "esaurito questo mese"

### 11.5 Coin tracker (4)

- [ ] AC-025: Cron giornaliero alle 06:00 assegna coin per compleanni/anniversari
- [ ] AC-026: Recognition peer-to-peer trigger coin a chi riceve (10) e 0 a chi dà
- [ ] AC-027: Quiz completed + survey completed triggerano coin via API trigger
- [ ] AC-028: View `pass_coin_balance` ritorna balance corretto sempre (somma ledger)

### 11.6 Partner web app (4)

- [ ] AC-029: Merchant scansiona QR del pass → apre `/partner/scan/?...` → mostra OK/KO in <1 sec
- [ ] AC-030: HMAC validato server-side, QR scaduto (>60 min) → KO
- [ ] AC-031: Log automatico `scan_qr` event in `convention_activations`
- [ ] AC-032: Brand mismatch (pass brand ≠ merchant brand) → KO

### 11.7 Compliance (2)

- [ ] AC-033: Dashboard HR mostra SOLO dati aggregati (nessun individual tracking)
- [ ] AC-034: PWA chiede consensi geolocation + tracking al primo accesso, gestiti via opt-in

---

## 12. Roadmap 9 settimane (sprint Lug-Ago 2026)

### Sprint 1 — Settimane 1-2 (1-14 luglio) · Backend foundation
- DB schema completo (9 tabelle nuove)
- API REST dashboard HR (CRUD merchant + experiences + coins/actions)
- CSV import + Nominatim geocoding
- Estensione `passkit.js`: back fields HUB/PGA/Me + `locations[]` + balance field
- Funzioni `coins.js`: grantCoin, debitCoin, getCurrentBalance
- Cron jobs: anniversari + booking reminders
- Test unit

### Sprint 2 — Settimane 3-4 (15-28 luglio) · PWA core (Convenzioni)
- Setup `hub.filodiretto.app` (sub-app o sub-routes)
- Bootstrap endpoint + auth JWT hub
- PWA pages `/conv`, `/conv/{id}`, `/qr/conv/{id}`, `/me`
- Search + filtri categoria (client-side)
- Bottoni "vai al sito" + "copy code" + log eventi
- Mobile-first UI + design system Filodiretto
- Coin balance widget always visible

### Sprint 3 — Settimane 5-6 (29 luglio - 11 agosto) · PWA PGA marketplace
- PWA pages `/pga`, `/pga/{id}`
- Marketplace UI con 10 esperienze card grid
- Redemption flow + booking creation
- Slot scheduling per esperienze interne (cena CEO, mentoring, growth day)
- Email automation HR + dipendente
- Geolocation "vicino a me" + push geofencing nativo Apple Wallet
- Partner web app `partner.filodiretto.app` (scan QR validate HMAC)
- Service worker + offline mode

### Sprint 4 — Settimane 7-9 (12-31 agosto) · Polish + dashboard HR
- Dashboard HR: nuove sezioni Convenzioni + PGA Catalog + Engagement + Hub Settings
- Analytics aggregati dashboard
- White-label settings (logo + accent color per brand)
- Onboarding wizard HR (CSV merchant + attivazione PGA + seed 10 esperienze)
- W.AI integration (intent nuovi)
- Documentation utente HR + dipendente
- Bug fixing + UX polish
- Smoke test produzione

### 1 Settembre 2026 — LAUNCH 🚀

---

## 13. Dependencies npm da installare

```bash
npm install qrcode                 # generazione QR pass dipendente
npm install csv-parse              # parsing CSV import
npm install ioredis                # cache PWA + rate limiting (opzionale ma raccomandato)
# Già presenti nel repo: pg, sharp, archiver, jsonwebtoken, express, node-fetch, sharp, resend
```

---

## 14. Environment variables nuove

Da aggiungere al `.env.example` e all'App Platform DigitalOcean:

```bash
# JWT hub (separato da JWT_SECRET dashboard)
JWT_HUB_SECRET=<random 32 byte hex>

# QR HMAC signing
QR_HMAC_SECRET=<random 32 byte hex>

# Geocoding (Nominatim free, no key necessaria)
NOMINATIM_USER_AGENT=Filodiretto/1.0 (contact@filodiretto.app)

# URL pubblici PWA
HUB_BASE_URL=https://hub.filodiretto.app
PARTNER_BASE_URL=https://partner.filodiretto.app

# Geofencing defaults
GEOFENCING_DEFAULT_RADIUS_M=150
GEOFENCING_MAX_PER_DAY=3

# PGA defaults
PGA_DEFAULT_ANNUAL_BUDGET_EUR=5000  # cap esperienze esterne per brand/anno
PGA_BOOKING_REMINDER_HOURS=24       # ore prima del booking per push promemoria
```

---

## 15. Cosa NON include (out of scope v1)

- **Pattern B online** (magic link tokenizzato + auto-fill checkout merchant) — Y2 quando convenzioni dirette
- **Browser extension** desktop — Y3 power user feature, NO Y1
- **Marketplace expansion oltre 10 esperienze** — Y2-Y3
- **Integrazione automatica provider esterni** (LinkedIn Learning API, BetterUp API per booking automatico) — Y2-Y3
- **Stipulare convenzioni direttamente** con merchant — Y2 partnership team
- **Multi-lingua** PWA (solo italiano v1) — Y2 quando UK/Spagna
- **Coin marketplace transfer P2P** (regalare coin tra colleghi) — Y2 valuta complessità
- **Integrazione Coverflex/Edenred/Jointly** — Y2 partnership exploration

---

## 16. Quick-start dev (machine-readable summary)

```yaml
project: Filodiretto v2
features:
  - hub_convenzioni
  - pga_people_growth_activator
launch_target: 2026-09-01
repo: github.com/mandriano77-prog/Filo_Diretto
branch: feature/hub-convenzioni-pga
stack: nodejs-20 + express + postgresql + vanilla-js-pwa
hosting: digitalocean-app-platform

deliverables:
  db_schema: 9 nuove tabelle (4 hub + 5 pga)
  api_endpoints: 35+ nuovi sotto /api/v1/
  pwa: hub.filodiretto.app (responsive, mobile-first, white-label, offline-capable)
  partner_webapp: partner.filodiretto.app (scan QR validate HMAC)
  dashboard_hr: 4 nuove sezioni in src/dashboard/index.html
  pass_integration: estensione passkit.js (back fields + locations + balance)
  geofencing: apple wallet locations[] nativo
  csv_import: parser bulk con geocoding nominatim
  coin_engine: src/engine/coins.js (grantCoin, debitCoin, balance)
  cron_jobs: 2 nuovi (anniversari giornaliero, booking reminders giornaliero)
  white_label: logo + accent color + welcome message + categorie per brand
  wai_integration: 10 nuovi intent

experiences_seed_default:
  - ceo_lunch (1500 coin)
  - mentoring_leader (1000 coin)
  - growth_day_half (300 coin)
  - linkedin_learning (800 coin)
  - workshop_softskill (600 coin)
  - library_book (100 coin)
  - volunteer_day (500 coin)
  - sabbatical_mini (5000 coin)
  - coaching_external (1500 coin)
  - personal_spotlight (300 coin)

coin_actions_default:
  - onboarding: 200
  - birthday: 50
  - anniversary_1y: 100
  - anniversary_5y: 500
  - anniversary_10y: 1500
  - quiz_completed: 20
  - survey_completed: 5
  - recognition_received: 10
  - convention_first_use: 5
  - challenge_completed: 50

timeline:
  sprint_1_backend: weeks 1-2 (1-14 jul)
  sprint_2_pwa_conv: weeks 3-4 (15-28 jul)
  sprint_3_pwa_pga: weeks 5-6 (29 jul - 11 aug)
  sprint_4_dashboard_polish: weeks 7-9 (12-31 aug)
  launch: 2026-09-01
  total_weeks: 9
  fte_required: 2 full-stack (parallel work) OR 1 full-stack with 1 week buffer

acceptance_criteria: 34 testable
dependencies_new: 3 npm packages (qrcode, csv-parse, ioredis)
env_vars_new: 8

compliance:
  gdpr: opt-in geofencing + tracking, data retention 24-60m
  art_88: dashboard HR solo aggregati, no individual tracking
  art_4_statuto: consenso esplicito dipendente per geofencing
  multi_tenancy: ogni query SQL filtra brand_id (pattern esistente)

out_of_scope_v1:
  - pattern_B_online_magic_link
  - browser_extension
  - marketplace_expansion
  - external_provider_api_integration
  - direct_merchant_partnerships
  - multilingua_pwa
  - p2p_coin_transfer
  - coverflex_edenred_integration
```

---

## 17. Note finali per Cursor

### Quando inizi un nuovo sprint
1. `git checkout -b feature/sprint-X-name`
2. Leggi le sezioni rilevanti di questo doc
3. Implementa secondo l'AC checklist della sezione 11
4. Run smoke test locali
5. Commit incrementali con messaggi descrittivi
6. PR review prima di merge in `feature/hub-convenzioni-pga`

### Quando hai dubbi
- Riferisciti sempre al pattern esistente nel repo (es. come è strutturato `routes.js`, come funziona il multi-tenancy)
- NON inventare nuove convenzioni di codice
- Riusa funzioni esistenti dove possibile (es. `createReward()` può essere riusato concettualmente per PGA)

### Quando ship in produzione
- Sempre con feature flag opt-in per brand
- HR cliente deve attivare esplicitamente HUB Convenzioni e PGA (default disabled)
- Migrazioni DB sono idempotenti (CREATE TABLE IF NOT EXISTS) — sicure da rieseguire

---

## 18. Contatti

**Founder:** Adriano Coccia · mandriano77@me.com
**Tech leadership:** Digital Builders S.r.l. — Nando Bocca + Simone Ricci
**Repo:** https://github.com/mandriano77-prog/Filo_Diretto
**Memo investitori v7:** https://filodiretto.netlify.app
**Demo pass live:** https://studio.filodiretto.app/activate/...

---

*Documento confidenziale. Non distribuire al di fuori del team di sviluppo Digital Builders + Adriano Coccia.*
*Versione 1.0 · giugno 2026 · self-contained per Cursor / agente AI dev.*
