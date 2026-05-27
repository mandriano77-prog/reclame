/**
 * FD-01 — FiloDiretto header chrome (logo home, account tooltip). No-op on ads2wallet.
 */
(function () {
  'use strict';

  function isFiloApp() {
    if (document.documentElement.classList.contains('a2w-shell')) return false;
    try {
      if (window.__2WALLET_PRODUCT_LOCK__ === 'hr') return true;
    } catch (_) {}
    return document.documentElement.getAttribute('data-shell') === 'light';
  }

  function fdGoHome() {
    if (typeof nav === 'function') {
      try {
        nav('welcome');
      } catch (_) {}
    }
    try {
      const target = '/dashboard/home';
      const path = window.location.pathname.replace(/\/$/, '');
      if (path !== target) {
        history.pushState({ fdHome: true }, '', target);
      }
    } catch (_) {}
  }

  function fdSyncHomeFromPath() {
    const path = window.location.pathname.replace(/\/$/, '');
    if (!path.endsWith('/dashboard/home')) return;
    if (typeof nav !== 'function') return;
    const welcome = document.getElementById('welcome');
    if (welcome && welcome.classList.contains('active')) return;
    try {
      nav('welcome');
    } catch (_) {}
  }

  function fdEnhanceLogo() {
    const logo = document.querySelector('.sidebar .logo');
    if (!logo || logo.querySelector('.fd-logo-link')) return;
    const link = document.createElement('a');
    link.href = '/dashboard/home';
    link.className = 'fd-logo-link';
    link.setAttribute('aria-label', 'FiloDiretto — Home');
    while (logo.firstChild) {
      link.appendChild(logo.firstChild);
    }
    logo.appendChild(link);
    link.addEventListener('click', (e) => {
      e.preventDefault();
      fdGoHome();
    });
  }

  function fdEnhanceBreadcrumbProduct() {
    const brandEl = document.getElementById('breadcrumbBrand');
    if (!brandEl || brandEl.dataset.fdHomeBound === '1') return;
    const productTitle = (brandEl.textContent || '').trim();
    const appTitle = (function () {
      try {
        return (window.__2WALLET_PRODUCT_TITLE__ || '').trim();
      } catch (_) {
        return '';
      }
    })();
    const isProductCrumb = !window.brandId && (
      productTitle === 'Filo Diretto'
      || productTitle === 'FiloDiretto'
      || (appTitle && productTitle === appTitle)
    );
    if (!isProductCrumb) return;
    brandEl.dataset.fdHomeBound = '1';
    brandEl.classList.add('fd-breadcrumb-home');
    brandEl.setAttribute('role', 'link');
    brandEl.setAttribute('tabindex', '0');
    brandEl.setAttribute('title', 'Vai alla home');
    const go = (e) => {
      if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
      if (e.type === 'keydown') e.preventDefault();
      fdGoHome();
    };
    brandEl.addEventListener('click', go);
    brandEl.addEventListener('keydown', go);
  }

  function fdEnhanceUserMenu() {
    const trigger = document.getElementById('userMenuTrigger');
    if (!trigger || trigger.dataset.fdEnhanced === '1') return;
    trigger.dataset.fdEnhanced = '1';
    trigger.setAttribute('data-fd-tooltip', 'Account');
    trigger.setAttribute('title', 'Account');
    trigger.setAttribute('aria-label', 'Menu account');
    if (!trigger.querySelector('.user-menu-chevron')) {
      const chevron = document.createElement('span');
      chevron.className = 'user-menu-chevron';
      chevron.setAttribute('aria-hidden', 'true');
      chevron.textContent = '▾';
      trigger.appendChild(chevron);
    }
  }

  function initFdHeader() {
    if (!isFiloApp()) return;
    document.documentElement.setAttribute('data-app', 'filodiretto');
    fdEnhanceLogo();
    fdEnhanceUserMenu();
    fdEnhanceBreadcrumbProduct();
    fdSyncHomeFromPath();
    window.addEventListener('popstate', fdSyncHomeFromPath);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFdHeader);
  } else {
    initFdHeader();
  }

  const origSyncBreadcrumb = window.syncBreadcrumb;
  if (typeof origSyncBreadcrumb === 'function' && !window.__fdBreadcrumbPatched) {
    window.__fdBreadcrumbPatched = true;
    window.syncBreadcrumb = function (sectionId) {
      origSyncBreadcrumb(sectionId);
      fdEnhanceBreadcrumbProduct();
    };
  }
})();
