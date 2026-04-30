# Nudj MVP — Apple Wallet CRM Platform

## What this is

Nudj is a multi-tenant SaaS that lets brands create loyalty programs via Apple Wallet passes (.pkpass). Each brand gets a back office dashboard to manage members, points, rewards, push notifications, and pass design. Members receive a storeCard-type Apple Wallet pass with real-time updates.

Current live client: **Hirostar Hangar Padel Club** (padel center in Origgio, VA).

## Stack

- **Runtime**: Node.js 20+ / Express
- **Database**: PostgreSQL (Railway managed), `pg` driver, schema auto-migrated on boot via `getDb()`
- **Hosting**: Railway (Nixpacks builder, auto-deploy from `main`)
- **Domain**: `www.nudj.studio` (CUSTOM_DOMAIN env var)
- **Pass signing**: openssl `cms -sign` (NOT node-forge — it was unreliable)
- **Push**: APNs HTTP/2 via native Node (no library), JWT-based auth
- **Email**: Resend API (`resend` npm), domain-verified `nudj.studio`
- **Image processing**: Sharp (logo/icon/strip generation for passes)
- **AI**: Replicate API for AI-generated strip images

## Architecture

```
src/
├── server.js          # Express app, middleware, static routes, cron boot
├── api/
│   ├── routes.js      # ALL API endpoints (~3200 lines, single file)
│   └── debug-sign.js  # /debug/sign-test diagnostic endpoint
├── dashboard/
│   └── index.html     # Single-page admin dashboard (vanilla JS, no framework)
├── landing/
│   └── index.html     # Public signup page per brand (slug-routed)
├── privacy/
│   └── index.html     # Privacy policy page
├── db/
│   └── index.js       # PostgreSQL pool, schema DDL, all CRUD functions
└── engine/
    ├── passkit.js      # .pkpass builder + openssl signing
    ├── apns.js         # APNs push notification sender
    ├── mailer.js       # Resend email (welcome + recap templates)
    ├── email-recap.js  # Weekly/monthly points recap cron
    ├── scheduler.js    # Scheduled push notification cron
    ├── playtomic.js    # Playtomic API sync engine
    ├── challenges.js   # Auto-challenge evaluator
    ├── strip-promo.js  # Scheduled strip image rotation
    └── templates.js    # Default pass template factory
```

## Key files

### `src/api/routes.js` — the monolith
All REST endpoints in one file. Main groups:
- **Auth**: `/auth/login`, `/auth/me`, `/auth/change-password`
- **Users**: CRUD `/users` (admin-only)
- **Brands**: CRUD `/brands`, logo/strip upload, AI strip generation
- **Templates**: CRUD `/templates`
- **Passes**: CRUD `/passes`, `/passes/signup` (self-service), `/passes/:id/download`, `/passes/:id/regenerate`
- **Apple Wallet protocol**: `POST/DELETE /devices/:did/registrations/:ptid/:sn`, `GET /devices/:did/registrations/:ptid`, `GET /passes/:ptid/:sn`
- **Members**: CRUD `/members`, import/export CSV
- **Push**: `/push/send` (manual), `/push/scheduled` (cron), `/push/history`
- **Rewards/Challenges/Tiers/VIP Cards**: full CRUD each
- **Analytics**: `/analytics/:brand_id`, `/brands/:id/analytics/full`
- **Playtomic**: `/brands/:id/playtomic/sync`, `/brands/:id/playtomic/logs`
- **Strip Promos**: CRUD `/brands/:id/strip-promos`
- **Email Recap**: `/brands/:id/send-recap`, `/recap/run`

### `src/db/index.js` — database layer
Single file with schema DDL + all query functions. Tables:
`brands`, `pass_templates`, `pass_instances`, `events`, `device_registrations`, `rewards`, `challenges`, `tiers`, `vip_cards`, `reward_claims`, `challenge_completions`, `members`, `playtomic_sync_log`, `scheduled_push`, `push_log`, `users`

Schema is auto-applied on every boot (`getDb()`). Migrations are inline SQL after the CREATE TABLE block.

### `src/engine/passkit.js` — pass generation
Builds .pkpass ZIP: pass.json + manifest.json + signature + icon/logo/strip images. Signing uses `openssl cms -sign` with temp files in `/tmp/pkpass-sign-*`. Falls back to `smime` if `cms` fails. PEM cleaning strips Bag Attributes from exported certs.

### `src/dashboard/index.html` — admin UI
Single HTML file, vanilla JS, no build step. Uses fetch to call API. Tab-based navigation: Brand, Pass, Members, Rewards, Challenges, Tiers, VIP, Push, Playtomic, Strip Promo, Analytics, Users.

## Three pass creation flows

All three must assign welcome points + send welcome email + log events:

1. **Self-service signup** — `POST /passes/signup` — public, from landing page
2. **Backoffice new member** — `POST /members` — creates member + pass + points + email
3. **Crea Pass for existing member** — `POST /passes` — from dashboard, member already exists

## Environment variables

Required:
- `DATABASE_URL` — PostgreSQL connection string (Railway auto-sets)
- `PASS_TYPE_IDENTIFIER` — Apple pass type ID (e.g. `pass.com.nudj`)
- `TEAM_IDENTIFIER` — Apple Developer Team ID
- `JWT_SECRET` — for dashboard auth tokens
- `RESEND_API_KEY` — Resend email API key
- `CUSTOM_DOMAIN` — production domain (`www.nudj.studio`)

Certificates (file-based preferred, env fallback):
- `certs/signerCert.pem`, `certs/signerKey.pem`, `certs/wwdr.pem` — in repo
- `SIGNER_CERT_BASE64`, `SIGNER_KEY_BASE64`, `WWDR_CERT_BASE64` — env var fallback

Optional:
- `APNS_ENV` — `production` or `development` (defaults to production)
- `FROM_EMAIL`, `FROM_NAME` — email sender identity
- `REPLICATE_API_TOKEN` — for AI strip image generation
- `PORT` — defaults to 3000

## Development

```bash
npm install
# Set DATABASE_URL to a local PostgreSQL
npm run dev    # node --watch src/server.js
```

Dashboard at `http://localhost:3000/dashboard`
Landing at `http://localhost:3000/{brand-slug}`

## Conventions and gotchas

- **Multi-tenant isolation**: every query filters by `brand_id`. Never forget it.
- **Railway ephemeral filesystem**: generated .pkpass files in `/tmp` are wiped on redeploy. Pass download regenerates on-the-fly.
- **Pass signing**: uses `openssl cms` CLI, NOT node-forge. The `cleanPem()` function strips Bag Attributes that break signing.
- **APNs push**: `sendPushUpdate(pushToken)` takes a plain string, NOT an object.
- **Dashboard is one big HTML file**: all JS inline, no framework. Search for function names.
- **DB schema evolves inline**: migrations are raw SQL in `getDb()` after the schema block. No migration framework.
- **brand.config is JSONB**: stores colors, links, welcome messages, recap settings, Playtomic credentials, strip promo schedule — everything brand-specific.
- **Email**: Resend with domain `nudj.studio`. Templates are inline HTML in `mailer.js`.
- **Cron jobs boot in `server.js`**: scheduler (push), playtomic sync, strip promo check, email recap.

## Testing

No test framework. Test by deploying to Railway and checking:
1. Dashboard loads and CRUD works
2. Pass downloads and installs on iPhone
3. Push notifications arrive
4. Email delivers (check Resend dashboard for failures)
5. `/debug/sign-test` endpoint for signing diagnostics

## Repo & deploy

- **GitHub**: `mandriano77-prog/nudj-mvp`
- **Branch**: `main` (auto-deploy to Railway)
- **Deploy**: `git push origin main` triggers Railway build
- Always commit + push together. Railway deploys on every push to main.
