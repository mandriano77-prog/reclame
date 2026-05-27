/**
 * FD-05 — FiloDiretto: de-emphasized destructive actions (media kebab, outline deletes).
 */
(function () {
  'use strict';

  function isFiloDestructiveApp() {
    if (document.documentElement.classList.contains('a2w-shell')) return false;
    try {
      if (window.__2WALLET_PRODUCT_LOCK__ === 'hr') return true;
    } catch (_) {}
    return document.documentElement.getAttribute('data-app') === 'filodiretto';
  }

  function closeMediaMenu() {
    var panel = document.getElementById('fdMediaPageMenuPanel');
    var trigger = document.getElementById('fdMediaPageMenuBtn');
    if (panel) panel.hidden = true;
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  }

  function ensureMediaPageMenu() {
    var section = document.getElementById('media-library');
    if (!section) return;
    section.classList.add('media-library--fd');

    var header = section.querySelector(':scope > div');
    if (!header) return;
    var actions = header.querySelector('div');
    if (!actions) return;

    var clearBtn = actions.querySelector('button[onclick*="deleteAllMedia"]');
    if (clearBtn) clearBtn.classList.add('fd-media-clear-btn');

    if (document.getElementById('fdMediaPageMenu')) return;

    var menu = document.createElement('div');
    menu.className = 'fd-media-page-menu';
    menu.id = 'fdMediaPageMenu';
    menu.innerHTML =
      '<button type="button" class="fd-media-page-menu__trigger" id="fdMediaPageMenuBtn" aria-label="Azioni Media Library" aria-haspopup="menu" aria-expanded="false">⋮</button>' +
      '<div class="fd-media-page-menu__panel" id="fdMediaPageMenuPanel" role="menu" hidden>' +
      '<button type="button" class="fd-media-page-menu__item fd-media-page-menu__item--danger" id="fdMediaClearAllBtn" role="menuitem">Svuota tutto</button>' +
      '</div>';
    actions.appendChild(menu);

    var trigger = document.getElementById('fdMediaPageMenuBtn');
    var panel = document.getElementById('fdMediaPageMenuPanel');
    var item = document.getElementById('fdMediaClearAllBtn');

    if (trigger && panel) {
      trigger.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = panel.hidden;
        closeMediaMenu();
        if (open) {
          panel.hidden = false;
          trigger.setAttribute('aria-expanded', 'true');
        }
      });
    }

    if (item) {
      item.addEventListener('click', function (e) {
        e.stopPropagation();
        closeMediaMenu();
        if (typeof window.deleteAllMedia === 'function') window.deleteAllMedia();
      });
    }

    if (document.body.dataset.fdMediaMenuBound !== '1') {
      document.body.dataset.fdMediaMenuBound = '1';
      document.addEventListener('click', closeMediaMenu);
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeMediaMenu();
      });
    }
  }

  function enhanceMediaDeleteButtons(root) {
    if (!root) return;
    root.querySelectorAll('button[onclick*="deleteMediaItem"]').forEach(function (btn) {
      btn.className = 'btn small sec fd-btn-danger-outline fd-media-delete-btn';
      if (!btn.textContent.trim()) btn.textContent = 'Elimina';
    });
  }

  function enhanceBrandIdentityAssetButtons() {
    document.querySelectorAll('#brand-identity .a2w-bi-asset-actions button[id*="RemoveBtn"]').forEach(function (btn) {
      btn.classList.remove('danger');
      btn.classList.add('sec', 'small', 'fd-btn-danger-outline');
    });
  }

  function enhanceMediaLibraryDom() {
    if (!isFiloDestructiveApp()) return;
    ensureMediaPageMenu();
    var section = document.getElementById('media-library');
    if (section) enhanceMediaDeleteButtons(section);
  }

  function patchRenderers() {
    if (window.__fdDestructivePatched) return;
    window.__fdDestructivePatched = true;

    var origMedia = window.loadMediaLibrary;
    if (typeof origMedia === 'function') {
      window.loadMediaLibrary = async function () {
        await origMedia.apply(this, arguments);
        if (isFiloDestructiveApp()) enhanceMediaLibraryDom();
      };
    }

    var origBiGrid = window.a2wBiRenderAssetsGrid;
    if (typeof origBiGrid === 'function') {
      window.a2wBiRenderAssetsGrid = function () {
        origBiGrid.apply(this, arguments);
        if (isFiloDestructiveApp()) enhanceBrandIdentityAssetButtons();
      };
    }
  }

  function initFdDestructive() {
    if (!isFiloDestructiveApp()) return;
    patchRenderers();
    ensureMediaPageMenu();
    enhanceMediaLibraryDom();
    enhanceBrandIdentityAssetButtons();
  }

  window.fdInitDestructive = initFdDestructive;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFdDestructive);
  } else {
    initFdDestructive();
  }
})();
