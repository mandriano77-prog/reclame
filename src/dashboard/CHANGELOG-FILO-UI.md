# Filo Diretto UI Changelog

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
