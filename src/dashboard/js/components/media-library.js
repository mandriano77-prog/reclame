/**
 * Ads2Wallet Media Library — A2W shell only (studio.ads2wallet.com).
 */
(function () {
  'use strict';

  const A2W = window.A2W = window.A2W || {};
  const BUCKETS = [
    { key: 'logo', hostId: 'mediaLogoBox', title: 'Logo brand', hint: 'PNG trasparente, max 320×100 px.' },
    { key: 'strip', hostId: 'mediaStripGrid', title: 'Strip default', hint: 'PNG/JPG 750×246 px — strip principale del pass.' },
    { key: 'thumbnail', hostId: 'mediaThumbnailGrid', title: 'Thumbnail', hint: 'PNG/JPG 90×90 px — Event Ticket (fronte).' },
    { key: 'background', hostId: 'mediaBackgroundGrid', title: 'Background', hint: 'PNG/JPG 360×440 px — sfondo Event Ticket.' }
  ];

  function esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function isActive() {
    return typeof window.isA2wDeploy === 'function' && window.isA2wDeploy()
      && document.documentElement.classList.contains('a2w-shell');
  }

  function ui() {
    return A2W.UI || {};
  }

  function state() {
    A2W.media = A2W.media || {};
    return A2W.media;
  }

  function partitionMedia(items) {
    const lists = { logo: [], strip: [], thumbnail: [], background: [], generic: [] };
    (items || []).forEach((it) => {
      const t = it.type || 'generic';
      if (lists[t]) lists[t].push(it);
      else lists.generic.push(it);
    });
    const primary = {
      logo: lists.logo[0] || null,
      strip: lists.strip.find((s) => !s.campaign_id) || lists.strip[0] || null,
      thumbnail: lists.thumbnail[0] || null,
      background: lists.background[0] || null
    };
    const primaryIds = new Set(
      Object.values(primary).filter(Boolean).map((i) => i.id)
    );
    const free = [];
    (items || []).forEach((it) => {
      if (it.type === 'generic') {
        free.push(it);
        return;
      }
      if (primaryIds.has(it.id)) return;
      free.push(it);
    });
    return { primary, lists, free };
  }

  function campaignLabel(it) {
    const name = it.campaign_name || '';
    if (name) return 'Usata in: ' + name;
    if (it.campaign_id) return 'Usata in: campagna';
    return 'Non assegnata';
  }

  function mediaImageUrl(id) {
    return '/api/v1/media/' + id + '/image';
  }

  async function downloadMedia(id, title) {
    try {
      const res = await fetch(mediaImageUrl(id), { headers: typeof getAuthHeaders === 'function' ? getAuthHeaders() : {} });
      if (!res.ok) throw new Error('Download fallito');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (title || 'media') + '.png';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      if (typeof toast === 'function') toast(err.message || 'Errore download');
    }
  }

  function openUploadForType(type, campaignId) {
    const sel = document.getElementById('mediaUploadType');
    if (sel) sel.value = type === 'free' ? 'generic' : type;
    if (typeof onMediaUploadTypeChange === 'function') onMediaUploadTypeChange();
    if (typeof openMediaUpload === 'function') openMediaUpload(campaignId || '');
  }

  async function confirmDeleteOne(id) {
    if (ui().openConfirmDialog) {
      const ok = await ui().openConfirmDialog({
        title: 'Elimina immagine',
        description: 'Questa azione è irreversibile.',
        confirmLabel: 'Elimina',
        requireTyping: false
      });
      if (!ok) return;
    } else if (typeof appConfirm === 'function') {
      const ok = await appConfirm({ title: 'Elimina media', message: 'Eliminare questo media?', confirmLabel: 'Elimina', tone: 'danger' });
      if (!ok) return;
    }
    if (typeof deleteMediaItem === 'function') {
      await deleteMediaItem(id, { skipConfirm: true });
    }
  }

  async function assignCampaignPrompt(item) {
    const campaigns = window.campaignsCache || [];
    if (!campaigns.length) {
      if (typeof toast === 'function') toast('Crea prima una campagna nella tab Campagne');
      return;
    }
    const names = campaigns.map((c, i) => (i + 1) + '. ' + c.name).join('\n');
    const raw = window.prompt('Assegna a campagna — inserisci il numero:\n' + names);
    if (raw == null || raw === '') return;
    const idx = parseInt(raw, 10) - 1;
    if (idx < 0 || idx >= campaigns.length) {
      if (typeof toast === 'function') toast('Selezione non valida');
      return;
    }
    if (typeof toast === 'function') {
      toast('Assegnazione campagna: richiede API di aggiornamento (non ancora disponibile). Ricarica con titolo [Campagna] in upload.');
    }
  }

  function renamePrompt(item) {
    const next = window.prompt('Nuovo nome', item.title || '');
    if (next == null || !String(next).trim()) return;
    if (typeof toast === 'function') toast('Rinomina: richiede API di aggiornamento (non ancora disponibile).');
  }

  function createCardMenu(item, opts) {
    opts = opts || {};
    if (!ui().createActionMenu) return null;
    const items = [];
    if (opts.allowAssign !== false && item.type === 'generic') {
      items.push({ label: 'Assegna a campagna', onClick: () => assignCampaignPrompt(item) });
    }
    items.push({ label: 'Rinomina', onClick: () => renamePrompt(item) });
    items.push({ label: 'Scarica', onClick: () => downloadMedia(item.id, item.title) });
    items.push({ label: 'Elimina', destructive: true, onClick: () => confirmDeleteOne(item.id) });
    return ui().createActionMenu({ label: 'Azioni immagine', items: items });
  }

  function createSystemCardMenu(item, bucketKey) {
    if (!ui().createActionMenu) return null;
    return ui().createActionMenu({
      label: 'Azioni ' + bucketKey,
      items: [
        { label: 'Scarica', onClick: () => downloadMedia(item.id, item.title) },
        {
          label: 'Rimuovi',
          destructive: true,
          onClick: () => confirmDeleteOne(item.id)
        }
      ]
    });
  }

  function renderSystemCard(bucket, item) {
    const host = document.getElementById(bucket.hostId);
    if (!host) return;
    host.className = 'a2w-media-host a2w-media-host--system';
    host.innerHTML = '';
    const card = document.createElement('article');
    card.className = 'a2w-media-system-card';
    card.setAttribute('data-a2w-bucket', bucket.key);
    card.setAttribute('data-media-id', item ? item.id : '');

    const preview = document.createElement('div');
    preview.className = 'a2w-media-system-card__preview';
    if (item) {
      const img = document.createElement('img');
      img.src = mediaImageUrl(item.id);
      img.alt = item.title || bucket.title;
      preview.appendChild(img);
    } else {
      preview.innerHTML = '<span class="a2w-media-system-card__empty">Nessun asset</span>';
    }
    card.appendChild(preview);

    const body = document.createElement('div');
    body.className = 'a2w-media-system-card__body';
    body.innerHTML = '<h3 class="a2w-media-system-card__title">' + esc(bucket.title) + '</h3>'
      + '<p class="a2w-media-system-card__hint">' + esc(bucket.hint) + '</p>';
    if (item && item.title) {
      body.innerHTML += '<p class="a2w-media-system-card__name">' + esc(item.title) + '</p>';
    }
    card.appendChild(body);

    const actions = document.createElement('div');
    actions.className = 'a2w-media-system-card__actions';
    const replaceBtn = document.createElement('button');
    replaceBtn.type = 'button';
    replaceBtn.className = 'btn a2w-btn-primary a2w-media-system-card__replace';
    replaceBtn.textContent = 'Sostituisci';
    replaceBtn.addEventListener('click', function () {
      openUploadForType(bucket.key, '');
    });
    actions.appendChild(replaceBtn);
    if (item) {
      const menu = createSystemCardMenu(item, bucket.key);
      if (menu) actions.appendChild(menu);
    }
    card.appendChild(actions);
    host.appendChild(card);
  }

  function renderFreeCard(item, viewMode) {
    const st = state();
    const selected = st.selectedIds && st.selectedIds.has(item.id);
    const wrap = document.createElement('article');
    wrap.className = 'a2w-media-gallery-card' + (viewMode === 'list' ? ' a2w-media-gallery-card--list' : '');
    wrap.setAttribute('data-media-id', item.id);

    const check = document.createElement('label');
    check.className = 'a2w-media-gallery-card__check';
    check.innerHTML = '<input type="checkbox" class="a2w-media-gallery-card__checkbox"' + (selected ? ' checked' : '') + ' aria-label="Seleziona">';
    check.querySelector('input').addEventListener('change', function (e) {
      toggleSelect(item.id, e.target.checked);
    });
    wrap.appendChild(check);

    const thumb = document.createElement('div');
    thumb.className = 'a2w-media-gallery-card__thumb';
    const img = document.createElement('img');
    img.src = mediaImageUrl(item.id);
    img.alt = item.title || 'Media';
    thumb.appendChild(img);
    wrap.appendChild(thumb);

    const meta = document.createElement('div');
    meta.className = 'a2w-media-gallery-card__meta';
    meta.innerHTML = '<div class="a2w-media-gallery-card__name">' + esc(item.title || 'Senza nome') + '</div>';
    const badge = document.createElement('span');
    const assigned = !!(item.campaign_id || item.campaign_name);
    badge.className = 'a2w-media-campaign-badge ' + (assigned ? 'a2w-badge-info' : 'a2w-badge-muted');
    badge.textContent = campaignLabel(item);
    meta.appendChild(badge);
    wrap.appendChild(meta);

    const menuSlot = document.createElement('div');
    menuSlot.className = 'a2w-media-gallery-card__menu';
    const menu = createCardMenu(item);
    if (menu) menuSlot.appendChild(menu);
    wrap.appendChild(menuSlot);

    return wrap;
  }

  function filterFreeItems(free) {
    const st = state();
    const q = (st.search || '').trim().toLowerCase();
    const status = st.statusFilter || 'all';
    const campaignId = st.campaignFilter || '';

    return free.filter((it) => {
      if (campaignId && it.campaign_id !== campaignId) return false;
      const assigned = !!(it.campaign_id || it.campaign_name);
      if (status === 'assigned' && !assigned) return false;
      if (status === 'unassigned' && assigned) return false;
      if (q) {
        const hay = [it.title, it.campaign_name, it.type, mediaTypeLabel(it.type)].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function mediaTypeLabel(type) {
    if (typeof window.mediaTypeLabel === 'function') return window.mediaTypeLabel(type);
    return type || '';
  }

  function toggleSelect(id, on) {
    const st = state();
    if (!st.selectedIds) st.selectedIds = new Set();
    if (on) st.selectedIds.add(id);
    else st.selectedIds.delete(id);
    updateBulkBar();
    const section = document.getElementById('media-library');
    if (section) {
      section.querySelectorAll('.a2w-media-gallery-card__checkbox').forEach((el) => {
        const card = el.closest('[data-media-id]');
        if (card && card.getAttribute('data-media-id') === id) el.checked = on;
      });
    }
  }

  function clearSelection() {
    const st = state();
    st.selectedIds = new Set();
    updateBulkBar();
    document.querySelectorAll('#mediaFreeGallery .a2w-media-gallery-card__checkbox').forEach((el) => {
      el.checked = false;
    });
  }

  function updateBulkBar() {
    const bar = document.getElementById('a2wMediaBulkBar');
    const st = state();
    const count = st.selectedIds ? st.selectedIds.size : 0;
    if (!bar) return;
    bar.hidden = count === 0;
    const label = bar.querySelector('.a2w-media-bulk-bar__count');
    if (label) label.textContent = count + ' selezionat' + (count === 1 ? 'a' : 'e');
  }

  async function bulkDelete() {
    const st = state();
    const ids = [...(st.selectedIds || [])];
    if (!ids.length) return;
    let ok = false;
    if (ui().openConfirmDialog) {
      ok = await ui().openConfirmDialog({
        title: 'Elimina selezione',
        description: 'Eliminerai ' + ids.length + ' immagini.',
        confirmLabel: 'Elimina',
        requireTyping: false
      });
    } else if (typeof appConfirm === 'function') {
      ok = await appConfirm({ title: 'Elimina', message: 'Eliminare ' + ids.length + ' media?', tone: 'danger' });
    }
    if (!ok) return;
    for (const id of ids) {
      try {
        await fetch((window.API || '/api/v1') + '/media/' + id, { method: 'DELETE' });
      } catch (_) {}
    }
    clearSelection();
    if (typeof toast === 'function') toast('Media eliminati');
    if (typeof loadMediaLibrary === 'function') loadMediaLibrary();
  }

  function bulkDownload() {
    const st = state();
    const items = (st.lastItems || []).filter((it) => st.selectedIds && st.selectedIds.has(it.id));
    items.forEach((it) => downloadMedia(it.id, it.title));
  }

  function renderFreeGallery(free) {
    const host = document.getElementById('mediaFreeGallery');
    if (!host) return;
    const st = state();
    const filtered = filterFreeItems(free);
    const viewMode = st.viewMode || 'grid';
    host.className = 'a2w-media-gallery a2w-media-gallery--' + viewMode;
    host.innerHTML = '';

    if (!filtered.length) {
      if (ui().createEmptyState) {
        host.appendChild(ui().createEmptyState({
          title: free.length ? 'Nessun risultato' : 'Nessuna immagine in libreria',
          description: free.length
            ? 'Prova a modificare ricerca o filtri.'
            : 'Carica immagini libere da usare nelle campagne.',
          primaryAction: {
            label: 'Carica la prima immagine',
            onClick: function () { openUploadForType('free', ''); }
          }
        }));
      } else {
        host.innerHTML = '<p style="color:var(--text2)">Nessuna immagine.</p>';
      }
      return;
    }

    filtered.forEach((it) => host.appendChild(renderFreeCard(it, viewMode)));
    updateBulkBar();
  }

  function ensureToolbar() {
    const mount = document.getElementById('a2wMediaToolbarMount');
    if (!mount || mount.dataset.mounted === '1') return;
    mount.dataset.mounted = '1';
    const st = state();

    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'a2w-media-toolbar-search';
    search.placeholder = 'Cerca nome, tag, campagna…';
    search.id = 'a2wMediaFreeSearch';
    search.value = st.search || '';
    search.addEventListener('input', function () {
      st.search = search.value;
      renderFreeGallery(st.lastFree || []);
    });

    const statusSel = document.createElement('select');
    statusSel.className = 'a2w-media-toolbar-select';
    statusSel.id = 'a2wMediaStatusFilter';
    [
      { v: 'all', l: 'Tutte' },
      { v: 'assigned', l: 'Assegnate' },
      { v: 'unassigned', l: 'Non assegnate' }
    ].forEach((o) => {
      const opt = document.createElement('option');
      opt.value = o.v;
      opt.textContent = o.l;
      statusSel.appendChild(opt);
    });
    statusSel.value = st.statusFilter || 'all';
    statusSel.addEventListener('change', function () {
      st.statusFilter = statusSel.value;
      renderFreeGallery(st.lastFree || []);
    });

    const campSel = document.createElement('select');
    campSel.className = 'a2w-media-toolbar-select';
    campSel.id = 'a2wMediaFreeCampaignFilter';
    campSel.innerHTML = '<option value="">Tutte le campagne</option>';
    (window.campaignsCache || []).forEach((c) => {
      const o = document.createElement('option');
      o.value = c.id;
      o.textContent = c.name;
      campSel.appendChild(o);
    });
    campSel.addEventListener('change', function () {
      st.campaignFilter = campSel.value;
      renderFreeGallery(st.lastFree || []);
    });

    const viewToggle = document.createElement('div');
    viewToggle.className = 'a2w-media-view-toggle';
    viewToggle.setAttribute('role', 'group');
    viewToggle.setAttribute('aria-label', 'Layout galleria');
    ['grid', 'list'].forEach((mode) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'a2w-media-view-btn' + ((st.viewMode || 'grid') === mode ? ' is-active' : '');
      btn.textContent = mode === 'grid' ? 'Griglia' : 'Lista';
      btn.addEventListener('click', function () {
        st.viewMode = mode;
        viewToggle.querySelectorAll('.a2w-media-view-btn').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        renderFreeGallery(st.lastFree || []);
      });
      viewToggle.appendChild(btn);
    });

    if (ui().createToolbar) {
      const toolbar = ui().createToolbar({ left: [search, statusSel, campSel], right: [viewToggle] });
      mount.appendChild(toolbar);
    } else {
      mount.append(search, statusSel, campSel, viewToggle);
    }
  }

  function ensureBulkBar() {
    let bar = document.getElementById('a2wMediaBulkBar');
    if (bar) return bar;
    bar = document.createElement('div');
    bar.id = 'a2wMediaBulkBar';
    bar.className = 'a2w-media-bulk-bar';
    bar.hidden = true;
    bar.innerHTML = [
      '<span class="a2w-media-bulk-bar__count">0 selezionate</span>',
      '<div class="a2w-media-bulk-bar__actions">',
      '  <button type="button" class="btn sec a2w-media-bulk-assign">Assegna</button>',
      '  <button type="button" class="btn sec a2w-media-bulk-download">Scarica</button>',
      '  <button type="button" class="btn a2w-ui-btn-destructive a2w-media-bulk-delete">Elimina</button>',
      '  <button type="button" class="btn sec a2w-media-bulk-clear">Annulla</button>',
      '</div>'
    ].join('');
    bar.querySelector('.a2w-media-bulk-assign').addEventListener('click', function () {
      if (typeof toast === 'function') toast('Assegnazione multipla: in arrivo');
    });
    bar.querySelector('.a2w-media-bulk-download').addEventListener('click', bulkDownload);
    bar.querySelector('.a2w-media-bulk-delete').addEventListener('click', bulkDelete);
    bar.querySelector('.a2w-media-bulk-clear').addEventListener('click', clearSelection);
    const freeSection = document.getElementById('a2wMediaFreeSection');
    if (freeSection) freeSection.appendChild(bar);
    return bar;
  }

  function ensurePageHeader() {
    const mount = document.getElementById('a2wMediaPageHeader');
    if (!mount || mount.dataset.mounted === '1' || !ui().createPageHeader) return;
    mount.dataset.mounted = '1';

    const uploadBtn = document.createElement('button');
    uploadBtn.type = 'button';
    uploadBtn.className = 'btn a2w-btn-primary';
    uploadBtn.textContent = 'Carica immagine';
    uploadBtn.addEventListener('click', function () { openUploadForType('free', ''); });

    const pageMenu = ui().createActionMenu({
      label: 'Azioni pagina',
      items: [{
        label: 'Svuota tutto',
        destructive: true,
        onClick: function () {
          if (typeof deleteAllMedia === 'function') deleteAllMedia();
        }
      }]
    });

    const actions = [uploadBtn, pageMenu];
    mount.appendChild(ui().createPageHeader({
      title: 'Media Library',
      description: 'Tutte le immagini del brand: asset di sistema (usati nei pass) e libreria libera per campagne.',
      actions: actions
    }));

    const legacyHead = document.getElementById('media-library-legacy-head');
    if (legacyHead) legacyHead.style.display = 'none';
  }

  function ensureDropzones() {
    BUCKETS.forEach((bucket) => {
      const host = document.getElementById(bucket.hostId);
      if (!host) return;
      const card = host.closest('.a2w-media-bucket');
      if (!card || card.querySelector('.a2w-media-dropzone')) return;
      const dz = document.createElement('div');
      dz.className = 'a2w-media-dropzone';
      dz.setAttribute('data-a2w-media-type', bucket.key);
      dz.setAttribute('tabindex', '0');
      dz.setAttribute('role', 'button');
      dz.innerHTML = '<div class="a2w-media-dropzone__title">Trascina o clicca</div><div class="a2w-media-dropzone__hint">' + bucket.key.toUpperCase() + '</div>';
      card.insertBefore(dz, host);
      if (typeof A2W.bindMediaDropzone === 'function') {
        A2W.bindMediaDropzone(dz);
      }
    });
  }

  function mount() {
    if (!isActive() || state().mounted) return;
    const section = document.getElementById('media-library');
    if (!section) return;
    state().mounted = true;
    section.setAttribute('data-a2w-component', 'media-library');

    const specsCard = section.querySelector('.a2w-media-specs-legacy');
    if (specsCard) specsCard.style.display = 'none';

    const legacyStripTools = document.getElementById('media-library-legacy-strip-tools');
    if (legacyStripTools) legacyStripTools.style.display = 'none';
    const legacyGrid = document.getElementById('media-library-legacy-grid');
    if (legacyGrid) legacyGrid.style.display = 'none';

    ensurePageHeader();
    ensureToolbar();
    ensureBulkBar();
    ensureDropzones();

    const sys = document.getElementById('a2wMediaSystemSection');
    const free = document.getElementById('a2wMediaFreeSection');
    if (sys) sys.hidden = false;
    if (free) free.hidden = false;
  }

  function refreshCampaignFilterOptions() {
    const campSel = document.getElementById('a2wMediaFreeCampaignFilter');
    if (!campSel) return;
    const current = campSel.value;
    campSel.innerHTML = '<option value="">Tutte le campagne</option>';
    (window.campaignsCache || []).forEach((c) => {
      const o = document.createElement('option');
      o.value = c.id;
      o.textContent = c.name;
      campSel.appendChild(o);
    });
    if (current) campSel.value = current;
  }

  function render(items) {
    if (!isActive()) return;
    mount();
    refreshCampaignFilterOptions();
    const st = state();
    st.lastItems = items || [];
    st.selectedIds = st.selectedIds || new Set();
    const parts = partitionMedia(items);
    st.lastFree = parts.free;

    BUCKETS.forEach((bucket) => {
      renderSystemCard(bucket, parts.primary[bucket.key]);
    });
    renderFreeGallery(parts.free);
  }

  A2W.Media = {
    isActive: isActive,
    mount: mount,
    render: render,
    partitionMedia: partitionMedia,
    clearSelection: clearSelection
  };
})();
