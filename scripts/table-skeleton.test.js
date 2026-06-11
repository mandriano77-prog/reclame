'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

test('renderTableSkeletonRows builds shimmer rows', () => {
  const g = { window: {}, global: {} };
  g.window = g;
  g.global = g;
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, '../src/dashboard/js/components/table-skeleton.js'), 'utf8'),
    g,
    { filename: 'table-skeleton.js' }
  );
  const html = g.renderTableSkeletonRows(3, 4);
  assert.match(html, /table-skeleton-row/);
  assert.equal((html.match(/table-skeleton-line/g) || []).length, 12);
});

test('renderTableErrorRow includes retry handler', () => {
  const g = { window: {}, global: {} };
  g.window = g;
  g.global = g;
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, '../src/dashboard/js/components/table-skeleton.js'), 'utf8'),
    g,
    { filename: 'table-skeleton.js' }
  );
  const html = g.renderTableErrorRow(5, 'Timeout', 'loadActivityLog()');
  assert.match(html, /Riprova/);
  assert.match(html, /loadActivityLog\(\)/);
  assert.match(html, /colspan="5"/);
});
