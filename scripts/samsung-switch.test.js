'use strict';

// Samsung è un "non ancora": le credenziali restano in produzione — servono a tenerlo
// pronto — ma finché non lo si vende non deve comparire da nessuna parte. Avere le
// credenziali non è più sufficiente: serve un interruttore esplicito.
// L'interruttore blocca ciò che NASCE (pulsante sulla landing, emissione di pass nuovi,
// UI in dashboard). Non tocca ciò che esiste: eventuali pass già su Samsung continuano ad
// aggiornarsi, e la diagnostica continua a dire la verità sulle credenziali.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

function conEnv(env, fn) {
  const prima = {};
  Object.keys(env).forEach((k) => { prima[k] = process.env[k]; process.env[k] = env[k]; });
  try {
    delete require.cache[require.resolve('../src/engine/samsung-wallet')];
    return fn(require('../src/engine/samsung-wallet'));
  } finally {
    Object.keys(prima).forEach((k) => {
      if (prima[k] === undefined) delete process.env[k]; else process.env[k] = prima[k];
    });
    delete require.cache[require.resolve('../src/engine/samsung-wallet')];
  }
}

const CREDENZIALI = {
  SAMSUNG_WALLET_CARD_ID: 'x',
  SAMSUNG_WALLET_CERTIFICATE_ID: 'y',
  SAMSUNG_WALLET_PARTNER_ID: 'z'
};

test('con le credenziali ma senza interruttore, Samsung resta spento', () => {
  // È il caso reale: le variabili Samsung sono su Railway, ma non lo usiamo ancora.
  conEnv({ ...CREDENZIALI, SAMSUNG_WALLET_ENABLED: '' }, (sw) => {
    assert.equal(sw.isConfigured(), true, 'le credenziali ci sono e la diagnostica lo dice');
    assert.equal(sw.isEnabled(), false, 'ma al pubblico non si mostra');
  });
});

test("l'interruttore da solo non basta: senza credenziali resta spento", () => {
  conEnv({ SAMSUNG_WALLET_ENABLED: 'true', SAMSUNG_WALLET_CARD_ID: '', SAMSUNG_WALLET_CERTIFICATE_ID: '', SAMSUNG_WALLET_PARTNER_ID: '' }, (sw) => {
    assert.equal(sw.isEnabled(), false);
  });
});

test('credenziali + interruttore: Samsung torna disponibile', () => {
  for (const on of ['true', '1', 'yes', 'si', 'TRUE']) {
    conEnv({ ...CREDENZIALI, SAMSUNG_WALLET_ENABLED: on }, (sw) => {
      assert.equal(sw.isEnabled(), true, `SAMSUNG_WALLET_ENABLED=${on} deve accendere`);
    });
  }
});

test('le superfici pubbliche usano isEnabled, la diagnostica isConfigured', () => {
  const routes = fs.readFileSync(path.join(root, 'src/api/routes.js'), 'utf8');
  const server = fs.readFileSync(path.join(root, 'src/server.js'), 'utf8');
  // landing (pulsante) + /health (UI dashboard) + emissione pass nuovi
  assert.match(routes, /samsung: samsungWallet\.isEnabled\(\)/);
  assert.match(server, /require\('\.\/engine\/samsung-wallet'\)\.isEnabled\(\)/);
  const signup = routes.indexOf("router.post('/signup/samsung-wallet'");
  assert.ok(signup > 0);
  assert.match(routes.slice(signup, signup + 700), /if \(!samsungWallet\.isEnabled\(\)\)/);
  // ciò che esiste continua a funzionare: pass già salvati e diagnostica
  const status = routes.indexOf("router.get('/samsung-wallet/status'");
  assert.match(routes.slice(status, status + 400), /samsungWallet\.isConfigured\(\)/);
});
