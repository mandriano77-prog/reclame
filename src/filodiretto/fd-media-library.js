/**
 * Filo HR — Media Library: layout semplificato (tutti i tipi asset, nessun campo nascosto).
 */
(function () {
  'use strict';
  var selectedIds = new Set();
  var pendingDeleteAsset = null;

  var SECTION_META = {
    logo: {
      title: 'Logo',
      hint: 'PNG trasparente, max 320×100 px — usato nel pass e in landing.',
      uploadLabel: 'Carica logo'
    },
    wallet_icon: {
      title: 'Icona notifiche Wallet',
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

  function wrapSectionCard(card, type) {
    if (!card || card.dataset.fdMediaSection === '1') return;
    card.dataset.fdMediaSection = '1';
    card.dataset.mediaType = type;
    card.classList.add('fd-media-section');

    var meta = SECTION_META[type] || { title: type, hint: '', uploadLabel: 'Carica' };
    var oldTitle = card.querySelector('.sec-title');
    var oldHint = card.querySelector('p');
    var stripSearch = card.querySelector('#mediaStripSearch');

    var head = document.createElement('div');
    head.className = 'fd-media-section__head';
    head.innerHTML =
      '<div class="fd-media-section__copy">' +
      '<h2 class="fd-media-section__title">' + esc(meta.title) + '</h2>' +
      '<p class="fd-media-section__hint">' + esc(meta.hint) + '</p>' +
      '</div>' +
      '<div class="fd-media-section__actions">' +
      (stripSearch ? '' : '<button type="button" class="btn sec small fd-media-upload-type" data-upload-type="' + esc(type) + '">' + esc(meta.uploadLabel) + '</button>') +
      '</div>';

    if (stripSearch) {
      var actions = head.querySelector('.fd-media-section__actions');
      stripSearch.classList.add('fd-media-section__search');
      actions.appendChild(stripSearch);
      actions.insertAdjacentHTML(
        'beforeend',
        '<button type="button" class="btn sec small fd-media-upload-type" data-upload-type="strip">Carica strip</button>'
      );
    }

    if (oldTitle) oldTitle.remove();
    if (oldHint) oldHint.remove();

    var bodyHost = document.createElement('div');
    bodyHost.className = 'fd-media-section__body';
    while (card.firstChild) bodyHost.appendChild(card.firstChild);

    card.appendChild(head);
    card.appendChild(bodyHost);

    head.querySelectorAll('.fd-media-upload-type').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openUploadForType(btn.getAttribute('data-upload-type'));
      });
    });
  }

  function createWalletIconSection() {
    if (document.getElementById('mediaWalletIconGrid')) return null;
    var grid = document.querySelector('#media-library .fd-media-grid');
    if (!grid) return null;

    var card = document.createElement('div');
    card.className = 'card fd-media-section';
    card.dataset.mediaType = 'wallet_icon';
    card.innerHTML =
      '<div class="fd-media-section__head">' +
      '<div class="fd-media-section__copy">' +
      '<h2 class="fd-media-section__title">' + esc(SECTION_META.wallet_icon.title) + '</h2>' +
      '<p class="fd-media-section__hint">' + esc(SECTION_META.wallet_icon.hint) + '</p>' +
      '</div>' +
      '<div class="fd-media-section__actions">' +
      '<button type="button" class="btn sec small fd-media-upload-type" data-upload-type="wallet_icon">' + esc(SECTION_META.wallet_icon.uploadLabel) + '</button>' +
      '</div></div>' +
      '<div class="fd-media-section__body"><div id="mediaWalletIconGrid" class="strip-gallery"><p class="fd-media-empty">Caricamento…</p></div></div>';
    card.dataset.fdMediaSection = '1';

    var stripCard = grid.querySelector('[data-media-type="strip"]') || grid.children[1];
    if (stripCard) grid.insertBefore(card, stripCard);
    else grid.appendChild(card);

    card.querySelector('.fd-media-upload-type').addEventListener('click', function () {
      openUploadForType('wallet_icon');
    });
    return card;
  }

  function ensureMediaLayout() {
    var section = document.getElementById('media-library');
    if (!section || section.dataset.fdMediaLayout === '1') return;
    section.dataset.fdMediaLayout = '1';
    section.classList.add('media-library--fd-layout');

    var header = section.querySelector(':scope > div');
    if (header) {
      header.classList.add('fd-media-header');
      var h1 = header.querySelector('h1');
      var actions = header.querySelector(':scope > div');
      if (h1 && actions) {
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

    var specsCard = section.querySelector(':scope > .card');
    if (specsCard) specsCard.remove();

    var grid = section.querySelector(':scope > div[style*="grid"]');
    if (grid) {
      grid.classList.add('fd-media-grid');
      grid.style.display = '';
      grid.style.gridTemplateColumns = '';
      var cards = grid.querySelectorAll(':scope > .card');
      if (cards[0]) wrapSectionCard(cards[0], 'logo');
      if (cards[1]) wrapSectionCard(cards[1], 'strip');
      if (cards[2]) wrapSectionCard(cards[2], 'thumbnail');
      if (cards[3]) wrapSectionCard(cards[3], 'background');
    }

    createWalletIconSection();

    if (!section.querySelector('#fdMediaBulkBar')) {
      var bulk = document.createElement('div');
      bulk.id = 'fdMediaBulkBar';
      bulk.className = 'fd-media-bulk-bar';
      bulk.hidden = true;
      bulk.innerHTML =
        '<span id="fdMediaBulkCount">0 selezionati</span>' +
        '<button type="button" class="btn sec" id="fdMediaBulkClearBtn">Deseleziona</button>' +
        '<button type="button" class="btn danger" id="fdMediaBulkDeleteBtn">Elimina selezionati</button>';
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

  function renderAssetCard(item, type) {
    var name = item.title || item.filename || SECTION_META[type].title;
    var usedIn = Number(item.used_in_count || 0);
    var usedText = usedIn > 0 ? ('Usato in: ' + usedIn + ' elementi') : 'Usato in: non assegnato';
    var metadata = estimateDims(type) + ' · ' + formatSize(item.size_bytes) + ' · ' + timeAgo(item.created_at);
    return (
      '<article class="media-card media-card--fd" data-asset-id="' + esc(item.id) + '" data-asset-type="' + esc(type) + '" data-asset-name="' + esc(name) + '" data-used-in="' + esc(usedIn) + '">' +
      '<div class="media-card__thumb-wrap">' +
      '<label class="media-card__check-wrap"><input type="checkbox" class="media-card__check" data-action="select" aria-label="Seleziona asset"></label>' +
      '<img src="/api/v1/media/' + esc(item.id) + '/image" alt="' + esc(name) + '">' +
      '<div class="media-card__overlay">' +
      '<button type="button" class="media-card__icon-btn" data-action="preview" aria-label="Preview asset">👁</button>' +
      '<button type="button" class="media-card__icon-btn" data-action="rename" aria-label="Rinomina asset">✎</button>' +
      '<button type="button" class="media-card__icon-btn media-card__icon-btn--danger" data-action="delete" aria-label="Elimina asset">🗑</button>' +
      '</div>' +
      '</div>' +
      '<div class="media-card__title">' + esc(name) + '</div>' +
      '<div class="media-card__meta">' + esc(metadata) + '</div>' +
      '<button type="button" class="media-card__used-in" data-action="used-in">' + esc(usedText) + '</button>' +
      '</article>'
    );
  }

  function renderEmptyDropzone(type) {
    var m = SECTION_META[type];
    return (
      '<button type="button" class="fd-media-dropzone" data-upload-type="' + esc(type) + '" aria-label="Carica ' + esc(m.title) + '">' +
      '<div class="fd-media-dropzone__icon">⤴</div>' +
      '<div class="fd-media-dropzone__title">Trascina qui il tuo asset o clicca per caricare</div>' +
      '<div class="fd-media-dropzone__spec">' + esc(m.hint) + '</div>' +
      '</button>'
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
            fetch((window.API || '/api/v1') + '/media/' + encodeURIComponent(id), {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title: next.trim(), type: type, brand_id: window.brandId })
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
          if (action === 'used-in') {
            if (typeof window.toast === 'function') window.toast('Dettaglio utilizzi in arrivo');
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
      if (!window.brandId) return;
      var api = window.API || '/api/v1';
      var res = await fetch(api + '/media?brand_id=' + encodeURIComponent(window.brandId));
      var items = await res.json().catch(function () { return []; });
      var rows = Array.isArray(items) ? items : [];
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
    };
  }

  function boot() {
    if (!isFiloMedia()) return;
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
