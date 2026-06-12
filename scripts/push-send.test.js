'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadPushHelpers() {
  const html = fs.readFileSync(path.join(__dirname, '../src/dashboard/index.html'), 'utf8');
  const start = html.indexOf('const PUSH_SEND_TIMEOUT_MS');
  const end = html.indexOf('async function sendImmediatePush()');
  const block = html.slice(start, end);
  const g = {
    document: {
      getElementById(id) {
        return g._els[id] || null;
      }
    },
    _els: {
      pushTitleError: { textContent: '' },
      pushMessageError: { textContent: '' },
      pushSendError: { textContent: '', hidden: true },
      pushSendBtn: { disabled: false, innerHTML: 'Send', dataset: {} }
    }
  };
  ['pushTitle', 'pushMessage'].forEach((id) => {
    g._els[id] = { value: '', setAttribute() {} };
  });
  vm.runInNewContext(block, g, { filename: 'push-helpers.js' });
  return g;
}

test('setPushFieldError writes inline validation message', () => {
  const g = loadPushHelpers();
  g.setPushFieldError('pushTitle', 'Inserisci un titolo per la notifica');
  assert.equal(g._els.pushTitleError.textContent, 'Inserisci un titolo per la notifica');
});

test('setPushSendLoading restores button label', () => {
  const g = loadPushHelpers();
  g.setPushSendLoading(true);
  assert.equal(g._els.pushSendBtn.disabled, true);
  g.setPushSendLoading(false);
  assert.equal(g._els.pushSendBtn.disabled, false);
});
