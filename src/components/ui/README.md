# Ads2Wallet UI kit

This repo’s dashboard is **vanilla JS** (`src/dashboard/index.html`), not React. The design system is implemented as:

| Spec (React path) | Production runtime |
|-------------------|-------------------|
| `src/components/ui/*.tsx` | `src/dashboard/js/components/ui/*.js` |
| Tailwind utilities | `src/dashboard/styles/a2w-ui-components.css` + `a2w-tokens.css` |
| `globals.css` tokens | `html[data-shell="dark"].a2w-shell` scoped variables |

**Playground:** open `/dashboard/ui-playground.html` with the dev server running.

**Tests:** `npm run test:ui`

TypeScript types in `index.ts` describe the public API for future React migration.
