/**
 * FD — Pass Emessi (FASE 4): DS layout, KPI grid, toolbar, table UX, azioni riga.
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

  function renderLoadingSkeleton() {
    function statSkel() {
      return (
        '<div class="fd-stat-card fd-stat-card--skeleton" aria-hidden="true">' +
        '<span class="fd-skeleton fd-skeleton--text" style="width:72%"></span>' +
        '<span class="fd-skeleton fd-skeleton--title" style="width:38%;margin-top:8px"></span>' +
        '</div>'
      );
    }
    return (
      '<div class="fd-passes-skeleton" aria-busy="true" aria-live="polite">' +
      '<div class="fd-stat-grid fd-passes-stat-grid">' +
      statSkel() +
      statSkel() +
      statSkel() +
      statSkel() +
      '</div>' +
      '<div class="fd-table-wrap fd-passes-table-skeleton">' +
      '<span class="fd-skeleton" style="display:block;width:100%;height:240px;border-radius:var(--fd-radius-md,12px)"></span>' +
      '</div></div>'
    );
  }

  function enhancePassesSectionDesign() {
    var section = document.getElementById('passes');
    if (!section || section.dataset.fdDsSection === '1') return;
    section.dataset.fdDsSection = '1';
    section.classList.add('passes--fd-layout', 'passes--fd-ds');

    var headerWrap = section.querySelector(':scope > div');
    var title = section.querySelector('h1.page-title, h1.sec-title');
    var filterWrap = section.querySelector('#passFilterCampaign')?.closest('div');
    if (headerWrap && title && !headerWrap.classList.contains('fd-page-header')) {
      headerWrap.classList.add('fd-page-header', 'fd-passes-header');
      headerWrap.style.display = '';
      headerWrap.style.justifyContent = '';
      headerWrap.style.alignItems = '';
      headerWrap.style.marginBottom = '';

      var copy = headerWrap.querySelector('.fd-page-header__copy');
      if (!copy) {
        copy = document.createElement('div');
        copy.className = 'fd-page-header__copy';
        copy.appendChild(title);
        var lead = document.createElement('p');
        lead.className = 'fd-page-header__lead fd-passes-lead';
        lead.textContent =
          'Monitora pass generati, installazioni Wallet e canali raggiungibili per il supporto HR.';
        copy.appendChild(lead);
        headerWrap.insertBefore(copy, headerWrap.firstChild);
      }

      title.classList.add('fd-page-header__title');
      var existingLead = copy.querySelector('.fd-page-header__lead, .fd-passes-lead');
      if (existingLead) existingLead.classList.add('fd-page-header__lead');

      if (filterWrap && filterWrap.parentNode === headerWrap) {
        filterWrap.classList.add('fd-page-header__actions', 'fd-passes-header__filters');
        filterWrap.style.display = '';
        filterWrap.style.gap = '';
        headerWrap.appendChild(filterWrap);
        var select = filterWrap.querySelector('#passFilterCampaign');
        if (select) select.classList.add('fd-passes-campaign-select');
      }
    }

    var hint = document.getElementById('passFilterSessionHint');
    if (hint) hint.classList.add('fd-passes-session-hint');

    var content = document.getElementById('passesContent');
    if (content) content.classList.add('fd-passes-content');

    var accordion = document.getElementById('passWalletTechAccordion');
    if (accordion) accordion.classList.add('fd-card', 'fd-passes-tech-accordion');

    if (typeof window.fdRelocateBrandPassFlowBar === 'function') {
      window.fdRelocateBrandPassFlowBar(section);
    }
  }

  function ensurePassesLayout() {
    var section = document.getElementById('passes');
    var accordion = document.getElementById('passWalletTechAccordion');
    var diag = document.getElementById('passWalletChannelsDiag');
    var content = document.getElementById('passesContent');
    if (!section || !content || section.dataset.fdPassesLayout === '1') return;
    if (!accordion && !diag) return;
    section.dataset.fdPassesLayout = '1';
    section.classList.add('passes--fd-layout');
    if (accordion) section.appendChild(accordion);
    else if (diag) section.appendChild(diag);
  }

  function enhanceStatsGrid(scope) {
    var root = scope || document.getElementById('passesContent');
    if (!root) return;
    var grid = root.querySelector('.stats-grid');
    if (!grid || grid.dataset.fdDsStats === '1') return;
    grid.dataset.fdDsStats = '1';
    grid.classList.add('fd-stat-grid', 'fd-passes-stat-grid');
    grid.style.marginBottom = '';
    grid.querySelectorAll('.stat-card').forEach(function (card) {
      card.classList.add('fd-stat-card');
      var label = card.querySelector('.stat-label');
      if (label) label.classList.add('fd-stat-card__label');
      var value = card.querySelector('.stat-value');
      if (value) value.classList.add('fd-stat-card__value');
      card.querySelectorAll('div[style*="font-size:11px"], div[style*="font-size: 11px"]').forEach(function (hint) {
        hint.classList.add('fd-stat-card__hint');
        hint.style.fontSize = '';
        hint.style.color = '';
        hint.style.marginTop = '';
      });
    });
  }

  function enhancePassesToolbar(scope) {
    var root = scope || document.getElementById('passesContent');
    if (!root) return;
    var input = root.querySelector('#passSearchInput');
    if (!input) return;
    var row = input.closest('div');
    if (!row || row.dataset.fdDsToolbar === '1') return;
    row.dataset.fdDsToolbar = '1';
    row.classList.add('fd-toolbar', 'fd-passes-toolbar');
    row.style.display = '';
    row.style.justifyContent = '';
    row.style.alignItems = '';
    row.style.gap = '';
    row.style.flexWrap = '';
    row.style.marginBottom = '';
    input.classList.add('fd-passes-search');
    input.style.maxWidth = '';
  }

  function enhancePassesPagination(scope) {
    var root = scope || document.getElementById('passesContent');
    if (!root) return;
    root.querySelectorAll('.fd-passes-pagination').forEach(function (el) {
      if (el.dataset.fdDsPagination === '1') return;
      el.dataset.fdDsPagination = '1';
    });
    var table = root.querySelector('.pass-table');
    if (!table) return;
    var pager = table.closest('.pass-table-wrap')?.nextElementSibling;
    if (!pager || pager.dataset.fdDsPagination === '1') return;
    if (!pager.querySelector('button[onclick*="goPrevPassesPage"], button[onclick*="goNextPassesPage"]')) return;
    pager.dataset.fdDsPagination = '1';
    pager.classList.add('fd-passes-pagination');
    pager.style.display = '';
    pager.style.justifyContent = '';
    pager.style.alignItems = '';
    pager.style.marginTop = '';
    pager.style.gap = '';
    pager.style.flexWrap = '';
  }

  function enhanceBulkBar(scope) {
    var root = scope || document.getElementById('passesContent');
    if (!root) return;
    var bar = root.querySelector('#passBulkBar');
    if (!bar || bar.dataset.fdDsBulk === '1') return;
    bar.dataset.fdDsBulk = '1';
    bar.classList.add('fd-passes-bulk-bar');
    var hint = root.querySelector('.bulk-select-hint');
    if (hint) hint.classList.add('fd-passes-bulk-hint');
  }

  function applyDsButtonClasses(scope) {
    var root = scope || document.getElementById('passesContent');
    if (!root) return;

    root.querySelectorAll('#passBulkBar .btn.small.sec, #passBulkBar .btn.sec.small').forEach(function (btn) {
      btn.classList.add('fd-btn', 'fd-btn--secondary', 'fd-btn--sm');
    });
    root.querySelectorAll('#passBulkBar .btn.small.danger, #passBulkBar .btn.danger.small').forEach(function (btn) {
      btn.classList.add('fd-btn', 'fd-btn--danger', 'fd-btn--sm');
    });
    root.querySelectorAll('[onclick*="downloadPassesTableCsv"]').forEach(function (btn) {
      btn.classList.add('fd-btn', 'fd-btn--secondary', 'fd-btn--sm');
    });
    root.querySelectorAll('.fd-passes-pagination button').forEach(function (btn) {
      btn.classList.add('fd-btn', 'fd-btn--sm');
      if (btn.getAttribute('onclick')?.indexOf('goNextPassesPage') >= 0) {
        btn.classList.add('fd-btn--primary');
      } else {
        btn.classList.add('fd-btn--secondary');
      }
    });

    var colsToggle = document.getElementById('fdPassesColsToggle');
    if (colsToggle) {
      colsToggle.classList.add('fd-btn', 'fd-btn--secondary', 'fd-btn--sm');
      colsToggle.classList.remove('sec');
    }
  }

  function enhancePassTable(scope) {
    var root = scope || document.getElementById('passesContent');
    if (!root) return;
    var table = root.querySelector('.pass-table');
    if (table) table.classList.add('fd-table');
    var wrap = root.querySelector('.pass-table-wrap');
    if (wrap) wrap.classList.add('fd-table-wrap');
  }

  function ensureAdvancedColumnsToggle() {
    var content = document.getElementById('passesContent');
    if (!content || document.getElementById('fdPassesColsToggle')) return;
    var searchRow = content.querySelector('#passSearchInput')?.closest('div');
    if (!searchRow) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'fdPassesColsToggle';
    btn.className = 'fd-btn fd-btn--secondary fd-btn--sm fd-passes-cols-toggle';
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
        '<button type="button" class="fd-btn fd-btn--secondary fd-btn--sm fd-pass-row-menu__trigger" aria-haspopup="menu" aria-expanded="false" aria-controls="' +
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
    var content = document.getElementById('passesContent');
    enhancePassesSectionDesign();
    ensurePassesLayout();
    if (!content) return;
    enhanceStatsGrid(content);
    enhanceBulkBar(content);
    enhancePassesToolbar(content);
    enhancePassTable(content);
    ensureAdvancedColumnsToggle();
    markAdvancedColumns();
    enhancePassesPagination(content);
    applyDsButtonClasses(content);
    enhancePassRowActions();
    if (typeof window.fdEnhanceResponsiveTables === 'function') {
      window.fdEnhanceResponsiveTables();
    }
  }

  function patchLoadPasses() {
    if (window.__fdPassesPatched || typeof window.loadPasses !== 'function') return;
    window.__fdPassesPatched = true;
    var orig = window.loadPasses;
    window.loadPasses = async function () {
      if (!isFiloPassesApp()) return orig.apply(this, arguments);
      if (!window.brandId) return orig.apply(this, arguments);
      enhancePassesSectionDesign();
      var el = document.getElementById('passesContent');
      if (el) el.innerHTML = renderLoadingSkeleton();
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

  function patchNavForPasses() {
    if (window.__fdPassesNavPatched || typeof window.nav !== 'function') return;
    window.__fdPassesNavPatched = true;
    var origNav = window.nav;
    window.nav = function (id) {
      var r = origNav.apply(this, arguments);
      var done = function () {
        if (id === 'passes') enhancePassesSectionDesign();
      };
      if (r && typeof r.then === 'function') return r.then(done);
      setTimeout(done, 0);
      return r;
    };
  }

  function initFdPasses() {
    if (!isFiloPassesApp()) return;
    ensurePassesLayout();
    patchLoadPasses();
    patchNavForPasses();
    enhancePassesSectionDesign();
  }

  window.fdInitPasses = initFdPasses;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFdPasses);
  } else {
    initFdPasses();
  }
})();
