'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadDateUtils() {
  const g = { Date: Date, global: {}, window: {} };
  g.global = g;
  g.window = g;
  const code = fs.readFileSync(path.join(__dirname, '../src/dashboard/lib/date-utils.js'), 'utf8');
  vm.runInNewContext(code, g, { filename: 'date-utils.js' });
  return g;
}

test('formatRelativeSavedLabel uses weeks for multi-day saves', () => {
  const g = loadDateUtils();
  const twoWeeksAgo = Date.now() - (15 * 24 * 60 * 60 * 1000);
  const rel = g.formatRelativeSavedLabel(twoWeeksAgo);
  assert.match(rel.label, /settiman/);
  assert.match(rel.title, /Salvato il/);
});

test('formatRelativeSavedLabel keeps minutes for recent saves', () => {
  const g = loadDateUtils();
  const rel = g.formatRelativeSavedLabel(Date.now() - (12 * 60 * 1000));
  assert.equal(rel.label, 'Salvato 12 min fa');
});
