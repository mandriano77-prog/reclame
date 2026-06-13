/**
 * FD-12 — FiloDiretto danger zone chrome + confirm-by-typing polish.
 */
(function () {
  'use strict';

  var HR_COPY =
    'Rimuove il brand e tutti i dati collegati. Operazione irreversibile.';

  function isFiloDangerApp() {
    if (document.documentElement.classList.contains('a2w-shell')) return false;
    try {
      if (window.__2WALLET_PRODUCT_LOCK__ === 'hr') return true;
    } catch (_) {}
    return document.documentElement.getAttribute('data-app') === 'filodiretto';
  }

  function isConfirmTypingMatch(input, expected) {
    if (window.A2W && window.A2W.UI && typeof window.A2W.UI.isConfirmTypingMatch === 'function') {
      return window.A2W.UI.isConfirmTypingMatch(input, expected);
    }
    return String(input || '').trim() === String(expected || '').trim();
  }

  function pluralCount(n, singular, plural) {
    var num = Number(n) || 0;
    return num + ' ' + (num === 1 ? singular : plural);
  }

  function formatDeleteBrandCounts(counts) {
    if (!counts) return '—';
    var parts = buildDeleteBrandImpactItems(counts);
    return parts.length ? parts.join(', ') : 'nessuna entità collegata';
  }

  function buildDeleteBrandImpactItems(counts) {
    if (!counts) return [];
    var items = [];
    if (counts.passes > 0) items.push(pluralCount(counts.passes, 'pass emesso', 'pass emessi'));
    if (counts.contatti > 0) items.push(pluralCount(counts.contatti, 'contatto', 'contatti'));
    if (counts.campagne > 0) items.push(pluralCount(counts.campagne, 'campagna', 'campagne'));
    return items;
  }

  function resolveBrandConfirmName() {
    var name = '';
    if (typeof window.a2wBiCollectFormData === 'function') {
      try {
        name = String(window.a2wBiCollectFormData().name || '').trim();
      } catch (_) {}
    }
    if (name) return name;
    if (window.currentBrandName && String(window.currentBrandName).trim()) {
      return String(window.currentBrandName).trim();
    }
    if (window.brandId && window.brandsListCache && window.brandsListCache.length) {
      var match = window.brandsListCache.find(function (b) {
        return String(b.id) === String(window.brandId);
      });
      if (match && match.name) return String(match.name).trim();
    }
    return '';
  }

  window.fdFormatDeleteBrandCounts = formatDeleteBrandCounts;
  window.fdBuildDeleteBrandImpactItems = buildDeleteBrandImpactItems;
  window.fdResolveBrandConfirmName = resolveBrandConfirmName;

  function ensureDangerIcon(parent, small) {
    if (!parent || parent.querySelector('.fd-danger-zone__icon')) return;
    var icon = document.createElement('span');
    icon.className = 'fd-danger-zone__icon' + (small ? ' fd-danger-zone__icon--sm' : '');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '⚠️';
    parent.insertBefore(icon, parent.firstChild);
  }

  function enhanceBrandDangerZone() {
    var zone = document.querySelector('#brand-identity .a2w-bi-danger-zone');
    if (!zone || zone.dataset.fdDangerZone === '1') return;
    zone.dataset.fdDangerZone = '1';
    zone.classList.add('fd-danger-zone');

    var title = zone.querySelector('#brandDangerTitle');
    if (title && !zone.querySelector('.fd-danger-zone__head')) {
      var head = document.createElement('div');
      head.className = 'fd-danger-zone__head';
      ensureDangerIcon(head, false);
      head.appendChild(title);
      zone.insertBefore(head, zone.firstChild);
    }

    var copy = zone.querySelector('p');
    if (copy) copy.textContent = HR_COPY;
  }

  function enhanceDeleteTrigger() {
    var host = document.getElementById('a2wBiDangerActionHost');
    if (!host) return;
    var btn = host.querySelector('button');
    if (!btn || btn.dataset.fdDangerBtn === '1') return;
    btn.dataset.fdDangerBtn = '1';
    btn.setAttribute('data-rbac-write', 'brand-identity');
    btn.className = 'btn sec fd-btn-danger-outline';
    btn.textContent = 'Elimina brand…';
  }

  function patchOpenConfirmDialog() {
    if (window.__fdDangerConfirmPatched) return;
    if (!window.A2W || !window.A2W.UI || typeof window.A2W.UI.openConfirmDialog !== 'function') return;
    window.__fdDangerConfirmPatched = true;

    var orig = window.A2W.UI.openConfirmDialog;
    window.A2W.UI.openConfirmDialog = function (opts) {
      opts = opts || {};
      var promise = orig.call(window.A2W.UI, opts);

      if (opts.requireTyping) {
        requestAnimationFrame(function () {
          var dlg = document.getElementById('a2wUiConfirmDialog');
          if (!dlg) return;
          dlg.classList.add('fd-danger-confirm');
          var titleEl = dlg.querySelector('#a2wUiConfirmTitle');
          if (titleEl) ensureDangerIcon(titleEl, true);
        });
      }

      return promise.finally(function () {
        var dlg = document.getElementById('a2wUiConfirmDialog');
        if (dlg) {
          dlg.classList.remove('fd-danger-confirm');
          var titleEl = dlg.querySelector('#a2wUiConfirmTitle');
          if (titleEl) {
            var icon = titleEl.querySelector('.fd-danger-zone__icon');
            if (icon) icon.remove();
          }
        }
      });
    };
  }

  function observeDangerHost() {
    var host = document.getElementById('a2wBiDangerActionHost');
    if (!host) return;
    var obs = new MutationObserver(function () {
      enhanceDeleteTrigger();
      if (typeof window.fdRbacHook === 'function') window.fdRbacHook('brand-identity');
    });
    obs.observe(host, { childList: true, subtree: true });
    enhanceDeleteTrigger();
  }

  function initFdDangerZone() {
    if (!isFiloDangerApp()) return;
    enhanceBrandDangerZone();
    observeDangerHost();
    patchOpenConfirmDialog();
  }

  window.fdInitDangerZone = initFdDangerZone;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFdDangerZone);
  } else {
    initFdDangerZone();
  }
})();
