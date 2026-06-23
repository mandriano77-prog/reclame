/**
 * FD — Analytics (FASE 4): DS layout, KPI grid, chart cards, table UX, skeleton loading.
 */
(function () {
  'use strict';

  function isFiloAnalyticsApp() {
    if (document.documentElement.classList.contains('a2w-shell')) return false;
    try {
      if (window.__2WALLET_PRODUCT_LOCK__ === 'hr') return true;
    } catch (_) {}
    return document.documentElement.getAttribute('data-app') === 'filodiretto';
  }

  function renderStatsSkeleton() {
    function statSkel() {
      return (
        '<div class="fd-stat-card fd-stat-card--skeleton" aria-hidden="true">' +
        '<span class="fd-skeleton fd-skeleton--text" style="width:72%"></span>' +
        '<span class="fd-skeleton fd-skeleton--title" style="width:38%;margin-top:8px"></span>' +
        '</div>'
      );
    }
    return (
      '<div class="fd-analytics-stats-skeleton" aria-busy="true" aria-live="polite">' +
      '<div class="fd-stat-grid fd-analytics-stat-grid">' +
      statSkel() + statSkel() + statSkel() + statSkel() +
      statSkel() + statSkel() + statSkel() + statSkel() +
      '</div></div>'
    );
  }

  function renderChartSkeleton(height) {
    return (
      '<div class="fd-analytics-chart-skeleton" aria-busy="true">' +
      '<span class="fd-skeleton" style="display:block;width:100%;height:' + (height || 220) +
      'px;border-radius:var(--fd-radius-md,12px)"></span></div>'
    );
  }

  function findAnalyticsTitleEl() {
    return document.querySelector(
      '#analytics h1.page-title, #analytics h1.sec-title, #analytics h1.page-header__title, #analytics .fd-page-header__title'
    );
  }

  function resolveAnalyticsChromeTab(tab) {
    if (tab === 'activity-log' || tab === 'metrics') return tab;
    if (typeof window.getAnalyticsSectionTab === 'function') {
      var detected = window.getAnalyticsSectionTab();
      if (detected === 'activity-log' || detected === 'metrics') return detected;
    }
    var activeNav = document.querySelector('.nav-item.active[data-section-id="activity-log"]');
    if (activeNav) return 'activity-log';
    var path = String(window.location.pathname || '');
    if (/\/analytics\/log\/?$/i.test(path)) return 'activity-log';
    return 'metrics';
  }

  function syncAnalyticsHrChrome(tab) {
    if (!isFiloAnalyticsApp()) return;
    tab = resolveAnalyticsChromeTab(tab);

    var tabsBar = document.getElementById('analyticsSectionTabs');
    if (tabsBar) tabsBar.hidden = true;

    var titleText = tab === 'activity-log' ? 'Log Attività' : 'Analytics';
    var h1 = findAnalyticsTitleEl();
    if (h1) h1.textContent = titleText;

    var lead = document.querySelector('#analytics .fd-analytics-lead');
    if (lead) {
      lead.textContent =
        tab === 'activity-log'
          ? 'Cronologia eventi pass, download, push e azioni sul wallet.'
          : 'Metriche pass, installazioni wallet e andamento campagne per monitorare l\'adozione HR.';
    }
  }

  function enhanceAnalyticsSectionDesign() {
    var section = document.getElementById('analytics');
    if (!section || section.dataset.fdDsSection === '1') return;
    section.dataset.fdDsSection = '1';
    section.classList.add('analytics--fd-ds');

    var title = findAnalyticsTitleEl();
    if (title && !title.closest('.fd-page-header')) {
      var header = document.createElement('header');
      header.className = 'fd-page-header fd-analytics-header';
      var copy = document.createElement('div');
      copy.className = 'fd-page-header__copy';
      copy.appendChild(title);
      title.classList.add('fd-page-header__title');
      var lead = document.createElement('p');
      lead.className = 'fd-page-header__lead fd-analytics-lead';
      lead.textContent =
        'Metriche pass, installazioni wallet e andamento campagne per monitorare l\'adozione HR.';
      copy.appendChild(lead);
      header.appendChild(copy);
      section.insertBefore(header, section.firstChild);
    }

    var tabs = section.querySelector('#analyticsSectionTabs');
    if (tabs) tabs.classList.add('fd-analytics-tabs');

    var perfTitle = section.querySelector('#analyticsTabPanel_metrics > .sec-title');
    if (perfTitle) perfTitle.classList.add('fd-analytics-section-title');

    enhanceAnalyticsCards();
    enhanceAnalyticsToolbars();
    wrapCampaignTable();
    enhanceActivityLogPanel();
  }

  function enhanceStatsGrid() {
    var grid = document.getElementById('analyticsStats');
    if (!grid || grid.dataset.fdDsStats === '1') return;
    if (!grid.querySelector('.stat-card')) return;
    grid.dataset.fdDsStats = '1';
    grid.classList.add('fd-stat-grid', 'fd-analytics-stat-grid');
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

  function enhanceAnalyticsCards() {
    var panel = document.getElementById('analyticsTabPanel_metrics');
    if (!panel) return;
    panel.querySelectorAll(':scope > .form-row .card, :scope > .card').forEach(function (card) {
      if (card.dataset.fdDsCard === '1') return;
      card.dataset.fdDsCard = '1';
      card.classList.add('fd-card', 'fd-analytics-card');
      card.style.marginBottom = '';
    });
  }

  function enhanceAnalyticsToolbars() {
    document.querySelectorAll('#analytics .analytics-toolbar').forEach(function (bar) {
      if (bar.dataset.fdDsToolbar === '1') return;
      bar.dataset.fdDsToolbar = '1';
      bar.classList.add('fd-toolbar', 'fd-analytics-toolbar');
      var title = bar.querySelector('.sec-title');
      if (title) title.classList.add('fd-analytics-toolbar__title');
      var actions = bar.querySelector('.analytics-actions');
      if (actions) actions.classList.add('fd-analytics-toolbar__actions');

      bar.querySelectorAll('.analytics-chip').forEach(function (chip) {
        chip.classList.add('fd-analytics-chip');
      });
      bar.querySelectorAll('.btn.small.sec, .btn.sec.small').forEach(function (btn) {
        if (!btn.classList.contains('small')) btn.classList.add('small');
      });
      bar.querySelectorAll('#analyticsTrendRange, .analytics-date').forEach(function (el) {
        el.classList.add('fd-analytics-control');
      });
    });
  }

  function wrapCampaignTable() {
    var table = document.getElementById('campaignAnalyticsTable');
    if (!table || table.closest('.fd-table-wrap, .fd-analytics-table-wrap')) return;
    var wrap = document.createElement('div');
    wrap.className = 'fd-table-wrap fd-analytics-table-wrap';
    table.parentNode.insertBefore(wrap, table);
    wrap.appendChild(table);
    table.classList.add('fd-table');
  }

  function enhanceActivityLogPanel() {
    var panel = document.getElementById('activity-log');
    if (!panel) return;
    panel.classList.add('activity-log--fd');

    var introRow = panel.querySelector(':scope > div[style*="justify-content"]');
    if (introRow && !introRow.classList.contains('fd-toolbar')) {
      introRow.classList.add('fd-toolbar', 'fd-analytics-activity-toolbar');
      introRow.style.display = '';
      introRow.style.justifyContent = '';
      introRow.style.alignItems = '';
      introRow.style.flexWrap = '';
      introRow.style.gap = '';
      introRow.style.marginBottom = '';
      var intro = introRow.querySelector('p');
      if (intro) {
        intro.classList.add('fd-analytics-activity-lead');
        intro.style.fontSize = '';
        intro.style.color = '';
        intro.style.margin = '';
        intro.style.maxWidth = '';
        intro.style.lineHeight = '';
      }
      introRow.querySelectorAll('.btn').forEach(function (btn) {
        if (btn.id === 'fdActivityLogExportBtn') return;
        btn.classList.add('small', 'sec');
      });
    }

    var tableWrap = panel.querySelector('.pass-table-wrap');
    if (tableWrap && !tableWrap.classList.contains('fd-table-wrap')) {
      tableWrap.classList.add('fd-table-wrap', 'fd-analytics-activity-table-wrap');
    }
    var table = document.getElementById('activityLogTable');
    if (table) table.classList.add('fd-table');
  }

  function showAnalyticsLoadingState() {
    var stats = document.getElementById('analyticsStats');
    if (stats) stats.innerHTML = renderStatsSkeleton();
    ['analyticsTrendChart', 'analyticsWalletSplit', 'analyticsTopCampaigns'].forEach(function (id, i) {
      var el = document.getElementById(id);
      if (el) el.innerHTML = renderChartSkeleton(i === 1 ? 180 : 220);
    });
    var tbody = document.querySelector('#campaignAnalyticsTable tbody');
    if (tbody) {
      tbody.innerHTML = typeof window.renderTableSkeletonRows === 'function'
        ? window.renderTableSkeletonRows(4, 6)
        : '<tr><td colspan="6"><div class="fd-analytics-chart-skeleton" aria-busy="true">' +
          '<span class="fd-skeleton" style="display:block;width:100%;height:120px;border-radius:12px"></span></div></td></tr>';
    }
    var section = document.getElementById('analytics');
    if (section) section.classList.add('fd-analytics--loading');
  }

  function clearAnalyticsLoadingState() {
    var section = document.getElementById('analytics');
    if (section) section.classList.remove('fd-analytics--loading');
  }

  function enhanceAnalyticsDom() {
    enhanceAnalyticsSectionDesign();
    enhanceStatsGrid();
    enhanceAnalyticsCards();
    enhanceAnalyticsToolbars();
    wrapCampaignTable();
    enhanceActivityLogPanel();
    syncAnalyticsHrChrome();
    if (typeof window.fdEnhanceResponsiveTables === 'function') {
      window.fdEnhanceResponsiveTables();
    }
  }

  function patchAnalyticsSubnav() {
    if (window.__fdAnalyticsSubnavPatched || typeof window.switchAnalyticsSectionTab !== 'function') return;
    window.__fdAnalyticsSubnavPatched = true;
    var orig = window.switchAnalyticsSectionTab;
    window.switchAnalyticsSectionTab = function (tab, options) {
      var active = orig.apply(this, arguments);
      if (isFiloAnalyticsApp()) {
        syncAnalyticsHrChrome(active || tab);
        requestAnimationFrame(function () {
          syncAnalyticsHrChrome(active || tab);
        });
      }
      return active;
    };
  }

  function patchLoader() {
    if (window.__fdAnalyticsPatched) return;
    window.__fdAnalyticsPatched = true;

    if (typeof window.loadAnalytics === 'function') {
      var orig = window.loadAnalytics;
      window.loadAnalytics = async function () {
        if (isFiloAnalyticsApp() && window.brandId) showAnalyticsLoadingState();
        try {
          await orig.apply(this, arguments);
        } finally {
          clearAnalyticsLoadingState();
        }
        if (isFiloAnalyticsApp()) enhanceAnalyticsDom();
      };
    }
  }

  function patchNav() {
    if (window.__fdAnalyticsNavPatched || typeof window.nav !== 'function') return;
    window.__fdAnalyticsNavPatched = true;
    var orig = window.nav;
    window.nav = function (sectionId, options) {
      var out = orig.apply(this, arguments);
      options = options || {};
      var resolved = typeof window.resolveNavTarget === 'function'
        ? window.resolveNavTarget(sectionId, options)
        : { section: sectionId, tab: options.tab || '' };
      if (resolved.section === 'analytics' || sectionId === 'analytics' || sectionId === 'activity-log') {
        setTimeout(function () {
          if (!isFiloAnalyticsApp()) return;
          enhanceAnalyticsDom();
          syncAnalyticsHrChrome(resolved.tab || (sectionId === 'activity-log' ? 'activity-log' : 'metrics'));
        }, 120);
      }
      return out;
    };
  }

  function patchApplyNavNaming() {
    if (window.__fdAnalyticsNavNamingPatched || !window.FD_NAV) return;
    window.__fdAnalyticsNavNamingPatched = true;
    var orig = window.FD_NAV.applyNavNaming;
    if (typeof orig !== 'function') return;
    window.FD_NAV.applyNavNaming = function () {
      var out = orig.apply(this, arguments);
      if (isFiloAnalyticsApp()) {
        syncAnalyticsHrChrome();
        requestAnimationFrame(function () {
          syncAnalyticsHrChrome();
        });
      }
      return out;
    };
  }

  function init() {
    if (!isFiloAnalyticsApp()) return;
    patchLoader();
    patchAnalyticsSubnav();
    patchNav();
    patchApplyNavNaming();
    enhanceAnalyticsDom();
  }

  window.fdInitAnalytics = init;
  window.fdSyncAnalyticsHrChrome = syncAnalyticsHrChrome;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
