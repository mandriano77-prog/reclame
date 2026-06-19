/**
 * Dashboard sub-navigation — tab panels + path aliases (Contatti/Audience, Analytics/Log).
 */
(function (global) {
  'use strict';

  var NAV_ALIASES = {
    audiences: { section: 'leads', tab: 'audience' },
    'activity-log': { section: 'analytics', tab: 'activity-log' }
  };

  var PATH_ROUTES = [
    { match: /\/dashboard\/contatti\/audience\/?$/i, section: 'leads', tab: 'audience' },
    { match: /\/dashboard\/contatti\/?$/i, section: 'leads', tab: 'contacts' },
    { match: /\/dashboard\/analytics\/log\/?$/i, section: 'analytics', tab: 'activity-log' },
    { match: /\/dashboard\/analytics\/?$/i, section: 'analytics', tab: 'metrics' }
  ];

  var HASH_ALIASES = {
    audiences: { section: 'leads', tab: 'audience' },
    'activity-log': { section: 'analytics', tab: 'activity-log' }
  };

  function normalizeTab(section, tab) {
    if (section === 'leads') return tab === 'audience' ? 'audience' : 'contacts';
    if (section === 'analytics') return tab === 'activity-log' ? 'activity-log' : 'metrics';
    return tab || '';
  }

  function resolveNavTarget(sectionId, options) {
    options = options || {};
    var raw = sectionId || '';
    if (NAV_ALIASES[raw]) {
      return {
        section: NAV_ALIASES[raw].section,
        tab: options.tab || NAV_ALIASES[raw].tab,
        raw: raw
      };
    }
    return { section: raw, tab: options.tab || '', raw: raw };
  }

  function parseLocationRoute() {
    var path = String(global.location.pathname || '').replace(/\/$/, '');
    var i;
    for (i = 0; i < PATH_ROUTES.length; i++) {
      if (PATH_ROUTES[i].match.test(path)) {
        return { section: PATH_ROUTES[i].section, tab: PATH_ROUTES[i].tab };
      }
    }
    var hash = String(global.location.hash || '').replace(/^#/, '').toLowerCase();
    if (hash && HASH_ALIASES[hash]) {
      return { section: HASH_ALIASES[hash].section, tab: HASH_ALIASES[hash].tab };
    }
    return null;
  }

  function navItemHighlightId(sectionId, tab) {
    tab = normalizeTab(sectionId, tab);
    if (sectionId === 'leads' || sectionId === 'audiences') return 'leads';
    if (sectionId === 'activity-log' || (sectionId === 'analytics' && tab === 'activity-log')) return 'activity-log';
    if (sectionId === 'analytics') return 'analytics';
    return sectionId;
  }

  function navHighlightSection(sectionId, tab) {
    return navItemHighlightId(sectionId, tab);
  }

  function breadcrumbLabel(sectionId, tab) {
    tab = normalizeTab(sectionId, tab);
    if (sectionId === 'leads' && tab === 'audience') return 'Audience';
    if (sectionId === 'analytics' && tab === 'activity-log') return 'Log Attività';
    if (typeof global.getSectionPageTitle === 'function') return global.getSectionPageTitle(navHighlightSection(sectionId, tab));
    return sectionId;
  }

  function sectionPath(sectionId, tab) {
    tab = normalizeTab(sectionId, tab);
    if (sectionId === 'leads') {
      return tab === 'audience' ? '/dashboard/contatti/audience' : '/dashboard/contatti';
    }
    if (sectionId === 'analytics') {
      return tab === 'activity-log' ? '/dashboard/analytics/log' : '/dashboard/analytics';
    }
    return global.location.pathname;
  }

  function syncSectionUrl(sectionId, tab) {
    tab = normalizeTab(sectionId, tab);
    var path = sectionPath(sectionId, tab);
    var u = new URLSearchParams(global.location.search);
    var qs = u.toString();
    var next = path + (qs ? '?' + qs : '');
    if (global.location.pathname + (global.location.search || '') !== next && (global.location.pathname !== path || global.location.search !== (qs ? '?' + qs : ''))) {
      global.history.replaceState({ section: sectionId, tab: tab }, '', next);
    }
    if (global.location.hash) {
      global.history.replaceState({ section: sectionId, tab: tab }, '', next);
    }
  }

  function setTabUi(prefix, tab, tabs) {
    tabs.forEach(function (t) {
      var btn = document.getElementById(prefix + 'Tab_' + t);
      var panel = document.getElementById(prefix + 'TabPanel_' + t);
      var on = t === tab;
      if (btn) {
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
        btn.tabIndex = on ? 0 : -1;
      }
      if (panel) {
        panel.hidden = !on;
        panel.setAttribute('aria-hidden', on ? 'false' : 'true');
      }
    });
  }

  function getLeadsSectionTab() {
    var panel = document.getElementById('leadsTabPanel_audience');
    if (panel && !panel.hidden) return 'audience';
    return 'contacts';
  }

  function getAnalyticsSectionTab() {
    var panel = document.getElementById('analyticsTabPanel_activity');
    if (panel && !panel.hidden) return 'activity-log';
    return 'metrics';
  }

  function switchLeadsSectionTab(tab, options) {
    options = options || {};
    tab = normalizeTab('leads', tab);
    setTabUi('leads', tab, ['contacts', 'audience']);
    if (!options.skipUrl && typeof global.getActiveSectionId === 'function' && global.getActiveSectionId() === 'leads') {
      syncSectionUrl('leads', tab);
    }
    if (!options.skipLoad) {
      if (tab === 'audience' && typeof global.loadAudiences === 'function') {
        global.loadAudiences();
      } else if (tab === 'contacts' && typeof global.loadLeads === 'function') {
        global.loadLeads();
      }
    }
    if (typeof global.fdRbacHook === 'function' && tab === 'audience') global.fdRbacHook('audiences');
    if (!options.skipBreadcrumb && typeof global.syncBreadcrumb === 'function' && typeof global.getActiveSectionId === 'function' && global.getActiveSectionId() === 'leads') {
      global.syncBreadcrumb('leads', tab);
    }
    if (!options.skipBreadcrumb && typeof global.syncSectionDocumentTitle === 'function') {
      global.syncSectionDocumentTitle('leads', tab);
    }
    if (!options.skipNavHighlight && typeof global.syncNavAriaCurrent === 'function') {
      global.syncNavAriaCurrent('leads', tab);
    }
    return tab;
  }

  function switchAnalyticsSectionTab(tab, options) {
    options = options || {};
    tab = normalizeTab('analytics', tab);
    setTabUi('analytics', tab, ['metrics', 'activity-log']);
    if (!options.skipUrl && typeof global.getActiveSectionId === 'function' && global.getActiveSectionId() === 'analytics') {
      syncSectionUrl('analytics', tab);
    }
    if (!options.skipLoad) {
      if (tab === 'activity-log' && typeof global.loadActivityLog === 'function') {
        global.loadActivityLog();
      } else if (tab === 'metrics' && typeof global.loadAnalytics === 'function') {
        global.loadAnalytics();
      }
    }
    if (typeof global.fdRbacHook === 'function' && tab === 'activity-log') global.fdRbacHook('activity-log');
    if (!options.skipBreadcrumb && typeof global.syncBreadcrumb === 'function' && typeof global.getActiveSectionId === 'function' && global.getActiveSectionId() === 'analytics') {
      global.syncBreadcrumb('analytics', tab);
    }
    if (!options.skipBreadcrumb && typeof global.syncSectionDocumentTitle === 'function') {
      global.syncSectionDocumentTitle('analytics', tab);
    }
    if (!options.skipNavHighlight && typeof global.syncNavAriaCurrent === 'function') {
      global.syncNavAriaCurrent('analytics', tab);
    }
    return tab;
  }

  function applySubnavForSection(sectionId, tab, options) {
    options = options || {};
    if (sectionId === 'leads') {
      switchLeadsSectionTab(tab || 'contacts', {
        skipUrl: options.skipUrl,
        skipLoad: options.skipLoad,
        skipBreadcrumb: true
      });
    } else if (sectionId === 'analytics') {
      switchAnalyticsSectionTab(tab || 'metrics', {
        skipUrl: options.skipUrl,
        skipLoad: options.skipLoad,
        skipBreadcrumb: true
      });
    }
  }

  function initDashboardSubnavFromLocation() {
    var route = parseLocationRoute();
    if (!route || typeof global.nav !== 'function') return false;
    global.nav(route.section, { tab: route.tab, fromRoute: true });
    return true;
  }

  if (typeof global.addEventListener === 'function') {
    global.addEventListener('popstate', function () {
      var route = parseLocationRoute();
      if (route && typeof global.nav === 'function') {
        global.nav(route.section, { tab: route.tab, fromRoute: true });
      }
    });
  }

  global.DASHBOARD_SUBNAV = {
    resolveNavTarget: resolveNavTarget,
    parseLocationRoute: parseLocationRoute,
    navItemHighlightId: navItemHighlightId,
    navHighlightSection: navHighlightSection,
    breadcrumbLabel: breadcrumbLabel,
    sectionPath: sectionPath,
    syncSectionUrl: syncSectionUrl,
    applySubnavForSection: applySubnavForSection
  };

  global.resolveNavTarget = resolveNavTarget;
  global.parseLocationRoute = parseLocationRoute;
  global.navItemHighlightId = navItemHighlightId;
  global.navHighlightSection = navHighlightSection;
  global.breadcrumbLabel = breadcrumbLabel;
  global.sectionPath = sectionPath;
  global.syncSectionUrl = syncSectionUrl;
  global.getLeadsSectionTab = getLeadsSectionTab;
  global.getAnalyticsSectionTab = getAnalyticsSectionTab;
  global.switchLeadsSectionTab = switchLeadsSectionTab;
  global.switchAnalyticsSectionTab = switchAnalyticsSectionTab;
  global.initDashboardSubnavFromLocation = initDashboardSubnavFromLocation;
})(typeof window !== 'undefined' ? window : global);
