# Filodiretto · Feature Spec
## HUB Convenzioni — modulo "Welfare Activator"

**Versione:** v1.0
**Data:** giugno 2026
**Autore:** Adriano Coccia · Founder Filodiretto
**Repo:** [mandriano77-prog/Filo_Diretto](https://github.com/mandriano77-prog/Filo_Diretto)
**Stack target:** Node.js 20+ · Express · PostgreSQL · DigitalOcean App Platform
**Target dev:** developer full-stack senior o agente AI tipo Claude Code
**Effort stimato:** 8 settimane · 4 sprint da 2 settimane · 1 FTE full-stack
**Stakeholder tecnico:** Digital Builders S.r.l. (Nando Bocca + Simone Ricci)

---

## 1. Contesto

### 1.1 Cos'è Filodiretto
Filodiretto è una piattaforma multi-tenant che fa di Apple/Google/Samsung Wallet il canale di comunicazione proprietario tra HR aziendali e dipendenti. Ogni dipendente riceve un pass digitale (`.pkpass` o equivalente Google/Samsung) che vive nel wallet del telefono e funziona da: canale push HR (sopra il 95% di lettura), badge fisico opzionale, e — con questa nuova feature — **attivatore di convenzioni aziendali**.

### 1.2 Stack attuale (verificato dal repo)
- **Runtime:** Node.js 20+ / Express (`src/server.js`)
- **DB:** PostgreSQL (`pg`), schema auto-applicato in `getDb()` in `src/db/index.js`
- **Pass signing:** OpenSSL `cms -sign` (NON node-forge)
- **Push:** APNs HTTP/2 nativa con JWT auth
- **Email:** Resend
- **Images:** Sharp
- **AI strip:** fal API
- **Domain:** definito in env `CUSTOM_DOMAIN`
- **Hosting:** DigitalOcean App Platform o Droplet
- **Multi-tenant:** sempre filtrare per `brand_id`

### 1.3 Cosa NON si tocca
- Sistema di autenticazione esistente (JWT, dashboard login)
- Logica `passkit.js`, `apns.js`, `mailer.js`, `scheduler.js`, `google-wallet.js`, `strip-promo.js` (si estende, non si riscrive)
- Multi-tenancy esistente (ogni query filtra per `brand_id`)
- W.AI agent (può essere esteso con nuovi intent, vedi sezione 8)

---

## 2. La feature in una frase

> *Permette all'HR di importare le convenzioni aziendali esistenti (es. palestra Virgin -15%, libreria Mondadori -10%) e di renderle accessibili al dipendente direttamente dal pass — con ricerca, filtri per categoria, geolocation, attivazione online (codice promo + redirect sito merchant) e attivazione fisica (QR code mostrato al banco merchant). Tracking real-time degli utilizzi per dashboard HR.*

---

## 3. Architettura

### 3.1 Componenti nuovi

```
┌──────────────────────────────────────────────────────────┐
│                    PASS FILODIRETTO                      │
│  (Apple/Google/Samsung Wallet — già esistente)           │
│                                                          │
│  Back fields:                                            │
│  ├── 👤 Dipendente · Azienda                            │
│  ├── 📢 HR News (esistente)                              │
│  ├── 🛒 HUB CONVENZIONI ← NUOVO LINK                    │
│  │   URL: https://hub.filodiretto.app/?token={JWT}      │
│  ├── 🎯 Welfare (esistente)                              │
│  └── 🏢 Badge fisico (esistente)                         │
└──────────────────────────────────────────────────────────┘
                            ↓ tap dipendente
┌──────────────────────────────────────────────────────────┐
│         PWA HUB CONVENZIONI                              │
│         (NUOVA · sub-app · hub.filodiretto.app)          │
│                                                          │
│  - Auth: JWT in URL query string (signed dal backend)    │
│  - Mobile-first, responsive, offline-capable             │
│  - White-label per brand (logo + accent color)           │
│  - Vista: search, filtri categoria, "vicino a me",      │
│    griglia card merchant, dettaglio merchant             │
│  - Azioni: copy codice promo, vai al sito merchant,     │
│    mostra QR per attivazione fisica al banco             │
└──────────────────────────────────────────────────────────┘
                            ↓ API calls
┌──────────────────────────────────────────────────────────┐
│         BACKEND (esteso)                                 │
│                                                          │
│  - PostgreSQL: 4 nuove tabelle (vedi sezione 4)          │
│  - API REST: /api/v1/merchants/* (CRUD + import CSV)     │
│  - API PWA: /api/v1/hub/* (read-only, autenticata JWT)   │
│  - Geofencing engine: monitora device location,         │
│    triggera push APNs quando dipendente entra in raggio │
│  - Analytics: log eventi (tap, click sito, copy, QR)    │
└──────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────┐
│         DASHBOARD HR (esteso)                            │
│         (esistente src/dashboard/index.html)             │
│                                                          │
│  - Nuova sezione "Convenzioni" nella sidebar             │
│  - Form aggiungi merchant manuale                        │
│  - Upload CSV bulk import (10 colonne — vedi sezione 5)  │
│  - Tabella merchant con stats real-time per merchant     │
│  - Filtri per categoria                                  │
│  - White-label settings (logo PWA + accent color)        │
└──────────────────────────────────────────────────────────┘
```

### 3.2 Domini DNS

- `studio.filodiretto.app` → dashboard HR esistente (CUSTOM_DOMAIN backend)
- `hub.filodiretto.app` → nuova sub-app PWA (sub-dominio dello stesso backend o app separata)
- Pass back field URL: `https://hub.filodiretto.app/?token={JWT}&brand={brand-slug}`

### 3.3 Auth model

- **Dashboard HR:** JWT esistente (login email/password) — invariato
- **PWA Hub:** JWT signed dal backend, encoded nel URL del back field del pass
  - Claims: `user_id`, `pass_serial`, `brand_id`, `iat`, `exp` (90 giorni)
  - Rinnovo automatico: quando pass si aggiorna via webServiceURL, viene generato nuovo JWT
  - Validazione lato PWA al load: GET `/api/v1/hub/bootstrap?token=...` → restituisce profilo + lista merchant del brand

---

## 4. Schema database (PostgreSQL)

Estensione di `src/db/index.js` — aggiungere DDL al blocco `getDb()` (pattern incremental ALTER esistente).

### 4.1 Tabella `merchants`

```sql
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
```

### 4.2 Tabella `merchant_locations`

Un merchant può avere N indirizzi fisici (es. Virgin ha 30 sedi in Italia).

```sql
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
  geofence_radius_m INTEGER DEFAULT 150,  -- raggio in metri per push geofencing
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_merchant_locations_merchant ON merchant_locations(merchant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_locations_geo ON merchant_locations(latitude, longitude);
```

### 4.3 Tabella `convention_activations`

Log eventi attivazione (analytics).

```sql
CREATE TABLE IF NOT EXISTS convention_activations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  pass_serial TEXT NOT NULL,  -- pass_instances.serial_number
  user_id TEXT,
  activation_type TEXT NOT NULL,  -- view | search_found | click_site | copy_code | show_qr | scan_qr | geofence_push
  location_id UUID REFERENCES merchant_locations(id),  -- popolato solo per show_qr/scan_qr/geofence_push
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activations_brand_merchant ON convention_activations(brand_id, merchant_id);
CREATE INDEX IF NOT EXISTS idx_activations_pass ON convention_activations(pass_serial);
CREATE INDEX IF NOT EXISTS idx_activations_created ON convention_activations(created_at DESC);
```

### 4.4 Tabella `hub_settings`

White-label settings per brand.

```sql
CREATE TABLE IF NOT EXISTS hub_settings (
  brand_id UUID PRIMARY KEY REFERENCES brands(id) ON DELETE CASCADE,
  logo_url TEXT,
  accent_color TEXT DEFAULT '#8B5CF6',  -- colore primario PWA
  welcome_message TEXT,
  categories_enabled JSONB DEFAULT '["food","fitness","retail","salute","viaggi","tech","servizi"]'::jsonb,
  geofencing_enabled BOOLEAN DEFAULT TRUE,
  geofencing_max_per_day INTEGER DEFAULT 3,  -- max push geofencing per dipendente per giorno
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. API endpoints

Tutti gli endpoint sono sotto `/api/v1/` (pattern routes.js esistente). Auth tramite JWT esistente per dashboard + nuovo JWT PWA per hub.

### 5.1 Endpoint dashboard HR (autenticati admin JWT)

| Metodo | Path | Descrizione |
|---|---|---|
| `GET` | `/merchants?brand_id={uuid}` | Lista merchant di un brand (con filtri category, active, search) |
| `POST` | `/merchants` | Crea merchant singolo |
| `PUT` | `/merchants/{id}` | Aggiorna merchant |
| `DELETE` | `/merchants/{id}` | Soft delete (set active=false) |
| `POST` | `/merchants/import-csv` | Bulk import via CSV (multipart form data) |
| `GET` | `/merchants/{id}/locations` | Lista indirizzi fisici di un merchant |
| `POST` | `/merchants/{id}/locations` | Aggiungi indirizzo fisico |
| `DELETE` | `/locations/{id}` | Rimuovi indirizzo |
| `GET` | `/merchants/{id}/analytics` | Analytics per singolo merchant (eventi ultimi 30/60/90 giorni) |
| `GET` | `/brands/{id}/hub-settings` | Recupera white-label settings PWA |
| `PUT` | `/brands/{id}/hub-settings` | Aggiorna white-label settings |

### 5.2 Endpoint PWA Hub (autenticati JWT hub)

| Metodo | Path | Descrizione |
|---|---|---|
| `GET` | `/hub/bootstrap?token={jwt}` | Init PWA: valida token, restituisce profilo dipendente + white-label settings + lista merchant attivi |
| `GET` | `/hub/merchants?token={jwt}&category={cat}&search={q}` | Lista merchant filtrabile |
| `GET` | `/hub/merchants/{id}?token={jwt}` | Dettaglio merchant (include locations) |
| `GET` | `/hub/merchants/nearby?token={jwt}&lat={lat}&lon={lon}&radius_km={r}` | Merchant entro raggio (default 5 km) |
| `POST` | `/hub/events` | Log evento (view, click_site, copy_code, show_qr) |

### 5.3 Endpoint geofencing engine (cron/scheduler)

Estensione `src/engine/scheduler.js`. Aggiungere job che gira ogni 5 minuti:

1. Recupera lista pass attivi con `push_token` e geofencing abilitato per il loro brand
2. Per ogni pass, query device location (Apple Wallet: location automaticamente inviata se pass ha campo `locations[]`; Google Wallet: equivalente)
3. Confronta con `merchant_locations` del brand
4. Se device dentro `geofence_radius_m` di un merchant: triggera push APNs
5. Rate limit: max `hub_settings.geofencing_max_per_day` push geofencing per dipendente per giorno

**NOTA TECNICA:** Apple Wallet `locations[]` nel pass.json è il meccanismo nativo. Configurare nel `passkit.js` quando si genera il pass, aggiungere array `locations` con coordinate dei merchant convenzionati attivi del brand. Apple/iOS gestisce autonomamente il triggering della push quando il device entra nel raggio. Non servono cron manuali se si usa questo pattern.

---

## 6. CSV import format (per HR)

Schema CSV per bulk upload merchant. File deve essere UTF-8, separatore `;` (italiano standard).

```csv
merchant_name;category;logo_url;description;discount_label;conditions;valid_until;online_enabled;online_url;online_promo_code;physical_enabled;address;city;latitude;longitude
Virgin Active;fitness;https://logos.example/virgin.png;Palestre premium;-15% abbonamento annuale;Solo abbonamenti nuovi;2026-12-31;true;https://virginactive.it/abbonamenti;ACME15;true;Via Sarca 22;Milano;45.5021;9.2147
Mondadori Store;retail;https://logos.example/mondadori.png;Libreria;-10% libri non scolastici;Escluso bestseller;2026-12-31;true;https://mondadoristore.it;ACME10;true;Piazza Duomo 1;Milano;45.4642;9.1900
```

Parser deve:
- Validare colonne obbligatorie (`merchant_name`, `category`, `discount_label`)
- Skip righe con errori, log a UI quante righe importate vs scartate
- Idempotente: se merchant con stesso `name` già esiste per brand, fa UPDATE invece di INSERT
- Trigger geocoding se `latitude/longitude` mancanti e `address` presente (use Nominatim OpenStreetMap free API, no Google Maps fee)

---

## 7. PWA (`hub.filodiretto.app`)

### 7.1 Stack frontend

- **Coerente con dashboard esistente:** vanilla JavaScript (no React/Vue) per uniformità di codebase
- **Mobile-first:** layout responsive, breakpoint principale 640px
- **PWA manifest:** `manifest.json` con icon, theme color (dinamico da `hub_settings.accent_color`), display `standalone`
- **Service Worker:** cache base (HTML/CSS/JS) per offline parziale + cache lista merchant in localStorage
- **No framework heavy:** vanilla JS + utility CSS (Tailwind-like via CDN o inline)
- **Font:** Inter + JetBrains Mono (coerente con design system Filodiretto memo)

### 7.2 Routes PWA

| Route | Componente |
|---|---|
| `/` (con `?token=`) | Bootstrap + redirect a `/merchants` |
| `/merchants` | Lista merchant con search + filtri + "vicino a me" |
| `/merchants/{id}` | Dettaglio merchant: foto, condizioni, scadenza, mappa locations, bottoni "vai al sito" + "mostra QR" |
| `/qr/{merchant_id}` | Schermata fullscreen QR per attivazione fisica al banco |
| `/error` | Token invalido/scaduto/brand inattivo |

### 7.3 Funzioni chiave

**Bootstrap (load):**
1. PWA legge `?token=...` dall'URL
2. POST `/hub/bootstrap?token=...` → recupera profilo + brand + white-label settings + lista merchant attivi
3. Salva in `localStorage` per offline use
4. Applica white-label (logo, accent color in CSS variable)
5. Render lista merchant default

**Search:**
- Input debounced 300ms
- Match su `name`, `description`, `category`
- Lato client (no API call) per <500 merchant; lato server (`/hub/merchants?search=`) per >500

**Filtri categoria:**
- Chip selezionabili in alto: All · Food · Fitness · Retail · Salute · Viaggi · Tech · Servizi
- Categorie visibili = `hub_settings.categories_enabled`

**"Vicino a me":**
- Toggle che attiva `navigator.geolocation.getCurrentPosition()`
- Chiede permesso device (gestire denial gracefully)
- GET `/hub/merchants/nearby?lat={lat}&lon={lon}&radius_km=5`
- Mostra distanza in km accanto a ogni merchant

**Dettaglio merchant:**
- Header: logo, nome, sconto in evidenza
- Body: descrizione, condizioni, scadenza
- Sezione "Online" (se `online_enabled`):
  - Bottone "Vai al sito" → `window.open(merchant.online_url)` + auto-copy `online_promo_code` in clipboard + log evento `click_site` + `copy_code`
  - Display visibile del codice promo (per fallback manuale)
- Sezione "In negozio" (se `physical_enabled`):
  - Lista indirizzi/sedi con distanza (se geolocation attiva)
  - Bottone "Mostra QR" → fullscreen QR con `pass_serial` encoded + log evento `show_qr`

**QR fullscreen:**
- QR contiene URL signed: `https://api.filodiretto.app/v1/scan?serial={pass_serial}&merchant={merchant_id}&t={timestamp}&sig={hmac}`
- Merchant scansiona con qualunque QR reader → si apre webapp **Filodiretto Partner** che mostra "OK Marco Rossi dipendente Acme, convenzione Virgin -15% attiva"
- Log evento `scan_qr`

### 7.4 Componente "Filodiretto Partner" (web app merchant)

- URL: `https://partner.filodiretto.app/scan/?serial=...&merchant=...`
- Mostra in mezza secondo:
  - ✅ Verde: "Convenzione attiva: Marco Rossi · dipendente Acme S.r.l. · Sconto -15%"
  - ❌ Rosso: "Convenzione non valida o scaduta"
- No login necessario per merchant (security via HMAC firmato lato Filodiretto)
- Log evento `scan_qr` lato backend automaticamente

---

## 8. W.AI integration (opzionale, sprint 7-8)

Estensione SYSTEM_PROMPT in `src/engine/wai.js` per nuovi intent:

```
- merchant.create — Aggiungere convenzione: "Aggiungi convenzione Virgin -15%"
- merchant.list — Lista convenzioni attive: "Quante convenzioni abbiamo?"
- merchant.analytics — Analytics utilizzo: "Quale convenzione viene usata di più?"
- merchant.deactivate — Disattivare convenzione: "Disattiva la convenzione Mondadori"
- hub.customize — Cambiare white-label PWA: "Cambia il colore dell'hub in blu"
```

Estendere mappa `EXECUTORS` con i nuovi handler.

---

## 9. Sicurezza e privacy

### 9.1 GDPR
- Consenso esplicito dipendente per:
  - Geolocation tracking (push geofencing) — opt-in nelle settings PWA
  - Tracking eventi utilizzo (analytics) — informativa al primo accesso
- Dati location NON memorizzati permanentemente — solo trigger push, poi scartati
- Data retention `convention_activations`: 24 mesi rolling

### 9.2 Art. 88 GDPR (dati lavoratori)
- Dashboard HR mostra **solo dati aggregati per merchant** (es. "Virgin: 47 utilizzi questo mese")
- NESSUN dato individuale visibile ad HR ("chi è andato in palestra")
- Eccezione: il singolo dipendente vede solo i propri eventi nelle sue "Activity history" (opt-in)

### 9.3 Art. 4 Statuto Lavoratori
- Consenso preventivo o accordo sindacale richiesto se geofencing attivato (è "controllo a distanza" tecnico)
- Documentazione in onboarding: HR deve dichiarare di avere consenso prima di abilitare geofencing per la sua azienda

### 9.4 JWT PWA
- Algorithm: HS256 con secret in env (`JWT_HUB_SECRET`, separato da `JWT_SECRET` dashboard)
- Expiry: 90 giorni (refresh automatico via webServiceURL pass)
- Token revocabile lato server (blacklist `pass_serial` se dipendente lascia l'azienda)

### 9.5 QR HMAC signing
- QR contiene timestamp + HMAC firmato lato backend
- Validità: 60 minuti dal momento di generazione (evita screenshot riusabili)
- Verifica HMAC obbligatoria su endpoint `/scan`

---

## 10. Acceptance criteria

### 10.1 HR backoffice
- [ ] HR può creare merchant manualmente via form
- [ ] HR può uploadare CSV con 50 merchant → tutti importati in <30 sec
- [ ] HR vede dashboard real-time con eventi ultimi 30 giorni per merchant
- [ ] HR può cambiare logo e accent color PWA (white-label)
- [ ] HR può disattivare merchant senza eliminarlo (soft delete)
- [ ] Solo HR del proprio brand vede i propri merchant (multi-tenancy)

### 10.2 Pass dipendente
- [ ] Pass back fields include link "HUB CONVENZIONI"
- [ ] Tap sul link apre PWA `hub.filodiretto.app` con token nel URL
- [ ] Pass include `locations[]` con coordinate merchant attivi (per geofencing Apple Wallet)
- [ ] Quando dipendente passa entro 150m di un merchant convenzionato, riceve push lockscreen

### 10.3 PWA Hub
- [ ] Bootstrap: carica in <2 sec su 4G mobile
- [ ] Search merchant funziona per name, description, category
- [ ] Filtri categoria funzionano
- [ ] "Vicino a me" mostra solo merchant entro 5 km dalla device location
- [ ] Tap merchant → dettaglio con logo, sconto, condizioni, locations, bottoni "vai al sito" + "mostra QR"
- [ ] "Vai al sito" copia codice in clipboard + apre nuova tab merchant
- [ ] "Mostra QR" mostra QR fullscreen scansionabile
- [ ] PWA installabile come app (manifest + service worker)
- [ ] White-label applicato (logo cliente + accent color)
- [ ] PWA funziona offline parzialmente (cached merchant list)

### 10.4 Partner web app (`partner.filodiretto.app`)
- [ ] Merchant può scansionare QR del pass dipendente da qualunque QR reader
- [ ] Apre `partner.filodiretto.app/scan/?...` → mostra OK/KO in <1 sec
- [ ] HMAC validato server-side
- [ ] QR scaduto (>60 min) → mostra KO con motivo "QR scaduto"

### 10.5 Analytics
- [ ] Ogni evento (view, search_found, click_site, copy_code, show_qr, scan_qr, geofence_push) loggato in `convention_activations`
- [ ] Dashboard HR aggrega per merchant + per categoria + per giorno
- [ ] Top 10 merchant utilizzati visibile nel dashboard
- [ ] Conversion funnel visibile: view → click_site → copy_code (per online); view → show_qr → scan_qr (per fisico)

### 10.6 Compliance & sicurezza
- [ ] Multi-tenancy: ogni query filtra per brand_id
- [ ] PWA JWT firma HS256 con `JWT_HUB_SECRET` separato
- [ ] HR vede SOLO dati aggregati per merchant (no individual tracking)
- [ ] Dipendente può vedere solo i suoi eventi (opt-in)
- [ ] Geofencing richiede consenso esplicito dipendente
- [ ] Data retention `convention_activations` 24 mesi

---

## 11. Roadmap 8 settimane (4 sprint)

### Sprint 1 — Settimane 1-2 · Backend foundation
- DB schema (4 tabelle nuove)
- API REST dashboard HR (CRUD merchant)
- CSV import + Nominatim geocoding
- Estensione `passkit.js`: aggiunta back field "HUB CONVENZIONI" + `locations[]` per geofencing
- Test unit Postman/curl

### Sprint 2 — Settimane 3-4 · PWA MVP
- Setup `hub.filodiretto.app` (sub-app o sub-dominio)
- Bootstrap endpoint + auth JWT hub
- Pages: lista merchant, dettaglio merchant
- Search + filtri categoria (client-side)
- Bottoni "vai al sito" + "copy code" + log eventi
- Mobile-first UI

### Sprint 3 — Settimane 5-6 · Esperienza completa
- Geolocation "vicino a me" + endpoint nearby
- Push geofencing (Apple Wallet `locations[]` + APNs per fallback)
- QR fullscreen per attivazione fisica
- Partner web app `partner.filodiretto.app` (scan QR validate HMAC)
- Service worker + offline mode

### Sprint 4 — Settimane 7-8 · Polish + go-to-market
- Dashboard HR: nuova sezione "Convenzioni" con analytics real-time
- White-label settings (logo + accent color per brand)
- Onboarding wizard HR (CSV template + tutorial)
- W.AI integration (opzionale, vedi sezione 8)
- Documentation utente HR + dipendente
- Pricing pubblicato + go-live

---

## 12. Dependencies da installare

```bash
npm install qrcode               # generazione QR pass dipendente
npm install csv-parse           # parsing CSV import
npm install node-fetch          # geocoding Nominatim (se Node <18)
# Già presenti nel repo: pg, sharp, archiver, jsonwebtoken, express
```

Nessuna nuova dipendenza pesante. Tutto compatibile con Node 20 + DigitalOcean App Platform.

---

## 13. Environment variables aggiuntive

Da aggiungere al `.env.example` e all'App Platform DigitalOcean:

```bash
# JWT hub (separato da JWT_SECRET dashboard)
JWT_HUB_SECRET=<random 32 byte hex>

# QR HMAC signing
QR_HMAC_SECRET=<random 32 byte hex>

# Geocoding (Nominatim free, no key necessaria)
NOMINATIM_USER_AGENT=Filodiretto/1.0 (contact@filodiretto.app)

# PWA hub URL (per costruire link nei pass back fields)
HUB_BASE_URL=https://hub.filodiretto.app
PARTNER_BASE_URL=https://partner.filodiretto.app

# Geofencing defaults
GEOFENCING_DEFAULT_RADIUS_M=150
GEOFENCING_MAX_PER_DAY=3
```

---

## 14. Quick-start dev (machine-readable summary)

```yaml
project: Filodiretto
feature: HUB Convenzioni
stack: nodejs-20, express, postgresql, vanilla-js-pwa
hosting: digitalocean-app-platform
new_subapp: hub.filodiretto.app
auth: jwt-hs256-separato

deliverables:
  - db_schema: 4 nuove tabelle (merchants, merchant_locations, convention_activations, hub_settings)
  - api_dashboard: 11 endpoint REST sotto /api/v1/merchants/*
  - api_hub: 5 endpoint REST sotto /api/v1/hub/*
  - pwa: hub.filodiretto.app responsive mobile-first vanilla js
  - partner_webapp: partner.filodiretto.app scan QR validate hmac
  - pass_integration: estensione passkit.js con back field + locations[]
  - dashboard_hr: nuova sezione Convenzioni in src/dashboard/index.html
  - geofencing: apple wallet locations[] nativo + apns fallback
  - csv_import: parser bulk con geocoding nominatim
  - white_label: logo + accent color per brand
  - analytics: dashboard real-time con eventi aggregati per merchant
  - wai_integration: opzionale, 5 nuovi intent merchant.*

timeline:
  total_weeks: 8
  sprints: 4 (settimane 1-2, 3-4, 5-6, 7-8)
  fte: 1 full-stack senior o 2 mid-level part-time

acceptance:
  hr_backoffice: 6 criteri
  pass_dipendente: 4 criteri
  pwa_hub: 10 criteri
  partner_webapp: 4 criteri
  analytics: 4 criteri
  compliance: 6 criteri
  total: 34 criteri verificabili

dependencies_npm:
  - qrcode
  - csv-parse
  - node-fetch (se Node <18)

env_vars_nuovi: 6

compliance:
  gdpr: opt-in geofencing + tracking, data retention 24m
  art_88: solo dati aggregati per HR
  art_4_statuto: consenso esplicito dipendente per geofencing

multi_tenancy: ogni query filtra brand_id (pattern esistente)
```

---

## 15. Cosa NON include questo spec (out of scope v1)

- **Pattern B online** (magic link tokenizzato con auto-fill checkout merchant) — Y2 quando si stipulano convenzioni dirette
- **Browser extension** desktop — Y3 power user feature, sconsigliato Y1-Y2
- **Cashback/loyalty** integrato — feature separata, post-Y1
- **Marketplace transazionale** (Filodiretto take-rate su spesa merchant) — Y2-Y3 valutazione
- **Stipulare convenzioni direttamente con merchant** — Y2 partnership team, fuori scope tech
- **Integrazione Coverflex/Edenred/Jointly** (sync convenzioni esistenti) — esplorabile Y2 partnership
- **Multi-lingua** PWA (solo italiano v1) — Y2 quando si espande UK/Spagna

---

## 16. Contatti

**Founder:** Adriano Coccia · mandriano77@me.com
**Repo GitHub:** https://github.com/mandriano77-prog/Filo_Diretto
**Memo investitori v7:** https://filodiretto.netlify.app
**Demo pass live:** https://studio.filodiretto.app/activate/... (scadenza 28/06/2026)

---

*Documento confidenziale. Non distribuire al di fuori del team di sviluppo.*
*Versione 1.0 · giugno 2026*
