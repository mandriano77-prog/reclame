'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'src/dashboard/index.html'), 'utf8');
const routesJs = fs.readFileSync(path.join(root, 'src/api/routes.js'), 'utf8');

test('Aggiungi contatto apre modale (non /landing/new)', () => {
  assert.match(indexHtml, /id="a2wAddContactModal"/);
  assert.match(indexHtml, /function openA2wAddContactModal\(/);
  assert.match(indexHtml, /function submitA2wAddContact\(/);
  assert.match(indexHtml, /id="a2wContactsAddBtn"/);
  assert.match(indexHtml, /class="btn a2w-contacts-header-btn" id="a2wContactsAddBtn"/);
  const addBtnBlock = indexHtml.match(/a2wContactsAddBtn[\s\S]{0,400}/);
  assert.ok(addBtnBlock, 'add button handler missing');
  assert.doesNotMatch(addBtnBlock[0], /landing\/new/);
});

test('empty state CTA usa campagne, non /landing/new', () => {
  assert.match(indexHtml, /openA2wContactsPrimaryLanding\(\)/);
  assert.doesNotMatch(
    indexHtml.match(/a2w-contacts-empty[\s\S]{0,1200}/)?.[0] || '',
    /landing\/new/
  );
});

test('API espone POST /brands/:brand_id/leads', () => {
  assert.match(routesJs, /router\.post\('\/brands\/:brand_id\/leads'/);
});

test('sidebar nav groups hanno helper a11y in a2w-shell', () => {
  const shell = fs.readFileSync(path.join(root, 'src/dashboard/js/a2w-shell.js'), 'utf8');
  assert.match(shell, /initA2wNavGroupAccessibility/);
  assert.match(shell, /aria-expanded/);
  assert.match(shell, /A2W_NAV_GROUP_KEY/);
  assert.match(shell, /a2wSyncNavGroupsVisibility/);
  assert.match(shell, /a2w-nav-soon-badge/);
  assert.match(shell, /details\.setAttribute\('open'/);
});

test('sidebar nav chrome usa token A2W per label e stati voce', () => {
  const chrome = fs.readFileSync(path.join(root, 'src/dashboard/styles/a2w-chrome.css'), 'utf8');
  assert.match(chrome, /\.a2w-nav-group-heading/);
  assert.match(chrome, /\.a2w-nav-soon-badge/);
  assert.match(chrome, /nav-group-label:hover[\s\S]*background:\s*transparent/);
  assert.match(chrome, /--a2w-action-secondary-hover/);
});
