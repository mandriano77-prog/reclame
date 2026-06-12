# Proposta: montaggio viste on-demand (Task 13)

## Stato attuale

- Tutte le sezioni (`#overview`, `#brand`, `#templates`, …) coesistono nel DOM in `src/dashboard/index.html`.
- `nav()` mostra/nasconde via classe `active`, `hidden` e `aria-hidden` (post Task 4–5).
- Ogni sezione include markup pesante (tabelle, modali inline, form).
- I moduli JS FiloDiretto si caricano all'avvio (`fd-home.js`, `fd-contacts.js`, …).

**Costo stimato:** ~2000 nodi DOM sempre presenti; init multipli se non deduplicati (mitigato da Task 2).

## Obiettivo

Montare nel DOM solo la vista attiva; caricare HTML/JS della vista al primo accesso.

## Approccio consigliato (incrementale)

### Fase 1 — Shell + router (basso rischio)

1. Estrarre ogni `<section id="…">` in file parziali sotto `src/dashboard/views/{id}.html`.
2. In `index.html` lasciare solo shell: sidebar, header, `<main id="main-content">` vuoto, modali globali.
3. Estendere `nav(sectionId)`:
   - se la vista non è montata → `fetch('/dashboard/views/' + sectionId + '.html')` → `main.innerHTML = html`
   - chiamare `initSection(sectionId)` registrato in mappa `window.__sectionInits`.
4. Cache in-memory `mountedViews: Set` per non rifetch nella sessione.

### Fase 2 — Lazy JS per vista

- Spostare init da `DOMContentLoaded` globale a `registerSectionInit('leads', fdInitContacts)`.
- Caricare `filodiretto/fd-contacts.js` solo al primo `nav('leads')` via `import()` dinamico o script inject (pattern già usato per HR boot).

### Fase 3 — Modali condivisi

- Modali usati da più viste (`#templateModal`, `#userModal`) restano nella shell o in `views/_modals.html` caricato una volta.

## File impattati

| Area | File |
|------|------|
| Markup | `src/dashboard/index.html` (split ~15 sezioni) |
| Nav | `dashboard/lib/nav.js`, inline `nav()` in index.html |
| Server | `src/server.js` — route statiche per `/dashboard/views/*` |
| Filo HR | `filodiretto/fd-*.js` — init on-demand |
| Test | nuovi contract test su fetch vista + a11y single H1 |

## Rischi

1. **Script che usano `getElementById` all'avvio** — falliscono se il nodo non è montato; richiede audit di ~50 handler.
2. **Modali e preview pass** — dipendenze cross-sezione; vanno nella shell.
3. **Regressione SEO/a11y** — mitigabile mantenendo `hidden`/`aria-hidden` finché non si migra.
4. **Caching CDN** — viste parziali versionate (`?v=hash`).

## Stima

| Fase | Effort | Rischio |
|------|--------|---------|
| 1 HTML split + fetch | 2–3 gg | Medio |
| 2 Lazy JS | 2 gg | Medio-alto |
| 3 QA + e2e | 1–2 gg | — |
| **Totale** | **5–7 gg** | |

## Decisione per questa release

**Rimandato:** l'intervento è troppo invasivo per una singola sessione di hardening. Task 4–5 (`hidden` + `aria-hidden`) riducono già l'esposizione a11y degli H1 multipli senza riscrivere il router.

## Criteri di accettazione futuri

- Una sola sezione figlia di `#main-content` per volta.
- Network: nessun fetch vista finché l'utente non naviga.
- Nessuna regressione su push, modali, brand switcher.
- Playwright: smoke per ogni voce menu HR.
