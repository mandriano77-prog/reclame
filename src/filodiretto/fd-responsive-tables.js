/**
 * FD — Mobile table cards: label cells from headers for stacked layout on small screens.
 */
(function () {
  'use strict';

  var TABLE_SELECTOR = '.content .section .table:not(.import-preview-table)';
  var enhanceTimer = null;

  function isFiloTablesApp() {
    if (document.documentElement.classList.contains('a2w-shell')) return false;
    try {
      if (window.__2WALLET_PRODUCT_LOCK__ === 'hr') return true;
    } catch (_) {}
    return document.documentElement.getAttribute('data-app') === 'filodiretto';
  }

  function headerLabel(th, index, total) {
    var text = String(th && th.textContent ? th.textContent : '').replace(/\s+/g, ' ').trim();
    if (!text && index === total - 1) return 'Azioni';
    return text || ('Campo ' + (index + 1));
  }

  function applyRowLabels(table) {
    var headers = Array.prototype.slice.call(table.querySelectorAll('thead th'));
    if (!headers.length) return;
    var labels = headers.map(function (th, i) {
      return headerLabel(th, i, headers.length);
    });
    var actionsIndex = labels.length - 1;

    table.querySelectorAll('tbody tr').forEach(function (tr) {
      if (tr.classList.contains('table-skeleton-row')
        || tr.classList.contains('table-empty-row')
        || tr.classList.contains('table-error-row')) {
        tr.querySelectorAll('td').forEach(function (td) {
          td.classList.add('fd-table-card-full');
          td.removeAttribute('data-label');
        });
        return;
      }

      var cells = Array.prototype.slice.call(tr.querySelectorAll(':scope > td'));
      cells.forEach(function (td, i) {
        td.classList.remove('fd-table-card-full', 'fd-table-card-actions');
        if (td.colSpan > 1) {
          td.classList.add('fd-table-card-full');
          td.removeAttribute('data-label');
          return;
        }
        var label = labels[i] || '';
        td.setAttribute('data-label', label);
        if (i === actionsIndex || label === 'Azioni') {
          td.classList.add('fd-table-card-actions');
        }
      });
    });
  }

  function enhanceTable(table) {
    if (!table || table.closest('.modal')) return;
    table.classList.add('fd-table-cards');
    table.dataset.fdTableCards = '1';
    applyRowLabels(table);
  }

  function enhanceAllTables() {
    if (!isFiloTablesApp()) return;
    document.querySelectorAll(TABLE_SELECTOR).forEach(enhanceTable);
    document.querySelectorAll('#audiencesList .table').forEach(enhanceTable);
  }

  function scheduleEnhance() {
    if (enhanceTimer) clearTimeout(enhanceTimer);
    enhanceTimer = setTimeout(function () {
      enhanceTimer = null;
      enhanceAllTables();
    }, 40);
  }

  function bindObserver() {
    var root = document.querySelector('.content');
    if (!root || root.dataset.fdTableObserver === '1') return;
    root.dataset.fdTableObserver = '1';
    var observer = new MutationObserver(scheduleEnhance);
    observer.observe(root, { childList: true, subtree: true });
  }

  function patchNav() {
    if (!isFiloTablesApp() || window.__fdTableNavPatched) return;
    if (typeof window.nav !== 'function') return;
    window.__fdTableNavPatched = true;
    var orig = window.nav;
    window.nav = function (id) {
      var out = orig.apply(this, arguments);
      scheduleEnhance();
      return out;
    };
  }

  function initFdResponsiveTables() {
    if (!isFiloTablesApp()) return;
    enhanceAllTables();
    bindObserver();
    patchNav();
    window.addEventListener('resize', scheduleEnhance);
  }

  window.fdEnhanceResponsiveTables = enhanceAllTables;
  window.fdHeaderLabelForTable = headerLabel;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFdResponsiveTables);
  } else {
    initFdResponsiveTables();
  }
})();
