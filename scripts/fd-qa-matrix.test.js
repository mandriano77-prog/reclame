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
    patterns: ['fd-skeleton', 'fd-tpl-list', 'fd-btn--primary|fd-tpl-card-delete']
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
  assert.match(build, /function protectCalc/);
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

test('fd.bundle.css preserves calc() operator spacing (W.AI inset)', () => {
  const bundle = read('src/filodiretto/fd.bundle.css');
  assert.match(
    bundle,
    /#waiOverlay\.wai-panel\{[^}]*calc\(var\(--space-5,\s*20px\)\s*\+\s*52px\)/
  );
  const broken = [...bundle.matchAll(/calc\([^)]*\+[^)]*\)/g)].filter((m) => !/ \+ /.test(m[0]));
  assert.equal(broken.length, 0, 'minifier must not strip spaces around + inside calc()');
});

test('index.html bundle cache references wide-layout tag', () => {
  const html = read('src/dashboard/index.html');
  assert.match(html, /fd\.bundle\.css\?v=20260623-push-linked-content/);
  assert.match(html, /fd\.bundle\.js\?v=20260623-push-linked-content/);
  assert.match(html, /\/dashboard\/lib\/public-url\.js/);
  assert.match(html, /function a2wPublicUrlBase/);
  assert.match(html, /#a2wMediaTabs\{display:none!important\}/);
  assert.match(html, /fd-page-states\.js/);
  assert.match(html, /fd-mobile-gate\.js/);
  assert.match(html, /fd-wide-layout\.css/);
});

test('wide-screen layout centers content and scales typography', () => {
  const wide = readFd('fd-wide-layout.css');
  const tokens = readFd('tokens.css');
  const build = read('scripts/build-fd-bundles.js');
  assert.match(wide, /html\[data-app='filodiretto'\] \.main > \.content/);
  assert.match(wide, /margin-inline:\s*auto/);
  assert.match(wide, /minmax\(220px/);
  assert.match(tokens, /clamp\(14px,\s*0\.875rem \+ 0\.2vw,\s*16px\)/);
  assert.match(tokens, /clamp\(24px,\s*4vw,\s*64px\)/);
  assert.match(build, /fd-wide-layout\.css/);
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

test('Filo brand identity uses per-section save and public landing URL', () => {
  const dirty = readFd('fd-form-dirty.js');
  const bi = readFd('fd-brand-identity.js');
  const biCss = readFd('fd-brand-identity.css');
  const dirtyCss = readFd('fd-form-dirty.css');
  const html = read('src/dashboard/index.html');
  assert.match(dirty, /fd-bi-section-save/);
  assert.match(dirty, /saveBrandIdentitySection/);
  assert.match(dirty, /fdBiSectionSaveBtn-/);
  assert.match(dirty, /BI_SECTION_DEFS/);
  assert.match(dirty, /removeBottomSaveBar/);
  assert.doesNotMatch(dirty, /fd-bi-sticky-bar fd-bi-bottom-bar/);
  assert.doesNotMatch(dirty, /ensureBrandIdentityStickyBar/);
  assert.doesNotMatch(dirtyCss, /position:\s*fixed/);
  assert.match(bi, /summarySlugLink/);
  assert.match(bi, /fd-bi-slug-copy/);
  assert.match(bi, /a2w-bi-identity-summary__slug-link/);
  assert.doesNotMatch(bi, /fd-bi-checklist/);
  assert.doesNotMatch(bi, /Checklist setup/);
  assert.doesNotMatch(bi, /fdRefreshBrandChecklist/);
  assert.match(biCss, /\.a2w-bi-identity-summary__slug-link/);
  assert.match(biCss, /\.fd-bi-aside-grid/);
  assert.match(biCss, /grid-template-rows: subgrid/);
  assert.match(dirtyCss, /\.fd-bi-section-save/);
  assert.match(html, /getPublicLandingUrl/);
});

test('Filo brand identity section accordions on HR shell', () => {
  const bi = readFd('fd-brand-identity.js');
  assert.match(bi, /fdBiBaseDetails/);
  assert.match(bi, /fdBiContactsDetails/);
  assert.match(bi, /fdBiSocialDetails/);
  assert.match(bi, /enhanceBiAccordionSections/);
  assert.match(bi, /details\.addEventListener\('toggle'/);
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

test('Filo template delete uses direct button with confirm flow', () => {
  const js = readFd('fd-templates.js');
  assert.match(js, /fd-tpl-card-delete/);
  assert.match(js, /fdDeleteTemplateWithConfirm/);
  assert.doesNotMatch(js, /fd-tpl-card-menu__trigger/);
});

test('Filo passes localize status badges and copy icon', () => {
  const js = readFd('fd-passes.js');
  const css = readFd('fd-passes.css');
  assert.match(js, /passStatusMeta/);
  assert.match(js, /enhancePassIdCells/);
  assert.match(css, /fd-pass-status--active/);
  assert.match(css, /fd-passes-stat-grid/);
  assert.match(css, /repeat\(auto-fit, minmax\(220px, 1fr\)\)/);
  assert.doesNotMatch(js, /fd-passes-stat-secondary/);
});

test('Filo passes row menu includes regenerate action', () => {
  const js = readFd('fd-passes.js');
  const css = readFd('fd-passes.css');
  assert.match(js, /data-action="regenerate"/);
  assert.match(js, /Rigenera pass/);
  assert.match(js, /fd-pass-row-menu__sep/);
  assert.match(js, /regenerateSelectedPasses/);
  assert.match(css, /fd-pass-row-menu__sep/);
});

test('contacts help popover uses floating panel positioning', () => {
  const help = read('src/dashboard/js/components/contacts/help-popover.js');
  assert.match(help, /positionFloatingPanel/);
  assert.match(help, /maxWidth/);
});

test('Filo contacts overflow menu has export and tour only', () => {
  const js = readFd('fd-contacts.js');
  const css = readFd('fd-contacts.css');
  assert.match(js, /stripLeadsHeaderDuplicates/);
  assert.match(js, /fdContactsOverflowExportBtn/);
  assert.match(js, /fdContactsOverflowTourBtn/);
  assert.match(js, /panel\.innerHTML = ''/);
  assert.doesNotMatch(js, /data-fd-toolbar-dynamic/);
  assert.match(css, /#contactsPageMenu/);
  assert.match(css, /fd-contacts-toolbar-overflow--always/);
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

test('Filo analytics H1 sync resolves page-header title and activity-log tab', () => {
  const js = readFd('fd-analytics.js');
  assert.match(js, /findAnalyticsTitleEl/);
  assert.match(js, /page-header__title/);
  assert.match(js, /resolveAnalyticsChromeTab/);
  assert.match(js, /Log Attività/);
});

test('Filo engagement KPIs use visible skeleton and clear loading class', () => {
  const js = readFd('fd-pga-engagement.js');
  const css = readFd('fd-pga.css');
  assert.match(js, /fd-pga-kpi__value-skeleton/);
  assert.match(js, /classList\.remove\('fd-pga-kpi-grid--loading'\)/);
  assert.doesNotMatch(css, /fd-pga-kpi-grid--loading[\s\S]*color:\s*transparent/);
  assert.match(css, /fd-pga-kpi__value-skeleton/);
});

test('Filo checkbox and radio use native 16px sizing not full-width inputs', () => {
  const html = read('src/dashboard/index.html');
  const components = readFd('fd-components.css');
  assert.match(html, /input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\)/);
  assert.match(html, /input\[type="checkbox"\]:not\(\.fd-switch__input\)/);
  assert.match(html, /accent-color:\s*#7c3aed/);
  assert.match(components, /input\[type='checkbox'\]:not\(\.fd-switch__input\)/);
  assert.match(components, /label:has\(> input\[type='checkbox'\]/);
});

test('Push channel multi-select maps pairs to comma-separated API values', () => {
  const js = readFd('fd-push.js');
  assert.match(js, /return active\.join\(',',?\)/);
  assert.doesNotMatch(js, /value: 'all', label: 'Tutti i canali'/);
  const routes = read('src/api/routes.js');
  assert.match(routes, /normalizePushChannelList/);
  assert.match(routes, /apple,google/);
});

test('Challenge hides table head when gamEmptyHost is visible', () => {
  const js = readFd('fd-reward-challenge.js');
  const css = readFd('fd-reward-challenge.css');
  assert.match(js, /gamEmptyHost/);
  assert.match(js, /enhanceChallengeStatusBadges/);
  assert.match(css, /#gamEmptyHost:not\(\[hidden\]\)/);
});

test('PGA onboarding banner uses delegated click handler', () => {
  const js = readFd('fd-pga.js');
  assert.match(js, /handleOnboardingBannerClick/);
  assert.match(js, /data-pga-nav-enable/);
  assert.match(js, /data-pga-nav-experiences/);
});

test('Google Wallet HR pass resolves hub links like passkit', () => {
  const gw = read('src/engine/google-wallet.js');
  const ep = read('src/engine/employee-pass.js');
  assert.match(gw, /async function buildPassObject/);
  assert.match(gw, /resolveHrPassOptions/);
  assert.match(gw, /hubUrl: hrOpts\.hubUrl/);
  assert.match(ep, /linkText \|\| s\.label/);
  assert.match(ep, /announcement_full/);
});

test('W.AI FAB uses single JS click handler without inline onclick', () => {
  const html = read('src/dashboard/index.html');
  const wai = readFd('fd-wai.js');
  assert.doesNotMatch(html, /id="waiBtn"[^>]*onclick=/);
  assert.match(wai, /function bindWaiTrigger/);
  assert.match(wai, /removeAttribute\('onclick'\)/);
  assert.match(wai, /bindWaiControls/);
  assert.doesNotMatch(html, /fd-wai-inline-link[^>]*onclick="openWaiForAudience/);
  assert.match(html, /data-fd-wai-open[^>]*data-fd-wai-mode="audience"/);
});

test('W.AI API calls include auth headers', () => {
  const html = read('src/dashboard/index.html');
  assert.match(html, /function waiFetchHeaders/);
  const waiBlocks = html.match(/fetch\(`\$\{API\}\/wai\/[^`]+`[\s\S]*?\}\);/g) || [];
  assert.ok(waiBlocks.length >= 5, 'expected at least 5 W.AI fetch calls');
  waiBlocks.forEach((block) => {
    assert.match(block, /waiFetchHeaders\(\)/, 'W.AI fetch must use waiFetchHeaders()');
  });
});
