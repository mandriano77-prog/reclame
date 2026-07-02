/**
 * Ads2Wallet — Template Pass editor UX (anteprima, toggle fronte/retro, upload, colori).
 */
(function (global) {
  'use strict';

  var TPL_SLOTS = {
    logo: { accept: 'image/png,image/jpeg,image/webp,image/svg+xml,.pdf', hint: 'PNG consigliato, max 320×100 px' },
    wallet_icon: { accept: 'image/png,image/jpeg,image/webp', hint: 'PNG quadrato 512×512 px' },
    strip: { accept: 'image/png,image/jpeg,image/webp', hint: 'PNG 750×246 px (rapporto 1125:432)' },
    thumbnail: { accept: 'image/png,image/jpeg,image/webp', hint: 'PNG 90×90 px' },
    background: { accept: 'image/png,image/jpeg,image/webp', hint: 'PNG 360×440 px' }
  };

  var brandPaletteCache = null;
  var manualPaletteOverride = false;

  function isActive() {
    return document.documentElement.classList.contains('a2w-shell') &&
      !(typeof global.isFiloShell === 'function' && global.isFiloShell());
  }

  function defaultColors() {
    return global.BRAND_PASS_FIXED_COLORS || {
      backgroundColor: '#0D0B1A',
      foregroundColor: '#FFFFFF',
      labelColor: '#A78BFA'
    };
  }

  function getColorInputs() {
    return {
      bg: document.getElementById('tplColorBg'),
      fg: document.getElementById('tplColorFg'),
      lbl: document.getElementById('tplColorLabel')
    };
  }

  function colorsFromBrandConfig(config) {
    if (!config) return null;
    var bg = config.backgroundColor;
    var fg = config.foregroundColor;
    var lbl = config.labelColor;
    if (!bg && config.colors) {
      bg = config.colors.background || config.colors.accent;
      fg = config.colors.text;
      lbl = config.colors.accent;
    }
    if (!bg) return null;
    return {
      backgroundColor: bg,
      foregroundColor: fg || defaultColors().foregroundColor,
      labelColor: lbl || bg
    };
  }

  function hasAutoBrandPalette(config) {
    return !!(config && config.palette_source && config.palette_source !== 'manual');
  }

  function isManualBrandPalette(config) {
    return !!(config && config.palette_source === 'manual');
  }

  function renderPaletteSwatches(colors) {
    var box = document.getElementById('tplPaletteSwatches');
    if (!box) return;
    if (!colors) {
      box.innerHTML = '<span style="font-size:12px;color:var(--text2);">Carica un logo nel brand per generare la palette.</span>';
      return;
    }
    var items = [
      { key: 'backgroundColor', label: 'Sfondo' },
      { key: 'foregroundColor', label: 'Testo' },
      { key: 'labelColor', label: 'Label' }
    ];
    box.innerHTML = items.map(function (item) {
      var hex = colors[item.key] || '#000000';
      return '<div class="a2w-tpl-palette-swatch">' +
        '<span class="a2w-tpl-palette-swatch__chip" style="background:' + hex + ';"></span>' +
        '<span class="a2w-tpl-palette-swatch__label">' + item.label + '</span>' +
        '</div>';
    }).join('');
  }

  function syncTplPaletteUi() {
    var autoBlock = document.getElementById('tplPaletteAutoBlock');
    var manualBlock = document.getElementById('tplPaletteManualBlock');
    var hint = document.getElementById('tplPaletteAutoHint');
    var cfg = brandPaletteCache;
    var autoColors = hasAutoBrandPalette(cfg) ? colorsFromBrandConfig(cfg) : null;
    var manualColors = isManualBrandPalette(cfg) ? colorsFromBrandConfig(cfg) : null;
    var effective = manualPaletteOverride
      ? null
      : (autoColors || manualColors);

    if (autoBlock) autoBlock.hidden = !!manualPaletteOverride;
    if (manualBlock) manualBlock.hidden = !manualPaletteOverride;

    if (!manualPaletteOverride) {
      renderPaletteSwatches(effective);
      if (hint) {
        if (cfg && cfg.palette_source === 'logo-auto') {
          hint.textContent = 'Generata dal logo del brand.';
        } else if (cfg && cfg.palette_source === 'icon-auto') {
          hint.textContent = 'Generata dall\'icona notifica (logo non ancora disponibile).';
        } else if (cfg && cfg.palette_source === 'manual') {
          hint.textContent = 'Palette personalizzata attiva sul brand.';
        } else {
          hint.textContent = 'Nessuna palette automatica: carica un logo o usa Personalizza colori.';
        }
      }
    }
    applyPreviewColors();
  }

  async function loadBrandPaletteForTemplate() {
    brandPaletteCache = null;
    manualPaletteOverride = false;
    if (!global.brandId || typeof global.fetchBrandById !== 'function') {
      syncTplPaletteUi();
      return;
    }
    try {
      var brand = await global.fetchBrandById(global.brandId);
      brandPaletteCache = (brand && brand.config) || null;
      manualPaletteOverride = isManualBrandPalette(brandPaletteCache);
      if (manualPaletteOverride) {
        // Pickers pre-caricati con i colori manuali salvati sul brand.
        var manual = colorsFromBrandConfig(brandPaletteCache) || defaultColors();
        var c = getColorInputs();
        if (c.bg) c.bg.value = manual.backgroundColor;
        if (c.fg) c.fg.value = manual.foregroundColor;
        if (c.lbl) c.lbl.value = manual.labelColor;
      }
    } catch (_) {
      brandPaletteCache = null;
    }
    syncTplPaletteUi();
  }

  function setManualPaletteMode(enabled) {
    manualPaletteOverride = !!enabled;
    var cfg = brandPaletteCache;
    if (enabled) {
      var colors = colorsFromBrandConfig(cfg) || defaultColors();
      var c = getColorInputs();
      if (c.bg) c.bg.value = colors.backgroundColor;
      if (c.fg) c.fg.value = colors.foregroundColor;
      if (c.lbl) c.lbl.value = colors.labelColor;
    }
    syncTplPaletteUi();
  }

  async function restoreAutoBrandPalette() {
    if (!global.brandId) return;
    try {
      var res = await fetch((global.API || '/api/v1') + '/brands/' + global.brandId + '/logo/sync-from-identity', {
        method: 'POST',
        headers: typeof global.waiFetchHeaders === 'function' ? global.waiFetchHeaders() : { 'Content-Type': 'application/json' }
      });
      if (!res.ok) {
        var err = await res.json().catch(function () { return {}; });
        if (typeof global.toast === 'function') global.toast(err.error || 'Impossibile rigenerare la palette dal logo');
        return;
      }
      manualPaletteOverride = false;
      if (typeof global.invalidateBrandCache === 'function') global.invalidateBrandCache();
      await loadBrandPaletteForTemplate();
      if (typeof global.applyBrandTheme === 'function') global.applyBrandTheme();
      if (typeof global.toast === 'function') global.toast('Palette automatica ripristinata dal logo');
    } catch (e) {
      if (typeof global.toast === 'function') global.toast('Errore ripristino palette');
    }
  }

  async function persistManualBrandPaletteIfNeeded() {
    if (!manualPaletteOverride || !global.brandId) return;
    var colors = getTemplatePreviewColors();
    var existing = typeof global.fetchBrandById === 'function'
      ? await global.fetchBrandById(global.brandId)
      : null;
    var cfg = Object.assign({}, (existing && existing.config) || {});
    cfg.backgroundColor = colors.backgroundColor;
    cfg.foregroundColor = colors.foregroundColor;
    cfg.labelColor = colors.labelColor;
    cfg.colors = Object.assign({}, cfg.colors || {}, {
      background: colors.backgroundColor,
      text: colors.foregroundColor,
      accent: colors.backgroundColor
    });
    cfg.palette_source = 'manual';
    cfg.palette_updated_at = new Date().toISOString();
    var res = await fetch((global.API || '/api/v1') + '/brands/' + global.brandId, {
      method: 'PUT',
      headers: typeof global.waiFetchHeaders === 'function' ? global.waiFetchHeaders() : { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: cfg })
    });
    if (!res.ok) {
      var err = await res.json().catch(function () { return {}; });
      throw new Error(err.error || 'Errore salvataggio palette brand');
    }
    brandPaletteCache = cfg;
    if (typeof global.invalidateBrandCache === 'function') global.invalidateBrandCache();
    if (typeof global.applyBrandTheme === 'function') global.applyBrandTheme();
  }

  function initPaletteControls() {
    var customizeBtn = document.getElementById('tplPaletteCustomizeBtn');
    var restoreBtn = document.getElementById('tplPaletteRestoreAutoBtn');
    if (customizeBtn && customizeBtn.dataset.a2wBound !== '1') {
      customizeBtn.dataset.a2wBound = '1';
      customizeBtn.addEventListener('click', function () { setManualPaletteMode(true); });
    }
    if (restoreBtn && restoreBtn.dataset.a2wBound !== '1') {
      restoreBtn.dataset.a2wBound = '1';
      restoreBtn.addEventListener('click', function () { restoreAutoBrandPalette(); });
    }
  }

  function getTemplatePreviewColors() {
    var d = defaultColors();
    if (!manualPaletteOverride) {
      var auto = hasAutoBrandPalette(brandPaletteCache) || isManualBrandPalette(brandPaletteCache)
        ? colorsFromBrandConfig(brandPaletteCache)
        : null;
      if (auto) return auto;
    }
    var c = getColorInputs();
    return {
      backgroundColor: (c.bg && c.bg.value) || d.backgroundColor,
      foregroundColor: (c.fg && c.fg.value) || d.foregroundColor,
      labelColor: (c.lbl && c.lbl.value) || d.labelColor
    };
  }

  function applyPreviewColors() {
    var colors = getTemplatePreviewColors();
    var front = document.getElementById('passPreviewFront');
    if (!front) return;
    front.style.backgroundColor = colors.backgroundColor;
    front.style.setProperty('--a2w-tpl-fg-color', colors.foregroundColor);
    front.style.setProperty('--a2w-tpl-label-color', colors.labelColor);
    var barcode = front.querySelector('.pp-barcode-bar');
    if (barcode) {
      barcode.style.filter = colors.foregroundColor.toLowerCase() === '#ffffff' || colors.foregroundColor === '#fff'
        ? 'none' : 'invert(1)';
    }
  }

  function setPreviewFace(face) {
    var container = document.getElementById('tplPassFlip');
    if (!container) return;
    var isBack = face === 'back';
    container.classList.toggle('a2w-tpl-show-back', isBack);
    document.querySelectorAll('.a2w-tpl-preview-toggle__btn').forEach(function (btn) {
      var active = btn.getAttribute('data-tpl-face') === face;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  function initPreviewToggle() {
    var container = document.getElementById('tplPassFlip');
    if (!container || container.dataset.a2wToggleBound === '1') return;
    container.dataset.a2wToggleBound = '1';
    container.classList.remove('flipped');
    container.removeAttribute('onmouseenter');
    container.removeAttribute('onmouseleave');
    container.onmouseenter = null;
    container.onmouseleave = null;

    document.querySelectorAll('.a2w-tpl-preview-toggle__btn').forEach(function (btn) {
      if (btn.dataset.a2wBound === '1') return;
      btn.dataset.a2wBound = '1';
      btn.addEventListener('click', function () {
        setPreviewFace(btn.getAttribute('data-tpl-face') || 'front');
      });
    });
    setPreviewFace('front');
  }

  function fileInputForSlot(slot) {
    var map = {
      logo: 'tplImgLogo',
      wallet_icon: 'tplImgWalletIcon',
      strip: 'tplImgStrip',
      thumbnail: 'tplImgThumb',
      background: 'tplImgBg'
    };
    return document.getElementById(map[slot]);
  }

  function showUploadError(wrap, msg) {
    var err = wrap.querySelector('.a2w-tpl-upload__error');
    if (!err) return;
    if (msg) {
      err.textContent = msg;
      err.hidden = false;
    } else {
      err.textContent = '';
      err.hidden = true;
    }
  }

  function validateFile(slot, file) {
    if (!file) return 'Nessun file selezionato';
    var okTypes = /^(image\/(png|jpeg|jpg|webp|svg\+xml)|application\/pdf)$/i;
    if (!okTypes.test(file.type) && !/\.(png|jpe?g|webp|svg|pdf)$/i.test(file.name)) {
      return 'Formato non supportato. Usa PNG, JPEG, WebP o SVG.';
    }
    if (file.size > 8 * 1024 * 1024) return 'File troppo grande (max 8 MB).';
    return '';
  }

  /** Base64 già salvati sul template (GET) — non in tplImageCache finché l'utente non cambia file. */
  var persistedImages = {};

  function getWrapForSlot(slot) {
    return document.querySelector('#templateModal .a2w-tpl-upload[data-tpl-slot="' + slot + '"]');
  }

  function previewIdForSlot(slot) {
    return typeof global.tplMediaPreviewId === 'function'
      ? global.tplMediaPreviewId(slot)
      : null;
  }

  function ensurePreviewImg(wrap, slot) {
    var previewId = previewIdForSlot(slot);
    if (!previewId) return null;
    var preview = document.getElementById(previewId);
    if (!preview) {
      preview = document.createElement('img');
      preview.id = previewId;
      preview.alt = 'Anteprima ' + slot;
      preview.style.display = 'none';
    }
    if (wrap && !wrap.contains(preview)) {
      preview.style.display = preview.style.display || 'none';
      wrap.appendChild(preview);
    }
    return preview;
  }

  function getSlotPreviewSrc(slot) {
    var previewId = previewIdForSlot(slot);
    var preview = previewId ? document.getElementById(previewId) : null;
    if (preview && preview.src && preview.style.display !== 'none') return preview.src;
    if (global.tplImageCache && global.tplImageCache[slot]) {
      return 'data:image/png;base64,' + global.tplImageCache[slot];
    }
    if (persistedImages[slot]) {
      return 'data:image/png;base64,' + persistedImages[slot];
    }
    return '';
  }

  function syncUploadZone(wrap, slot) {
    if (!wrap) wrap = getWrapForSlot(slot);
    var zone = wrap && wrap.querySelector('.a2w-tpl-upload__zone');
    if (!zone) return;
    var src = getSlotPreviewSrc(slot);
    if (src) {
      zone.innerHTML = '';
      var img = document.createElement('img');
      img.className = 'a2w-tpl-upload__thumb' + (slot === 'wallet_icon' || slot === 'thumbnail' ? ' a2w-tpl-upload__thumb--square' : '');
      img.src = src;
      img.alt = '';
      zone.appendChild(img);
      var preview = ensurePreviewImg(wrap, slot);
      if (preview && (!preview.src || preview.style.display === 'none')) {
        preview.src = src;
        preview.style.display = 'block';
      }
    } else {
      zone.innerHTML = '<span>Trascina un file o clicca per caricare</span>';
    }
  }

  function syncTplUploadZone(slot) {
    syncUploadZone(getWrapForSlot(slot), slot);
  }

  function syncAllTplUploadZones() {
    Object.keys(TPL_SLOTS).forEach(syncTplUploadZone);
  }

  function setSlotPreview(slot, src, opts) {
    opts = opts || {};
    var wrap = getWrapForSlot(slot);
    if (wrap) {
      var preview = ensurePreviewImg(wrap, slot);
      if (preview) {
        preview.src = src;
        preview.style.display = 'block';
      }
      syncUploadZone(wrap, slot);
    } else {
      var previewId = previewIdForSlot(slot);
      var preview = previewId ? document.getElementById(previewId) : null;
      if (preview) {
        preview.src = src;
        preview.style.display = 'block';
      }
    }
    if (!opts.skipPassPreview && typeof global.updatePassPreview === 'function') {
      global.updatePassPreview();
    }
  }

  function applyStyleImages(styleImages) {
    persistedImages = {};
    if (!styleImages || typeof styleImages !== 'object') return;
    Object.keys(TPL_SLOTS).forEach(function (slot) {
      if (!styleImages[slot]) return;
      persistedImages[slot] = styleImages[slot];
      setSlotPreview(slot, 'data:image/png;base64,' + styleImages[slot], { skipPassPreview: true });
    });
    if (typeof global.updatePassPreview === 'function') global.updatePassPreview();
  }

  function resetPersistedImages() {
    persistedImages = {};
  }

  function enhanceUploadSlot(slot) {
    var input = fileInputForSlot(slot);
    if (!input) return;
    var existingWrap = getWrapForSlot(slot);
    if (input.dataset.a2wUploadEnhanced === '1' && existingWrap) {
      syncUploadZone(existingWrap, slot);
      return;
    }
    var group = input.closest('.form-group');
    if (!group) return;
    input.dataset.a2wUploadEnhanced = '1';

    var previewId = previewIdForSlot(slot);
    var existingPreview = previewId
      ? (group.querySelector('#' + previewId) || document.getElementById(previewId))
      : null;
    var savedSrc = existingPreview && existingPreview.src ? existingPreview.src : '';
    var savedVisible = existingPreview && existingPreview.style.display !== 'none';

    var wrap = document.createElement('div');
    wrap.className = 'a2w-tpl-upload a2w-tpl-upload--enhanced';
    wrap.setAttribute('data-tpl-slot', slot);

    var label = group.querySelector('.form-label');
    if (label) wrap.appendChild(label.cloneNode(true));

    var zone = document.createElement('div');
    zone.className = 'a2w-tpl-upload__zone';
    zone.setAttribute('role', 'button');
    zone.setAttribute('tabindex', '0');
    zone.innerHTML = '<span>Trascina un file o clicca per caricare</span>';
    wrap.appendChild(zone);

    var actions = document.createElement('div');
    actions.className = 'a2w-tpl-upload__actions';
    var libBtn = group.querySelector('button[onclick*="tplPickFromMedia"]');
    if (libBtn) actions.appendChild(libBtn.cloneNode(true));
    var removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn small sec';
    removeBtn.textContent = 'Rimuovi';
    removeBtn.addEventListener('click', function () {
      if (global.tplImageCache) delete global.tplImageCache[slot];
      delete persistedImages[slot];
      input.value = '';
      var preview = ensurePreviewImg(wrap, slot);
      if (preview) { preview.style.display = 'none'; preview.removeAttribute('src'); }
      showUploadError(wrap, '');
      syncUploadZone(wrap, slot);
      if (typeof global.updatePassPreview === 'function') global.updatePassPreview();
    });
    actions.appendChild(removeBtn);
    wrap.appendChild(actions);

    var hint = document.createElement('p');
    hint.className = 'a2w-tpl-upload__hint';
    hint.textContent = (TPL_SLOTS[slot] && TPL_SLOTS[slot].hint) || '';
    wrap.appendChild(hint);

    var err = document.createElement('p');
    err.className = 'a2w-tpl-upload__error';
    err.hidden = true;
    wrap.appendChild(err);

    wrap.appendChild(input);

    var preview = ensurePreviewImg(wrap, slot);
    if (preview && savedSrc && savedVisible) {
      preview.src = savedSrc;
      preview.style.display = 'block';
    }

    var oldBtns = group.querySelector('div[style*="display:flex"]');
    var oldSelect = group.querySelector('#tplStripPromoSelect');
    group.innerHTML = '';
    group.appendChild(wrap);
    if (slot === 'strip' && oldSelect) {
      var promoWrap = document.createElement('div');
      promoWrap.className = 'a2w-tpl-upload__actions';
      promoWrap.style.marginTop = '4px';
      var promoLabel = document.createElement('label');
      promoLabel.className = 'form-label';
      promoLabel.style.fontSize = '11px';
      promoLabel.textContent = 'Oppure da Strip Promo';
      promoWrap.appendChild(promoLabel);
      promoWrap.appendChild(oldSelect);
      group.appendChild(promoWrap);
    }

    function pickFile() { input.click(); }

    function handleFiles(fileList) {
      var file = fileList && fileList[0];
      var errMsg = validateFile(slot, file);
      if (errMsg) { showUploadError(wrap, errMsg); return; }
      showUploadError(wrap, '');
      var dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      if (typeof global.previewTplImage === 'function') global.previewTplImage(input, slot);
      else setTimeout(function () { syncUploadZone(wrap, slot); }, 50);
    }

    zone.addEventListener('click', pickFile);
    zone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickFile(); }
    });
    zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.classList.add('is-dragover'); });
    zone.addEventListener('dragleave', function () { zone.classList.remove('is-dragover'); });
    zone.addEventListener('drop', function (e) {
      e.preventDefault();
      zone.classList.remove('is-dragover');
      handleFiles(e.dataTransfer.files);
    });
    input.addEventListener('change', function () {
      var errMsg = validateFile(slot, input.files[0]);
      if (errMsg) { showUploadError(wrap, errMsg); input.value = ''; return; }
      showUploadError(wrap, '');
      setTimeout(function () { syncUploadZone(wrap, slot); }, 50);
    });

    if (libBtn) {
      var cloned = actions.querySelector('button');
      if (cloned) {
        cloned.addEventListener('click', function () {
          if (typeof global.tplPickFromMedia === 'function') global.tplPickFromMedia(slot);
        });
      }
    }

    syncUploadZone(wrap, slot);
  }

  function enhanceAllUploads() {
    Object.keys(TPL_SLOTS).forEach(enhanceUploadSlot);
  }

  function resetColorPickers(style) {
    var d = defaultColors();
    var s = style || {};
    var c = getColorInputs();
    var effective = (!manualPaletteOverride && brandPaletteCache)
      ? (colorsFromBrandConfig(brandPaletteCache) || s)
      : s;
    if (c.bg) c.bg.value = effective.backgroundColor || d.backgroundColor;
    if (c.fg) c.fg.value = effective.foregroundColor || d.foregroundColor;
    if (c.lbl) c.lbl.value = effective.labelColor || d.labelColor;
    syncTplPaletteUi();
  }

  function initColorPickers() {
    var c = getColorInputs();
    [c.bg, c.fg, c.lbl].forEach(function (el) {
      if (!el || el.dataset.a2wColorBound === '1') return;
      el.dataset.a2wColorBound = '1';
      el.addEventListener('input', function () {
        applyPreviewColors();
        if (typeof global.updatePassPreview === 'function') global.updatePassPreview();
      });
    });
  }

  function setSaveStatus(state, message) {
    var el = document.getElementById('tplSaveStatus');
    var btn = document.getElementById('tplSaveBtn');
    if (el) {
      el.textContent = message || '';
      el.className = 'a2w-tpl-save-status' + (state ? ' is-' + state : '');
    }
    if (btn) {
      btn.disabled = state === 'saving';
      if (state === 'saving') {
        btn.dataset.a2wPrevLabel = btn.textContent;
        btn.textContent = 'Salvataggio…';
      } else if (btn.dataset.a2wPrevLabel) {
        btn.textContent = btn.dataset.a2wPrevLabel;
        delete btn.dataset.a2wPrevLabel;
      }
    }
  }

  function patchSaveTemplate() {
    if (global.__a2wTplSavePatched || typeof global.saveTemplate !== 'function') return;
    global.__a2wTplSavePatched = true;
    var orig = global.saveTemplate;
    global.saveTemplate = async function a2wSaveTemplateWrapped() {
      if (!isActive()) return orig.apply(this, arguments);
      setSaveStatus('saving', 'Salvataggio…');
      try {
        await orig.apply(this, arguments);
        if (manualPaletteOverride) await persistManualBrandPaletteIfNeeded();
        setSaveStatus('ok', 'Salvato');
      } catch (e) {
        setSaveStatus('error', e.message || 'Errore salvataggio');
        throw e;
      }
    };
  }

  function patchUpdatePassPreview() {
    if (global.__a2wTplPreviewPatched || typeof global.updatePassPreview !== 'function') return;
    global.__a2wTplPreviewPatched = true;
    var orig = global.updatePassPreview;
    global.updatePassPreview = function a2wUpdatePassPreviewWrapped() {
      var out = orig.apply(this, arguments);
      if (isActive()) applyPreviewColors();
      return out;
    };
  }

  function patchPreviewTplImage() {
    if (global.__a2wPreviewTplPatched || typeof global.previewTplImage !== 'function') return;
    global.__a2wPreviewTplPatched = true;
    var orig = global.previewTplImage;
    global.previewTplImage = function (input, imageType) {
      orig.apply(this, arguments);
      if (!isActive()) return;
      setTimeout(function () { syncTplUploadZone(imageType); }, 0);
    };
  }

  function patchTplPickFromMedia() {
    if (global.__a2wTplPickPatched || typeof global.tplPickFromMedia !== 'function') return;
    global.__a2wTplPickPatched = true;
    var orig = global.tplPickFromMedia;
    global.tplPickFromMedia = function (imageType) {
      if (!isActive()) return orig.apply(this, arguments);
      if (!global.brandId) return orig.apply(this, arguments);
      var pickerFilter = imageType === 'wallet_icon' ? 'all' : imageType;
      if (typeof global.openMediaPicker !== 'function') return orig.apply(this, arguments);
      global.openMediaPicker(async function (mediaId, imageUrl) {
        var base64 = typeof global.fetchMediaImageBase64 === 'function'
          ? await global.fetchMediaImageBase64(mediaId)
          : null;
        if (!base64) return;
        if (global.tplImageCache) global.tplImageCache[imageType] = base64;
        delete persistedImages[imageType];
        setSlotPreview(imageType, 'data:image/png;base64,' + base64);
        if (imageType === 'wallet_icon' && typeof global.persistHrWalletIcon === 'function') {
          global.tplWalletIconMediaId = mediaId;
          await global.persistHrWalletIcon();
          return;
        }
        if (typeof global.mediaTypeLabel === 'function' && typeof global.toast === 'function') {
          global.toast(global.mediaTypeLabel(imageType) + ' dalla Media Library');
        }
      }, pickerFilter);
    };
  }

  function patchOpenTemplateModal() {
    if (global.__a2wTplOpenPatched) return;
    ['openTemplateModal', 'editTemplate'].forEach(function (name) {
      if (typeof global[name] !== 'function') return;
      var orig = global[name];
      global[name] = async function () {
        var out = orig.apply(this, arguments);
        if (out && typeof out.then === 'function') await out;
        if (!isActive()) return out;
        initPreviewToggle();
        initPaletteControls();
        enhanceAllUploads();
        syncAllTplUploadZones();
        await loadBrandPaletteForTemplate();
        if (name === 'openTemplateModal') {
          resetColorPickers();
          resetPersistedImages();
        } else {
          syncTplPaletteUi();
        }
        setSaveStatus('', '');
        setPreviewFace('front');
        return out;
      };
      global.__a2wTplOpenPatched = true;
    });
  }

  function init() {
    if (!isActive()) return;
    initPreviewToggle();
    initColorPickers();
    initPaletteControls();
    enhanceAllUploads();
    patchUpdatePassPreview();
    patchSaveTemplate();
    patchPreviewTplImage();
    patchTplPickFromMedia();
    patchOpenTemplateModal();
  }

  global.a2wGetTemplatePreviewColors = getTemplatePreviewColors;
  global.a2wApplyTplPreviewColors = applyPreviewColors;
  global.a2wResetTplColorPickers = resetColorPickers;
  global.a2wLoadBrandPaletteForTemplate = loadBrandPaletteForTemplate;
  global.a2wIsTplManualPaletteOn = function () { return !!manualPaletteOverride; };
  global.a2wSetTplSaveStatus = setSaveStatus;
  global.a2wApplyTplStyleImages = applyStyleImages;
  global.a2wSyncTplUploadZone = syncTplUploadZone;
  global.a2wSyncAllTplUploadZones = syncAllTplUploadZones;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : global);
