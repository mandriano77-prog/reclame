'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const modalJs = fs.readFileSync(path.join(root, 'src/dashboard/js/components/a2w-modal.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'src/dashboard/index.html'), 'utf8');

test('A2wModal exports mount/open/close', () => {
  assert.match(modalJs, /A2wModal\s*=\s*\{/);
  assert.match(modalJs, /mount:/);
  assert.match(modalJs, /BODY_LOCK_CLASS/);
  assert.match(modalJs, /getFocusables/);
});

test('add-contact modal uses a2w-modal layer', () => {
  assert.match(indexHtml, /class="a2w-modal a2w-add-contact-modal"/);
  assert.match(indexHtml, /a2w-modal__backdrop/);
  assert.match(indexHtml, /a2w-btn-primary/);
  assert.match(indexHtml, /A2wModal\.mount\(modalId/);
  assert.doesNotMatch(
    indexHtml.match(/id="a2wAddContactModal"[\s\S]{0,200}/)?.[0] || '',
    /import-modal-overlay/
  );
});

test('empty state prioritizes landing CTA', () => {
  const block = indexHtml.match(/a2w-contacts-empty[\s\S]{0,1600}/)?.[0] || '';
  assert.match(block, /a2w-contacts-empty__actions--primary/);
  assert.match(block, /Crea la prima landing/);
  assert.match(block, /a2w-contacts-empty__actions--secondary/);
  assert.match(block, /Importa CSV/);
});
