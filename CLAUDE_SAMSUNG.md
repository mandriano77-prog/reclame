# Istruzioni per Claude (copia tutto il blocco qui sotto nella chat)

---

Sei nel progetto **Ads2Wallet / Nudj**: Node.js, Express, PostgreSQL, dashboard in HTML/JS, wallet **Apple (PassKit + APNs)**, **Google Wallet**, **Samsung Wallet** (Partner API).

## Samsung — stato implementazione

- Motore: `src/engine/samsung-wallet.js`  
  - Legge env con alias: `SAMSUNG_WALLET_*` e nomi corti (`SAMSUNG_PARTNER_ID`, `SAMSUNG_CERTIFICATE_ID`, `SAMSUNG_CARD_ID`, `SAMSUNG_PRIVATE_KEY`, `SAMSUNG_SIGNED_CERT`, access token opzionale).  
  - Paths chiavi/cert con espansione `~/`.  
  - Get Card Data / Send Card State (inbound JWT da verificare).  
  - Update Notification outbound: JWT **AUTH** (RS256) con chiave privata **oppure** Bearer da `SAMSUNG_WALLET_ACCESS_TOKEN`.  
  - `cc2` salvato su pass (`samsung_wallet_cc2`) dopo Send Card State; fallback `SAMSUNG_WALLET_DEFAULT_CC2`.
  - Tipo card configurabile via env `SAMSUNG_WALLET_CARD_TYPE` (default `coupon`) e `SAMSUNG_WALLET_CARD_SUBTYPE` (default `others`). HQ Italy → default cc2 = `IT`.

- Route API: `src/api/routes.js` — `/signup/samsung-wallet`, `/samsung-wallet/status`, `/samsung-wallet/pass/:id`, `/samsung-wallet/cards/:cardId/:refId` (GET + POST).

- Segreti **fuori repo**: ad es. `~/wallet-ads-secrets/` con `wallet-ads-samsung-private.key` e cert PEM per inbound.

- File `.env` in root (gitignored): path assoluti verso quel folder; da completare a mano **CUSTOM_DOMAIN** e i tre ID dal **portale Samsung Partner** (`SAMSUNG_WALLET_CARD_ID`, `SAMSUNG_WALLET_CERTIFICATE_ID`, `SAMSUNG_WALLET_PARTNER_ID`).

## Cosa puoi fare tu (Claude)

1. Leggi il codice citato e la doc Samsung (`server-interaction`, `security` JWT AUTH) e segnala solo **incoerenze o bug** concreti, con patch minime e path file.  
2. Non inventare ID, token o PEM; non stampare contenuti di `.env` o file chiave se l’utente li ha aperti.  
3. Se manca qualcosa per produzione (es. JWE `cdata`, host tsapi), indicalo come gap chiaro in elenco puntato.  
4. Rispetta le convenzioni del repo (stesso stile degli altri engine, niente refactor non richiesti).

## Cosa deve fare l’utente (non automatizzabile da te)

- Inserire nel portale Samsung l’URL Partner Get card data come da `GET /api/v1/samsung-wallet/status` → `partner_cards_base_url`.  
- Compilare i tre ID e `CUSTOM_DOMAIN` nel `.env` / segreti sul server.  
- Test su dispositivo Samsung reale dopo deploy HTTPS.

---

_Fine blocco da incollare in Claude._
