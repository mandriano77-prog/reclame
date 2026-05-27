'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  parseLeadsFilterParam,
  nextFilterPopoverState,
  toggleKpiFilter,
  kpiFilterToCheckboxState,
  shouldShowKpiDelta,
  kpiDeltaClassName,
  shouldHideKpiStripWhenEmpty
} = require('../src/dashboard/js/components/contacts/a2w-contacts-ux.cjs');

test('parseLeadsFilterParam reads valid ?filter= values', () => {
  assert.equal(parseLeadsFilterParam('?filter=has_email'), 'has_email');
  assert.equal(parseLeadsFilterParam('?filter=with_device'), 'with_device');
  assert.equal(parseLeadsFilterParam('?filter=total'), 'total');
  assert.equal(parseLeadsFilterParam('?filter=unknown'), null);
  assert.equal(parseLeadsFilterParam(''), null);
});

test('nextFilterPopoverState maps open flag to aria-expanded', () => {
  assert.deepEqual(nextFilterPopoverState(true), {
    panelHidden: false,
    ariaExpanded: 'true'
  });
  assert.deepEqual(nextFilterPopoverState(false), {
    panelHidden: true,
    ariaExpanded: 'false'
  });
});

test('toggleKpiFilter toggles off when same key selected', () => {
  assert.equal(toggleKpiFilter('has_email', 'has_email'), null);
  assert.equal(toggleKpiFilter(null, 'has_phone'), 'has_phone');
  assert.equal(toggleKpiFilter('has_phone', 'has_email'), 'has_email');
});

test('kpiFilterToCheckboxState maps quick filters to cumulative flags', () => {
  assert.deepEqual(kpiFilterToCheckboxState('has_email'), {
    hasEmail: true,
    hasPhone: false,
    withDevice: false
  });
  assert.deepEqual(kpiFilterToCheckboxState('with_device'), {
    hasEmail: false,
    hasPhone: false,
    withDevice: true
  });
});

test('KPI delta visibility and tone classes', () => {
  assert.equal(shouldShowKpiDelta(0), false);
  assert.equal(shouldShowKpiDelta(3), true);
  assert.equal(kpiDeltaClassName(2), 'is-positive');
  assert.equal(kpiDeltaClassName(0), '');
});

test('shouldHideKpiStripWhenEmpty hides zero-state KPI strip', () => {
  assert.equal(shouldHideKpiStripWhenEmpty(0), true);
  assert.equal(shouldHideKpiStripWhenEmpty(1), false);
});
