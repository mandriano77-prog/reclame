'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function loadSubnav(base) {
  const g = Object.assign(base, {
    window: base,
    global: base,
    document: base.document,
    addEventListener() {}
  });
  vm.runInNewContext(read('src/dashboard/js/dashboard-subnav.js'), g, {
    filename: 'dashboard-subnav.js'
  });
  return g;
}

test('resolveNavTarget maps legacy section ids to parent + tab', () => {
  const g = loadSubnav({ location: { pathname: '/dashboard', search: '', hash: '' }, history: { replaceState() {} } });
  const aud = g.resolveNavTarget('audiences');
  assert.equal(aud.section, 'leads');
  assert.equal(aud.tab, 'audience');
  assert.equal(aud.raw, 'audiences');
  const log = g.resolveNavTarget('activity-log');
  assert.equal(log.section, 'analytics');
  assert.equal(log.tab, 'activity-log');
  assert.equal(g.navHighlightSection('leads', 'audience'), 'audiences');
  assert.equal(g.navHighlightSection('analytics', 'activity-log'), 'analytics');
  assert.equal(g.navHighlightSection('analytics', 'metrics'), 'analytics');
});

test('parseLocationRoute resolves contatti and analytics paths', () => {
  const g = loadSubnav({ location: { pathname: '/dashboard', search: '', hash: '' }, history: { replaceState() {} } });
  g.location.pathname = '/dashboard/contatti/audience';
  const r1 = g.parseLocationRoute();
  assert.equal(r1.section, 'leads');
  assert.equal(r1.tab, 'audience');
  g.location.pathname = '/dashboard/contatti';
  const r2 = g.parseLocationRoute();
  assert.equal(r2.section, 'leads');
  assert.equal(r2.tab, 'contacts');
  g.location.pathname = '/dashboard/analytics/log';
  const r3 = g.parseLocationRoute();
  assert.equal(r3.section, 'analytics');
  assert.equal(r3.tab, 'activity-log');
  g.location.pathname = '/dashboard/analytics';
  const r4 = g.parseLocationRoute();
  assert.equal(r4.section, 'analytics');
  assert.equal(r4.tab, 'metrics');
});

test('sectionPath builds canonical dashboard URLs', () => {
  const g = loadSubnav({ location: { pathname: '/dashboard', search: '', hash: '' }, history: { replaceState() {} } });
  assert.equal(g.sectionPath('leads', 'contacts'), '/dashboard/contatti');
  assert.equal(g.sectionPath('leads', 'audience'), '/dashboard/audience');
  assert.equal(g.sectionPath('analytics', 'metrics'), '/dashboard/analytics');
  assert.equal(g.sectionPath('analytics', 'activity-log'), '/dashboard/analytics/log');
});

test('switchAnalyticsSectionTab uses analyticsTabPanel_activity DOM ids', () => {
  const panels = {
    metrics: { hidden: false, ariaHidden: 'false' },
    activity: { hidden: true, ariaHidden: 'true' }
  };
  const buttons = {
    metrics: { classList: { active: true }, ariaSelected: 'true', tabIndex: 0 },
    activity: { classList: { active: false }, ariaSelected: 'false', tabIndex: -1 }
  };
  const doc = {
    getElementById(id) {
      if (id === 'analyticsTabPanel_metrics') return panels.metrics;
      if (id === 'analyticsTabPanel_activity') return panels.activity;
      if (id === 'analyticsTab_metrics') return buttons.metrics;
      if (id === 'analyticsTab_activity') return buttons.activity;
      return null;
    }
  };
  panels.metrics.setAttribute = (k, v) => { if (k === 'aria-hidden') panels.metrics.ariaHidden = v; };
  panels.activity.setAttribute = (k, v) => { if (k === 'aria-hidden') panels.activity.ariaHidden = v; };
  buttons.metrics.setAttribute = (k, v) => { if (k === 'aria-selected') buttons.metrics.ariaSelected = v; };
  buttons.activity.setAttribute = (k, v) => { if (k === 'aria-selected') buttons.activity.ariaSelected = v; };
  buttons.metrics.classList.toggle = (c, on) => { if (c === 'active') buttons.metrics.classList.active = on; };
  buttons.activity.classList.toggle = (c, on) => { if (c === 'active') buttons.activity.classList.active = on; };

  const g = loadSubnav({
    location: { pathname: '/dashboard/analytics/log', search: '', hash: '' },
    history: { replaceState() {} },
    document: doc,
    getActiveSectionId: () => 'analytics'
  });

  g.switchAnalyticsSectionTab('activity-log', { skipUrl: true, skipLoad: true, skipBreadcrumb: true });

  assert.equal(panels.metrics.hidden, true);
  assert.equal(panels.activity.hidden, false);
  assert.equal(buttons.activity.classList.active, true);
  assert.equal(buttons.metrics.classList.active, false);
});

test('index.html analytics tab panel ids use activity slug not activity-log', () => {
  const html = read('src/dashboard/index.html');
  assert.match(html, /id="analyticsTabPanel_activity"/);
  assert.match(html, /id="analyticsTab_activity"/);
  assert.doesNotMatch(html, /id="analyticsTabPanel_activity-log"/);
});

test('index.html sidebar has merged nav items and section tabs', () => {
  const html = read('src/dashboard/index.html');
  assert.match(html, /data-menu-key="nav_group_engagement"/);
  assert.match(html, /data-nav-group="retail-media"/);
  assert.doesNotMatch(html, /data-nav-group="database"/);
  assert.match(html, /nav-item[^>]+data-section-id="audiences"/);
  assert.match(html, /nav-item[^>]+data-section-id="activity-log"/);
  assert.match(html, /id="leadsSectionTabs"/);
  assert.match(html, /id="analyticsSectionTabs"/);
  assert.match(html, /switchLeadsSectionTab\('audience'\)/);
  assert.match(html, /switchAnalyticsSectionTab\('activity-log'\)/);
  assert.match(html, /dashboard-subnav\.js/);
});

test('server exposes SPA routes for contatti and analytics subpaths', () => {
  const server = read('src/server.js');
  assert.match(server, /\/dashboard\/contatti\/audience/);
  assert.match(server, /\/dashboard\/audience/);
  assert.match(server, /\/dashboard\/analytics\/log/);
});

test('NAV catalog lists Contatti under Brand & Pass and Engagement rewards stack', () => {
  const g = { document: { querySelectorAll: () => [] } };
  vm.runInNewContext(read('src/dashboard/lib/nav.js'), { ...g, window: g, global: g });
  const nav = g.FD_NAV.NAV;
  const engagement = nav.find((s) => s.id === 'comunicazione');
  assert.equal(engagement.label, 'Engagement');
  const engagementItems = engagement.items.map((i) => i.id);
  assert.equal(engagementItems.length, 3);
  assert.ok(engagementItems.includes('push'));
  assert.ok(engagementItems.includes('instant-win'));
  assert.ok(engagementItems.includes('gamification'));
  const brandPassItems = nav.find((s) => s.id === 'brand-pass').items.map((i) => i.id);
  assert.ok(brandPassItems.includes('leads'));
  assert.equal(nav.find((s) => s.id === 'database'), undefined);
  const insightsItems = nav.find((s) => s.id === 'insights').items.map((i) => i.id);
  assert.equal(insightsItems.length, 2);
  assert.ok(insightsItems.includes('analytics'));
  assert.ok(insightsItems.includes('activity-log'));
});
