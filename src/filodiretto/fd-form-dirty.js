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

  function isBrandIdentityActive() {
    var section = document.getElementById('brand-identity');
    return !!(section && section.classList.contains('active'));
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
        if (typeof window.fdRefreshBrandChecklist === 'function') window.fdRefreshBrandChecklist();
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

  function hideLegacyFormFooter() {
    var footer = document.getElementById('fdBiFormFooter');
    if (footer) footer.hidden = true;
  }

  function showSavedFlash(label) {
    clearSavedFlash();
    relocateBrandSaveButton();
    var bar = document.getElementById('fdBiStickyBar');
    if (bar) {
      bar.hidden = false;
      bar.classList.remove('is-dirty', 'is-saving');
      bar.classList.add('is-saved-flash');
      var hint = document.getElementById('fdBiStickyHint');
      if (hint) hint.textContent = label || 'Salvato ✓';
    }
    setBottomBarVisible(isBrandIdentityActive());
    savedFlashTimer = setTimeout(function () {
      savedFlashTimer = null;
      if (bar) bar.classList.remove('is-saved-flash');
      syncBrandIdentityStickyBar();
    }, 2800);
  }

  function ensureBrandIdentityStickyBar() {
    var bar = document.getElementById('fdBiStickyBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'fdBiStickyBar';
      bar.className = 'fd-bi-sticky-bar fd-bi-bottom-bar';
      bar.setAttribute('role', 'region');
      bar.setAttribute('aria-label', 'Salvataggio modifiche brand');
      bar.innerHTML =
        '<div class="fd-bi-bottom-bar__inner">' +
        '<span class="fd-bi-sticky-bar__hint" id="fdBiStickyHint">Salvato</span>' +
        '<div class="fd-bi-sticky-bar__actions">' +
        '<button type="button" class="btn sec fd-btn fd-btn--secondary" id="fdBiStickyCancelBtn">Annulla</button>' +
        '</div></div>';
      document.body.appendChild(bar);

      document.getElementById('fdBiStickyCancelBtn').addEventListener('click', function () {
        if (typeof window.loadBrandIdentity === 'function') window.loadBrandIdentity();
      });
    }
    relocateBrandSaveButton();
    hideLegacyFormFooter();
    return bar;
  }

  function relocateBrandSaveButton() {
    var bar = ensureBrandIdentityStickyBar();
    var actions = bar.querySelector('.fd-bi-sticky-bar__actions');
    var saveBtn = document.getElementById('a2wBiSaveBtn');
    var badge = document.getElementById('a2wBiSaveStateBadge');
    if (!bar || !actions || !saveBtn) return;

    if (badge) {
      badge.classList.add('fd-badge', 'fd-bi-state-badge', 'fd-bi-save-meta--sr');
      badge.setAttribute('aria-hidden', 'true');
    }

    saveBtn.dataset.fdRelocated = '1';
    saveBtn.classList.add('fd-btn', 'fd-btn--primary', 'fd-bi-bottom-save-btn');
    saveBtn.hidden = false;
    saveBtn.style.display = '';
    if (!actions.contains(saveBtn)) {
      actions.insertBefore(saveBtn, actions.firstChild);
    }

    var duplicate = document.getElementById('fdBiStickySaveBtn');
    if (duplicate) duplicate.remove();

    var footer = document.getElementById('fdBiFormFooter');
    if (footer) footer.hidden = true;
  }

  function isSectionReadOnly() {
    if (window.FdRbac && typeof window.FdRbac.isActiveSectionReadOnly === 'function') {
      return window.FdRbac.isActiveSectionReadOnly();
    }
    return document.body && document.body.classList.contains('fd-rbac-readonly');
  }

  function resolveBarHint(state, dirty, saving) {
    if (saving) return 'Salvataggio…';
    if (dirty) return 'Modifiche non salvate';
    var badge = document.getElementById('a2wBiSaveStateBadge');
    if (badge && badge.textContent && badge.textContent.trim()) {
      return badge.textContent.trim();
    }
    return 'Salvato';
  }

  function syncBrandIdentityStickyBar() {
    if (!isFiloFormDirtyApp()) return;
    if (savedFlashTimer) return;

    if (isSectionReadOnly() || !isBrandIdentityActive()) {
      var barHidden = document.getElementById('fdBiStickyBar');
      if (barHidden) barHidden.hidden = true;
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

    bar.hidden = false;
    setBottomBarVisible(true);
    bar.classList.toggle('is-saving', saving);
    bar.classList.toggle('is-dirty', dirty && !saving);
    bar.classList.toggle('is-clean', !dirty && !saving);
    bar.classList.remove('is-saved-flash');

    var hint = document.getElementById('fdBiStickyHint');
    if (hint) hint.textContent = resolveBarHint(state, dirty, saving);

    var actions = bar.querySelector('.fd-bi-sticky-bar__actions');
    if (actions) actions.hidden = false;

    relocateBrandSaveButton();

    var cancelBtn = document.getElementById('fdBiStickyCancelBtn');
    if (cancelBtn) cancelBtn.disabled = saving;
  }

  function hideHeaderSaveChrome() {
    var section = document.getElementById('brand-identity');
    if (section) section.classList.add('brand-identity--fd-bottom-save');
    var headerActions = document.querySelector('#brand-identity .a2w-bi-header__actions');
    if (headerActions) headerActions.setAttribute('aria-hidden', 'true');
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

  function patchNavForBrandBar() {
    if (window.__fdBiNavBarPatched || typeof window.nav !== 'function') return;
    window.__fdBiNavBarPatched = true;
    var orig = window.nav;
    window.nav = function (id) {
      var out = orig.apply(this, arguments);
      var done = function () {
        syncBrandIdentityStickyBar();
      };
      if (out && typeof out.then === 'function') return out.then(done);
      setTimeout(done, 80);
      return out;
    };
  }

  function initFdFormDirty() {
    if (!isFiloFormDirtyApp()) return;
    patchBrandIdentityV2Flag();
    patchTemplateFlows();
    patchBrandIdentitySaveUi();
    patchNavForBrandBar();
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
