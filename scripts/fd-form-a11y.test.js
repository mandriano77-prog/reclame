'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('fd-form-a11y wires label for attributes', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/filodiretto/fd-form-a11y.js'), 'utf8');
  assert.match(src, /wireFormLabels/);
  assert.match(src, /setAttribute\('for'/);
  assert.match(src, /fixPreviewImages/);
  assert.match(src, /ensureGlobalLiveRegion/);
  assert.match(src, /fdEnhanceLoadingRegions/);
});
