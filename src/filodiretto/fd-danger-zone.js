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
    var parts = [];
    if (counts.passes > 0) parts.push(pluralCount(counts.passes, 'pass emesso', 'pass emessi'));
    if (counts.contatti > 0) parts.push(pluralCount(counts.contatti, 'contatto', 'contatti'));
    if (counts.campagne > 0) parts.push(pluralCount(counts.campagne, 'campagna', 'campagne'));
    return parts.length ? parts.join(', ') : 'nessuna entità collegata';
  }

  window.fdFormatDeleteBrandCounts = formatDeleteBrandCounts;

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

  function enhanceFallbackDeleteDialog() {
    var dialog = document.getElementById('a2wDeleteBrandDialog');
    if (!dialog || dialog.dataset.fdDangerDialog === '1') return;
    dialog.dataset.fdDangerDialog = '1';
    dialog.classList.add('fd-delete-brand-dialog');

    var title = document.getElementById('a2wDeleteBrandDialogTitle');
    if (title) ensureDangerIcon(title, true);

    var input = document.getElementById('a2wDeleteBrandConfirmInput');
    if (input && !document.getElementById('a2wDeleteBrandDialogHint')) {
      var hint = document.createElement('p');
      hint.id = 'a2wDeleteBrandDialogHint';
      hint.className = 'fd-danger-zone__hint';
      hint.textContent = 'Il pulsante si attiva solo se il testo coincide esattamente con il nome del brand (senza spazi extra).';
      input.parentNode.insertBefore(hint, input.nextSibling);
      input.setAttribute('aria-describedby', 'a2wDeleteBrandDialogHint');
    }

    rebindFallbackTyping();
  }

  function rebindFallbackTyping() {
    var input = document.getElementById('a2wDeleteBrandConfirmInput');
    var confirmBtn = document.getElementById('a2wDeleteBrandConfirmBtn');
    if (!input || !confirmBtn || input.dataset.fdTypingBound === '1') return;

    var fresh = input.cloneNode(true);
    input.parentNode.replaceChild(fresh, input);
    fresh.dataset.fdTypingBound = '1';
    if (document.getElementById('a2wDeleteBrandDialogHint')) {
      fresh.setAttribute('aria-describedby', 'a2wDeleteBrandDialogHint');
    }

    fresh.addEventListener('input', function () {
      var expected = '';
      if (typeof window.a2wBiCollectFormData === 'function') {
        try {
          expected = window.a2wBiCollectFormData().name || '';
        } catch (_) {}
      }
      confirmBtn.disabled = !isConfirmTypingMatch(fresh.value, expected);
    });
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

  function patchOpenDeleteDialog() {
    if (window.__fdOpenDeletePatched || typeof window.a2wBiOpenDeleteDialog !== 'function') return;
    window.__fdOpenDeletePatched = true;
    var orig = window.a2wBiOpenDeleteDialog;
    window.a2wBiOpenDeleteDialog = async function () {
      var counts = null;
      if (typeof window.a2wBiBuildDeleteCounts === 'function') {
        try {
          counts = await window.a2wBiBuildDeleteCounts();
        } catch (_) {}
      }
      await orig.apply(this, arguments);
      if (counts) {
        var countsNode = document.getElementById('a2wDeleteBrandCounts');
        if (countsNode) countsNode.textContent = formatDeleteBrandCounts(counts);
      }
      enhanceFallbackDeleteDialog();
      rebindFallbackTyping();
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
    enhanceFallbackDeleteDialog();
    observeDangerHost();
    patchOpenConfirmDialog();
    patchOpenDeleteDialog();
  }

  window.fdInitDangerZone = initFdDangerZone;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFdDangerZone);
  } else {
    initFdDangerZone();
  }
})();
