'use strict';

/** @typedef {'total'|'has_email'|'has_phone'|'with_device'|null} A2wLeadsKpiFilter */

const VALID_FILTERS = new Set(['total', 'has_email', 'has_phone', 'with_device']);

/**
 * Parse ?filter= from location.search (A2W Contatti quick filters).
 * @param {string} search
 * @returns {A2wLeadsKpiFilter}
 */
function parseLeadsFilterParam(search) {
  if (!search || typeof search !== 'string') return null;
  const raw = new URLSearchParams(search.startsWith('?') ? search : `?${search}`).get('filter');
  if (!raw || !VALID_FILTERS.has(raw)) return null;
  return raw === 'total' ? 'total' : /** @type {A2wLeadsKpiFilter} */ (raw);
}

/**
 * Toggle filter popover open state (for tests + UI).
 * @param {boolean} isOpen
 * @returns {{ panelHidden: boolean, ariaExpanded: string }}
 */
function nextFilterPopoverState(isOpen) {
  return {
    panelHidden: !isOpen,
    ariaExpanded: isOpen ? 'true' : 'false'
  };
}

/**
 * KPI card click: toggle off when same filter selected.
 * @param {string|null} current
 * @param {string} next
 * @returns {A2wLeadsKpiFilter}
 */
function toggleKpiFilter(current, next) {
  if (!VALID_FILTERS.has(next)) return current === 'total' ? null : /** @type {A2wLeadsKpiFilter} */ (current);
  if (current === next) return null;
  return /** @type {A2wLeadsKpiFilter} */ (next);
}

/**
 * Map KPI key to checkbox filter flags (cumulative with search).
 * @param {A2wLeadsKpiFilter} kpiFilter
 */
function kpiFilterToCheckboxState(kpiFilter) {
  return {
    hasEmail: kpiFilter === 'has_email',
    hasPhone: kpiFilter === 'has_phone',
    withDevice: kpiFilter === 'with_device'
  };
}

/**
 * @param {number} delta
 */
function shouldShowKpiDelta(delta) {
  return Number(delta) > 0;
}

/**
 * @param {number} delta
 */
function kpiDeltaClassName(delta) {
  const n = Number(delta);
  if (n > 0) return 'is-positive';
  if (n < 0) return 'is-negative';
  return '';
}

module.exports = {
  parseLeadsFilterParam,
  nextFilterPopoverState,
  toggleKpiFilter,
  kpiFilterToCheckboxState,
  shouldShowKpiDelta,
  kpiDeltaClassName,
  VALID_FILTERS
};
