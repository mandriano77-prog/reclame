/**
 * FD — Section flow pills (Brand & Pass, Growth Activation, Insights).
 */
(function () {
  'use strict';

  var FLOW_GROUPS = [
    {
      id: 'brand-pass',
      ariaLabel: 'Percorso Brand & Pass',
      steps: [
        { id: 'brand-identity', label: 'Identità' },
        { id: 'media-library', label: 'Media' },
        { id: 'templates', label: 'Template Pass' },
        { id: 'passes', label: 'Pass emessi' },
        { id: 'leads', label: 'Dipendenti' }
      ]
    },
    {
      id: 'growth-activation',
      ariaLabel: 'Percorso Growth Activation',
      steps: [
        { id: 'push', label: 'Push' },
        { id: 'instant-win', label: 'Reward' },
        { id: 'gamification', label: 'Challenge' },
        { id: 'conventions', label: 'Convenzioni' },
        { id: 'pga-catalog', label: 'PGA Catalog' },
        { id: 'pga-engagement', label: 'Engagement Coin' }
      ]
    },
    {
      id: 'insights',
      ariaLabel: 'Percorso Insights',
      steps: [
        { id: 'analytics', label: 'Analytics' },
        { id: 'activity-log', label: 'Log Attività' }
      ]
    }
  ];

  function isFiloFlowApp() {
    if (document.documentElement.classList.contains('a2w-shell')) return false;
    try {
      if (window.__2WALLET_PRODUCT_LOCK__ === 'hr') return true;
    } catch (_) {}
    return document.documentElement.getAttribute('data-app') === 'filodiretto';
  }

  function esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function findGroupForSection(sectionId) {
    for (var i = 0; i < FLOW_GROUPS.length; i++) {
      var group = FLOW_GROUPS[i];
      for (var j = 0; j < group.steps.length; j++) {
        if (group.steps[j].id === sectionId) return group;
      }
    }
    return null;
  }

  function resolveHostSectionId(sectionId) {
    if (sectionId === 'activity-log') return 'analytics';
    return sectionId;
  }

  function allStepIds() {
    var ids = [];
    FLOW_GROUPS.forEach(function (group) {
      group.steps.forEach(function (step) {
        ids.push(step.id);
      });
    });
    return ids;
  }

  function renderFlowBar(group, activeId) {
    return (
      '<nav class="fd-brand-pass-flow" data-flow-group="' +
      esc(group.id) +
      '" aria-label="' +
      esc(group.ariaLabel) +
      '">' +
      group.steps
        .map(function (step, idx) {
          var active = step.id === activeId ? ' is-active' : '';
          var sep =
            idx < group.steps.length - 1
              ? '<span class="fd-brand-pass-flow__sep" aria-hidden="true">›</span>'
              : '';
          return (
            '<button type="button" class="fd-brand-pass-flow__step' +
            active +
            '" data-fd-nav="' +
            esc(step.id) +
            '" onclick="nav(\'' +
            esc(step.id) +
            '\')">' +
            esc(step.label) +
            '</button>' +
            sep
          );
        })
        .join('') +
      '</nav>'
    );
  }

  function findFlowInsertPoint(page) {
    return (
      page.querySelector('.fd-page-header') ||
      page.querySelector('.a2w-media-page-head') ||
      page.querySelector('.fd-media-header') ||
      page.querySelector('h1.page-title, h1.sec-title, h1.fd-page-header__title')
    );
  }

  function injectFlowBar(sectionId) {
    if (!isFiloFlowApp()) return;
    var group = findGroupForSection(sectionId);
    if (!group) return;

    var hostId = resolveHostSectionId(sectionId);
    var section = document.getElementById(hostId);
    if (!section) return;

    var page = section.querySelector('.a2w-media-page') || section;
    var host = section.querySelector('.fd-brand-pass-flow-host');
    if (host) {
      host.innerHTML = renderFlowBar(group, sectionId);
      relocateFlowBarOutOfHeader(section);
      return;
    }

    var anchor = findFlowInsertPoint(page);
    host = document.createElement('div');
    host.className = 'fd-brand-pass-flow-host';
    host.innerHTML = renderFlowBar(group, sectionId);

    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(host, anchor);
    } else {
      page.insertBefore(host, page.firstChild);
    }
    relocateFlowBarOutOfHeader(section);
  }

  function relocateFlowBarOutOfHeader(section) {
    if (!section) return;
    var page = section.querySelector('.a2w-media-page') || section;
    var header = page.querySelector('.fd-page-header, .a2w-media-page-head, .fd-media-header');
    var flowHost = section.querySelector('.fd-brand-pass-flow-host');
    if (!flowHost || !header) return;
    if (flowHost.parentNode === header || header.contains(flowHost)) {
      header.parentNode.insertBefore(flowHost, header);
    }
  }

  function patchBrandSnapshot() {
    if (window.__fdBrandSnapPatched || typeof window.loadBrandIdentity !== 'function') return;
    window.__fdBrandSnapPatched = true;
    var orig = window.loadBrandIdentity;
    window.loadBrandIdentity = async function () {
      await orig.apply(this, arguments);
      try {
        var data =
          typeof window.a2wBiCollectFormData === 'function' ? window.a2wBiCollectFormData() : {};
        window.__fdBrandPassSnapshot = {
          id: window.brandId,
          hr_email: data.supportEmail || data.hrEmail,
          support_email: data.supportEmail
        };
      } catch (_) {}
    };
  }

  function patchAnalyticsTabSwitch() {
    if (window.__fdFlowAnalyticsTabPatched || typeof window.switchAnalyticsSectionTab !== 'function') {
      return;
    }
    window.__fdFlowAnalyticsTabPatched = true;
    var orig = window.switchAnalyticsSectionTab;
    window.switchAnalyticsSectionTab = function (tab, options) {
      var out = orig.apply(this, arguments);
      var activeTab =
        tab || (typeof window.getAnalyticsSectionTab === 'function' ? window.getAnalyticsSectionTab() : 'metrics');
      injectFlowBar(activeTab === 'activity-log' ? 'activity-log' : 'analytics');
      return out;
    };
  }

  function initFdSectionFlow() {
    if (!isFiloFlowApp()) return;
    patchBrandSnapshot();
    patchAnalyticsTabSwitch();

    allStepIds().forEach(function (id) {
      injectFlowBar(id);
    });

    var origNav = window.nav;
    if (typeof origNav === 'function' && !window.__fdFlowNavPatched) {
      window.__fdFlowNavPatched = true;
      window.nav = function (id) {
        var r = origNav.apply(this, arguments);
        var done = function () {
          if (allStepIds().indexOf(id) >= 0) injectFlowBar(id);
        };
        if (r && typeof r.then === 'function') return r.then(done);
        setTimeout(done, 0);
        return r;
      };
    }
  }

  window.fdInitBrandPassFlow = initFdSectionFlow;
  window.fdInitSectionFlow = initFdSectionFlow;
  window.fdInjectBrandPassFlowBar = injectFlowBar;
  window.fdInjectSectionFlowBar = injectFlowBar;
  window.fdRelocateBrandPassFlowBar = relocateFlowBarOutOfHeader;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFdSectionFlow);
  } else {
    initFdSectionFlow();
  }
})();
