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
  assert.equal(g.navHighlightSection('leads', 'audience'), 'leads');
  assert.equal(g.navHighlightSection('analytics', 'activity-log'), 'activity-log');
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
  assert.equal(g.sectionPath('leads', 'audience'), '/dashboard/contatti/audience');
  assert.equal(g.sectionPath('analytics', 'metrics'), '/dashboard/analytics');
  assert.equal(g.sectionPath('analytics', 'activity-log'), '/dashboard/analytics/log');
});

test('index.html sidebar has merged nav items and section tabs', () => {
  const html = read('src/dashboard/index.html');
  assert.match(html, /nav-group-label">Engagement<\/summary>/);
  assert.doesNotMatch(html, /data-nav-group="database"/);
  assert.doesNotMatch(html, /nav-item[^>]+data-section-id="audiences"/);
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
  assert.match(server, /\/dashboard\/analytics\/log/);
});

test('NAV catalog lists Contatti under Engagement and Analytics + Log under Insights', () => {
  const g = { document: { querySelectorAll: () => [] } };
  vm.runInNewContext(read('src/dashboard/lib/nav.js'), { ...g, window: g, global: g });
  const nav = g.FD_NAV.NAV;
  const engagement = nav.find((s) => s.id === 'comunicazione');
  assert.equal(engagement.label, 'Engagement');
  const engagementItems = engagement.items.map((i) => i.id);
  assert.ok(engagementItems.includes('leads'));
  assert.equal(nav.find((s) => s.id === 'database'), undefined);
  const insightsItems = nav.find((s) => s.id === 'insights').items.map((i) => i.id);
  assert.equal(insightsItems.length, 2);
  assert.ok(insightsItems.includes('analytics'));
  assert.ok(insightsItems.includes('activity-log'));
});
