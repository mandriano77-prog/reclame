'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const FD = path.join(ROOT, 'src', 'filodiretto');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function readFd(name) {
  return fs.readFileSync(path.join(FD, name), 'utf8');
}

/** FASE 4 pages + DS modules exercised across viewports. */
const SECTION_MATRIX = [
  {
    label: 'Inizio',
    sectionId: 'welcome',
    js: 'fd-home.js',
    css: 'fd-home.css',
    patterns: ['fd-page-header', 'fd-skeleton', 'fd-empty-state', 'fdRenderErrorState|fdRenderLoadingRegion']
  },
  {
    label: 'Identità Brand',
    sectionId: 'brand-identity',
    js: 'fd-brand-identity.js',
    css: 'fd-brand-identity.css',
    patterns: ['fd-page-header', 'fd-form-section', 'fd-btn']
  },
  {
    label: 'Media Library',
    sectionId: 'media-library',
    js: 'fd-media-library.js',
    css: 'fd-media-library.css',
    patterns: ['fd-skeleton', 'media-tabs|fd-media-tabs', 'media-hidden|media-dropzone']
  },
  {
    label: 'Template Pass',
    sectionId: 'templates',
    js: 'fd-templates.js',
    css: 'fd-templates.css',
    patterns: ['fd-skeleton', 'fd-tpl-list', 'fd-btn--primary|fd-tpl-card-menu']
  },
  {
    label: 'Pass Emessi',
    sectionId: 'passes',
    js: 'fd-passes.js',
    css: 'fd-passes.css',
    patterns: ['fd-skeleton', 'fd-stat-grid', 'fd-passes-legend-hint|fd-table-wrap']
  },
  {
    label: 'Push',
    sectionId: 'push',
    js: 'fd-push.js',
    css: 'fd-push.css',
    patterns: ['fd-skeleton', 'fd-empty-state', 'aria-live']
  },
  {
    label: 'Reward',
    sectionId: 'instant-win',
    js: 'fd-reward-challenge.js',
    css: 'fd-reward-challenge.css',
    patterns: ['fd-reward-table-skeleton', 'fd-loading-region', 'aria-live']
  },
  {
    label: 'Challenge',
    sectionId: 'gamification',
    js: 'fd-reward-challenge.js',
    css: 'fd-reward-challenge.css',
    patterns: ['fd-challenge-table-skeleton', 'fd-loading-region', 'aria-live']
  },
  {
    label: 'Analytics',
    sectionId: 'analytics',
    js: 'fd-analytics.js',
    css: 'fd-analytics.css',
    patterns: ['fd-analytics-stats-skeleton', 'fd-skeleton', 'aria-busy']
  },
  {
    label: 'Log Attività',
    sectionId: 'activity-log',
    js: 'fd-activity-log.js',
    css: 'fd-activity-log.css',
    patterns: ['fd-activity-log-toolbar', 'EVENT_TYPE_LABELS', 'fd-activity-log-details__text']
  },
  {
    label: 'Utenti',
    sectionId: 'users',
    js: 'fd-users.js',
    css: 'fd-users.css',
    patterns: ['fd-page-header', 'fd-users-protected', 'fd-users-status--active', 'fd-users-copy']
  },
  {
    label: 'Contatti',
    sectionId: 'leads',
    js: 'fd-contacts.js',
    css: 'fd-contacts.css',
    patterns: ['fd-page-header', 'fd-contacts-table-wrap', 'fd-table']
  }
];

const VIEWPORT_BREAKPOINTS = [
  { className: 'fd-bp-desktop', minWidth: '1280px' },
  { className: 'fd-bp-tablet-landscape', minWidth: '1024px' },
  { className: 'fd-bp-tablet-portrait', minWidth: '768px' },
  { className: 'fd-bp-mobile', gateMax: '767px' }
];

test('build-fd-bundles lists FASE 5–6 modules', () => {
  const build = read('scripts/build-fd-bundles.js');
  assert.match(build, /fd-page-states\.css/);
  assert.match(build, /fd-page-states\.js/);
  assert.match(build, /fd-mobile-gate\.css/);
  assert.match(build, /fd-mobile-gate\.js/);
});

test('fd.bundle.js is valid JavaScript after build', () => {
  const bundlePath = path.join(ROOT, 'src', 'filodiretto', 'fd.bundle.js');
  assert.doesNotThrow(() => {
    execFileSync(process.execPath, ['--check', bundlePath], { stdio: 'pipe' });
  });
  const bundle = read('src/filodiretto/fd.bundle.js');
  assert.ok(
    bundle.includes('/^https?:\\/\\//i.test(value)'),
    'bundle must preserve URL regex literal (minifier must not strip // inside regex)'
  );
});

test('index.html bundle cache references filodiretto-rebrand tag', () => {
  const html = read('src/dashboard/index.html');
  assert.match(html, /fd\.bundle\.css\?v=20260622-filodiretto-rebrand/);
  assert.match(html, /fd\.bundle\.js\?v=20260622-filodiretto-rebrand/);
  assert.match(html, /\/dashboard\/lib\/public-url\.js/);
  assert.match(html, /function a2wPublicUrlBase/);
  assert.match(html, /#a2wMediaTabs\{display:none!important\}/);
  assert.match(html, /fd-page-states\.js/);
  assert.match(html, /fd-mobile-gate\.js/);
});

test('FASE 5 page state helpers and tokens exist', () => {
  const js = readFd('fd-page-states.js');
  const css = readFd('fd-page-states.css');
  assert.match(js, /fdRenderLoadingRegion/);
  assert.match(js, /fdRenderErrorState/);
  assert.match(js, /aria-busy="true"/);
  assert.match(js, /aria-live="polite"/);
  assert.match(css, /\.fd-error-state/);
  assert.match(css, /--fd-color-danger/);
  assert.match(css, /\.fd-loading-region/);
});

test('Filo media library hides legacy a2w tabs without fd-layout class', () => {
  const css = readFd('fd-media-library.css');
  assert.match(css, /html\[data-app='filodiretto'\] #media-library #a2wMediaTabs/);
  assert.doesNotMatch(css, /media-library--fd-layout #a2wMediaTabs/);
});

test('FASE 6 smartphone gate blocks under 768px only', () => {
  const js = readFd('fd-mobile-gate.js');
  const css = readFd('fd-mobile-gate.css');
  assert.match(js, /max-width: 767px/);
  assert.match(js, /fd-mobile-gated/);
  assert.match(css, /min-width: 768px/);
  assert.match(css, /\.fd-mobile-gate/);
});

test('layout breakpoints sync fd-bp-* classes', () => {
  const layoutJs = readFd('fd-layout.js');
  const layoutCss = read('src/filodiretto/fd-layout.css');
  VIEWPORT_BREAKPOINTS.forEach(function (bp) {
    assert.match(layoutJs, new RegExp(bp.className));
    assert.match(layoutCss, new RegExp(bp.className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
  assert.match(layoutJs, /min-width: 768px/);
});

test('responsive tables keep card mode threshold at 768px', () => {
  const js = readFd('fd-responsive-tables.js');
  const css = readFd('fd-responsive-tables.css');
  assert.match(js, /768/);
  assert.match(css, /768/);
  assert.match(css, /fd-table-wrap/);
});

for (const section of SECTION_MATRIX) {
  test(`DS patterns present for ${section.label}`, () => {
    const js = readFd(section.js);
    const css = readFd(section.css);
    section.patterns.forEach(function (pattern) {
      const re = new RegExp(pattern);
      assert.ok(re.test(js) || re.test(css), `${section.label}: missing /${pattern}/ in ${section.js} or ${section.css}`);
    });
    assert.match(read('src/dashboard/index.html'), new RegExp('id="' + section.sectionId + '"'));
  });
}

test('Filo brand identity uses bottom save bar and public landing URL', () => {
  const dirty = readFd('fd-form-dirty.js');
  const bi = readFd('fd-brand-identity.js');
  const biCss = readFd('fd-brand-identity.css');
  const html = read('src/dashboard/index.html');
  assert.match(dirty, /brand-identity--fd-bottom-save/);
  assert.match(dirty, /fd-bi-bottom-bar/);
  assert.match(dirty, /showSavedFlash/);
  assert.match(bi, /fd-bi-landing-preview/);
  assert.match(bi, /URL pubblica della landing/);
  assert.match(biCss, /\.fd-bi-landing-preview/);
  assert.match(html, /window\.location\?\.origin/);
});

test('Filo brand identity aside reads camelCase form snapshot', () => {
  const js = readFd('fd-brand-identity.js');
  assert.match(js, /fieldVal\(data, 'supportEmail'/);
  assert.match(js, /fieldVal\(data, 'supportPhone'/);
  assert.match(js, /fieldVal\(data, 'dpoEmail'/);
});

test('Filo media library uses single contextual search', () => {
  const js = readFd('fd-media-library.js');
  assert.match(js, /fdMediaContextSearch/);
  assert.match(js, /applyContextSearchFilter/);
  assert.match(js, /fd-media-dropzone__specs/);
  assert.match(js, /removeLegacyMediaSearches/);
});

test('Filo template delete moved to kebab menu', () => {
  const js = readFd('fd-templates.js');
  assert.match(js, /fd-tpl-card-menu/);
  assert.doesNotMatch(js, /fd-btn--danger fd-btn--sm" onclick="deleteTemplate/);
});

test('Filo passes localize status badges and copy icon', () => {
  const js = readFd('fd-passes.js');
  const css = readFd('fd-passes.css');
  assert.match(js, /passStatusMeta/);
  assert.match(js, /enhancePassIdCells/);
  assert.match(css, /fd-pass-status--active/);
  assert.match(css, /fd-stat-card--primary/);
});

test('contacts help popover uses floating panel positioning', () => {
  const help = read('src/dashboard/js/components/contacts/help-popover.js');
  assert.match(help, /positionFloatingPanel/);
  assert.match(help, /maxWidth/);
});

test('Filo media library hides legacy Ads2Wallet tabs markup', () => {
  const js = readFd('fd-media-library.js');
  const css = readFd('fd-media-library.css');
  assert.match(js, /hideLegacyA2wMediaTabs/);
  assert.match(js, /reconcileLegacyMediaTabs/);
  assert.match(js, /fdEnsureMediaLibraryLayout/);
  assert.match(js, /setAttribute\('data-component', 'media-tabs'\)/);
  assert.match(js, /media-hidden/);
  assert.match(js, /fdMediaLogoCard/);
  assert.match(js, /#a2wMediaTabs/);
  assert.match(css, /#a2wMediaTabs/);
});

test('fd-empty-states and fd-form-a11y integrate with page states', () => {
  const empty = readFd('fd-empty-states.js');
  const a11y = readFd('fd-form-a11y.js');
  assert.match(empty, /ensureEmptyStateA11y/);
  assert.match(empty, /role="status"/);
  assert.match(a11y, /fdEnhanceLoadingRegions/);
  assert.match(a11y, /fdGlobalAriaLive/);
});
