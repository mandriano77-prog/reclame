'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  sanitizeInitials,
  sanitizeHex,
  colorForCategory,
  renderPlaceholderLogo,
} = require('../src/engine/placeholder-logo');

test('sanitizeInitials keeps up to 2 alphanumerics, uppercased', () => {
  assert.equal(sanitizeInitials('Moda Milano'), 'MO');
  assert.equal(sanitizeInitials('mm'), 'MM');
  assert.equal(sanitizeInitials('Scarpe & Co.'), 'SC');
  assert.equal(sanitizeInitials(''), '•');
  assert.equal(sanitizeInitials('  '), '•');
});

test('sanitizeHex validates and falls back', () => {
  assert.equal(sanitizeHex('#6c5ce7'), '#6C5CE7');
  assert.equal(sanitizeHex('6C5CE7'), '#6C5CE7');
  assert.equal(sanitizeHex('nope'), '#6C5CE7');
  assert.equal(sanitizeHex('', '#000000'), '#000000');
});

test('colorForCategory maps known categories, else null', () => {
  assert.equal(colorForCategory('retail'), '#6C5CE7');
  assert.equal(colorForCategory('FOOD'), '#E8590C');
  assert.equal(colorForCategory('bogus'), null);
});

test('renderPlaceholderLogo returns a valid PNG buffer', async () => {
  const png = await renderPlaceholderLogo({ text: 'Moda Milano', bg: colorForCategory('retail') });
  assert.ok(Buffer.isBuffer(png) && png.length > 100);
  // PNG magic number
  assert.equal(png.slice(0, 8).toString('hex'), '89504e470d0a1a0a');
});

test('renderPlaceholderLogo clamps size into a sane range', async () => {
  const sharp = require('sharp');
  const tiny = await sharp(await renderPlaceholderLogo({ text: 'X', size: 10 })).metadata();
  const huge = await sharp(await renderPlaceholderLogo({ text: 'X', size: 9999 })).metadata();
  assert.equal(tiny.width, 64);
  assert.equal(huge.width, 512);
});
