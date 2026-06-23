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

    if (typeof window.fdInjectBrandPassFlowBar === 'function') {
      window.fdInjectBrandPassFlowBar('passes');
    }
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

  function passStatusMeta(status) {
    var key = String(status || '').toLowerCase();
    var map = {
      active: { label: 'Attivo', cls: 'fd-pass-status--active' },
      expired: { label: 'Scaduto', cls: 'fd-pass-status--expired' },
      revoked: { label: 'Revocato', cls: 'fd-pass-status--revoked' },
      inactive: { label: 'Inattivo', cls: 'fd-pass-status--inactive' },
      suspended: { label: 'Sospeso', cls: 'fd-pass-status--inactive' }
    };
    return map[key] || { label: status || '—', cls: 'fd-pass-status--neutral' };
  }

  function relocatePassesRangeHint(root, text) {
    if (!text || root.querySelector('.fd-passes-toolbar__range')) return;
    var toolbar = root.querySelector('#passSearchInput')?.closest('div');
    if (!toolbar) return;
    var sub = document.createElement('div');
    sub.className = 'fd-passes-toolbar__range';
    sub.textContent = text;
    toolbar.insertAdjacentElement('afterend', sub);
  }

  function enhanceStatsGrid(scope) {
    var root = scope || document.getElementById('passesContent');
    if (!root) return;
    var grid = root.querySelector('.stats-grid');
    if (!grid || grid.dataset.fdDsStats === '1') return;
    grid.dataset.fdDsStats = '1';
    grid.classList.add('fd-stat-grid', 'fd-passes-stat-grid');
    grid.style.marginBottom = '';
    var rangeHintText = '';
    grid.querySelectorAll('.stat-card').forEach(function (card) {
      card.classList.add('fd-stat-card');
      var label = card.querySelector('.stat-label');
      if (label) label.classList.add('fd-stat-card__label');
      var value = card.querySelector('.stat-value');
      if (value) value.classList.add('fd-stat-card__value');
      card.querySelectorAll('div[style*="font-size:11px"], div[style*="font-size: 11px"], .fd-stat-card__hint').forEach(function (hint) {
        var hintText = (hint.textContent || '').trim();
        if (hintText && !rangeHintText) rangeHintText = hintText;
        hint.remove();
      });
    });
    if (rangeHintText) relocatePassesRangeHint(root, rangeHintText);
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
      if (!btn.classList.contains('small')) btn.classList.add('small');
    });
    root.querySelectorAll('#passBulkBar .btn.small.danger, #passBulkBar .btn.danger.small').forEach(function (btn) {
      if (!btn.classList.contains('small')) btn.classList.add('small');
    });
    root.querySelectorAll('[onclick*="downloadPassesTableCsv"]').forEach(function (btn) {
      btn.classList.remove('sec');
      btn.classList.add('small');
    });
    root.querySelectorAll('.fd-passes-pagination button').forEach(function (btn) {
      btn.classList.add('small', 'sec');
    });

    var colsToggle = document.getElementById('fdPassesColsToggle');
    if (colsToggle) {
      colsToggle.className = 'btn sec small fd-passes-cols-toggle';
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
    btn.className = 'btn sec small fd-passes-cols-toggle';
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

  function enhancePassIdCells(scope) {
    var root = scope || document.getElementById('passesContent');
    if (!root) return;
    root.querySelectorAll('.pass-id-copy').forEach(function (btn) {
      if (btn.dataset.fdCopyEnhanced === '1') return;
      btn.dataset.fdCopyEnhanced = '1';
      btn.classList.add('fd-pass-id-copy');
      var fullId = btn.getAttribute('title') || btn.textContent || '';
      var text = btn.textContent || '';
      btn.innerHTML =
        '<span class="fd-pass-id-copy__icon" aria-hidden="true" title="Copia Pass ID">⧉</span>' +
        '<span class="fd-pass-id-copy__text">' + text + '</span>';
      btn.setAttribute('aria-label', 'Copia Pass ID ' + fullId);
    });
  }

  function enhancePassStatusBadges(scope) {
    var root = scope || document.getElementById('passesContent');
    if (!root) return;
    root.querySelectorAll('.pass-table tbody tr').forEach(function (row) {
      var badge = row.querySelector('td .badge');
      if (!badge || badge.dataset.fdStatusLocalized === '1') return;
      var raw = (badge.textContent || '').trim();
      var meta = passStatusMeta(raw);
      badge.dataset.fdStatusLocalized = '1';
      badge.textContent = meta.label;
      badge.classList.remove('active', 'inactive');
      badge.classList.add('fd-pass-status', meta.cls);
    });
  }

  function fdPassToast(msg) {
    if (typeof window.toast === 'function') window.toast(msg);
  }

  function fdPassConfirm(opts) {
    if (typeof window.appConfirm === 'function') return window.appConfirm(opts);
    return Promise.resolve(window.confirm(opts.message || opts.title || 'Confermi?'));
  }

  function passIdLabel(id) {
    if (typeof window.formatPassIdShort === 'function') return window.formatPassIdShort(id);
    var s = String(id || '');
    if (s.length <= 14) return s;
    return s.slice(0, 8) + '…' + s.slice(-4);
  }

  async function callRegeneratePassApi(passId) {
    var api = typeof window.API !== 'undefined' ? window.API : '/api/v1';
    var headers = typeof window.getAuthHeaders === 'function' ? window.getAuthHeaders() : {};
    var res = await fetch(api + '/passes/' + encodeURIComponent(passId) + '/regenerate?json=1', {
      method: 'POST',
      headers: Object.assign({}, headers, { Accept: 'application/json' })
    });
    var data = {};
    try {
      data = await res.json();
    } catch (_) {}
    if (!res.ok) throw new Error((data && data.error) || res.statusText || 'Errore rigenerazione');
    return data;
  }

  function regenerateSuccessMessage(data) {
    var msg = 'Pass rigenerato';
    if (data && data.apns_sent > 0) msg += ' — notifica inviata (' + data.apns_sent + ')';
    return msg;
  }

  async function regeneratePassInstance(passId, menuBtn) {
    var label = passIdLabel(passId);
    var ok = await fdPassConfirm({
      title: 'Rigenera pass',
      message:
        'Rigenerare il pass ' +
        label +
        '? Verrà ricreato il file wallet e re-inviata la notifica di installazione al device, se disponibile.',
      confirmLabel: 'Rigenera'
    });
    if (!ok) return false;

    var btn = menuBtn || null;
    var origText = btn ? btn.textContent : '';
    if (btn) {
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      btn.textContent = 'Rigenerazione…';
    }
    try {
      var data = await callRegeneratePassApi(passId);
      fdPassToast(regenerateSuccessMessage(data));
      if (typeof window.loadPasses === 'function') window.loadPasses(false);
      return true;
    } catch (err) {
      fdPassToast('Errore: ' + (err && err.message ? err.message : err));
      return false;
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
        btn.textContent = origText;
      }
    }
  }

  async function regenerateSelectedPasses() {
    var set =
      typeof window.getPassSelectedIds === 'function' ? window.getPassSelectedIds() : null;
    var ids = set ? Array.from(set) : [];
    if (!ids.length) return;

    var ok = await fdPassConfirm({
      title: 'Rigenera pass selezionati',
      message:
        'Rigenerare ' +
        ids.length +
        ' pass selezionati? Verranno ricreati i file wallet e re-inviate le notifiche di installazione ai device registrati.',
      confirmLabel: 'Rigenera'
    });
    if (!ok) return;

    var bulkBtn = document.getElementById('fdPassBulkRegenerateBtn');
    var bulkOrig = bulkBtn ? bulkBtn.textContent : '';
    if (bulkBtn) {
      bulkBtn.disabled = true;
      bulkBtn.setAttribute('aria-busy', 'true');
      bulkBtn.textContent = 'Rigenerazione…';
    }

    var okCount = 0;
    var failCount = 0;
    var pushCount = 0;
    for (var i = 0; i < ids.length; i++) {
      try {
        var data = await callRegeneratePassApi(ids[i]);
        okCount += 1;
        if (data && data.apns_sent > 0) pushCount += data.apns_sent;
      } catch (_) {
        failCount += 1;
      }
    }

    if (bulkBtn) {
      bulkBtn.disabled = false;
      bulkBtn.removeAttribute('aria-busy');
      bulkBtn.textContent = bulkOrig;
    }

    if (okCount) {
      var bulkMsg = 'Rigenerati ' + okCount + ' pass';
      if (pushCount > 0) bulkMsg += ' — ' + pushCount + ' notifiche inviate';
      fdPassToast(bulkMsg);
    }
    if (failCount) fdPassToast(failCount + ' pass non rigenerati');
    if (okCount && typeof window.loadPasses === 'function') window.loadPasses(false);
  }

  function ensurePassBulkRegenerateButton() {
    var bar = document.querySelector('#passBulkBar div[style*="display:flex"]');
    if (!bar || document.getElementById('fdPassBulkRegenerateBtn')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'fdPassBulkRegenerateBtn';
    btn.className = 'btn small sec';
    btn.textContent = 'Rigenera selezionati';
    btn.setAttribute('data-rbac-write', 'passes');
    btn.addEventListener('click', regenerateSelectedPasses);
    var deleteBtn = bar.querySelector('.btn.danger');
    if (deleteBtn) bar.insertBefore(btn, deleteBtn);
    else bar.appendChild(btn);
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
        '<button type="button" class="fd-pass-row-menu__item" role="menuitem" data-action="regenerate" data-rbac-write="passes">Rigenera pass</button>' +
        '<hr class="fd-pass-row-menu__sep" role="separator">' +
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
      wrap.querySelector('[data-action="regenerate"]').addEventListener('click', function (e) {
        var regenBtn = e.currentTarget;
        panel.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
        regeneratePassInstance(passId, regenBtn);
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

  function renderCompactPassLegendHtml() {
    return (
      '<div class="fd-passes-legend-hint">' +
      '<button type="button" class="fd-btn fd-btn--ghost fd-btn--sm fd-passes-legend-trigger" ' +
      'id="fdPassTableLegendBtn" aria-expanded="false" aria-controls="fdPassTableLegendPanel">' +
      'Legenda colonne</button>' +
      '<div class="fd-passes-legend-panel" id="fdPassTableLegendPanel" role="dialog" aria-label="Legenda tabella pass emessi" hidden>' +
      '<div class="fd-passes-legend-panel__title">Legenda tabella</div>' +
      '<ul class="fd-passes-legend-panel__list">' +
      '<li><strong>Installato</strong> — salvato nel wallet vs solo generato</li>' +
      '<li><strong>Apple</strong> — token push (APNs) attivo o assente</li>' +
      '<li><strong>Google</strong> — GW salvato · GW° in attesa · — non usato</li>' +
      '<li><strong>Samsung</strong> — SW salvato · SW° in attesa</li>' +
      '<li><strong>Push (APNs)</strong> — ✔ consegnata · ✖ errore · Nx = numero invii</li>' +
      '<li><strong>Pass ID</strong> — clic per copiare l’identificativo</li>' +
      '<li><strong>Selezione</strong> — ☑ prima colonna → Rigenera / Elimina selezionati</li>' +
      '</ul></div></div>'
    );
  }

  function wirePassLegendPopover(scope) {
    var root = scope || document.getElementById('passesContent');
    if (!root) return;
    var btn = root.querySelector('#fdPassTableLegendBtn');
    var panel = root.querySelector('#fdPassTableLegendPanel');
    if (!btn || !panel || btn.dataset.fdLegendWired === '1') return;
    btn.dataset.fdLegendWired = '1';
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = panel.hidden;
      document.querySelectorAll('.fd-passes-legend-panel').forEach(function (p) {
        p.hidden = true;
      });
      document.querySelectorAll('.fd-passes-legend-trigger').forEach(function (t) {
        t.setAttribute('aria-expanded', 'false');
      });
      if (open) {
        panel.hidden = false;
        btn.setAttribute('aria-expanded', 'true');
      }
    });
    if (!document.body.dataset.fdPassLegendDismiss) {
      document.body.dataset.fdPassLegendDismiss = '1';
      document.addEventListener('click', function () {
        document.querySelectorAll('.fd-passes-legend-panel').forEach(function (p) {
          p.hidden = true;
        });
        document.querySelectorAll('.fd-passes-legend-trigger').forEach(function (t) {
          t.setAttribute('aria-expanded', 'false');
        });
      });
    }
  }

  function patchPassTableLegend() {
    if (window.__fdPassLegendPatched || typeof window.renderPassTableLegendHtml !== 'function') return;
    window.__fdPassLegendPatched = true;
    var orig = window.renderPassTableLegendHtml;
    window.renderPassTableLegendHtml = function () {
      if (!isFiloPassesApp()) return orig();
      return renderCompactPassLegendHtml();
    };
  }

  function collapsePassTableLegend(scope) {
    var root = scope || document.getElementById('passesContent');
    if (!root) return;
    root.querySelectorAll('.pass-table-legend').forEach(function (el) {
      el.hidden = true;
      el.setAttribute('aria-hidden', 'true');
    });
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
    ensurePassBulkRegenerateButton();
    enhancePassIdCells(content);
    enhancePassStatusBadges(content);
    wirePassLegendPopover(content);
    collapsePassTableLegend(content);
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
    patchPassTableLegend();
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
