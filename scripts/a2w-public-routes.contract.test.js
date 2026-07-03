'use strict';

// Guardrail for the positional auth model in routes.js: routes defined BEFORE the
// `router.use(authMiddleware)` gate are public (no JWT). It's easy to add a route above
// the gate and expose it by accident. This test freezes the set of public-by-position
// routes; adding/removing one fails CI until the developer consciously updates this list.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '../src/api/routes.js'), 'utf8');

// The intended public surface (method + path), as defined before the auth gate.
const EXPECTED_PUBLIC = new Set([
  'all /devices/*',
  'all /passes/:passTypeId/:serialNumber',
  'delete /devices/:deviceLibraryId/registrations/:passTypeId/:serialNumber',
  'get /activate/:token',
  'get /brands/by-slug/:slug',
  'get /brands/by-slug/:slug/landing-bg',
  'get /brands/by-slug/:slug/logo',
  'get /brands/by-slug/:slug/strip',
  'get /click/:campaign_id',
  'get /creative-assets/:id/image',
  'get /debug/push-diagnostics',
  'get /devices/:deviceLibraryId/registrations/:passTypeId',
  'get /join/:slug/info',
  'get /media/:id/image',
  'get /passes/:id/download',
  'get /passes/:id/wallet-icon-debug',
  'get /passes/:id/wallet-icon.png',
  'get /passes/:passTypeId/:serialNumber',
  'get /pixel/:campaign_id',
  'get /serve/:campaign_id',
  'get /serve/:campaign_id/image',
  'get /track/pass-link',
  'post /activate/:token',
  'post /auth/forgot-password',
  'post /auth/login',
  'post /auth/reset-password',
  'post /devices/:deviceLibraryId/registrations/:passTypeId/:serialNumber',
  'post /join/:slug',
  'post /redeem/confirm',
  'post /redeem/preview',
  'post /signup',
  'post /signup/google-wallet',
  'post /signup/samsung-wallet',
]);

function collectPublicRoutes() {
  const gateIdx = SRC.indexOf('if (isJwtBypassRoute(req)) return next();');
  assert.ok(gateIdx > 0, 'auth gate marker not found in routes.js');
  const before = SRC.slice(0, gateIdx);
  const re = /router\.(get|post|put|delete|patch|all)\(\s*['"]([^'"]+)['"]/g;
  const found = new Set();
  let m;
  while ((m = re.exec(before)) !== null) {
    found.add(`${m[1]} ${m[2]}`);
  }
  return found;
}

test('routes.js: no route becomes public-by-position without updating the allowlist', () => {
  const actual = collectPublicRoutes();

  const added = [...actual].filter((r) => !EXPECTED_PUBLIC.has(r));
  const removed = [...EXPECTED_PUBLIC].filter((r) => !actual.has(r));

  assert.deepEqual(
    added, [],
    `New public (pre-auth-gate) route(s) detected. If intentional, add them to EXPECTED_PUBLIC; ` +
    `otherwise move them below the auth gate:\n  ${added.join('\n  ')}`
  );
  assert.deepEqual(
    removed, [],
    `Public route(s) removed/moved. Update EXPECTED_PUBLIC:\n  ${removed.join('\n  ')}`
  );
});
