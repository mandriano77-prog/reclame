/**
 * FD — Filo HR nav: keep legacy Campagne hidden after updateNavState() resets inline styles.
 */
(function () {
  'use strict';

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

  function patchUpdateNavState() {
    if (window.__fdNavPatched || typeof window.updateNavState !== 'function') return;
    window.__fdNavPatched = true;
    var orig = window.updateNavState;
    window.updateNavState = function () {
      orig.apply(this, arguments);
      applyFiloNavMask();
    };
  }

  function initFdNav() {
    if (!isFiloNavApp()) return;
    patchUpdateNavState();
    applyFiloNavMask();
  }

  window.fdApplyFiloNavMask = applyFiloNavMask;
  window.fdInitNav = initFdNav;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFdNav);
  } else {
    initFdNav();
  }
})();
