# Filo Diretto UI Changelog

## Phase 1 — Accessibility & semantics (`fix(a11y)`)

### Added
- `styles/tokens.css` — design tokens + `@deprecated` legacy aliases
- `styles/filo-a11y.css` — focus-visible, nav `aria-current`, ghost button contrast, sticky sidebar (light shell)
- Dynamic `<title>`: `{Sezione} · {Brand} · {App}` via `syncSectionDocumentTitle()`
- Sidebar as `<aside role="navigation">` with keyboard-accessible nav items

### Changed
- Main section titles: `<div class="sec-title">` → `<h1 class="page-title">` (Identità, Media, Push, Analytics, …)
- Welcome sub-blocks → `<h2 class="block-title">`
- Removed `!important` from light-theme nav/badge overrides (delegated to `filo-a11y.css`)

### Filo Diretto scope
Visual/a11y shell rules apply when `html[data-shell="light"]` (HR deploy / `studio.filodiretto.app`).

### Next (Phase 2+)
- Collapsible sidebar groups, breadcrumb header, `.c-*` components, empty states, danger zones.
