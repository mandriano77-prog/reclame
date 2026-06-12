'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadModalA11y() {
  global.MutationObserver = class {
    observe() {}
    disconnect() {}
  };
  global.requestAnimationFrame = (fn) => fn();
  const g = {
    document: {
      body: { classList: { add() {}, remove() {} } },
      querySelectorAll: () => [],
      querySelector: () => null,
      addEventListener: () => {},
      contains: () => false
    },
    closeModal: null,
    MutationObserver: global.MutationObserver,
    requestAnimationFrame: global.requestAnimationFrame
  };
  g.window = g;
  g.document.body = g.document.body;
  const code = fs.readFileSync(path.join(__dirname, '../src/dashboard/js/components/modal-a11y.js'), 'utf8');
  vm.runInNewContext(code, g, { filename: 'modal-a11y.js' });
  return g;
}

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
    classList: {
      _active: false,
      contains() { return this._active; }
    },
    setAttribute(k, v) { this[k] = v; },
    getAttribute(k) { return this[k] || null; },
    querySelector(sel) {
      if (sel === '.modal-content') return dialog;
      return null;
    },
    addEventListener() {}
  };

  const g = loadModalA11y();
  g.document.querySelectorAll = () => [modal];
  g.initLegacyModalA11y();
  assert.equal(dialog.getAttribute('role'), 'dialog');
  assert.equal(dialog.getAttribute('aria-modal'), 'true');
  assert.equal(dialog.getAttribute('aria-labelledby'), 'templateModalTitle');
});

test('init exposes prepareModalOpen and unified closeModal', () => {
  const g = loadModalA11y();
  g.initLegacyModalA11y();
  assert.equal(typeof g.prepareModalOpen, 'function');
  assert.equal(typeof g.openLegacyModal, 'function');
  assert.equal(typeof g.closeModal, 'function');
});
