'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'src/dashboard/index.html'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'src/dashboard/js/a2w-shell.js'), 'utf8');
const chrome = fs.readFileSync(path.join(root, 'src/dashboard/styles/a2w-chrome.css'), 'utf8');

test('nav groups espansi di default nel markup', () => {
  const groups = ['brand-pass', 'comunicazione', 'insights', 'setup'];
  groups.forEach((id) => {
    assert.match(indexHtml, new RegExp(`data-nav-group="${id}"[^>]*\\bopen\\b`));
  });
});

test('stato open/collapsed persistito in localStorage', () => {
  assert.match(shell, /A2W_NAV_GROUP_KEY\s*=\s*['"]a2w:nav-group['"]/);
  assert.match(shell, /localStorage\.setItem\(`\$\{A2W_NAV_GROUP_KEY\}:\$\{groupId\}`/);
  assert.match(shell, /function a2wApplyNavGroupOpenState/);
});

test('intestazioni sezione non cliccabili; toggle dedicato', () => {
  assert.match(chrome, /nav-group-label[\s\S]*pointer-events:\s*none/);
  assert.match(chrome, /nav-group-label:hover[\s\S]*background:\s*transparent/);
  assert.match(chrome, /\.a2w-nav-group-toggle[\s\S]*pointer-events:\s*auto/);
  assert.match(indexHtml, /html\.a2w-shell \.nav-group-label[\s\S]*cursor:\s*default/);
});

test('voci nav con hover e stato active evidenti', () => {
  assert.match(chrome, /\.sidebar \.nav-item\.active[\s\S]*--a2w-nav-active-bg/);
  assert.match(chrome, /\.sidebar \.nav-item:hover:not\(\.disabled\)/);
  assert.match(chrome, /box-shadow:\s*inset 3px 0 0 var\(--a2w-action-primary\)/);
});
