# Filo Diretto UI Changelog

## Refactor — Media Library header/actions (`[FD] media-library`)

### Changed
- Header con search globale `Cerca asset…` + CTA `Carica file`
- Menu ⋮ esteso: `Esporta libreria (.zip)` (stub), `Specifiche tecniche` (modal), `Svuota libreria…`
- Azione distruttiva globale protetta da conferma con typing `SVUOTA`
- Rimosso il blocco accordion “Specifiche tecniche consigliate” dalla pagina
- Posizionamento menu contestuale: offset 8px e collision padding 16 (no clipping su sidebar)
- Sezioni unificate (schema tipo `MediaSection`) con card asset uniformi
- Overlay hover per-card con azioni `Preview / Rename / Delete`
- Dropzone esplicita per sezione vuota + supporto drag&drop con annuncio `aria-live`
- Selezione multipla con barra bulk e conferma `ELIMINA` per delete massivo

---

## Fix — Avatar account header (`[FD] header`)

### Changed
- `src/filodiretto/fd-header.css` — trigger account con allineamento e clipping corretti; avatar `AD` fissato a 28×28 per evitare rendering a metà

---

## Fix — Media Library layout Filo (`[FD] media-library`)

### Added
- `src/filodiretto/fd-media-library.css` / `fd-media-library.js` — layout a sezioni verticali, specifiche in `<details>`, CTA «Carica» per tipo
- Sezione **Icona notifiche Wallet** (512×512) in libreria e nel modal upload

### Changed
- Tutti i tipi restano visibili: Logo, Icona Wallet, Strip, Thumbnail, Background
- Copy HR: deposito file → assegnazione in Template Pass; card light shell (no grigio scuro legacy)
- Link «Template Pass» in fondo pagina

---

## Fix — Glossario HR Fase A (`[FD] hr-copy`)

### Added
- `src/filodiretto/fd-hr-copy.js` — nav/pagina **Dipendenti**, CTA **Aggiungi dipendente** / **Importa dipendenti**

### Changed
- `PRODUCT_MENU_COPY.hr` — `nav_leads`, titolo e blurb pagina
- `fd-home.js` — checklist: dati azienda → template (logo/strip) → dipendenti
- `loadLeads()` — allinea CTA header in modalità HR

---

## Fix — Sidebar toggle, menu floating, Utenti (`[FD] layout`)

### Added
- `src/filodiretto/fd-layout.css` / `fd-layout.js` — hamburger sempre visibile; collapse sidebar su desktop; menu ⋮ in `position: fixed` sopra la sidebar

### Changed
- Media Library: pannello kebab non finisce più sotto il menu laterale
- Setup → Utenti: ripristinato **+ Nuovo Utente** per admin HR (anche con login allowlist)
- `loadUsers()` usa tabella Filo su tutta la dashboard HR

---

## Fix — Separazione Identità brand / Template pass (`[FD] brand-scope`)

### Added
- `src/filodiretto/fd-brand-scope.css` — nasconde tagline, griglia asset pass e anteprima wallet su Identità brand HR
- `src/filodiretto/fd-brand-scope.js` — hint verso Template Pass; nasconde contatti HR duplicati nel modal template

### Changed
- Identità brand HR: solo nome, slug, settore, lingua, homepage, contatti (inclusi DPO ed emergenze), social
- Salvataggio brand HR: non sovrascrive `brand_identity_assets` / tagline; sincronizza colonne `hr_email`, `hr_phone`, `dpo_email`, `emergency_phone`
- Template pass HR: logo, strip, header e link fisso; contatti retro ereditati dal brand

---

## Fix — Media Library kebab menu (`[FD] media-library`)

### Changed
- `src/filodiretto/fd-destructive.css` — `.fd-media-page-menu__panel` z-index 250 (above sidebar/mobile sheet at 200); page header row `overflow: visible` to avoid clipping

---

## Fix — Nav HR: nascondi Campagne (`[FD] nav`)

### Added
- `src/filodiretto/fd-nav.css` — `display: none !important` su voce Campagne e sezione `#campaigns`
- `src/filodiretto/fd-nav.js` — riapplica mask dopo `updateNavState()` / `nav('campaigns')`

### Changed
- `isHrDashboard()` riconosce anche `data-app=filodiretto`
- `updateNavState()` non ripristina più `display` sulla voce Campagne in modalità HR

---

## Fix — Identità brand Filo (`[FD] brand-identity`)

### Added
- `src/filodiretto/fd-brand-identity.css` — layout 2 colonne, card sezioni, griglia asset, anteprima pass sticky (light shell)

### Changed
- Tipografia: titolo pagina BI a 24px (non più H1 globale 30px)
- Breadcrumb interno nascosto; header sticky con Salva
- Zona pericolosa meno invasiva (bordo tratteggiato, copy breve)

---

## FD-14 — Push & Notifiche (`[FD] push`)

### Added
- `src/filodiretto/fd-push.css` — layout con anteprima sticky, segmented canale, contatori caratteri
- `src/filodiretto/fd-push.js` — preview lock-screen iOS/Android, «Invia di prova», label HR-friendly
- API `POST /push/send` accetta `test_pass_id` (invio a un solo pass, retro-compatibile)

### Changed
- Canale: segmented «iPhone (Apple Wallet)» / «Android (Google Wallet)» / «Entrambi» + tooltip APNs
- Titolo max ~50, messaggio max ~178 con contatore live
- HR deploy injects push assets

---

## FD-13 — Brand switcher (`[FD] brand-switcher`)

### Added
- `src/filodiretto/fd-brand-switcher.css` — combobox header, pannello search
- `src/filodiretto/fd-brand-switcher.js` — switcher unico top-right; sezione **Recenti** se ≥6 brand

### Changed
- Breadcrumb senza prefisso nome brand (solo titolo pagina quando un brand è attivo)
- Identità brand: breadcrumb interno senza ripetizione brand
- `<select id="brandSelector">` resta per `changeBrand()` ma è screen-reader only

---

## FD-12 — Zona pericolosa (`[FD] danger-zone`)

### Added
- `src/filodiretto/fd-danger-zone.css` — container bordo `--fd-color-danger`, icona ⚠️, copy HR
- `src/filodiretto/fd-danger-zone.js` — enhance Identità brand, modale fallback e `A2W.UI.openConfirmDialog` con confirm-by-typing (trim)

### Changed
- CTA «Elimina brand» → outline danger; modali delete con bordo danger e hint accessibilità
- Conferma finale disabilitata finché il nome brand digitato non coincide (trim)

---

## FD-11 — Sistema bottoni (`[FD] buttons`)

### Added
- `src/filodiretto/fd-buttons.css` — primary (viola pieno), secondary (outline), ghost; toni success; focus 3px; loading spinner
- `src/filodiretto/fd-buttons.js` — `window.FdButton.render({ variant, tone, size, loading, … })`

### Changed
- HR deploy injects button assets; `.btn` / `.btn.sec` su Filo allineati a token `--fd-*` (radius 12px)
- Danger in-page resta gestito da `fd-destructive.css` (outline + modali solidi)

---

## FD-10 — Tipografia (`[FD] typography`)

### Added
- `src/filodiretto/fd-typography.css` — scala H1/H2/H3/body su `[data-app=filodiretto]`
- Token tipografici in `tokens.css` (`--fd-font-size-*`, line-height, pesi)

### Changed
- HR deploy injects `fd-typography.css`
- Titoli pagina 30px bold, sezioni 20px semibold, sotto-sezioni 16px, corpo 14px con line-height 1.5–1.6
- Form, tabelle, KPI strip e empty state allineati alla scala

---

## FD-09 — Design tokens (`[FD] tokens`)

### Added
- `src/filodiretto/fd-theme.css` — bridge `--fd-*` → variabili dashboard su `[data-app=filodiretto]`

### Changed
- `src/filodiretto/tokens.css` — scala primary 50/100/500/700, semantici, neutrals, spacing, radius 12px, shadow
- HR boot: `fd-theme.css` dopo `tokens.css`
- Moduli `fd-*.css` aggiornati a usare token al posto di hex hard-coded (radius, shadow, danger/success)

---

## FD-08 — Empty state arricchiti (`[FD] empty-states`)

### Added
- `src/filodiretto/fd-empty-states.css` — layout CTA + link guida
- `src/filodiretto/fd-empty-states.js` — wrap `renderEmptyState()` su Filo HR con copy, CTA e link «Come funziona»

### Changed
- HR deploy injects `fd-empty-states.css` / `fd-empty-states.js`
- Empty state per: Template Pass, Pass emessi, Reward, Challenge, Log attività, Contatti (dipendenti)
- Link guida → `https://docs.filodiretto.app/guide#…` (placeholder documentazione)

---

## FD-07 — Helper text e placeholder (`[FD] form-help`)

### Added
- `src/filodiretto/fd-form-help.css` — `--fd-text-helper` (#475569), contrasto helper WCAG AA su Filo
- `src/filodiretto/fd-form-help.js` — placeholder URL/telefono completi; help slug; label «URL link fisso»

### Changed
- HR deploy injects `fd-form-help.css` / `fd-form-help.js`
- Testi secondari Filo leggermente più scuri (`--text-secondary` su `[data-app=filodiretto]`)
- Rimosso helper duplicato sotto Tagline (resta il placeholder descrittivo)
- `https://...` e `+39 ...` sostituiti con esempi completi nei form visibili HR

---

## FD-06 — Form dirty state (`[FD] form-dirty`)

### Added
- `src/filodiretto/fd-form-dirty.css` — badge «Modifiche non salvate», save disabled styling (Filo light)
- `src/filodiretto/fd-form-dirty.js` — abilita brand identity v2 dirty su Filo HR; dirty state su modal Template Pass

### Changed
- HR deploy injects `fd-form-dirty.css` / `fd-form-dirty.js`
- **Identità brand**: `Salva modifiche` disabilitato finché non ci sono modifiche; badge stato accanto al bottone
- **Template pass** (HR): stesso pattern nel modal con barra salvataggio

---

## FD-05 — CTA destructive (`[FD] destructive`)

### Added
- `src/filodiretto/fd-destructive.css` — outline danger buttons; media page kebab menu
- `src/filodiretto/fd-destructive.js` — patch `loadMediaLibrary` / `a2wBiRenderAssetsGrid`; «Svuota tutto» in ⋮

### Changed
- HR deploy injects `fd-destructive.css` / `fd-destructive.js`
- Media Library: «Svuota tutto» nascosto in header, spostato nel menu ⋮
- Elimina logo / Elimina card media → `fd-btn-danger-outline`
- Identità brand: «Rimuovi» asset in outline rosso
- Altri `.btn.danger` in pagina → outline (conferme modale e elimina brand restano piene)

---

## FD-04 — Contatti / Anagrafica (`[FD] contacts`)

### Added
- `src/filodiretto/fd-contacts.css` — KPI grid responsive (max 4 colonne), cluster impilati, icone compatte
- `src/filodiretto/fd-contacts.js` — patch `renderLeadsKpiStrip` / toolbar; menu ⋮ su card Anagrafica con Esporta CSV

### Changed
- HR deploy injects `fd-contacts.css` / `fd-contacts.js`
- Export CSV spostato dal toolbar al menu accanto al titolo «Anagrafica dipendenti»; bottone toolbar nascosto su Filo
- KPI anagrafica/distribuzione in griglia a wrap con etichette di sezione

---

## FD-03 — Tabella Utenti (`[FD] users`)

### Added
- `src/filodiretto/fd-users.css` — brand cell, copy ID, protected badge, kebab menu
- `src/filodiretto/fd-users.js` — `fdLoadUsers()` con lookup nome brand; no-op su `a2w-shell`

### Changed
- HR deploy injects `fd-users.css` / `fd-users.js`
- `loadUsers()` delega a Filo quando `isFiloOperationalHome()`
- Colonna Brand: nome + ID copiabile on hover; azioni in menu ⋮; utenti protetti con badge 🔒 e tooltip

---

## FD-02 — Home dashboard (`[FD] home`)

### Added
- `src/filodiretto/fd-home.css` — KPI grid, onboarding checklist, activity list
- `src/filodiretto/fd-home.js` — loads analytics, employees, push, events; `fdLoadHome()`; no-op on `a2w-shell`

### Changed
- HR deploy injects `fd-home.css` / `fd-home.js` with FD-01 assets
- `getDefaultBrandSection()` → `welcome` on Filo HR (landing dopo login / cambio brand)
- `nav('welcome')` non reindirizza più a Pass Emessi su Filo HR
- Sidebar **Inizio** resta visibile con brand selezionato (Filo HR)
- Sezione `#welcome`: legacy nascosta su Filo; home operativa con KPI e setup guidato (5 step)

---

## FD-01 — Header globale (`[FD] header`)

### Added
- `src/filodiretto/tokens.css` — `--fd-border`, `--fd-color-header-bg`
- `src/filodiretto/fd-header.css` — header surface, logo link, account chevron + tooltip
- `src/filodiretto/fd-header.js` — logo → `/dashboard/home`, `nav('welcome')`; no-op on `a2w-shell`
- Route `GET /dashboard/home` (same SPA as dashboard)

### Changed
- HR boot injects Filo assets only when `__2WALLET_PRODUCT_LOCK__ === 'hr'`
- `data-app="filodiretto"` on `<html>` for Filo deploy

---

## Phase 2 — Layout, sidebar, header (`feat(ui)`)

### Added
- `styles/filo-layout.css` — collapsible nav groups, breadcrumb header, avatar dropdown, W.AI FAB tooltip
- Sidebar `<details class="nav-group">` with `localStorage` persistence (`filo_nav_group:*`)
- Header breadcrumb: `{Brand} › {Sezione}`
- Avatar menu: Profilo · Impostazioni · Esci (Filo light); inline legacy row on dark shell
- W.AI: tooltip "Chiedi a W.AI", minimize/close panel actions, collapsed FAB state

### Changed
- Header restructured as `<header class="app-header">` with `.header-actions`
- Brand selector styled via `.brand-sel--header` on Filo
- Product line selector hidden on locked HR deploy (`data-filo-hidden`)
- Sidebar footer uses `.sidebar-footer` (no inline styles)

### Filo Diretto scope
Layout rules apply when `html[data-shell="light"]` (HR deploy / `studio.filodiretto.app`). Dark shell retains compatible markup with legacy header/user row styling.

---

## Phase 1 — Accessibility & semantics (`fix(a11y)`)

### Added
- `styles/tokens.css` — design tokens + `@deprecated` legacy aliases
- `styles/filo-a11y.css` — focus-visible, nav `aria-current`, ghost button contrast, sticky sidebar (light shell)
- Dynamic `<title>`: `{Sezione} · {Brand} · {App}` via `syncSectionDocumentTitle()`
- Sidebar as `<aside role="navigation">` with keyboard-accessible nav items

### Changed
- Main section titles: `<div class="sec-title">` → `<h1 class="page-title">`
- Welcome sub-blocks → `<h2 class="block-title">`

### Next (Phase 3+)
- `.c-*` components, empty states, danger zones, push preview, analytics export, responsive tables, reduce inline styles.
