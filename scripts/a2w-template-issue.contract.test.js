'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'src/dashboard/index.html'), 'utf8');
const serverJs = fs.readFileSync(path.join(root, 'src/server.js'), 'utf8');
const pushUx = fs.readFileSync(path.join(root, 'src/dashboard/js/a2w-push-ux.js'), 'utf8');

test('template card shows Emetti il pass with link and QR actions', () => {
  assert.match(indexHtml, /function renderTemplateIssueSection/);
  assert.match(indexHtml, /Emetti il pass/);
  assert.match(indexHtml, /Crea link/);
  assert.match(indexHtml, /Crea QR/);
  assert.match(indexHtml, /getTemplatePassDirectUrl/);
  assert.match(indexHtml, /showTemplatePassQR/);
  assert.match(indexHtml, /renderTemplateIssueSection\(t\.id\)/);
});

test('/save route accepts template_id query for per-template download', () => {
  assert.match(serverJs, /req\.query\.template_id/);
});

test('push UX resolves brand via ensureBrandIdFromContext and window.brandId sync', () => {
  assert.match(indexHtml, /function syncGlobalBrandId/);
  assert.match(indexHtml, /window\.brandId = brandId/);
  assert.match(pushUx, /function resolveBrandId/);
  assert.match(pushUx, /ensureBrandIdFromContext/);
});
