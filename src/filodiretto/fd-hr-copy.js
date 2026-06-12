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

    var add = document.getElementById('a2wContactsAddBtn');
    if (add) {
      add.textContent = '＋ Aggiungi dipendente';
      add.setAttribute('aria-label', 'Aggiungi dipendente');
    }

    var imp = document.getElementById('a2wContactsImportBtn');
    if (imp) {
      imp.textContent = 'Importa dipendenti';
      imp.setAttribute('aria-label', 'Importa dipendenti da CSV o Excel');
    }

    var pageMenu = document.getElementById('contactsPageMenuBtn');
    if (pageMenu) pageMenu.setAttribute('aria-label', 'Menu pagina Dipendenti');

    var cardTitle = document.getElementById('contactsCardATitle');
    if (cardTitle) cardTitle.textContent = 'Anagrafica dipendenti';
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

  function boot() {
    if (!isFiloHr()) return;
    patchMenuCopy();
    patchNav();
    applyLeadsChrome();
    applyTemplatesSubtitle();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
