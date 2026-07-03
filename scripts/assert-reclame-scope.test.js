'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { isForbidden } = require('./assert-reclame-scope.js');

test('reclame scope blocks filodiretto paths', () => {
  assert.ok(isForbidden('src/filodiretto/fd-nav.js'));
  assert.ok(isForbidden('scripts/fd-nav-groups.test.js'));
  assert.ok(isForbidden('scripts/build-fd-bundles.js'));
  assert.ok(isForbidden('e2e/fd-nav-groups.spec.js'));
});

test('reclame scope allows reclame paths', () => {
  assert.ok(!isForbidden('src/engine/reclame-commercial.js'));
  assert.ok(!isForbidden('src/dashboard/js/a2w-commercial.js'));
  assert.ok(!isForbidden('scripts/reclame-phases-2-6.test.js'));
  assert.ok(!isForbidden('.cursor/rules/reclame-only.mdc'));
});

test('reclame-only cursor rule exists', () => {
  const fs = require('fs');
  const rule = fs.readFileSync(path.join(__dirname, '../.cursor/rules/reclame-only.mdc'), 'utf8');
  assert.match(rule, /alwaysApply:\s*true/);
  assert.match(rule, /src\/filodiretto/);
});

test('reclame-scope workflow is registered', () => {
  const fs = require('fs');
  const wf = fs.readFileSync(path.join(__dirname, '../.github/workflows/reclame-scope.yml'), 'utf8');
  assert.match(wf, /name:\s*Reclame scope/);
  assert.match(wf, /npm run check:reclame-scope/);
});
