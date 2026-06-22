const test = require('node:test');
const assert = require('node:assert/strict');

const { parseWalletPushFlags } = require('../src/engine/push-dispatch');

test('parseWalletPushFlags supports comma-separated channel pairs', () => {
  assert.deepEqual(parseWalletPushFlags('apple,google'), {
    sendApple: true,
    sendGoogle: true,
    sendSamsung: false
  });
  assert.deepEqual(parseWalletPushFlags('google,samsung'), {
    sendApple: false,
    sendGoogle: true,
    sendSamsung: true
  });
});

test('parseWalletPushFlags keeps legacy both and all semantics', () => {
  assert.deepEqual(parseWalletPushFlags('both'), {
    sendApple: true,
    sendGoogle: true,
    sendSamsung: false
  });
  assert.deepEqual(parseWalletPushFlags('all'), {
    sendApple: true,
    sendGoogle: true,
    sendSamsung: true
  });
});
