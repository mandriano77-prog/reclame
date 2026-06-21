'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

test('fd-templates.js wires Filo HR template preview flip toggle', () => {
  const js = read('src/filodiretto/fd-templates.js');
  assert.match(js, /function setPreviewFace/);
  assert.match(js, /a2w-tpl-show-back/);
  assert.match(js, /initPreviewToggle/);
  assert.match(js, /patchTemplateModalFlip/);
  assert.match(js, /openTemplateModal.*editTemplate/s);
});

test('fd-templates.css applies flip transform for Filo template modal', () => {
  const css = read('src/filodiretto/fd-templates.css');
  assert.match(css, /html\[data-app='filodiretto'\] #templateModal \.pass-flip-container\.a2w-tpl-show-back \.pass-flip-inner/);
  assert.match(css, /rotateY\(180deg\)/);
});

test('index.html HR pass preview includes HUB CONVENZIONI back link', () => {
  const html = read('src/dashboard/index.html');
  assert.match(html, /function previewHubUrl\(\)/);
  assert.match(html, /TOKEN_AUTOMATICO/);
  assert.match(html, /addBackLink\('HUB CONVENZIONI', previewHubUrl\(\)\)/);
  assert.match(html, /addBackLink\('PROFILO PERSONALE'/);
  const hubIdx = html.indexOf("addBackLink('HUB CONVENZIONI', previewHubUrl())");
  const portalIdx = html.indexOf("addBackLink('PROFILO PERSONALE'");
  assert.ok(hubIdx > -1 && portalIdx > -1 && hubIdx < portalIdx, 'HUB CONVENZIONI must appear before PROFILO PERSONALE');
});
