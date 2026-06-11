'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadResponsiveTables() {
  const g = {
    document: {
      documentElement: {
        classList: { contains: () => false },
        getAttribute: (k) => (k === 'data-app' ? 'filodiretto' : null)
      },
      querySelectorAll: () => [],
      querySelector: () => null,
      addEventListener: () => {}
    },
    __2WALLET_PRODUCT_LOCK__: 'hr',
    addEventListener: () => {}
  };
  g.window = g;
  const code = fs.readFileSync(path.join(__dirname, '../src/filodiretto/fd-responsive-tables.js'), 'utf8');
  vm.runInNewContext(code, g, { filename: 'fd-responsive-tables.js' });
  return g;
}

test('fdHeaderLabelForTable defaults empty last header to Azioni', () => {
  const g = loadResponsiveTables();
  assert.equal(g.fdHeaderLabelForTable({ textContent: 'Nome' }, 0, 4), 'Nome');
  assert.equal(g.fdHeaderLabelForTable({ textContent: '  ' }, 3, 4), 'Azioni');
});
