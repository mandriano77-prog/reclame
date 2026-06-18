/**
 * Filo HR — Media Library: layout semplificato (tutti i tipi asset, nessun campo nascosto).
 */
(function () {
  'use strict';
  var selectedIds = new Set();
  var pendingDeleteAsset = null;

  function authHeaders() {
    if (typeof window.getDashboardFetchHeaders === 'function') return window.getDashboardFetchHeaders();
    if (typeof window.getAuthHeaders === 'function') return window.getAuthHeaders();
    return {};
  }

  function mediaRowsFromPayload(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.items)) return payload.items;
    if (payload && Array.isArray(payload.media)) return payload.media;
    return [];
  }

  function isValidBrandId(value) {
    if (value == null) return false;
    var id = String(value).trim();
    if (!id || id === 'undefined' || id === 'null') return false;
    return true;
  }

  function getCurrentBrandId() {
    var candidates = [];
    try {
      if (window.brandId) candidates.push(window.brandId);
    } catch (_) {}
    try {
      var sel = document.getElementById('brandSelector');
      if (sel && sel.value) candidates.push(sel.value);
    } catch (_) {}
    try {
      var qpBrandId = new URLSearchParams(window.location.search || '').get('brand_id');
      if (qpBrandId) candidates.push(qpBrandId);
    } catch (_) {}
    for (var i = 0; i < candidates.length; i++) {
      var id = String(candidates[i]).trim();
      if (isValidBrandId(id)) return id;
    }
    return '';
  }

  function syncDashboardBrandId(brandId) {
    if (!isValidBrandId(brandId)) return;
    try { window.brandId = brandId; } catch (_) {}
    if (typeof window.ensureBrandIdFromContext === 'function') {
      try { window.ensureBrandIdFromContext(); } catch (_) {}
    }
  }

  var SECTION_META = {
    logo: {
      title: 'Logo',
      hint: 'PNG trasparente, max 320×100 px — usato nel pass e in landing.',
      uploadLabel: 'Carica logo'
    },
    wallet_icon: {
      title: 'Icona notifiche',
      hint: 'Quadrata 512×512 px — compare nelle push iPhone al posto del logo orizzontale.',
      uploadLabel: 'Carica icona'
    },
    strip: {
      title: 'Strip',
      hint: '750×246 px — banner in alto sul pass; puoi avere più varianti (default, promo, evento).',
      uploadLabel: 'Carica strip'
    },
    thumbnail: {
      title: 'Thumbnail',
      hint: '90×90 px — fronte pass su layout Event Ticket.',
      uploadLabel: 'Carica thumbnail'
    },
    background: {
      title: 'Background',
      hint: '360×440 px — sfondo intero su layout Event Ticket.',
      uploadLabel: 'Carica background'
    }
  };

  var CATEGORY_ORDER = ['logo', 'wallet_icon', 'strip', 'thumbnail', 'background'];
  var STORAGE_KEY = 'fdMediaCategory';
  var HOST_ID_BY_TYPE = {
    logo: 'mediaLogoBox',
    wallet_icon: 'mediaWalletIconGrid',
    strip: 'mediaStripGrid',
    thumbnail: 'mediaThumbnailGrid',
    background: 'mediaBackgroundGrid'
  };
  var activeCategory = 'logo';

  function panelIdForType(type) {
    return 'fdMediaPanel_' + type;
  }

  /** URL hash slug → internal mediaType (underscore). */
  function mediaTypeFromHash(slug) {
    var key = String(slug || '').toLowerCase();
    if (!key) return null;
    if (key === 'wallet-icon' || key === 'wallet_icon') return 'wallet_icon';
    if (CATEGORY_ORDER.indexOf(key) !== -1) return key;
    return null;
  }

  /** internal mediaType → URL hash slug (hyphen for wallet_icon). */
  function hashFromMediaType(type) {
    if (type === 'wallet_icon') return 'wallet-icon';
    return type;
  }

  function isFiloMedia() {
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

  function ensureUploadTypeOption() {
    var sel = document.getElementById('mediaUploadType');
    if (!sel || sel.querySelector('option[value="wallet_icon"]')) return;
    var opt = document.createElement('option');
    opt.value = 'wallet_icon';
    opt.textContent = 'Icona notifiche Wallet';
    var stripOpt = sel.querySelector('option[value="strip"]');
    if (stripOpt && stripOpt.nextSibling) sel.insertBefore(opt, stripOpt.nextSibling);
    else sel.appendChild(opt);
  }

  function openUploadForType(type) {
    if (typeof window.openMediaUpload === 'function') {
      window.openMediaUpload();
    }
    var sel = document.getElementById('mediaUploadType');
    if (sel && type) {
      sel.value = type;
      if (typeof window.onMediaUploadTypeChange === 'function') window.onMediaUploadTypeChange();
    }
  }

  window.openMediaUploadForType = openUploadForType;

  function readSavedCategory() {
    var fromHash = mediaTypeFromHash(String(window.location.hash || '').replace(/^#/, ''));
    if (fromHash) return fromHash;
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored && CATEGORY_ORDER.indexOf(stored) !== -1) return stored;
    } catch (_) {}
    return 'logo';
  }

  function persistCategory(type) {
    try {
      localStorage.setItem(STORAGE_KEY, type);
    } catch (_) {}
    if (typeof window.getActiveSectionId === 'function' && window.getActiveSectionId() === 'media-library') {
      var slug = hashFromMediaType(type);
      var base = window.location.pathname + window.location.search;
      try {
        window.history.replaceState({ section: 'media-library', mediaCategory: type }, '', base + '#' + slug);
      } catch (_) {}
    }
  }

  function switchMediaCategory(type, options) {
    options = options || {};
    if (CATEGORY_ORDER.indexOf(type) === -1) type = 'logo';
    activeCategory = type;

    var activePanelId = panelIdForType(type);
    var activePanel = document.getElementById(activePanelId);
    if (!activePanel) {
      console.warn('[fd-media-library] Panel not found for category:', type, '(expected #' + activePanelId + ')');
    }

    document.querySelectorAll('#media-library .fd-media-grid .fd-media-section').forEach(function (panel) {
      var on = panel.id === activePanelId;
      panel.classList.toggle('fd-media-section--hidden', !on);
      panel.classList.toggle('is-active', on);
      panel.hidden = !on;
      panel.style.display = on ? '' : 'none';
      panel.setAttribute('aria-hidden', on ? 'false' : 'true');
    });

    document.querySelectorAll('#media-library .a2w-media-bucket:not(.fd-media-section)').forEach(function (orphan) {
      orphan.hidden = true;
      orphan.style.display = 'none';
      console.warn('[fd-media-library] Hiding orphan bucket outside tab panels:', orphan);
    });

    document.querySelectorAll('#fdMediaTabs .fd-media-tabs__tab').forEach(function (tab) {
      var tabType = tab.getAttribute('data-media-type');
      var on = tabType === type;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
      var controls = tab.getAttribute('aria-controls');
      if (controls && !document.getElementById(controls)) {
        console.warn('[fd-media-library] Tab aria-controls missing panel:', controls);
      }
    });

    var sel = document.getElementById('fdMediaCategorySelect');
    if (sel && sel.value !== type) sel.value = type;

    if (!options.skipPersist) persistCategory(type);

    var live = document.getElementById('fdMediaAriaLive');
    if (live && !options.skipAnimation) {
      live.textContent = 'Categoria ' + ((SECTION_META[type] || {}).title || type);
    }
  }

  window.switchMediaCategory = switchMediaCategory;

  function onMediaTabsClick(e) {
    var tab = e.target.closest('.fd-media-tabs__tab');
    if (!tab) return;
    var type = tab.getAttribute('data-media-type');
    if (type) switchMediaCategory(type);
  }

  function onMediaTabsSelectChange(e) {
    if (!e.target || e.target.id !== 'fdMediaCategorySelect') return;
    switchMediaCategory(e.target.value);
  }

  function onMediaTabsKeydown(e) {
    var tab = e.target.closest('.fd-media-tabs__tab');
    if (!tab || !tab.closest('#fdMediaTabs')) return;
    var tabs = Array.from(document.querySelectorAll('#fdMediaTabs .fd-media-tabs__tab'));
    var idx = tabs.indexOf(tab);
    if (idx === -1) return;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      var next = tabs[(idx + 1) % tabs.length];
      switchMediaCategory(next.getAttribute('data-media-type'));
      next.focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      var prev = tabs[(idx - 1 + tabs.length) % tabs.length];
      switchMediaCategory(prev.getAttribute('data-media-type'));
      prev.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      switchMediaCategory(CATEGORY_ORDER[0]);
      tabs[0].focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      switchMediaCategory(CATEGORY_ORDER[CATEGORY_ORDER.length - 1]);
      tabs[tabs.length - 1].focus();
    }
  }

  function buildMediaTabsMarkup() {
    var listItems = CATEGORY_ORDER.map(function (type) {
      var meta = SECTION_META[type];
      return (
        '<li role="presentation">' +
        '<button type="button" class="fd-media-tabs__tab" role="tab" id="fdMediaTab_' + type + '" data-media-type="' + type + '" aria-controls="' + panelIdForType(type) + '" aria-selected="false" tabindex="-1">' +
        esc(meta.title) +
        '</button></li>'
      );
    }).join('');

    var selectOpts = CATEGORY_ORDER.map(function (type) {
      return '<option value="' + type + '">' + esc(SECTION_META[type].title) + '</option>';
    }).join('');

    return (
      '<div class="fd-media-tabs__select-wrap">' +
      '<label class="fd-media-tabs__select-label" for="fdMediaCategorySelect">Categoria asset</label>' +
      '<select id="fdMediaCategorySelect" class="fd-media-tabs__select" aria-label="Categoria asset">' +
      selectOpts +
      '</select></div>' +
      '<ul class="fd-media-tabs__list" role="tablist" aria-label="Categorie asset">' +
      listItems +
      '</ul>'
    );
  }

  function assertMediaPanelIntegrity(grid) {
    if (!grid) return;
    var tabs = document.querySelectorAll('#fdMediaTabs .fd-media-tabs__tab');
    var panels = grid.querySelectorAll(':scope > .fd-media-section[data-media-type]');
    if (tabs.length !== panels.length) {
      console.warn(
        '[fd-media-library] Tab/panel count mismatch: tabs=',
        tabs.length,
        'panels=',
        panels.length
      );
    }
    CATEGORY_ORDER.forEach(function (type) {
      var panel = document.getElementById(panelIdForType(type));
      if (!panel) {
        console.warn('[fd-media-library] Missing panel for type:', type);
      }
    });
    tabs.forEach(function (tab) {
      var controls = tab.getAttribute('aria-controls');
      if (!controls || !document.getElementById(controls)) {
        console.warn('[fd-media-library] Tab points to missing panel:', controls);
      }
    });
  }

  function ensureMediaCategoryTabs() {
    var section = document.getElementById('media-library');
    if (!section) return;
    var grid = section.querySelector('.fd-media-grid');
    if (!grid) return;

    grid.classList.add('fd-media-grid--tabs');

    CATEGORY_ORDER.forEach(function (type) {
      var panel = document.getElementById(panelIdForType(type))
        || grid.querySelector('.fd-media-section[data-media-type="' + type + '"]');
      if (!panel) return;
      panel.id = panelIdForType(type);
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', 'fdMediaTab_' + type);
    });

    if (!section.querySelector('#fdMediaTabs')) {
      var tabs = document.createElement('div');
      tabs.className = 'fd-media-tabs';
      tabs.id = 'fdMediaTabs';
      tabs.innerHTML = buildMediaTabsMarkup();
      grid.parentNode.insertBefore(tabs, grid);
    }

    if (section.dataset.fdMediaTabsBound !== '1') {
      section.dataset.fdMediaTabsBound = '1';
      section.addEventListener('click', onMediaTabsClick);
      section.addEventListener('change', onMediaTabsSelectChange);
      section.addEventListener('keydown', onMediaTabsKeydown);
    }

    section.dataset.fdMediaTabs = '1';
    assertMediaPanelIntegrity(grid);
    switchMediaCategory(readSavedCategory(), { skipPersist: true, skipAnimation: true });
  }

  /*
   * Variante accordion (non attiva — default = segmented tabs):
   *
   * function ensureMediaAccordion() {
   *   document.querySelectorAll('#media-library .fd-media-section__head').forEach(function (head) {
   *     head.addEventListener('click', function () {
   *       var panel = head.closest('.fd-media-section');
   *       var type = panel && panel.getAttribute('data-media-type');
   *       if (type) switchMediaCategory(type);
   *     });
   *   });
   * }
   */

  function getGlobalSearchValue() {
    var el = document.getElementById('fdMediaGlobalSearch');
    return (el && el.value ? el.value : '').trim().toLowerCase();
  }

  function applyGlobalSearchFilter() {
    var q = getGlobalSearchValue();
    document.querySelectorAll('#media-library .media-card').forEach(function (card) {
      var titleNode = card.querySelector('.media-card__title') || card.querySelector('div');
      var title = (titleNode && titleNode.textContent ? titleNode.textContent : '').trim().toLowerCase();
      card.hidden = !!q && title.indexOf(q) === -1;
    });
    document.querySelectorAll('#media-library .fd-media-section__body').forEach(function (body) {
      var cards = body.querySelectorAll('.media-card');
      var visible = Array.from(cards).some(function (c) { return !c.hidden; });
      var empty = body.querySelector('.fd-media-filter-empty');
      if (!visible && cards.length && q) {
        if (!empty) {
          empty = document.createElement('p');
          empty.className = 'fd-media-empty fd-media-filter-empty';
          body.appendChild(empty);
        }
        empty.textContent = 'Nessun asset per "' + q + '".';
      } else if (empty) {
        empty.remove();
      }
    });
  }

  function buildMediaDialogs() {
    if (document.getElementById('fdMediaSpecsDialog')) return;
    var host = document.createElement('div');
    host.innerHTML =
      '<div id="fdMediaSpecsDialog" class="fd-media-dialog" hidden>' +
      '<div class="fd-media-dialog__backdrop" data-close="specs"></div>' +
      '<div class="fd-media-dialog__panel" role="dialog" aria-modal="true" aria-labelledby="fdMediaSpecsTitle">' +
      '<h3 id="fdMediaSpecsTitle">Specifiche tecniche</h3>' +
      '<table class="fd-media-specs-table"><tbody>' +
      '<tr><th>Logo</th><td>PNG trasparente · 320×100 px · max 2MB</td></tr>' +
      '<tr><th>Icona Wallet</th><td>PNG/JPG quadrata · 512×512 px · max 2MB</td></tr>' +
      '<tr><th>Strip</th><td>PNG/JPG · 750×246 px · max 2MB</td></tr>' +
      '<tr><th>Thumbnail</th><td>PNG/JPG · 90×90 px · max 2MB</td></tr>' +
      '<tr><th>Background</th><td>PNG/JPG · 360×440 px · max 2MB</td></tr>' +
      '</tbody></table>' +
      '<div class="fd-media-dialog__actions"><button type="button" class="btn sec" data-close="specs">Chiudi</button></div>' +
      '</div></div>' +
      '<div id="fdMediaClearDialog" class="fd-media-dialog" hidden>' +
      '<div class="fd-media-dialog__backdrop" data-close="clear"></div>' +
      '<div class="fd-media-dialog__panel" role="dialog" aria-modal="true" aria-labelledby="fdMediaClearTitle">' +
      '<h3 id="fdMediaClearTitle">Svuotare la libreria?</h3>' +
      '<p>Questa azione elimina tutti gli asset del brand. Scrivi <strong>SVUOTA</strong> per confermare.</p>' +
      '<label class="form-label" for="fdMediaClearInput">Conferma</label>' +
      '<input id="fdMediaClearInput" type="text" autocomplete="off" placeholder="SVUOTA">' +
      '<div class="fd-media-dialog__actions">' +
      '<button type="button" class="btn sec" data-close="clear">Annulla</button>' +
      '<button type="button" id="fdMediaClearConfirmBtn" class="btn danger" disabled>Svuota libreria</button>' +
      '</div></div></div>';
    host.innerHTML +=
      '<div id="fdMediaAssetDeleteDialog" class="fd-media-dialog" hidden>' +
      '<div class="fd-media-dialog__backdrop" data-close="asset-delete"></div>' +
      '<div class="fd-media-dialog__panel" role="dialog" aria-modal="true" aria-labelledby="fdMediaAssetDeleteTitle">' +
      '<h3 id="fdMediaAssetDeleteTitle">Eliminare questo asset?</h3>' +
      '<p id="fdMediaAssetDeleteDesc">Questa azione non può essere annullata.</p>' +
      '<label class="form-label" for="fdMediaAssetDeleteInput">Conferma</label>' +
      '<input id="fdMediaAssetDeleteInput" type="text" autocomplete="off" placeholder="ELIMINA">' +
      '<div class="fd-media-dialog__actions">' +
      '<button type="button" class="btn sec" data-close="asset-delete">Annulla</button>' +
      '<button type="button" id="fdMediaAssetDeleteConfirmBtn" class="btn danger" disabled>Elimina asset</button>' +
      '</div></div></div>' +
      '<div id="fdMediaBulkDeleteDialog" class="fd-media-dialog" hidden>' +
      '<div class="fd-media-dialog__backdrop" data-close="bulk-delete"></div>' +
      '<div class="fd-media-dialog__panel" role="dialog" aria-modal="true" aria-labelledby="fdMediaBulkDeleteTitle">' +
      '<h3 id="fdMediaBulkDeleteTitle">Eliminare gli asset selezionati?</h3>' +
      '<p id="fdMediaBulkDeleteDesc">Conferma digitando <strong>ELIMINA</strong>.</p>' +
      '<label class="form-label" for="fdMediaBulkDeleteInput">Conferma</label>' +
      '<input id="fdMediaBulkDeleteInput" type="text" autocomplete="off" placeholder="ELIMINA">' +
      '<div class="fd-media-dialog__actions">' +
      '<button type="button" class="btn sec" data-close="bulk-delete">Annulla</button>' +
      '<button type="button" id="fdMediaBulkDeleteConfirmBtn" class="btn danger" disabled>Elimina selezionati</button>' +
      '</div></div></div>' +
      '<div id="fdMediaAriaLive" class="sr-only" aria-live="polite"></div>';
    document.body.appendChild(host);

    var clearInput = document.getElementById('fdMediaClearInput');
    var clearBtn = document.getElementById('fdMediaClearConfirmBtn');
    if (clearInput && clearBtn) {
      clearInput.addEventListener('input', function () {
        clearBtn.disabled = (clearInput.value || '').trim().toUpperCase() !== 'SVUOTA';
      });
    }

    document.querySelectorAll('.fd-media-dialog [data-close]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-close');
        var dlg = document.getElementById(key === 'specs' ? 'fdMediaSpecsDialog' : 'fdMediaClearDialog');
        if (dlg) dlg.hidden = true;
      });
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        var dlg = document.getElementById('fdMediaClearDialog');
        if (dlg) dlg.hidden = true;
        window.__fdSkipMediaAppConfirm = true;
        if (typeof window.deleteAllMedia === 'function') window.deleteAllMedia();
      });
    }

    var assetInput = document.getElementById('fdMediaAssetDeleteInput');
    var assetBtn = document.getElementById('fdMediaAssetDeleteConfirmBtn');
    if (assetInput && assetBtn) {
      assetInput.addEventListener('input', function () {
        var expected = pendingDeleteAsset && pendingDeleteAsset.requireType ? String(pendingDeleteAsset.requireType) : 'ELIMINA';
        assetBtn.disabled = (assetInput.value || '').trim().toUpperCase() !== expected.toUpperCase();
      });
      assetBtn.addEventListener('click', function () {
        var dlg = document.getElementById('fdMediaAssetDeleteDialog');
        if (dlg) dlg.hidden = true;
        if (pendingDeleteAsset && typeof window.deleteMediaItem === 'function') {
          window.__fdSkipMediaAppConfirm = true;
          window.deleteMediaItem(pendingDeleteAsset.id);
        }
        pendingDeleteAsset = null;
      });
    }

    var bulkInput = document.getElementById('fdMediaBulkDeleteInput');
    var bulkBtn = document.getElementById('fdMediaBulkDeleteConfirmBtn');
    if (bulkInput && bulkBtn) {
      bulkInput.addEventListener('input', function () {
        bulkBtn.disabled = (bulkInput.value || '').trim().toUpperCase() !== 'ELIMINA';
      });
      bulkBtn.addEventListener('click', function () {
        var ids = Array.from(selectedIds);
        var dlg = document.getElementById('fdMediaBulkDeleteDialog');
        if (dlg) dlg.hidden = true;
        selectedIds.clear();
        syncBulkUi();
        ids.forEach(function (id) {
          window.__fdSkipMediaAppConfirm = true;
          if (typeof window.deleteMediaItem === 'function') window.deleteMediaItem(id);
        });
      });
    }
  }

  function openDialog(id) {
    var dlg = document.getElementById(id);
    if (!dlg) return;
    if (id === 'fdMediaClearDialog') {
      var input = document.getElementById('fdMediaClearInput');
      var btn = document.getElementById('fdMediaClearConfirmBtn');
      if (input) input.value = '';
      if (btn) btn.disabled = true;
    }
    if (id === 'fdMediaAssetDeleteDialog') {
      var aInput = document.getElementById('fdMediaAssetDeleteInput');
      var aBtn = document.getElementById('fdMediaAssetDeleteConfirmBtn');
      if (aInput) aInput.value = '';
      if (aBtn) aBtn.disabled = true;
    }
    if (id === 'fdMediaBulkDeleteDialog') {
      var bInput = document.getElementById('fdMediaBulkDeleteInput');
      var bBtn = document.getElementById('fdMediaBulkDeleteConfirmBtn');
      var bDesc = document.getElementById('fdMediaBulkDeleteDesc');
      if (bInput) bInput.value = '';
      if (bBtn) bBtn.disabled = true;
      if (bDesc) bDesc.innerHTML = 'Stai eliminando <strong>' + selectedIds.size + '</strong> asset. Conferma digitando <strong>ELIMINA</strong>.';
    }
    dlg.hidden = false;
  }

  window.fdMediaOpenSpecs = function () { openDialog('fdMediaSpecsDialog'); };
  window.fdMediaOpenClearDialog = function () { openDialog('fdMediaClearDialog'); };
  window.fdMediaOpenBulkDeleteDialog = function () { openDialog('fdMediaBulkDeleteDialog'); };
  window.fdMediaExportLibrary = function () {
    if (typeof window.toast === 'function') window.toast('Export libreria disponibile a breve');
  };

  function renderLoadingSkeleton() {
    return (
      '<div class="fd-media-skeleton" aria-busy="true" aria-live="polite">' +
      '<span class="fd-skeleton fd-skeleton--title" style="width:55%;max-width:220px"></span>' +
      '<span class="fd-skeleton fd-skeleton--text" style="width:80%;margin-top:10px"></span>' +
      '<span class="fd-skeleton fd-skeleton--text" style="width:60%;margin-top:6px"></span>' +
      '</div>'
    );
  }

  function applyDsButtonClasses(root) {
    var scope = root || document;
    scope.querySelectorAll('#media-library .fd-media-header__actions button[onclick*="openMediaUpload"]').forEach(function (btn) {
      btn.classList.add('fd-btn', 'fd-btn--primary');
      btn.classList.remove('sec');
    });
    scope.querySelectorAll('#media-library .fd-media-upload-type').forEach(function (btn) {
      btn.classList.add('fd-btn', 'fd-btn--secondary');
    });
    scope.querySelectorAll('#media-library #fdMediaBulkClearBtn').forEach(function (btn) {
      btn.classList.add('fd-btn', 'fd-btn--secondary');
    });
    scope.querySelectorAll('#media-library #fdMediaBulkDeleteBtn').forEach(function (btn) {
      btn.classList.add('fd-btn', 'fd-btn--danger');
    });
  }

  function enhanceMediaHeaderDesign(header) {
    if (!header || header.dataset.fdDsHeader === '1') return;
    header.dataset.fdDsHeader = '1';
    header.classList.add('fd-page-header');

    var copy = header.querySelector('.fd-media-header__copy');
    if (copy) copy.classList.add('fd-page-header__copy');
    var h1 = header.querySelector('h1, .page-title');
    if (h1) h1.classList.add('fd-page-header__title');
    var lead = header.querySelector('.fd-media-lead');
    if (lead) lead.classList.add('fd-page-header__lead');

    var actions = header.querySelector('.fd-media-header__actions');
    if (actions) actions.classList.add('fd-page-header__actions');

    applyDsButtonClasses(header);
  }

  function ensureSpecsPanel(page) {
    if (!page || page.querySelector('.fd-media-specs')) return;
    var details = document.createElement('details');
    details.className = 'fd-media-specs fd-card';
    details.innerHTML =
      '<summary>Specifiche tecniche consigliate</summary>' +
      '<div class="fd-media-specs__body">' +
      '<div><strong>Logo</strong> — PNG trasparente, max 320×100 px.</div>' +
      '<div><strong>Icona notifiche</strong> — quadrata 512×512 px.</div>' +
      '<div><strong>Strip</strong> — 750×246 px, più varianti possibili.</div>' +
      '<div><strong>Thumbnail</strong> — 90×90 px (Event Ticket).</div>' +
      '<div><strong>Background</strong> — 360×440 px (Event Ticket).</div>' +
      '</div>';
    var grid = page.querySelector('.fd-media-grid');
    if (grid) page.insertBefore(details, grid);
    else page.appendChild(details);
  }

  function enhanceSectionDesign(card) {
    if (!card) return;
    card.classList.add('fd-card', 'fd-form-section');
  }

  function findBucketForType(type) {
    var hostId = HOST_ID_BY_TYPE[type];
    if (!hostId) return null;
    var host = document.getElementById(hostId);
    if (!host) return null;
    return host.closest('.fd-media-section, .a2w-media-bucket, .card');
  }

  function bindUploadButtons(scope) {
    if (!scope) return;
    scope.querySelectorAll('.fd-media-upload-type').forEach(function (btn) {
      if (btn.dataset.uploadBound === '1') return;
      btn.dataset.uploadBound = '1';
      btn.addEventListener('click', function () {
        openUploadForType(btn.getAttribute('data-upload-type'));
      });
    });
  }

  function applySectionMeta(card, type) {
    var meta = SECTION_META[type] || { title: type, hint: '', uploadLabel: 'Carica' };
    card.dataset.mediaType = type;
    card.dataset.fdMediaSection = '1';
    card.classList.add('fd-media-section', 'card', 'fd-card', 'fd-form-section');
    card.id = panelIdForType(type);
    card.setAttribute('role', 'tabpanel');
    card.setAttribute('aria-labelledby', 'fdMediaTab_' + type);

    var titleEl = card.querySelector('.fd-media-section__title');
    var hintEl = card.querySelector('.fd-media-section__hint');
    if (titleEl) titleEl.textContent = meta.title;
    if (hintEl) hintEl.textContent = meta.hint;

    var actions = card.querySelector('.fd-media-section__actions');
    if (!actions) return;
    var uploadBtn = actions.querySelector('.fd-media-upload-type[data-upload-type="' + type + '"]')
      || actions.querySelector('.fd-media-upload-type');
    if (uploadBtn) {
      uploadBtn.setAttribute('data-upload-type', type);
      uploadBtn.textContent = meta.uploadLabel;
    } else if (type !== 'strip' || !actions.querySelector('#mediaStripSearch')) {
      actions.insertAdjacentHTML(
        'beforeend',
        '<button type="button" class="fd-btn fd-btn--secondary fd-media-upload-type" data-upload-type="' + esc(type) + '">' + esc(meta.uploadLabel) + '</button>'
      );
    }
    bindUploadButtons(actions);
  }

  function buildSectionShell(type) {
    var meta = SECTION_META[type];
    var hostId = HOST_ID_BY_TYPE[type];
    var card = document.createElement('div');
    card.className = 'card fd-media-section';
    card.dataset.mediaType = type;
    card.dataset.fdMediaSection = '1';
    card.id = panelIdForType(type);
    card.setAttribute('role', 'tabpanel');
    card.setAttribute('aria-labelledby', 'fdMediaTab_' + type);
    card.innerHTML =
      '<div class="fd-media-section__head">' +
      '<div class="fd-media-section__copy">' +
      '<h2 class="fd-media-section__title">' + esc(meta.title) + '</h2>' +
      '<p class="fd-media-section__hint">' + esc(meta.hint) + '</p>' +
      '</div>' +
      '<div class="fd-media-section__actions">' +
      (type === 'strip'
        ? '<input id="mediaStripSearch" type="search" class="fd-media-section__search" placeholder="Cerca per nome…">'
        : '') +
        '<button type="button" class="fd-btn fd-btn--secondary fd-media-upload-type" data-upload-type="' + esc(type) + '">' + esc(meta.uploadLabel) + '</button>' +
      '</div></div>' +
      '<div class="fd-media-section__body">' +
      '<div id="' + hostId + '" class="strip-gallery">' + renderLoadingSkeleton() + '</div>' +
      '</div>';
    bindUploadButtons(card);
    if (type === 'strip') {
      var search = card.querySelector('#mediaStripSearch');
      if (search) search.addEventListener('input', function () {
        if (typeof window.loadMediaLibrary === 'function') window.loadMediaLibrary();
      });
    }
    return card;
  }

  function wrapSectionCard(card, type) {
    if (!card) return null;
    if (card.dataset.fdMediaSection === '1') {
      applySectionMeta(card, type);
      return card;
    }

    var meta = SECTION_META[type] || { title: type, hint: '', uploadLabel: 'Carica' };
    var oldTitle = card.querySelector('.sec-title');
    var oldHint = card.querySelector('p');
    var stripSearch = card.querySelector('#mediaStripSearch');

    card.dataset.fdMediaSection = '1';
    card.dataset.mediaType = type;
    card.classList.add('fd-media-section');
    card.id = panelIdForType(type);
    card.setAttribute('role', 'tabpanel');
    card.setAttribute('aria-labelledby', 'fdMediaTab_' + type);

    var head = document.createElement('div');
    head.className = 'fd-media-section__head';
    head.innerHTML =
      '<div class="fd-media-section__copy">' +
      '<h2 class="fd-media-section__title">' + esc(meta.title) + '</h2>' +
      '<p class="fd-media-section__hint">' + esc(meta.hint) + '</p>' +
      '</div>' +
      '<div class="fd-media-section__actions">' +
      (stripSearch ? '' : '<button type="button" class="fd-btn fd-btn--secondary fd-media-upload-type" data-upload-type="' + esc(type) + '">' + esc(meta.uploadLabel) + '</button>') +
      '</div>';

    if (stripSearch) {
      var actions = head.querySelector('.fd-media-section__actions');
      stripSearch.classList.add('fd-media-section__search');
      actions.appendChild(stripSearch);
      actions.insertAdjacentHTML(
        'beforeend',
        '<button type="button" class="fd-btn fd-btn--secondary fd-media-upload-type" data-upload-type="strip">Carica strip</button>'
      );
    }

    if (oldTitle) oldTitle.remove();
    if (oldHint && oldHint !== stripSearch) oldHint.remove();

    var bodyHost = document.createElement('div');
    bodyHost.className = 'fd-media-section__body';
    while (card.firstChild) bodyHost.appendChild(card.firstChild);

    card.appendChild(head);
    card.appendChild(bodyHost);
    bindUploadButtons(card);
    return card;
  }

  function removeDuplicateSections(grid) {
    CATEGORY_ORDER.forEach(function (type) {
      var hostId = HOST_ID_BY_TYPE[type];
      var panels = Array.from(grid.querySelectorAll('.fd-media-section[data-media-type="' + type + '"]'));
      if (panels.length <= 1) return;
      panels.forEach(function (panel) {
        if (!panel.querySelector('#' + hostId)) panel.remove();
      });
    });
  }

  function removeOrphanBuckets(grid) {
    grid.querySelectorAll(':scope > .a2w-media-bucket:not(.fd-media-section), :scope > .card:not(.fd-media-section)').forEach(function (node) {
      console.warn('[fd-media-library] Removing orphan bucket outside tab panels:', node);
      node.remove();
    });
  }

  function rebuildMediaSections(grid) {
    var sections = {};

    CATEGORY_ORDER.forEach(function (type) {
      var bucket = findBucketForType(type);
      if (bucket) {
        sections[type] = wrapSectionCard(bucket, type);
      } else if (!document.getElementById(HOST_ID_BY_TYPE[type])) {
        sections[type] = buildSectionShell(type);
      }
    });

    removeDuplicateSections(grid);

    CATEGORY_ORDER.forEach(function (type) {
      var panel = sections[type] || document.getElementById(panelIdForType(type));
      if (panel) grid.appendChild(panel);
    });

    removeOrphanBuckets(grid);
    assertMediaPanelIntegrity(grid);
  }

  function ensureMediaLayout() {
    var section = document.getElementById('media-library');
    if (!section) return;

    var page = section.querySelector('.a2w-media-page') || section;
    var grid = page.querySelector('.a2w-media-buckets-grid, .fd-media-grid');

    if (section.dataset.fdMediaLayout === '1') {
      if (grid) rebuildMediaSections(grid);
      if (typeof window.fdRelocateBrandPassFlowBar === 'function') {
        window.fdRelocateBrandPassFlowBar(section);
      }
      ensureMediaCategoryTabs();
      applyDsButtonClasses(section);
      return;
    }

    section.classList.add('media-library--fd-layout');

    var header = page.querySelector('.a2w-media-page-head, .fd-media-header') || section.querySelector(':scope > div');
    if (header) {
      header.classList.add('fd-media-header');
      var h1 = header.querySelector('h1');
      var actions = header.querySelector(':scope > div:last-child') || header.querySelector(':scope > div');
      if (h1 && actions && !header.querySelector('.fd-media-header__copy')) {
        var copy = document.createElement('div');
        copy.className = 'fd-media-header__copy';
        copy.appendChild(h1);
        var lead = document.createElement('p');
        lead.className = 'fd-media-lead';
        lead.textContent =
          'Deposito immagini del brand e del pass. Scegli i file qui, poi assegnali in Template Pass o nelle push.';
        copy.appendChild(lead);
        header.insertBefore(copy, actions);
        actions.classList.add('fd-media-header__actions');
        actions.querySelectorAll('button[onclick*="deleteAllMedia"]').forEach(function (btn) { btn.remove(); });
        var uploadBtn = actions.querySelector('button[onclick*="openMediaUpload"]');
        if (uploadBtn) {
          uploadBtn.textContent = 'Carica file';
          uploadBtn.classList.remove('sec');
        }
        enhanceMediaHeaderDesign(header);
        if (!actions.querySelector('#fdMediaGlobalSearch')) {
          var search = document.createElement('input');
          search.type = 'search';
          search.id = 'fdMediaGlobalSearch';
          search.className = 'fd-media-global-search';
          search.placeholder = 'Cerca asset…';
          search.setAttribute('aria-label', 'Cerca asset');
          search.addEventListener('input', applyGlobalSearchFilter);
          actions.insertBefore(search, actions.firstChild);
        }
      }
    }

    page.querySelectorAll('.a2w-media-specs-card').forEach(function (specsCard) {
      specsCard.remove();
    });
    ensureSpecsPanel(page);

    if (!grid) {
      grid = document.createElement('div');
      grid.className = 'fd-media-grid';
      page.appendChild(grid);
    }
    grid.classList.add('fd-media-grid');
    grid.classList.remove('a2w-media-buckets-grid');
    grid.style.display = '';
    grid.style.gridTemplateColumns = '';

    rebuildMediaSections(grid);
    if (typeof window.fdRelocateBrandPassFlowBar === 'function') {
      window.fdRelocateBrandPassFlowBar(section);
    }
    ensureMediaCategoryTabs();

    if (!section.querySelector('#fdMediaBulkBar')) {
      var bulk = document.createElement('div');
      bulk.id = 'fdMediaBulkBar';
      bulk.className = 'fd-media-bulk-bar';
      bulk.hidden = true;
      bulk.innerHTML =
        '<span id="fdMediaBulkCount">0 selezionati</span>' +
        '<button type="button" class="fd-btn fd-btn--secondary" id="fdMediaBulkClearBtn">Deseleziona</button>' +
        '<button type="button" class="fd-btn fd-btn--danger" id="fdMediaBulkDeleteBtn">Elimina selezionati</button>';
      section.appendChild(bulk);
      document.getElementById('fdMediaBulkClearBtn').addEventListener('click', function () {
        selectedIds.clear();
        syncBulkUi();
        document.querySelectorAll('#media-library .media-card__check').forEach(function (c) { c.checked = false; });
      });
      document.getElementById('fdMediaBulkDeleteBtn').addEventListener('click', function () {
        window.fdMediaOpenBulkDeleteDialog();
      });
    }

    if (!section.querySelector('.fd-media-link-template')) {
      var link = document.createElement('p');
      link.className = 'fd-media-link-template';
      link.innerHTML = 'Dopo il caricamento, assegna le immagini in <a href="#" data-fd-nav="templates">Template Pass</a>.';
      link.querySelector('a').addEventListener('click', function (e) {
        e.preventDefault();
        if (typeof window.nav === 'function') window.nav('templates');
      });
      section.appendChild(link);
    }

    ensureUploadTypeOption();
    buildMediaDialogs();
    applyDsButtonClasses(section);
    section.dataset.fdMediaLayout = '1';
  }

  function estimateDims(type) {
    if (type === 'logo') return '320×100';
    if (type === 'wallet_icon') return '512×512';
    if (type === 'strip') return '750×246';
    if (type === 'thumbnail') return '90×90';
    if (type === 'background') return '360×440';
    return '—';
  }

  function formatSize(bytes) {
    var n = Number(bytes || 0);
    if (!n) return '—';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function timeAgo(dateString) {
    if (!dateString) return '—';
    var d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return '—';
    var min = Math.max(1, Math.floor((Date.now() - d.getTime()) / 60000));
    if (min < 60) return min + ' min fa';
    var h = Math.floor(min / 60);
    if (h < 24) return h + ' ore fa';
    var day = Math.floor(h / 24);
    return day + ' giorni fa';
  }

  function fdIcon(name, label) {
    if (window.FD_ICONS && typeof window.FD_ICONS.svg === 'function') {
      return window.FD_ICONS.svg(name, 15);
    }
    return '';
  }

  function renderAssetCard(item, type) {
    var name = item.title || item.filename || SECTION_META[type].title;
    var usedIn = Number(item.used_in_count || 0);
    var metadata = estimateDims(type) + ' · ' + formatSize(item.size_bytes) + ' · ' + timeAgo(item.created_at);
    return (
      '<article class="media-card media-card--fd" data-asset-id="' + esc(item.id) + '" data-asset-type="' + esc(type) + '" data-asset-name="' + esc(name) + '" data-used-in="' + esc(usedIn) + '">' +
      '<div class="media-card__thumb-wrap">' +
      '<label class="media-card__check-wrap"><input type="checkbox" class="media-card__check" data-action="select" aria-label="Seleziona asset"></label>' +
      '<img src="/api/v1/media/' + esc(item.id) + '/image" alt="' + esc(name) + '">' +
      '<div class="media-card__overlay">' +
      '<button type="button" class="media-card__icon-btn" data-action="preview" aria-label="Anteprima asset" title="Anteprima">' + fdIcon('eye') + '</button>' +
      '<button type="button" class="media-card__icon-btn" data-action="rename" aria-label="Rinomina asset" title="Rinomina">' + fdIcon('pencil') + '</button>' +
      '<button type="button" class="media-card__icon-btn media-card__icon-btn--danger" data-action="delete" aria-label="Elimina asset" title="Elimina">' + fdIcon('trash') + '</button>' +
      '</div>' +
      '</div>' +
      '<div class="media-card__title">' + esc(name) + '</div>' +
      '<div class="media-card__meta" title="' + esc(metadata) + '">' + esc(metadata) + '</div>' +
      '</article>'
    );
  }

  function renderEmptyDropzone(type) {
    var m = SECTION_META[type];
    return (
      '<div class="fd-empty-state fd-media-empty-state">' +
      '<p class="fd-empty-state__title">Nessun asset ' + esc(m.title.toLowerCase()) + '</p>' +
      '<p class="fd-empty-state__desc">' + esc(m.hint) + '</p>' +
      '<div class="fd-empty-state__actions">' +
      '<button type="button" class="fd-media-dropzone fd-btn fd-btn--secondary" data-upload-type="' + esc(type) + '" aria-label="Carica ' + esc(m.title) + '">' +
      '<span class="fd-media-dropzone__title">Trascina qui o clicca per caricare</span>' +
      '</button></div></div>'
    );
  }

  function bindAssetCardActions(scope) {
    if (!scope) return;
    scope.querySelectorAll('.media-card--fd').forEach(function (card) {
      if (card.dataset.bound === '1') return;
      card.dataset.bound = '1';
      var id = card.getAttribute('data-asset-id');
      var type = card.getAttribute('data-asset-type');
      var name = card.getAttribute('data-asset-name') || 'Asset';
      var check = card.querySelector('.media-card__check');
      if (check) {
        check.checked = selectedIds.has(id);
        check.addEventListener('change', function () {
          if (check.checked) selectedIds.add(id);
          else selectedIds.delete(id);
          syncBulkUi();
        });
      }

      card.querySelectorAll('[data-action]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var action = btn.getAttribute('data-action');
          if (action === 'preview') {
            window.open('/api/v1/media/' + encodeURIComponent(id) + '/image', '_blank');
            return;
          }
          if (action === 'rename') {
            var next = window.prompt('Nuovo nome asset', name);
            if (!next || next.trim() === name) return;
            var brandId = getCurrentBrandId();
            fetch((window.API || '/api/v1') + '/media/' + encodeURIComponent(id), {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', ...authHeaders() },
              body: JSON.stringify({ title: next.trim(), type: type, brand_id: brandId || undefined })
            }).then(function () {
              if (typeof window.loadMediaLibrary === 'function') window.loadMediaLibrary();
            });
            return;
          }
          if (action === 'delete') {
            var usedIn = Number(card.getAttribute('data-used-in') || 0);
            pendingDeleteAsset = {
              id: id,
              requireType: usedIn > 0 ? name : 'ELIMINA'
            };
            var desc = document.getElementById('fdMediaAssetDeleteDesc');
            if (desc) {
              desc.innerHTML = usedIn > 0
                ? 'Asset usato in <strong>' + usedIn + '</strong> elementi. Digita <strong>' + esc(name) + '</strong> per confermare.'
                : 'Questa azione non può essere annullata. Digita <strong>ELIMINA</strong> per confermare.';
            }
            openDialog('fdMediaAssetDeleteDialog');
            return;
          }
        });
      });
    });

    scope.querySelectorAll('.fd-media-dropzone').forEach(function (btn) {
      if (btn.dataset.bound === '1') return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', function () {
        openUploadForType(btn.getAttribute('data-upload-type'));
      });
    });
  }

  function announceDnD(message) {
    var node = document.getElementById('fdMediaAriaLive');
    if (node) node.textContent = message || '';
  }

  function bindDropzoneDnD(host, type) {
    if (!host || host.dataset.dragBound === '1') return;
    host.dataset.dragBound = '1';
    ['dragenter', 'dragover'].forEach(function (evt) {
      host.addEventListener(evt, function (e) {
        e.preventDefault();
        host.classList.add('is-dragover');
        announceDnD('Rilascia per caricare');
      });
    });
    ['dragleave', 'dragend', 'drop'].forEach(function (evt) {
      host.addEventListener(evt, function () {
        host.classList.remove('is-dragover');
      });
    });
    host.addEventListener('drop', function (e) {
      e.preventDefault();
      var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file) return;
      openUploadForType(type);
      var input = document.getElementById('mediaUploadFile');
      try {
        var dt = new DataTransfer();
        dt.items.add(file);
        if (input) input.files = dt.files;
      } catch (_) {}
      announceDnD('File pronto per il caricamento');
    });
  }

  function syncBulkUi() {
    var bar = document.getElementById('fdMediaBulkBar');
    var count = document.getElementById('fdMediaBulkCount');
    var delBtn = document.getElementById('fdMediaBulkDeleteBtn');
    if (!bar || !count || !delBtn) return;
    var n = selectedIds.size;
    bar.hidden = n === 0;
    count.textContent = n + ' selezionati';
    delBtn.disabled = n === 0;
  }

  function renderSectionAssets(type, items) {
    var hostId = type === 'logo' ? 'mediaLogoBox'
      : type === 'wallet_icon' ? 'mediaWalletIconGrid'
      : type === 'strip' ? 'mediaStripGrid'
      : type === 'thumbnail' ? 'mediaThumbnailGrid'
      : 'mediaBackgroundGrid';
    var host = document.getElementById(hostId);
    if (!host) return;

    var actions = host.closest('.fd-media-section')?.querySelector('.fd-media-section__actions');
    var searchId = 'fdMediaSearch_' + type;
    var searchEl = document.getElementById(searchId);
    if (!searchEl && actions) {
      searchEl = document.createElement('input');
      searchEl.type = 'search';
      searchEl.id = searchId;
      searchEl.className = 'fd-media-section__search';
      searchEl.placeholder = 'Cerca…';
      searchEl.hidden = true;
      searchEl.addEventListener('input', function () {
        renderSectionAssets(type, items);
        applyGlobalSearchFilter();
      });
      actions.insertBefore(searchEl, actions.firstChild);
    }

    var localQ = (searchEl && !searchEl.hidden && searchEl.value ? searchEl.value : '').trim().toLowerCase();
    var list = items;
    if (localQ) {
      list = items.filter(function (it) {
        var t = (it.title || it.filename || '').toLowerCase();
        return t.indexOf(localQ) !== -1;
      });
    }
    if (searchEl) searchEl.hidden = items.length <= 6;

    if (!list.length) {
      host.innerHTML = renderEmptyDropzone(type);
      bindAssetCardActions(host);
      bindDropzoneDnD(host, type);
      return;
    }
    host.innerHTML = list.map(function (it) { return renderAssetCard(it, type); }).join('');
    bindAssetCardActions(host);
    bindDropzoneDnD(host, type);
  }


  function patchLoadMediaLibrary() {
    if (window.__fdMediaLoadPatched || typeof window.loadMediaLibrary !== 'function') return;
    window.__fdMediaLoadPatched = true;
    window.loadMediaLibrary = async function () {
      ensureMediaLayout();
      document.querySelectorAll('#mediaLogoBox, #mediaWalletIconGrid, #mediaStripGrid, #mediaThumbnailGrid, #mediaBackgroundGrid').forEach(function (node) {
        if (!node) return;
        if (node.querySelector('.fd-media-skeleton') || node.querySelector('.fd-media-empty-state') || node.querySelector('.media-card--fd')) return;
        var txt = (node.textContent || '').trim();
        if (/caricamento/i.test(txt) || !txt) {
          node.innerHTML = renderLoadingSkeleton();
        }
      });
      try {
        var brandId = getCurrentBrandId();
        if (!brandId) return;
        syncDashboardBrandId(brandId);
        var api = window.API || '/api/v1';
        var res = await fetch(api + '/media?brand_id=' + encodeURIComponent(brandId), {
          headers: authHeaders()
        });
        if (!res.ok) throw new Error('media fetch failed ' + res.status);
        var items = await res.json().catch(function () { return []; });
        var rows = mediaRowsFromPayload(items);
        var keep = new Set(rows.map(function (x) { return String(x.id); }));
        Array.from(selectedIds).forEach(function (id) {
          if (!keep.has(String(id))) selectedIds.delete(id);
        });
        renderSectionAssets('logo', rows.filter(function (x) { return x.type === 'logo'; }));
        renderSectionAssets('wallet_icon', rows.filter(function (x) { return x.type === 'wallet_icon'; }));
        renderSectionAssets('strip', rows.filter(function (x) { return x.type === 'strip'; }));
        renderSectionAssets('thumbnail', rows.filter(function (x) { return x.type === 'thumbnail'; }));
        renderSectionAssets('background', rows.filter(function (x) { return x.type === 'background'; }));
        applyGlobalSearchFilter();
        syncBulkUi();
        if (document.getElementById('fdMediaTabs')) {
          switchMediaCategory(activeCategory || readSavedCategory(), { skipPersist: true, skipAnimation: true });
        }
        if (typeof window.fdRbacHook === 'function') window.fdRbacHook('media-library');
      } catch (e) {
        console.error('fd-media-library load error:', e);
        document.querySelectorAll('#mediaLogoBox, #mediaWalletIconGrid, #mediaStripGrid, #mediaThumbnailGrid, #mediaBackgroundGrid').forEach(function (node) {
          if (!node) return;
          var txt = (node.textContent || '').trim();
          if (/caricamento/i.test(txt) || !txt) {
            node.innerHTML =
              typeof window.fdRenderErrorState === 'function'
                ? window.fdRenderErrorState('Errore caricamento. Riprova tra poco.', {
                    title: 'Media Library non disponibile'
                  })
                : '<p class="fd-media-empty">Errore caricamento. Riprova tra poco.</p>';
          }
        });
        if (typeof window.toast === 'function') window.toast('Media Library: errore caricamento');
      }
    };
  }

  function patchMediaDeleteConfirm() {
    if (window.__fdMediaDeletePatched) return;
    window.__fdMediaDeletePatched = true;

    if (typeof window.deleteMediaItem === 'function') {
      var origItem = window.deleteMediaItem;
      window.deleteMediaItem = async function (id) {
        if (window.__fdSkipMediaAppConfirm) {
          window.__fdSkipMediaAppConfirm = false;
          try {
            await fetch((window.API || '/api/v1') + '/media/' + encodeURIComponent(id), {
              method: 'DELETE',
              headers: authHeaders()
            });
            if (typeof window.toast === 'function') window.toast('Media eliminato');
            if (typeof window.loadMediaLibrary === 'function') window.loadMediaLibrary();
          } catch (err) {
            if (typeof window.toast === 'function') window.toast('Errore: ' + err.message);
          }
          return;
        }
        return origItem.apply(this, arguments);
      };
    }

    if (typeof window.deleteAllMedia === 'function') {
      var origAll = window.deleteAllMedia;
      window.deleteAllMedia = async function () {
        if (window.__fdSkipMediaAppConfirm) {
          window.__fdSkipMediaAppConfirm = false;
          var brandId = getCurrentBrandId();
          if (!brandId) return;
          try {
            var res = await fetch((window.API || '/api/v1') + '/media?brand_id=' + encodeURIComponent(brandId), {
              method: 'DELETE',
              headers: authHeaders()
            });
            var data = await res.json();
            if (typeof window.toast === 'function') window.toast((data.deleted || 0) + ' media eliminati');
            if (typeof window.loadMediaLibrary === 'function') window.loadMediaLibrary();
          } catch (err) {
            if (typeof window.toast === 'function') window.toast('Errore: ' + err.message);
          }
          return;
        }
        return origAll.apply(this, arguments);
      };
    }
  }

  function boot() {
    if (!isFiloMedia()) return;
    patchMediaDeleteConfirm();
    ensureUploadTypeOption();
    patchLoadMediaLibrary();
    ensureMediaLayout();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  var origNav = window.nav;
  if (typeof origNav === 'function' && !window.__fdMediaNav) {
    window.__fdMediaNav = true;
    window.nav = function (id) {
      var r = origNav.apply(this, arguments);
      var done = function () {
        if (id === 'media-library') boot();
      };
      if (r && typeof r.then === 'function') return r.then(done);
      setTimeout(done, 0);
      return r;
    };
  }
})();
