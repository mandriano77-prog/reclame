'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadScript(relativePath, globals) {
  const code = fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
  const ctx = { ...globals, window: globals, global: globals };
  vm.runInNewContext(code, ctx, { filename: relativePath });
  return ctx;
}

test('renderTableEmptyState wraps empty state in colspan row', () => {
  const g = {};
  loadScript('src/dashboard/js/components/empty-state.js', g);
  const html = g.renderTableEmptyState(8, {
    title: 'Nessuna campagna Reward',
    description: 'Test',
    ctaLabel: '+ Nuova Campagna',
    ctaOnclick: 'openIwModal()',
    icon: 'ticket'
  });
  assert.match(html, /table-empty-row/);
  assert.match(html, /colspan="8"/);
  assert.match(html, /Nessuna campagna Reward/);
  assert.match(html, /openIwModal\(\)/);
});

test('fdTableEmptyState applies reward preset copy', () => {
  const g = { document: { documentElement: { getAttribute: () => 'filodiretto', classList: { contains: () => false } } } };
  loadScript('src/dashboard/js/components/empty-state.js', g);
  loadScript('src/filodiretto/fd-empty-states.js', g);
  const html = g.fdTableEmptyState(8, { title: 'Nessuna campagna Reward', ctaOnclick: 'openIwModal()', icon: 'ticket' });
  assert.match(html, /Premia i tuoi dipendenti/);
  assert.match(html, /\+ Nuova Campagna/);
  assert.match(html, /Come funziona/);
});
