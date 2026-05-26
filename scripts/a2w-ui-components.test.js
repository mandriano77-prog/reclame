'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isConfirmTypingMatch } = require('../src/dashboard/js/components/ui/logic/confirm-typing.cjs');
const { createActionMenuRegistry } = require('../src/dashboard/js/components/ui/logic/action-menu-registry.cjs');

test('ConfirmDialog requireTyping: trimmed input must match confirmText', () => {
  assert.equal(isConfirmTypingMatch('  Dealer Day  ', 'Dealer Day'), true);
  assert.equal(isConfirmTypingMatch('Dealer Day', 'Dealer Day'), true);
  assert.equal(isConfirmTypingMatch('dealer day', 'Dealer Day'), false);
  assert.equal(isConfirmTypingMatch('', 'Dealer Day'), false);
});

test('ActionMenu: opening one closes the other', () => {
  const reg = createActionMenuRegistry();
  const closed = [];
  reg.registerMenu('a', {
    close: () => closed.push('a')
  });
  reg.registerMenu('b', {
    close: () => closed.push('b')
  });
  reg.notifyOpened('b');
  assert.deepEqual(closed, ['a']);
  assert.equal(reg.getOpenId(), 'b');
});

test('EmptyState: primaryAction onClick fires', () => {
  let fired = false;
  const primaryAction = { label: 'Crea', onClick: () => { fired = true; } };
  primaryAction.onClick();
  assert.equal(fired, true);
});
