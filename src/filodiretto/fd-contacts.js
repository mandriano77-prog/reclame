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

  function stripLeadsHeaderDuplicates() {
    if (!isFiloContactsApp() || !isHrLeadsActive()) return;

    var headerActions = document.getElementById('a2wContactsHeaderActions');
    if (headerActions) {
      headerActions.hidden = true;
      headerActions.setAttribute('aria-hidden', 'true');
      headerActions.style.display = 'none';
    }

    var pageMenu = document.getElementById('contactsPageMenu');
    if (pageMenu) {
      pageMenu.hidden = true;
      pageMenu.setAttribute('aria-hidden', 'true');
      pageMenu.style.display = 'none';
    }

    var legacyExport = document.getElementById('fdContactsPageExportBtn');
    if (legacyExport) legacyExport.remove();
  }

  function closeToolbarOverflowMenu() {
    var panel = document.getElementById('fdContactsToolbarOverflowPanel');
    var trigger = document.getElementById('fdContactsToolbarOverflowBtn');
    if (panel) panel.hidden = true;
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  }

  function ensureToolbarOverflowMenu() {
    if (!isFiloContactsApp() || !isHrLeadsActive()) return;
    var host = document.getElementById('contactsToolbarHost');
    if (!host) return;
    var actions = host.querySelector('.contacts-toolbar__actions, .a2w-contacts-toolbar-actions');
    if (!actions) return;

    var overflowBtn = document.getElementById('fdContactsToolbarOverflowBtn');
    var panel = document.getElementById('fdContactsToolbarOverflowPanel');

    if (!overflowBtn) {
      overflowBtn = document.createElement('button');
      overflowBtn.type = 'button';
      overflowBtn.id = 'fdContactsToolbarOverflowBtn';
      overflowBtn.className = 'fd-btn fd-btn--ghost fd-btn--sm fd-contacts-toolbar-overflow fd-contacts-toolbar-overflow--always';
      overflowBtn.textContent = '•••';
      overflowBtn.setAttribute('aria-haspopup', 'menu');
      overflowBtn.setAttribute('aria-expanded', 'false');
      overflowBtn.setAttribute('aria-label', 'Altre azioni anagrafica');
      actions.appendChild(overflowBtn);
    }

    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'fdContactsToolbarOverflowPanel';
      panel.className = 'fd-contacts-toolbar-overflow-panel';
      panel.hidden = true;
      panel.setAttribute('role', 'menu');
      actions.appendChild(panel);
    }

    if (host.dataset.fdOverflowBound !== '1') {
      host.dataset.fdOverflowBound = '1';
      overflowBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = panel.hidden;
        closeToolbarOverflowMenu();
        if (open) {
          panel.hidden = false;
          overflowBtn.setAttribute('aria-expanded', 'true');
        }
      });

      document.addEventListener('click', function (e) {
        if (!panel.hidden && !panel.contains(e.target) && e.target !== overflowBtn) {
          closeToolbarOverflowMenu();
        }
      });
    }

    panel.innerHTML = '';
    ensureToolbarOverflowStaticItems(panel);
  }

  function ensureToolbarOverflowStaticItems(panel) {
    if (!panel) return;

    var exportItem = document.createElement('button');
    exportItem.type = 'button';
    exportItem.role = 'menuitem';
    exportItem.className = 'fd-contacts-toolbar-overflow-panel__item';
    exportItem.id = 'fdContactsOverflowExportBtn';
    exportItem.textContent = 'Esporta CSV dipendenti';
    exportItem.addEventListener('click', function (e) {
      e.stopPropagation();
      closeToolbarOverflowMenu();
      if (exportItem.disabled) return;
      if (typeof window.exportLeadsCSV === 'function') window.exportLeadsCSV();
    });
    panel.appendChild(exportItem);

    var tourItem = document.createElement('button');
    tourItem.type = 'button';
    tourItem.role = 'menuitem';
    tourItem.className = 'fd-contacts-toolbar-overflow-panel__item';
    tourItem.id = 'fdContactsOverflowTourBtn';
    tourItem.textContent = 'Mostra tour';
    tourItem.addEventListener('click', function (e) {
      e.stopPropagation();
      closeToolbarOverflowMenu();
      if (window.ContactsPage && typeof window.ContactsPage.showTour === 'function') {
        window.ContactsPage.showTour();
      }
    });
    panel.appendChild(tourItem);
  }

  function wireContactsHelpPopover() {
    var host = document.getElementById('contactsCardAHelp');
    if (!host || host.dataset.fdHelpWired === '1') return;
    if (!window.HelpPopover || typeof window.HelpPopover.render !== 'function') return;
    host.dataset.fdHelpWired = '1';
    host.classList.add('fd-contacts-help-host');
    window.HelpPopover.render({
      host: host,
      title: 'Anagrafica dipendenti',
      what: 'Elenco centrale di tutti i dipendenti del brand con stato anagrafico e distribuzione pass.',
      whenToUse: [
        'Cercare o filtrare dipendenti',
        'Aggiungere o importare anagrafica',
        'Inviare attivazioni e monitorare lo stato pass'
      ],
      effects: 'Le azioni qui aggiornano la tabella sottostante e i KPI di riepilogo.',
      example: 'Filtra «Da invitare», seleziona i contatti e invia l\'email di attivazione del pass.'
    });
  }

  function simplifyCardHelp() {
    /* Help popover stays interactive — positioned via HelpPopover (flip + shift). */
    wireContactsHelpPopover();
  }

  function ensureCardMenu() {
    /* Card-level kebab removed — export/tour live in toolbar overflow menu. */
  }

  function syncFiloExportMenuState() {
    if (!isFiloContactsApp() || !isHrLeadsActive()) return;
    var exportItem = document.getElementById('fdContactsOverflowExportBtn');
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
    stripLeadsHeaderDuplicates();
    wireContactsHelpPopover();
    ensureToolbarOverflowMenu();
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

    if (typeof window.fdInjectBrandPassFlowBar === 'function') {
      window.fdInjectBrandPassFlowBar('leads');
    }
    if (typeof window.fdRelocateBrandPassFlowBar === 'function') {
      window.fdRelocateBrandPassFlowBar(section);
    }
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
    var addBtn = document.getElementById('leadsAddBtn');
    if (addBtn) {
      addBtn.classList.remove('sec', 'a2w-btn-primary');
      addBtn.classList.add('small');
    }
    var importBtn = document.getElementById('leadsImportBtn');
    if (importBtn) {
      importBtn.classList.add('sec', 'small');
    }

    var toolbar = document.getElementById('contactsToolbarHost');
    if (toolbar) {
      toolbar.querySelectorAll('button.btn').forEach(function (btn) {
        if (btn.id === 'leadsAddBtn') return;
        if (btn.classList.contains('danger')) {
          btn.classList.add('small');
        } else if (btn.id === 'a2wLeadsSendActivationBtn' || btn.id === 'leadsDistributeBtn') {
          btn.classList.add('sec', 'small');
        } else {
          btn.classList.add('sec', 'small');
        }
      });
    }

    var menuBtn = document.getElementById('fdContactsToolbarOverflowBtn');
    if (menuBtn) menuBtn.classList.add('fd-btn-ghost', 'small');
  }

  function enhanceContactsKpiAsStatGrid() {
    var host = document.getElementById('leadsStats');
    if (!host || !host.querySelector('.contacts-kpi-strip__item')) return;
    host.classList.add('fd-contacts-stat-grid');
  }

  function enhanceContactsDom() {
    if (!isFiloContactsApp() || !isHrLeadsActive()) return;
    enhanceContactsSectionDesign();
    if (typeof window.fdInjectBrandPassFlowBar === 'function') {
      window.fdInjectBrandPassFlowBar('leads');
    }
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
      stripLeadsHeaderDuplicates();
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
