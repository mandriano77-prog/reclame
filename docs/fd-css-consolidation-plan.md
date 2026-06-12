# Piano consolidamento CSS (Task 12)

## Prima/dopo richieste FiloDiretto (HR boot)

| Metrica | Prima | Dopo bundle |
|---------|-------|-------------|
| CSS FiloDiretto | 22 file | 1 (`fd.bundle.css`) |
| JS FiloDiretto | 20 file | 1 (`fd.bundle.js`) |
| **Risparmio HR** | **42 richieste** | **2 richieste** |

Il dashboard condiviso (`/dashboard/styles/*`, `/dashboard/css/*`) resta multi-file (~18 CSS + ~15 JS). Consolidamento futuro: `dashboard.bundle.css` con lo stesso script pattern.

## Sovrapposizioni note (non eliminate in questa release)

| Tema | File duplicati / sovrapposti | Nota |
|------|------------------------------|------|
| Contatti / leads | `a2w-leads.css`, `filo-contacts-refactor.css`, `fd-contacts.css` | HR usa principalmente `fd-contacts.css`; gli altri servono ancora Ads2Wallet |
| Form / dirty state | `fd-form-dirty.css`, `dashboard/css/components/form.css` | Token diversi; unificare in Fase 2 |
| Empty state | `empty-state.css`, `fd-empty-states.css` | Wrapper HR vs componente base |
| Tokens colore | `tokens.css`, `a2w-tokens.css`, `filodiretto/tokens.css` | `--fd-*` vs `--a2w-*`; mappare alias |
| Layout sidebar | `filo-layout.css`, `fd-layout.css`, `layout.css` | Shell condivisa + override HR |

## Build

```bash
npm run build:fd-bundles
```

Commitare `fd.bundle.css`, `fd.bundle.js`, `fd.bundle.manifest.json` dopo ogni modifica ai sorgenti FiloDiretto.

Debug senza bundle: `?fd_nobundle=1` sulla dashboard.
