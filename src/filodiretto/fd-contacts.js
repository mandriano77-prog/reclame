/**
 * FD-04 — FiloDiretto Contatti: responsive KPI strip, export in card ⋮ menu.
 */
(function () {
  'use strict';

  var KPI_ICONS = {
    total: '👥',
    with_employee_id: '🪪',
    with_email: '✉️',
    candidate: '📋',
    invited: '📨',
    activated: '✅',
    pass_installed: '📱'
  };

  function isFiloContactsApp() {
    if (document.documentElement.classList.contains('a2w-shell')) return false;
    try {
      if (window.__2WALLET_PRODUCT_LOCK__ === 'hr') return true;
    } catch (_) {}
    return document.documentElement.getAttribute('data-app') === 'filodiretto';
  }

  function isHrLeadsActive() {
    try {
      return !!window.leadsHrMode;
    } catch (_) {
      return false;
    }
  }

  function ensureLeadsSection() {
    var section = document.getElementById('leads');
    if (!section) return null;
    section.classList.add('leads--fd');
    return section;
  }

  function closePageMenu() {
    var panel = document.getElementById('contactsPageMenuPanel');
    var trigger = document.getElementById('contactsPageMenuBtn');
    if (panel) panel.hidden = true;
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  }

  function consolidateLeadsPageMenu() {
    if (!isFiloContactsApp() || !isHrLeadsActive()) return;

    var cardMenu = document.getElementById('fdContactsCardMenu');
    if (cardMenu) cardMenu.remove();

    var pageMenu = document.getElementById('contactsPageMenu');
    var panel = document.getElementById('contactsPageMenuPanel');
    if (!panel) return;

    if (!document.getElementById('fdContactsPageExportBtn')) {
      var exportItem = document.createElement('button');
      exportItem.type = 'button';
      exportItem.role = 'menuitem';
      exportItem.className = 'contacts-page-menu__item';
      exportItem.id = 'fdContactsPageExportBtn';
      exportItem.textContent = 'Esporta CSV dipendenti';
      panel.insertBefore(exportItem, panel.firstChild);
      exportItem.addEventListener('click', function (e) {
        e.stopPropagation();
        closePageMenu();
        if (exportItem.disabled) return;
        if (typeof window.exportLeadsCSV === 'function') window.exportLeadsCSV();
      });
    }

    if (pageMenu) pageMenu.hidden = false;
  }

  function simplifyCardHelp() {
    var host = document.getElementById('contactsCardAHelp');
    if (!host || host.dataset.fdHelpSimplified === '1') return;
    host.dataset.fdHelpSimplified = '1';

    var trigger = host.querySelector('.contacts-help__trigger');
    var panel = host.querySelector('.contacts-help__panel');
    if (!trigger) return;

    var tip =
      'Anagrafica dipendenti: cerca, filtra, importa ed esporta. ' +
      'Le azioni aggiornano la tabella e i KPI sottostanti.';
    trigger.textContent = 'ℹ';
    trigger.classList.add('fd-contacts-info-tip');
    trigger.setAttribute('title', tip);
    trigger.setAttribute('aria-label', 'Guida anagrafica dipendenti. ' + tip);
    if (panel) panel.remove();
    trigger.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
    });
  }

  function ensureCardMenu() {
    /* Card-level kebab removed — actions live in page menu (consolidateLeadsPageMenu). */
  }

  function syncFiloExportMenuState() {
    if (!isFiloContactsApp() || !isHrLeadsActive()) return;
    var exportItem = document.getElementById('fdContactsPageExportBtn');
    if (!exportItem) return;

    var total = 0;
    var filteredLen = 0;
    try {
      total = Array.isArray(window.allLeads) ? window.allLeads.length : 0;
      if (typeof window.getFilteredLeadsByUiState === 'function') {
        filteredLen = window.getFilteredLeadsByUiState().length;
      }
    } catch (_) {}

    var disabled = total === 0 || !filteredLen;
    exportItem.disabled = disabled;
    exportItem.title = total === 0
      ? 'Nessun dipendente da esportare'
      : (filteredLen ? 'Esporta dipendenti filtrati in CSV' : 'Nessun risultato con i filtri attivi');
  }

  function enhanceFiloKpiStrip() {
    if (!isFiloContactsApp()) return;
    var host = document.getElementById('leadsStats');
    if (!host) return;
    host.classList.add('fd-contacts-kpi');
    if (!isHrLeadsActive()) return;

    host.querySelectorAll('.contacts-kpi-strip__item').forEach(function (btn) {
      var key = btn.dataset.kpiKey;
      if (!key || btn.classList.contains('fd-contacts-kpi-item')) return;
      btn.classList.add('fd-contacts-kpi-item');
      var icon = document.createElement('span');
      icon.className = 'fd-contacts-kpi-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = KPI_ICONS[key] || '•';
      btn.insertBefore(icon, btn.firstChild);
    });
  }

  function enhanceFiloContactsToolbar() {
    if (!isFiloContactsApp() || !isHrLeadsActive()) return;
    consolidateLeadsPageMenu();
    simplifyCardHelp();
    syncFiloExportMenuState();
  }

  function enhanceContactsSectionDesign() {
    var section = ensureLeadsSection();
    if (!section || section.dataset.fdDsSection === '1') return;
    section.dataset.fdDsSection = '1';
    section.classList.add('leads--fd-ds');

    var header = section.querySelector('.contacts-page-header');
    if (header && !header.classList.contains('fd-page-header')) {
      header.classList.add('fd-page-header', 'fd-contacts-header');
      var copyDiv = header.querySelector(':scope > div:first-child');
      if (copyDiv) copyDiv.classList.add('fd-page-header__copy');
      var h1 = header.querySelector('h1');
      if (h1) h1.classList.add('fd-page-header__title');
      var blurb = header.querySelector('.contacts-page-blurb');
      if (blurb) blurb.classList.add('fd-page-header__lead');
      var actions = header.querySelector('.a2w-contacts-header-actions');
      if (actions) actions.classList.add('fd-page-header__actions', 'fd-contacts-header__actions');
    }

    var cardA = document.getElementById('contactsCardA');
    if (cardA) cardA.classList.add('fd-card', 'fd-contacts-card');

    var tabs = section.querySelector('#leadsSectionTabs');
    if (tabs) tabs.classList.add('fd-contacts-tabs');
  }

  function wrapLeadsTable() {
    var table = document.getElementById('leadsTable');
    if (!table || table.closest('.fd-table-wrap, .fd-contacts-table-wrap')) return;
    var wrap = document.createElement('div');
    wrap.className = 'fd-table-wrap fd-contacts-table-wrap';
    table.parentNode.insertBefore(wrap, table);
    wrap.appendChild(table);
    table.classList.add('fd-table');
  }

  function applyContactsDsButtons() {
    if (!isFiloContactsApp() || !isHrLeadsActive()) return;
    var addBtn = document.getElementById('a2wContactsAddBtn');
    if (addBtn) {
      addBtn.classList.add('fd-btn', 'fd-btn--primary');
      addBtn.classList.remove('a2w-btn-primary');
    }
    var importBtn = document.getElementById('a2wContactsImportBtn');
    if (importBtn) importBtn.classList.add('fd-btn', 'fd-btn--secondary');

    var toolbar = document.getElementById('contactsToolbarHost');
    if (toolbar) {
      toolbar.querySelectorAll('button.btn').forEach(function (btn) {
        if (btn.classList.contains('danger')) {
          btn.classList.add('fd-btn', 'fd-btn--danger', 'fd-btn--sm');
        } else if (
          btn.id === 'a2wLeadsSendActivationBtn' ||
          (btn.textContent || '').indexOf('Invia') >= 0
        ) {
          btn.classList.add('fd-btn', 'fd-btn--primary', 'fd-btn--sm');
        } else {
          btn.classList.add('fd-btn', 'fd-btn--secondary', 'fd-btn--sm');
        }
      });
    }

    var menuBtn = document.getElementById('contactsPageMenuBtn');
    if (menuBtn) menuBtn.classList.add('fd-btn', 'fd-btn--ghost', 'fd-btn--sm');
  }

  function enhanceContactsKpiAsStatGrid() {
    var host = document.getElementById('leadsStats');
    if (!host || !host.querySelector('.contacts-kpi-strip__item')) return;
    host.classList.add('fd-contacts-stat-grid');
  }

  function enhanceContactsDom() {
    if (!isFiloContactsApp() || !isHrLeadsActive()) return;
    enhanceContactsSectionDesign();
    wrapLeadsTable();
    enhanceContactsKpiAsStatGrid();
    enhanceFiloKpiStrip();
    enhanceFiloContactsToolbar();
    applyContactsDsButtons();
    if (typeof window.fdEnhanceResponsiveTables === 'function') {
      window.fdEnhanceResponsiveTables();
    }
  }

  function patchLoadLeadsForDs() {
    if (window.__fdContactsLoadDsPatched || typeof window.loadLeads !== 'function') return;
    window.__fdContactsLoadDsPatched = true;
    var orig = window.loadLeads;
    window.loadLeads = async function () {
      if (isFiloContactsApp() && isHrLeadsActive()) enhanceContactsSectionDesign();
      await orig.apply(this, arguments);
      if (isFiloContactsApp() && isHrLeadsActive()) enhanceContactsDom();
    };
  }

  function patchNavForContacts() {
    if (window.__fdContactsNavPatched || typeof window.nav !== 'function') return;
    window.__fdContactsNavPatched = true;
    var origNav = window.nav;
    window.nav = function (id) {
      var r = origNav.apply(this, arguments);
      var done = function () {
        if (id === 'leads' && isFiloContactsApp()) enhanceContactsDom();
      };
      if (r && typeof r.then === 'function') return r.then(done);
      setTimeout(done, 120);
      return r;
    };
  }

  function patchLeadsRenderers() {
    if (window.__fdContactsPatched) return;
    window.__fdContactsPatched = true;

    var origKpi = window.renderLeadsKpiStrip;
    if (typeof origKpi === 'function') {
      window.renderLeadsKpiStrip = function () {
        origKpi.apply(this, arguments);
        if (isFiloContactsApp()) enhanceFiloKpiStrip();
      };
    }

    var origToolbar = window.renderLeadsToolbar;
    if (typeof origToolbar === 'function') {
      window.renderLeadsToolbar = function () {
        origToolbar.apply(this, arguments);
        if (isFiloContactsApp()) {
          enhanceFiloContactsToolbar();
          applyContactsDsButtons();
          setTimeout(simplifyCardHelp, 0);
        }
      };
    }

    var origSyncExport = window.syncA2wLeadsExportButtonState;
    if (typeof origSyncExport === 'function') {
      window.syncA2wLeadsExportButtonState = function () {
        origSyncExport.apply(this, arguments);
        if (isFiloContactsApp()) syncFiloExportMenuState();
      };
    }
  }

  function initFdContacts() {
    if (!isFiloContactsApp()) return;
    patchLeadsRenderers();
    patchLoadLeadsForDs();
    patchNavForContacts();
    ensureLeadsSection();
    if (isHrLeadsActive()) {
      consolidateLeadsPageMenu();
      enhanceContactsDom();
    }
  }

  window.fdInitContacts = initFdContacts;
  window.fdSyncContactsExport = syncFiloExportMenuState;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFdContacts);
  } else {
    initFdContacts();
  }
})();
