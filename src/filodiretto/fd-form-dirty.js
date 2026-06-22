/**
 * FD-06 — FiloDiretto form dirty state (brand identity v2 + template save guard).
 */
(function () {
  'use strict';

  var prevBiBarState = { dirty: false, saving: false };
  var savedFlashTimer = null;

  function isFiloFormDirtyApp() {
    if (document.documentElement.classList.contains('a2w-shell')) return false;
    try {
      if (window.__2WALLET_PRODUCT_LOCK__ === 'hr') return true;
    } catch (_) {}
    return document.documentElement.getAttribute('data-app') === 'filodiretto';
  }

  function isHrContext() {
    if (typeof window.isHrDashboard === 'function') return window.isHrDashboard();
    return false;
  }

  function patchBrandIdentityV2Flag() {
    if (window.__fdBiV2Patched) return;
    window.__fdBiV2Patched = true;
    var orig = window.isA2wBrandIdentityV2Enabled;
    window.isA2wBrandIdentityV2Enabled = function () {
      if (isFiloFormDirtyApp()) return true;
      if (typeof orig === 'function') return orig();
      return false;
    };
  }

  var TPL_FIELD_IDS = [
    'tplName', 'tplDescription', 'tplHeaderLabel', 'tplHeaderValue',
    'tplSecLabel', 'tplSecValue', 'tplAuxLabel', 'tplAuxValue',
    'tplLink1Label', 'tplLink1Url', 'tplLink2Label', 'tplLink2Url',
    'tplLink3Label', 'tplLink3Url', 'tplRegolamento', 'tplContatti',
    'hrFixedLinkLabel', 'hrFixedLinkUrl'
  ];

  function serializeTemplateModalState() {
    var parts = [document.getElementById('templateEditId')?.value || ''];
    TPL_FIELD_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      parts.push(el ? el.value : '');
    });
    try {
      parts.push(String(window.tplWalletIconMediaId || ''));
    } catch (_) {}
    return parts.join('\u0001');
  }

  function ensureTemplateDirtyUi() {
    var modal = document.getElementById('templateModal');
    if (!modal) return null;
    var saveBtn = modal.querySelector('button[onclick*="saveTemplate"]');
    if (!saveBtn) return null;
    if (!saveBtn.id) saveBtn.id = 'fdTplSaveBtn';

    var bar = modal.querySelector('.fd-form-dirty-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'fd-form-dirty-bar';
      var badge = document.createElement('span');
      badge.className = 'fd-form-dirty-badge';
      badge.id = 'fdTplDirtyBadge';
      badge.textContent = 'Salvato';
      bar.appendChild(badge);
      saveBtn.parentNode.insertBefore(bar, saveBtn);
      bar.appendChild(saveBtn);
    }
    return {
      saveBtn: saveBtn,
      badge: document.getElementById('fdTplDirtyBadge')
    };
  }

  function syncTemplateDirtyState() {
    if (!isFiloFormDirtyApp() || !isHrContext()) return;
    if (isSectionReadOnly()) return;
    var ui = ensureTemplateDirtyUi();
    if (!ui) return;
    var dirty = serializeTemplateModalState() !== (window.__fdTplBaseline || '');
    ui.saveBtn.disabled = !dirty;
    if (!dirty) {
      ui.saveBtn.title = 'Nessuna modifica da salvare';
    } else {
      ui.saveBtn.removeAttribute('title');
    }
    if (ui.badge) {
      ui.badge.textContent = dirty ? 'Modifiche non salvate' : 'Salvato';
      ui.badge.classList.toggle('is-dirty', dirty);
    }
  }

  function resetTemplateBaseline() {
    window.__fdTplBaseline = serializeTemplateModalState();
    syncTemplateDirtyState();
  }

  function bindTemplateModalDirty() {
    var modal = document.getElementById('templateModal');
    if (!modal || modal.dataset.fdDirtyBound === '1') return;
    modal.dataset.fdDirtyBound = '1';
    modal.addEventListener('input', syncTemplateDirtyState);
    modal.addEventListener('change', syncTemplateDirtyState);
  }

  function patchTemplateFlows() {
    if (window.__fdTplDirtyPatched) return;
    window.__fdTplDirtyPatched = true;

    var origOpen = window.openTemplateModal;
    if (typeof origOpen === 'function') {
      window.openTemplateModal = async function () {
        await origOpen.apply(this, arguments);
        if (!isFiloFormDirtyApp()) return;
        bindTemplateModalDirty();
        resetTemplateBaseline();
      };
    }

    var origEdit = window.editTemplate;
    if (typeof origEdit === 'function') {
      window.editTemplate = async function () {
        await origEdit.apply(this, arguments);
        if (!isFiloFormDirtyApp()) return;
        bindTemplateModalDirty();
        resetTemplateBaseline();
      };
    }

    var origSave = window.saveTemplate;
    if (typeof origSave === 'function') {
      window.saveTemplate = async function () {
        await origSave.apply(this, arguments);
        if (!isFiloFormDirtyApp()) return;
        resetTemplateBaseline();
      };
    }
  }

  function setBottomBarVisible(visible) {
    document.body.classList.toggle('fd-bi-bottom-bar-visible', !!visible);
  }

  function clearSavedFlash() {
    if (savedFlashTimer) {
      clearTimeout(savedFlashTimer);
      savedFlashTimer = null;
    }
  }

  function showSavedFlash(label) {
    clearSavedFlash();
    var bar = document.getElementById('fdBiStickyBar');
    if (!bar) return;
    bar.hidden = false;
    bar.classList.remove('is-dirty', 'is-saving');
    bar.classList.add('is-saved-flash');
    var hint = document.getElementById('fdBiStickyHint');
    var actions = bar.querySelector('.fd-bi-sticky-bar__actions');
    if (hint) hint.textContent = label || 'Salvato';
    if (actions) actions.hidden = true;
    setBottomBarVisible(true);
    savedFlashTimer = setTimeout(function () {
      savedFlashTimer = null;
      bar.hidden = true;
      bar.classList.remove('is-saved-flash');
      if (actions) actions.hidden = false;
      setBottomBarVisible(false);
    }, 2800);
  }

  function ensureBrandIdentityStickyBar() {
    if (document.getElementById('fdBiStickyBar')) return document.getElementById('fdBiStickyBar');
    var bar = document.createElement('div');
    bar.id = 'fdBiStickyBar';
    bar.className = 'fd-bi-sticky-bar fd-bi-bottom-bar';
    bar.hidden = true;
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Salvataggio modifiche brand');
    bar.innerHTML =
      '<div class="fd-bi-bottom-bar__inner">' +
      '<span class="fd-bi-sticky-bar__hint" id="fdBiStickyHint">Modifiche non salvate</span>' +
      '<div class="fd-bi-sticky-bar__actions">' +
      '<button type="button" class="btn sec fd-btn fd-btn--secondary" id="fdBiStickyCancelBtn">Annulla</button>' +
      '<button type="button" class="btn fd-btn fd-btn--primary" id="fdBiStickySaveBtn">Salva modifiche</button>' +
      '</div></div>';
    document.body.appendChild(bar);

    document.getElementById('fdBiStickySaveBtn').addEventListener('click', function () {
      if (typeof window.saveBrandIdentity === 'function') window.saveBrandIdentity();
    });
    document.getElementById('fdBiStickyCancelBtn').addEventListener('click', function () {
      if (typeof window.loadBrandIdentity === 'function') window.loadBrandIdentity();
    });
    return bar;
  }

  function mirrorBottomSaveButton() {
    var src = document.getElementById('a2wBiSaveBtn');
    var dst = document.getElementById('fdBiStickySaveBtn');
    if (!src || !dst) return;
    dst.disabled = src.disabled;
    dst.textContent = src.textContent || 'Salva modifiche';
    dst.classList.toggle('is-dirty', src.classList.contains('is-dirty'));
    dst.classList.toggle('is-saving', src.classList.contains('is-saving'));
  }

  function isSectionReadOnly() {
    if (window.FdRbac && typeof window.FdRbac.isActiveSectionReadOnly === 'function') {
      return window.FdRbac.isActiveSectionReadOnly();
    }
    return document.body && document.body.classList.contains('fd-rbac-readonly');
  }

  function syncBrandIdentityStickyBar() {
    if (!isFiloFormDirtyApp()) return;
    if (savedFlashTimer) return;
    if (isSectionReadOnly()) {
      var barReadonly = document.getElementById('fdBiStickyBar');
      if (barReadonly) barReadonly.hidden = true;
      setBottomBarVisible(false);
      return;
    }
    var bar = ensureBrandIdentityStickyBar();
    if (!bar) return;
    var state = window.brandIdentityState || {};
    var dirty = !!state.dirty;
    var saving = !!state.saving;

    if (prevBiBarState.saving && !saving && !dirty) {
      var badge = document.getElementById('a2wBiSaveStateBadge');
      showSavedFlash(badge && badge.textContent ? badge.textContent : 'Salvato ✓');
      prevBiBarState = { dirty: dirty, saving: saving };
      return;
    }

    prevBiBarState = { dirty: dirty, saving: saving };

    var showBar = dirty || saving;
    bar.hidden = !showBar;
    setBottomBarVisible(showBar);
    bar.classList.toggle('is-saving', saving);
    bar.classList.toggle('is-dirty', dirty && !saving);
    bar.classList.remove('is-saved-flash');

    var hint = document.getElementById('fdBiStickyHint');
    if (hint) {
      hint.textContent = saving ? 'Salvataggio in corso…' : 'Modifiche non salvate';
    }

    var actions = bar.querySelector('.fd-bi-sticky-bar__actions');
    if (actions) actions.hidden = false;

    var saveBtn = document.getElementById('fdBiStickySaveBtn');
    var cancelBtn = document.getElementById('fdBiStickyCancelBtn');
    if (saveBtn) saveBtn.disabled = saving || !dirty;
    if (cancelBtn) cancelBtn.disabled = saving;
    mirrorBottomSaveButton();
  }

  function hideHeaderSaveChrome() {
    var section = document.getElementById('brand-identity');
    if (section) section.classList.add('brand-identity--fd-bottom-save');
  }

  function patchBrandIdentitySaveUi() {
    if (window.__fdBiStickyPatched || typeof window.a2wBiUpdateSaveButton !== 'function') return;
    window.__fdBiStickyPatched = true;
    hideHeaderSaveChrome();
    ensureBrandIdentityStickyBar();
    var origRefresh = window.a2wBiRefreshSaveUi;
    if (typeof origRefresh === 'function') {
      window.a2wBiRefreshSaveUi = function () {
        origRefresh.apply(this, arguments);
        syncBrandIdentityStickyBar();
      };
    }
    var orig = window.a2wBiUpdateSaveButton;
    window.a2wBiUpdateSaveButton = function () {
      orig.apply(this, arguments);
      syncBrandIdentityStickyBar();
    };
  }

  function initFdFormDirty() {
    if (!isFiloFormDirtyApp()) return;
    patchBrandIdentityV2Flag();
    patchTemplateFlows();
    patchBrandIdentitySaveUi();
    bindTemplateModalDirty();
    document.getElementById('brand-identity')?.classList.add('brand-identity--fd-dirty');
    syncBrandIdentityStickyBar();
  }

  window.fdInitFormDirty = initFdFormDirty;
  window.fdSyncBrandIdentityBottomBar = syncBrandIdentityStickyBar;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFdFormDirty);
  } else {
    initFdFormDirty();
  }
})();
