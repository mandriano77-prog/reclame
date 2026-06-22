/**
 * Public landing / pass URLs for dashboard UI (FiloDiretto Studio).
 * Source of truth: window.__PUBLIC_BASE_URL__ from /dashboard/boot.js (CUSTOM_DOMAIN / PUBLIC_BASE_URL).
 */
(function (global) {
  'use strict';

  function getPublicBaseUrl() {
    try {
      var injected = global.__PUBLIC_BASE_URL__;
      if (injected) return String(injected).replace(/\/+$/, '');
    } catch (_) {}
    try {
      if (global.location && global.location.origin && global.location.origin !== 'null') {
        return global.location.origin;
      }
    } catch (_) {}
    return '';
  }

  function getPublicLandingUrl(slug) {
    var safe = String(slug || '').trim().replace(/^\/+|\/+$/g, '');
    if (!safe) return '';
    var base = getPublicBaseUrl();
    if (!base) return '/' + safe;
    return base + '/' + encodeURIComponent(safe).replace(/%2F/g, '/');
  }

  function getPublicPathUrl(path) {
    var clean = String(path || '').trim().replace(/^\/+/, '');
    var base = getPublicBaseUrl();
    if (!base) return clean ? '/' + clean : '';
    return clean ? base + '/' + clean : base;
  }

  global.getPublicBaseUrl = getPublicBaseUrl;
  global.getPublicLandingUrl = getPublicLandingUrl;
  global.getPublicPathUrl = getPublicPathUrl;
})(typeof window !== 'undefined' ? window : globalThis);
