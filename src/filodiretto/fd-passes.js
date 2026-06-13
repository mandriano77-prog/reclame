/**
 * FD — Pass Emessi: reorder diagnostica, colonne avanzate, azioni riga.
 */
(function () {
  'use strict';

  function isFiloPassesApp() {
    if (document.documentElement.classList.contains('a2w-shell')) return false;
    try {
      if (window.__2WALLET_PRODUCT_LOCK__ === 'hr') return true;
    } catch (_) {}
    return document.documentElement.getAttribute('data-app') === 'filodiretto';
  }

  function ensurePassesLayout() {
    var section = document.getElementById('passes');
    var diag = document.getElementById('passWalletChannelsDiag');
    var content = document.getElementById('passesContent');
    if (!section || !diag || !content || section.dataset.fdPassesLayout === '1') return;
    section.dataset.fdPassesLayout = '1';
    section.classList.add('passes--fd-layout');
    section.appendChild(diag);
  }

  function ensureAdvancedColumnsToggle() {
    var content = document.getElementById('passesContent');
    if (!content || document.getElementById('fdPassesColsToggle')) return;
    var searchRow = content.querySelector('#passSearchInput')?.closest('div');
    if (!searchRow) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'fdPassesColsToggle';
    btn.className = 'btn small sec fd-passes-cols-toggle';
    btn.textContent = 'Colonne avanzate';
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', function () {
      var section = document.getElementById('passes');
      if (!section) return;
      var on = !section.classList.contains('passes--advanced-cols');
      section.classList.toggle('passes--advanced-cols', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.textContent = on ? 'Nascondi colonne avanzate' : 'Colonne avanzate';
    });
    searchRow.insertBefore(btn, searchRow.lastElementChild);
  }

  function markAdvancedColumns() {
    var table = document.querySelector('#passesContent .pass-table');
    if (!table) return;
    var advancedIdx = [4, 5, 6];
    var headCells = table.querySelectorAll('thead th');
    advancedIdx.forEach(function (i) {
      if (headCells[i]) headCells[i].classList.add('pass-col-advanced');
    });
    table.querySelectorAll('tbody tr').forEach(function (row) {
      var cells = row.querySelectorAll('td');
      advancedIdx.forEach(function (i) {
        if (cells[i]) cells[i].classList.add('pass-col-advanced');
      });
    });
  }

  function enhancePassRowActions() {
    document.querySelectorAll('#passesContent .pass-row-actions').forEach(function (wrap) {
      if (wrap.dataset.fdActionsEnhanced === '1') return;
      wrap.dataset.fdActionsEnhanced = '1';
      var viewBtn = wrap.querySelector('.pass-action-btn--view');
      var delBtn = wrap.querySelector('.pass-action-btn--danger');
      if (!viewBtn || !delBtn) return;
      var passId =
        viewBtn.getAttribute('onclick')?.match(/'([^']+)'/)?.[1] ||
        delBtn.getAttribute('onclick')?.match(/'([^']+)'/)?.[1] ||
        '';
      var menuId = 'fdPassMenu_' + passId.replace(/[^a-z0-9]/gi, '');
      wrap.innerHTML =
        '<div class="fd-pass-row-menu">' +
        '<button type="button" class="btn small sec fd-pass-row-menu__trigger" aria-haspopup="menu" aria-expanded="false" aria-controls="' +
        menuId +
        '">Azioni</button>' +
        '<div class="fd-pass-row-menu__panel" id="' +
        menuId +
        '" role="menu" hidden>' +
        '<button type="button" class="fd-pass-row-menu__item" role="menuitem" data-action="view">Dettaglio pass</button>' +
        '<button type="button" class="fd-pass-row-menu__item fd-pass-row-menu__item--danger" role="menuitem" data-action="delete" data-rbac-write="passes">Elimina pass</button>' +
        '</div></div>';
      var trigger = wrap.querySelector('.fd-pass-row-menu__trigger');
      var panel = wrap.querySelector('.fd-pass-row-menu__panel');
      trigger.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = panel.hidden;
        document.querySelectorAll('.fd-pass-row-menu__panel').forEach(function (p) {
          p.hidden = true;
        });
        document.querySelectorAll('.fd-pass-row-menu__trigger').forEach(function (t) {
          t.setAttribute('aria-expanded', 'false');
        });
        if (open) {
          panel.hidden = false;
          trigger.setAttribute('aria-expanded', 'true');
        }
      });
      wrap.querySelector('[data-action="view"]').addEventListener('click', function () {
        panel.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
        if (typeof window.viewPassDetail === 'function') window.viewPassDetail(passId);
      });
      wrap.querySelector('[data-action="delete"]').addEventListener('click', function () {
        panel.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
        if (typeof window.deletePassInstance === 'function') window.deletePassInstance(passId);
      });
    });
    if (!document.body.dataset.fdPassMenuDismiss) {
      document.body.dataset.fdPassMenuDismiss = '1';
      document.addEventListener('click', function () {
        document.querySelectorAll('.fd-pass-row-menu__panel').forEach(function (p) {
          p.hidden = true;
        });
        document.querySelectorAll('.fd-pass-row-menu__trigger').forEach(function (t) {
          t.setAttribute('aria-expanded', 'false');
        });
      });
    }
  }

  function enhancePassesDom() {
    ensurePassesLayout();
    ensureAdvancedColumnsToggle();
    markAdvancedColumns();
    enhancePassRowActions();
  }

  function patchLoadPasses() {
    if (window.__fdPassesPatched || typeof window.loadPasses !== 'function') return;
    window.__fdPassesPatched = true;
    var orig = window.loadPasses;
    window.loadPasses = async function () {
      if (!isFiloPassesApp()) return orig.apply(this, arguments);
      var origDiag = window.loadPassWalletChannelsDiag;
      window.loadPassWalletChannelsDiag = function () {};
      try {
        await orig.apply(this, arguments);
        enhancePassesDom();
        if (typeof origDiag === 'function') await origDiag();
        if (typeof window.fdRbacHook === 'function') window.fdRbacHook('passes');
      } finally {
        window.loadPassWalletChannelsDiag = origDiag;
      }
    };
  }

  function initFdPasses() {
    if (!isFiloPassesApp()) return;
    ensurePassesLayout();
    patchLoadPasses();
  }

  window.fdInitPasses = initFdPasses;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFdPasses);
  } else {
    initFdPasses();
  }
})();
