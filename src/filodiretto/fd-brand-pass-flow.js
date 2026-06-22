/**
 * FD — Brand & Pass setup flow indicators (Identità → Media → Template → Pass → Dipendenti).
 */
(function () {
  'use strict';

  var STEPS = [
    { id: 'brand-identity', label: 'Identità' },
    { id: 'media-library', label: 'Media' },
    { id: 'templates', label: 'Template Pass' },
    { id: 'passes', label: 'Pass emessi' },
    { id: 'leads', label: 'Dipendenti' }
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

  function renderFlowBar(activeId) {
    return (
      '<nav class="fd-brand-pass-flow" aria-label="Percorso configurazione pass">' +
      STEPS.map(function (step, idx) {
        var active = step.id === activeId ? ' is-active' : '';
        var sep = idx < STEPS.length - 1 ? '<span class="fd-brand-pass-flow__sep" aria-hidden="true">›</span>' : '';
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
      }).join('') +
      '</nav>'
    );
  }

  function injectFlowBar(sectionId) {
    var section = document.getElementById(sectionId);
    if (!section || section.querySelector('.fd-brand-pass-flow')) return;
    var page = section.querySelector('.a2w-media-page') || section;
    var anchor =
      page.querySelector('.a2w-media-page-head') ||
      page.querySelector('.fd-media-header') ||
      page.querySelector('h1.page-title, h1.sec-title');
    var host = document.createElement('div');
    host.className = 'fd-brand-pass-flow-host';
    host.innerHTML = renderFlowBar(sectionId);
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
    var header = page.querySelector('.a2w-media-page-head, .fd-media-header');
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

  function initFdBrandPassFlow() {
    if (!isFiloFlowApp()) return;
    patchBrandSnapshot();
    STEPS.forEach(function (s) {
      injectFlowBar(s.id);
    });
    var origNav = window.nav;
    if (typeof origNav === 'function' && !window.__fdFlowNavPatched) {
      window.__fdFlowNavPatched = true;
      window.nav = function (id) {
        var r = origNav.apply(this, arguments);
        var done = function () {
          if (STEPS.some(function (s) {
            return s.id === id;
          })) {
            injectFlowBar(id);
          }
        };
        if (r && typeof r.then === 'function') return r.then(done);
        setTimeout(done, 0);
        return r;
      };
    }
  }

  window.fdInitBrandPassFlow = initFdBrandPassFlow;
  window.fdRelocateBrandPassFlowBar = relocateFlowBarOutOfHeader;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFdBrandPassFlow);
  } else {
    initFdBrandPassFlow();
  }
})();
