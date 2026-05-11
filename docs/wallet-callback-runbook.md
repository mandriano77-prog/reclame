# Wallet Callback Runbook (Google/Samsung)

## Obiettivo

Verificare rapidamente perche' un pass risulta "link generato" ma non "salvato".

## Controlli base

1. Verifica stato integrazioni in dashboard:
   - Google: callback pubblico configurato.
   - Samsung: inbound JWT verify ready.
2. Verifica che il brand abbia pass con link wallet generato.
3. Controlla Activity Log per eventi:
   - `google_wallet_link_generated`
   - `google_wallet_installed`
   - `samsung_wallet_installed`

## Google Wallet: troubleshooting

1. Controlla log server:
   - `[GoogleWallet Callback] Received`
   - eventuali `Missing signedMessage`, `Google cert fetch failed`, `Unknown event type`.
2. Se callback ricevuti ma `saved` fermo:
   - verifica `objectId` presente nel payload callback.
   - verifica che `google_wallet_object_id` esista su `pass_instances`.
3. Se callback duplicati:
   - il sistema ora deduplica con `event_hash` (sha256 di `signedMessage`).
   - stato atteso in telemetria: `duplicate_ignored`.

## Samsung Wallet: troubleshooting

1. Verifica che callback GET/POST arrivino con `x-request-id`.
2. Verifica JWT inbound:
   - `SAMSUNG_SIGNED_CERT` o `SAMSUNG_WALLET_JWT_PUBLIC_KEY_PEM`.
3. Verifica query params:
   - `cc2` valido e `event` presente su POST.

## Query utili (PostgreSQL)

```sql
-- Ultimi callback wallet
SELECT provider, event_type, object_id, process_status, processed, created_at, processed_at
FROM wallet_callback_events
ORDER BY created_at DESC
LIMIT 50;
```

```sql
-- Callback Google per brand
SELECT process_status, COUNT(*) AS total
FROM wallet_callback_events
WHERE provider = 'google' AND brand_id = '<brand_id>'
GROUP BY process_status
ORDER BY total DESC;
```

```sql
-- Pass Google con link ma non salvati
SELECT id, serial_number, google_wallet_object_id, google_wallet_saved, created_at
FROM pass_instances
WHERE brand_id = '<brand_id>'
  AND google_wallet_object_id IS NOT NULL
  AND google_wallet_object_id <> ''
  AND google_wallet_saved = FALSE
ORDER BY created_at DESC
LIMIT 100;
```

## Stati telemetria callback (Google)

- `received`: evento inserito.
- `applied_save`: callback valido, pass marcato salvato.
- `applied_delete`: callback valido, pass marcato rimosso.
- `ignored_no_object`: payload senza object id.
- `ignored_no_pass`: object id non mappato nel DB.
- `ignored_unknown_type`: event type non riconosciuto.
- `duplicate_ignored`: callback gia' processato.
- `error`: errore runtime durante processing.
