'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

test('legacy modal-content gets dialog role and labelledby from header', () => {
  const dialog = {
    id: '',
    setAttribute(k, v) { this[k] = v; },
    getAttribute(k) { return this[k] || null; },
    hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this, k); },
    querySelector(sel) {
      if (sel.includes('ModalTitle') || sel.includes('modal-header')) {
        return { id: 'templateModalTitle', textContent: 'Nuovo Template' };
      }
      return null;
    },
    addEventListener() {},
    focus() {}
  };
  const modal = {
    id: 'templateModal',
    dataset: {},
    classList: { contains: () => false },
    setAttribute(k, v) { this[k] = v; },
    getAttribute(k) { return this[k] || null; },
    querySelector(sel) {
      if (sel === '.modal-content') return dialog;
      return null;
    },
    addEventListener() {}
  };

  global.MutationObserver = class {
    observe() {}
    disconnect() {}
  };
  const g = { document: { querySelectorAll: () => [], addEventListener: () => {} }, closeModal: () => {}, MutationObserver: global.MutationObserver };
  g.window = g;
  const code = fs.readFileSync(path.join(__dirname, '../src/dashboard/js/components/modal-a11y.js'), 'utf8');
  vm.runInNewContext(code, g, { filename: 'modal-a11y.js' });

  g.document.querySelectorAll = () => [modal];
  g.initLegacyModalA11y();
  assert.equal(dialog.getAttribute('role'), 'dialog');
  assert.equal(dialog.getAttribute('aria-modal'), 'true');
  assert.equal(dialog.getAttribute('aria-labelledby'), 'templateModalTitle');
});
