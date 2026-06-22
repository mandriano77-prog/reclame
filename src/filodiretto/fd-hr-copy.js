/**
 * Filo HR — glossario unificato (Dipendenti, CTA, microcopy header pagina).
 */
(function () {
  'use strict';

  function isFiloHr() {
    if (document.documentElement.classList.contains('a2w-shell')) return false;
    try {
      if (window.__2WALLET_PRODUCT_LOCK__ === 'hr') return true;
    } catch (_) {}
    if (document.documentElement.getAttribute('data-app') === 'filodiretto') return true;
    return typeof window.isHrDashboard === 'function' && window.isHrDashboard();
  }

  function applyTemplatesSubtitle() {
    var section = document.getElementById('templates');
    if (!section || section.querySelector('[data-fd-templates-lead]')) return;
    if (typeof window.enhancePageHeaders === 'function') window.enhancePageHeaders();
    var lead = document.createElement('p');
    lead.className = 'page-header__desc';
    lead.setAttribute('data-fd-templates-lead', '1');
    lead.textContent = 'Crea e gestisci i layout dei pass Wallet per i tuoi dipendenti.';
    var main = section.querySelector('header.page-header .page-header__main');
    if (main) {
      main.appendChild(lead);
      return;
    }
    var h1 = section.querySelector('h1');
    if (h1) h1.insertAdjacentElement('afterend', lead);
  }

  function applyLeadsChrome() {
    if (!isFiloHr()) return;

    stripLeadsHeaderDuplicates();

    var pageMenu = document.getElementById('contactsPageMenu');
    if (pageMenu) {
      pageMenu.hidden = true;
      pageMenu.style.display = 'none';
    }
  }

  function stripLeadsHeaderDuplicates() {
    var headerActions = document.getElementById('a2wContactsHeaderActions');
    if (headerActions) {
      headerActions.hidden = true;
      headerActions.setAttribute('aria-hidden', 'true');
      headerActions.style.display = 'none';
    }
  }

  function patchMenuCopy() {
    if (!isFiloHr() || window.__fdHrCopyPatched) return;
    window.__fdHrCopyPatched = true;

    var orig = window.applyProductMenuCopy;
    if (typeof orig !== 'function') return;

    window.applyProductMenuCopy = function (line) {
      orig.call(this, line);
      if (line === 'hr' || isFiloHr()) applyLeadsChrome();
    };
  }

  function patchNav() {
    if (!isFiloHr()) return;
    var origNav = window.nav;
    if (typeof origNav !== 'function' || window.__fdHrCopyNav) return;
    window.__fdHrCopyNav = true;
    window.nav = function (id) {
      var r = origNav.apply(this, arguments);
      var done = function () {
        if (id === 'leads') applyLeadsChrome();
        if (id === 'templates') applyTemplatesSubtitle();
      };
      if (r && typeof r.then === 'function') return r.then(done);
      setTimeout(done, 0);
      return r;
    };
  }

  function applyFiloProductBranding() {
    if (!isFiloHr()) return;
    var title = (function () {
      try {
        return (window.__2WALLET_PRODUCT_TITLE__ || 'FiloDiretto').trim();
      } catch (_) {
        return 'FiloDiretto';
      }
    })();
    document.querySelectorAll('.chrome-product-title').forEach(function (el) {
      if ((el.textContent || '').trim() === 'Ads2Wallet') el.textContent = title;
    });
    var headerBrand = document.getElementById('headerBrandName');
    if (headerBrand && !window.brandId && (headerBrand.textContent || '').trim() === 'Ads2Wallet') {
      headerBrand.textContent = title;
    }
    var breadcrumbBrand = document.getElementById('breadcrumbBrand');
    if (breadcrumbBrand && !window.brandId && (breadcrumbBrand.textContent || '').trim() === 'Ads2Wallet') {
      breadcrumbBrand.textContent = title;
    }
  }

  function boot() {
    if (!isFiloHr()) return;
    patchMenuCopy();
    patchNav();
    applyLeadsChrome();
    applyTemplatesSubtitle();
    applyFiloProductBranding();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
