/**
 * FD-DS FASE 5 — Unified loading / error helpers + Filo patches for table errors.
 */
(function () {
  'use strict';

  var patchRetryTimer = null;
  var patchRetryCount = 0;
  var PATCH_RETRY_MAX = 80;

  function isFiloApp() {
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
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Wrap skeleton markup with consistent aria-busy / aria-live.
   * @param {string} innerHtml
   * @param {{ id?: string, className?: string, label?: string }} [opts]
   */
  function fdRenderLoadingRegion(innerHtml, opts) {
    opts = opts || {};
    var cls = 'fd-loading-region' + (opts.className ? ' ' + opts.className : '');
    return (
      '<div class="' + esc(cls) + '"' +
      (opts.id ? ' id="' + esc(opts.id) + '"' : '') +
      ' aria-busy="true" aria-live="polite"' +
      ' aria-label="' + esc(opts.label || 'Caricamento in corso') + '">' +
      (innerHtml || '') +
      '</div>'
    );
  }

  /**
   * Inline or block error banner using DS tokens.
   * @param {string} message
   * @param {{ title?: string, retryOnclick?: string, retryId?: string, retryLabel?: string, id?: string }} [opts]
   */
  function fdRenderErrorState(message, opts) {
    opts = opts || {};
    var retry = '';
    if (opts.retryOnclick) {
      retry =
        '<button type="button" class="fd-btn fd-btn--secondary fd-error-state__retry"' +
        (opts.retryId ? ' id="' + esc(opts.retryId) + '"' : '') +
        ' onclick="' + esc(opts.retryOnclick) + '">' +
        esc(opts.retryLabel || 'Riprova') +
        '</button>';
    } else if (opts.retryId) {
      retry =
        '<button type="button" class="fd-btn fd-btn--secondary fd-error-state__retry" id="' +
        esc(opts.retryId) +
        '">' +
        esc(opts.retryLabel || 'Riprova') +
        '</button>';
    }
    return (
      '<div class="fd-error-state"' +
      (opts.id ? ' id="' + esc(opts.id) + '"' : '') +
      ' role="alert">' +
      '<p class="fd-error-state__title">' + esc(opts.title || 'Errore di caricamento') + '</p>' +
      '<p class="fd-error-state__desc">' + esc(message || 'Si è verificato un errore.') + '</p>' +
      (retry ? '<div class="fd-error-state__actions">' + retry + '</div>' : '') +
      '</div>'
    );
  }

  function fdRenderTableErrorRow(colspan, message, retryOnclick) {
    var span = Math.max(1, parseInt(colspan, 10) || 1);
    return (
      '<tr class="table-error-row fd-table-error-row"><td colspan="' + span + '">' +
      fdRenderErrorState(message, { retryOnclick: retryOnclick }) +
      '</td></tr>'
    );
  }

  function fdRenderTableErrorBlock(message, retryOnclick) {
    return fdRenderErrorState(message, { retryOnclick: retryOnclick });
  }

  function patchTableErrorRenderers() {
    if (window.__fdPageStatesPatched) return true;
    if (typeof window.renderTableErrorRow !== 'function') return false;
    window.__fdPageStatesPatched = true;
    var baseRow = window.renderTableErrorRow;
    var baseBlock =
      typeof window.renderTableErrorBlock === 'function' ? window.renderTableErrorBlock : null;
    window.renderTableErrorRow = function (colspan, message, retryOnclick) {
      if (!isFiloApp()) return baseRow(colspan, message, retryOnclick);
      return fdRenderTableErrorRow(colspan, message, retryOnclick);
    };
    if (baseBlock) {
      window.renderTableErrorBlock = function (message, retryOnclick) {
        if (!isFiloApp()) return baseBlock(message, retryOnclick);
        return fdRenderTableErrorBlock(message, retryOnclick);
      };
    }
    return true;
  }

  function schedulePatchRetry() {
    if (patchTableErrorRenderers()) {
      if (patchRetryTimer) clearTimeout(patchRetryTimer);
      return;
    }
    patchRetryCount += 1;
    if (patchRetryCount >= PATCH_RETRY_MAX) return;
    patchRetryTimer = setTimeout(schedulePatchRetry, 50);
  }

  function enhanceLoadingRegions(root) {
    if (!root) return;
    root.querySelectorAll(
      '[class*="skeleton"]:not([aria-busy]), [data-fd-loading]:not([aria-busy])'
    ).forEach(function (el) {
      if (el.classList.contains('fd-skeleton') && !el.querySelector('.fd-skeleton, [class*="skeleton"]')) {
        return;
      }
      el.setAttribute('aria-busy', 'true');
      if (!el.hasAttribute('aria-live')) el.setAttribute('aria-live', 'polite');
      if (!el.classList.contains('fd-loading-region')) el.classList.add('fd-loading-region');
    });
  }

  function initFdPageStates() {
    if (!isFiloApp()) return;
    schedulePatchRetry();
    var root = document.getElementById('main-content') || document.body;
    enhanceLoadingRegions(root);
  }

  window.fdRenderLoadingRegion = fdRenderLoadingRegion;
  window.fdRenderErrorState = fdRenderErrorState;
  window.fdRenderTableErrorRow = fdRenderTableErrorRow;
  window.fdRenderTableErrorBlock = fdRenderTableErrorBlock;
  window.fdEnhanceLoadingRegions = enhanceLoadingRegions;
  window.fdInitPageStates = initFdPageStates;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFdPageStates);
  } else {
    initFdPageStates();
  }

  window.addEventListener('load', schedulePatchRetry);
})();
