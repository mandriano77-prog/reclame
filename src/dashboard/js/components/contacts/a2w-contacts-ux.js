/**
 * Ads2Wallet Contatti — pure UX helpers (browser).
 */
(function (global) {
  'use strict';

  var VALID_FILTERS = { total: 1, has_email: 1, has_phone: 1, with_device: 1 };

  function parseLeadsFilterParam(search) {
    if (!search || typeof search !== 'string') return null;
    var q = search.charAt(0) === '?' ? search : '?' + search;
    var raw = new URLSearchParams(q).get('filter');
    if (!raw || !VALID_FILTERS[raw]) return null;
    return raw;
  }

  function nextFilterPopoverState(isOpen) {
    return {
      panelHidden: !isOpen,
      ariaExpanded: isOpen ? 'true' : 'false'
    };
  }

  function toggleKpiFilter(current, next) {
    if (!VALID_FILTERS[next]) return current;
    if (current === next) return null;
    return next;
  }

  function kpiFilterToCheckboxState(kpiFilter) {
    return {
      hasEmail: kpiFilter === 'has_email',
      hasPhone: kpiFilter === 'has_phone',
      withDevice: kpiFilter === 'with_device'
    };
  }

  function shouldShowKpiDelta(delta) {
    return Number(delta) > 0;
  }

  function kpiDeltaClassName(delta) {
    var n = Number(delta);
    if (n > 0) return 'is-positive';
    if (n < 0) return 'is-negative';
    return '';
  }

  global.A2wContactsUx = {
    parseLeadsFilterParam: parseLeadsFilterParam,
    nextFilterPopoverState: nextFilterPopoverState,
    toggleKpiFilter: toggleKpiFilter,
    kpiFilterToCheckboxState: kpiFilterToCheckboxState,
    shouldShowKpiDelta: shouldShowKpiDelta,
    kpiDeltaClassName: kpiDeltaClassName
  };
})(typeof window !== 'undefined' ? window : global);
