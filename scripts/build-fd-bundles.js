#!/usr/bin/env node
/**
 * Concatena CSS/JS FiloDiretto in bundle singoli (nessuna dipendenza esterna).
 * Uso: node scripts/build-fd-bundles.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FD = path.join(ROOT, 'src', 'filodiretto');

const CSS_FILES = [
  'tokens.css', 'fd-theme.css', 'fd-typography.css', 'fd-buttons.css', 'fd-header.css',
  'fd-layout.css', 'fd-wai.css', 'fd-brand-switcher.css', 'fd-nav.css', 'fd-brand-identity.css',
  'fd-brand-scope.css', 'fd-home.css', 'fd-users.css', 'fd-contacts.css', 'fd-media-library.css',
  'fd-destructive.css', 'fd-form-dirty.css', 'fd-form-help.css', 'fd-empty-states.css',
  'fd-danger-zone.css', 'fd-push.css', 'fd-responsive-tables.css', 'fd-rbac.css',
];

const JS_FILES = [
  'fd-buttons.js', 'fd-header.js', 'fd-layout.js', 'fd-wai.js', 'fd-brand-switcher.js',
  'fd-nav.js', 'fd-hr-copy.js', 'fd-brand-scope.js', 'fd-home.js', 'fd-users.js',
  'fd-contacts.js', 'fd-media-library.js', 'fd-destructive.js', 'fd-form-dirty.js',
  'fd-form-help.js', 'fd-form-a11y.js', 'fd-empty-states.js', 'fd-danger-zone.js',
  'fd-rbac.js', 'fd-push.js', 'fd-responsive-tables.js',
];

function minifyCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>+~])\s*/g, '$1')
    .trim();
}

function minifyJs(js) {
  return js
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

function concat(files, dir, minify) {
  return files.map((f) => {
    const p = path.join(dir, f);
    if (!fs.existsSync(p)) throw new Error('Missing: ' + p);
    return '/* === ' + f + ' === */\n' + fs.readFileSync(p, 'utf8');
  }).join('\n\n');
}

const cssRaw = concat(CSS_FILES, FD, false);
const jsRaw = concat(JS_FILES, FD, false);

fs.writeFileSync(path.join(FD, 'fd.bundle.css'), minifyCss(cssRaw));
fs.writeFileSync(path.join(FD, 'fd.bundle.js'), minifyJs(jsRaw));

const manifest = {
  builtAt: new Date().toISOString(),
  cssFiles: CSS_FILES.length,
  jsFiles: JS_FILES.length,
  cssBytes: fs.statSync(path.join(FD, 'fd.bundle.css')).size,
  jsBytes: fs.statSync(path.join(FD, 'fd.bundle.js')).size,
  requestsBefore: CSS_FILES.length + JS_FILES.length,
  requestsAfter: 2,
};

fs.writeFileSync(path.join(FD, 'fd.bundle.manifest.json'), JSON.stringify(manifest, null, 2));

console.log('FiloDiretto bundles written:', manifest);
