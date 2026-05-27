# Filo Diretto UI Changelog

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
