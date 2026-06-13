/**
 * Filo HR — remove legacy UTM "Campagne" section (orphan UI + redundant fetches).
 */
(function () {
  'use strict';

  function isFiloApp() {
    if (document.documentElement.getAttribute('data-app') === 'filodiretto') return true;
    try {
      if (window.__2WALLET_PRODUCT_LOCK__ === 'hr') return true;
    } catch (_) {}
    return false;
  }

  function purgeLegacyCampaignsUi() {
    document.querySelectorAll('.nav-item[data-section-id="campaigns"]').forEach(function (el) {
      el.remove();
    });
    var section = document.getElementById('campaigns');
    if (section) section.remove();
  }

  function patchNavCampaignsRedirect() {
    if (window.__fdLegacyCampaignsNavPatch || typeof window.nav !== 'function') return;
    window.__fdLegacyCampaignsNavPatch = true;
    var orig = window.nav;
    window.nav = function (id) {
      if (id === 'campaigns') {
        id = typeof window.getDefaultBrandSection === 'function'
          ? window.getDefaultBrandSection()
          : 'welcome';
      }
      return orig.apply(this, arguments);
    };
  }

  function init() {
    if (!isFiloApp()) return;
    purgeLegacyCampaignsUi();
    patchNavCampaignsRedirect();
  }

  window.fdPurgeLegacyCampaignsUi = purgeLegacyCampaignsUi;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
