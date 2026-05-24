# CHANGELOG UI — FiloDiretto Studio

> **Nota stack:** il back office attuale è la dashboard Express (`src/dashboard/index.html`), non Next.js.
> Le specifiche App Router/shadcn sono adattate incrementalmente su questo codebase.

## SETUP + TASK 1 — Naming (2026-05-24)

### Utente
- Sidebar allineata a un unico catalogo voci (`src/dashboard/lib/nav.js`).
- **Identità** → **Identità Brand**; **Push Notification** → **Push & Notifiche**.
- **Leads / People / Dipendenti** → **Contatti**; **Attività** → **Log Attività**.
- **Audience Platform** → **Audience**; **Gestione Utenti** → **Utenti**.
- Tab browser Filo light: `Identità Brand · Filo Diretto`.

### Tecnico
- `src/dashboard/lib/nav.js`, `lib/utils.js`, `styles/tokens.css`, `data-section-id` sidebar.

---

## TASK 2–12 — Componenti UI (2026-05-24)

### Utente
- **PageHeader** uniforme su tutte le sezioni (titolo, descrizione, azioni).
- **Empty state** illustrati su Campagne, Template, Pass, Instant Win, Gamification, Contatti, Audience, Log Attività.
- **Conferme eliminazione** con dialog modale al posto del popup browser.
- **Zona pericolosa** separata per eliminazione brand.
- **Push & Notifiche**: tab con icone SVG (Immediata / Programmata / Geofencing) e dropzone strip.
- **Sidebar mobile**: menu hamburger + drawer; gruppi collassabili ricordati in localStorage.
- **Stat card**, tabelle e form con spacing e label sentence-case (shell light).
- **W.AI FAB** con tooltip e focus visibile.

### Tecnico
```
src/dashboard/
  css/components/   page-header, empty-state, stat-card, data-table, form, dialog, danger-zone, tabs, dropzone, fab
  css/layout.css    mobile sidebar sheet
  js/main.js        ES module bootstrap
  js/lib/nav.js     NAV (ESM, mirror di lib/nav.js)
  js/components/    confirm-dialog, empty-state, page-header, sidebar
```

### Decisioni
- Nessuna dipendenza npm aggiuntiva; Lucide sostituito da SVG inline nei tab.
- Logica API invariata; solo markup/CSS/UX client.
