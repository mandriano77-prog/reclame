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

  function closeCardMenu() {
    var panel = document.getElementById('fdContactsCardMenuPanel');
    var trigger = document.getElementById('fdContactsCardMenuBtn');
    if (panel) panel.hidden = true;
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  }

  function ensureCardMenu() {
    var heading = document.querySelector('#contactsCardA .contacts-card__heading');
    if (!heading || document.getElementById('fdContactsCardMenu')) return;

    var wrap = document.createElement('div');
    wrap.className = 'fd-contacts-card-menu';
    wrap.id = 'fdContactsCardMenu';
    wrap.innerHTML =
      '<button type="button" class="fd-contacts-card-menu__trigger" id="fdContactsCardMenuBtn" aria-label="Azioni anagrafica" aria-haspopup="menu" aria-expanded="false">⋮</button>' +
      '<div class="fd-contacts-card-menu__panel" id="fdContactsCardMenuPanel" role="menu" hidden>' +
      '<button type="button" class="fd-contacts-card-menu__item" id="fdContactsExportBtn" role="menuitem">Esporta CSV</button>' +
      '</div>';

    heading.appendChild(wrap);

    var trigger = document.getElementById('fdContactsCardMenuBtn');
    var panel = document.getElementById('fdContactsCardMenuPanel');
    var exportItem = document.getElementById('fdContactsExportBtn');

    if (trigger && panel) {
      trigger.addEventListener('click', function (e) {
        e.stopPropagation();
        if (trigger.disabled) return;
        var open = panel.hidden;
        closeCardMenu();
        if (open) {
          panel.hidden = false;
          trigger.setAttribute('aria-expanded', 'true');
        }
      });
    }

    if (exportItem) {
      exportItem.addEventListener('click', function (e) {
        e.stopPropagation();
        closeCardMenu();
        if (exportItem.disabled) return;
        if (typeof window.exportLeadsCSV === 'function') window.exportLeadsCSV();
      });
    }

    if (document.body.dataset.fdContactsMenuBound !== '1') {
      document.body.dataset.fdContactsMenuBound = '1';
      document.addEventListener('click', closeCardMenu);
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeCardMenu();
      });
    }
  }

  function syncFiloExportMenuState() {
    if (!isFiloContactsApp() || !isHrLeadsActive()) return;
    var exportItem = document.getElementById('fdContactsExportBtn');
    var trigger = document.getElementById('fdContactsCardMenuBtn');
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
    trigger.disabled = false;
    exportItem.title = total === 0
      ? 'Nessun contatto da esportare'
      : (filteredLen ? 'Esporta contatti in CSV' : 'Nessun risultato con i filtri attivi');
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
    ensureCardMenu();
    syncFiloExportMenuState();
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
        if (isFiloContactsApp()) enhanceFiloContactsToolbar();
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
    ensureLeadsSection();
    ensureCardMenu();
    if (isHrLeadsActive()) {
      enhanceFiloKpiStrip();
      syncFiloExportMenuState();
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
