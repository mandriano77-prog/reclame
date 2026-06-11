/**
 * FD — Filo HR nav: hide ads-only sections, sync accordion groups + active state.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'filo_nav_group';
  var PINNED_MAX_ITEMS = 2;

  function isFiloNavApp() {
    if (document.documentElement.getAttribute('data-app') === 'filodiretto') return true;
    try {
      if (window.__2WALLET_PRODUCT_LOCK__ === 'hr') return true;
    } catch (_) {}
    return false;
  }

  function hideCampaignsNav() {
    document.querySelectorAll('.nav-item[data-section-id="campaigns"]').forEach(function (el) {
      el.style.display = 'none';
      el.setAttribute('aria-hidden', 'true');
      el.classList.add('fd-nav-hidden');
    });
    var section = document.getElementById('campaigns');
    if (section) {
      section.style.display = 'none';
      section.setAttribute('aria-hidden', 'true');
    }
  }

  function applyFiloNavMask() {
    if (!isFiloNavApp()) return;
    if (typeof window.applyLegacyCampaignsUiMask === 'function') {
      window.applyLegacyCampaignsUiMask();
    }
    hideCampaignsNav();
  }

  function sectionIdFromNavItem(el) {
    if (!el) return '';
    var sid = el.getAttribute('data-section-id');
    if (sid) return sid;
    var match = (el.getAttribute('onclick') || '').match(/nav\('([^']+)'\)/);
    return match ? match[1] : '';
  }

  function sectionToGroup(sectionId) {
    if (!sectionId || sectionId === 'welcome') return 'dashboard';
    var nav = window.FD_NAV && window.FD_NAV.NAV;
    if (!nav) return null;
    for (var i = 0; i < nav.length; i++) {
      var sec = nav[i];
      for (var j = 0; j < sec.items.length; j++) {
        if (sec.items[j].id === sectionId) return sec.id;
      }
    }
    return null;
  }

  function getActiveSectionForGroups() {
    if (typeof window.getActiveSectionId === 'function') {
      var sid = window.getActiveSectionId();
      if (sid) return sid;
    }
    var active = document.querySelector('.nav-item.active');
    if (active) return sectionIdFromNavItem(active);
    return 'welcome';
  }

  function isNavItemVisible(el) {
    if (!el) return false;
    if (el.style.display === 'none') return false;
    if (el.classList.contains('fd-nav-hidden')) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    return true;
  }

  function visibleItemsCount(details) {
    var n = 0;
    details.querySelectorAll('.nav-item').forEach(function (el) {
      if (isNavItemVisible(el)) n += 1;
    });
    return n;
  }

  function syncNavGroupA11y(details) {
    var summary = details.querySelector('summary.nav-group-label');
    if (!summary) return;
    summary.setAttribute('aria-expanded', details.open ? 'true' : 'false');
  }

  function syncNavGroups(sectionId) {
    if (!isFiloNavApp()) return;
    var activeSection = sectionId || getActiveSectionForGroups();
    var activeGroup = sectionToGroup(activeSection);

    document.querySelectorAll('.nav-group[data-nav-group]').forEach(function (details) {
      var gid = details.dataset.navGroup;
      var pinned = visibleItemsCount(details) <= PINNED_MAX_ITEMS;

      details.classList.toggle('nav-group--pinned', pinned);
      if (pinned) details.setAttribute('open', '');

      var isActive = gid === activeGroup;
      details.classList.toggle('nav-group--active', isActive);
      if (isActive) details.setAttribute('open', '');

      syncNavGroupA11y(details);
    });
  }

  function restoreNavGroupPrefs() {
    if (!isFiloNavApp()) return;
    document.querySelectorAll('.nav-group[data-nav-group]').forEach(function (details) {
      if (details.classList.contains('nav-group--pinned')) return;
      var id = details.dataset.navGroup;
      try {
        var saved = localStorage.getItem(STORAGE_KEY + ':' + id);
        if (saved === '0') details.removeAttribute('open');
        else if (saved === '1') details.setAttribute('open', '');
      } catch (_) {}
    });
  }

  function bindNavGroups() {
    document.querySelectorAll('.nav-group[data-nav-group]').forEach(function (details) {
      if (details.dataset.fdNavGroupBound === '1') return;
      details.dataset.fdNavGroupBound = '1';
      details.addEventListener('toggle', function () {
        if (!isFiloNavApp()) return;
        var id = details.dataset.navGroup;
        var activeGroup = sectionToGroup(getActiveSectionForGroups());

        if (details.classList.contains('nav-group--pinned')) {
          details.setAttribute('open', '');
          return;
        }

        if (id === activeGroup && !details.open) {
          details.setAttribute('open', '');
          return;
        }

        try {
          localStorage.setItem(STORAGE_KEY + ':' + id, details.open ? '1' : '0');
        } catch (_) {}
        syncNavGroupA11y(details);
      });
    });
  }

  function fdInitNavGroups() {
    if (!isFiloNavApp()) return false;
    bindNavGroups();
    restoreNavGroupPrefs();
    syncNavGroups(getActiveSectionForGroups());
    return true;
  }

  function patchUpdateNavState() {
    if (window.__fdNavPatched || typeof window.updateNavState !== 'function') return;
    window.__fdNavPatched = true;
    var orig = window.updateNavState;
    window.updateNavState = function () {
      orig.apply(this, arguments);
      applyFiloNavMask();
      syncNavGroups(getActiveSectionForGroups());
    };
  }

  function initFdNav() {
    if (!isFiloNavApp()) return;
    patchUpdateNavState();
    applyFiloNavMask();
  }

  window.fdApplyFiloNavMask = applyFiloNavMask;
  window.fdSyncNavGroups = syncNavGroups;
  window.fdInitNavGroups = fdInitNavGroups;
  window.fdSectionToNavGroup = sectionToGroup;
  window.fdInitNav = initFdNav;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFdNav);
  } else {
    initFdNav();
  }
})();
