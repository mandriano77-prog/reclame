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

  function getTemplatePreviewColors() {
    var d = defaultColors();
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

  function syncUploadZone(wrap, slot) {
    var zone = wrap.querySelector('.a2w-tpl-upload__zone');
    var previewId = typeof global.tplMediaPreviewId === 'function' ? global.tplMediaPreviewId(slot) : null;
    var preview = previewId ? document.getElementById(previewId) : null;
    var hasImg = preview && preview.style.display !== 'none' && preview.src;
    if (!zone) return;
    if (hasImg) {
      zone.innerHTML = '';
      var img = document.createElement('img');
      img.className = 'a2w-tpl-upload__thumb' + (slot === 'wallet_icon' || slot === 'thumbnail' ? ' a2w-tpl-upload__thumb--square' : '');
      img.src = preview.src;
      img.alt = '';
      zone.appendChild(img);
    } else {
      zone.innerHTML = '<span>Trascina un file o clicca per caricare</span>';
    }
  }

  function enhanceUploadSlot(slot) {
    var input = fileInputForSlot(slot);
    if (!input || input.dataset.a2wUploadEnhanced === '1') return;
    var group = input.closest('.form-group');
    if (!group) return;
    input.dataset.a2wUploadEnhanced = '1';

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
      input.value = '';
      var previewId = typeof global.tplMediaPreviewId === 'function' ? global.tplMediaPreviewId(slot) : null;
      var preview = previewId ? document.getElementById(previewId) : null;
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
      setTimeout(function () { syncUploadZone(wrap, slot); }, 50);
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
          setTimeout(function () { syncUploadZone(wrap, slot); }, 200);
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
    if (c.bg) c.bg.value = s.backgroundColor || d.backgroundColor;
    if (c.fg) c.fg.value = s.foregroundColor || d.foregroundColor;
    if (c.lbl) c.lbl.value = s.labelColor || d.labelColor;
    applyPreviewColors();
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
        enhanceAllUploads();
        if (name === 'openTemplateModal') resetColorPickers();
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
    enhanceAllUploads();
    patchUpdatePassPreview();
    patchSaveTemplate();
    patchOpenTemplateModal();
  }

  global.a2wGetTemplatePreviewColors = getTemplatePreviewColors;
  global.a2wApplyTplPreviewColors = applyPreviewColors;
  global.a2wResetTplColorPickers = resetColorPickers;
  global.a2wSetTplSaveStatus = setSaveStatus;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : global);
