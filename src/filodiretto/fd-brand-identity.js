/**
 * FD — Identità Brand (FASE 4): layout DS, pannello laterale, save bar, social, delete.
 */
(function () {
  'use strict';

  var SOCIAL_IDS = ['biSocialInstagram', 'biSocialFacebook', 'biSocialLinkedin', 'biSocialTiktok', 'biSocialX'];
  var SUMMARY_FIELD_IDS = [
    'biName',
    'biTagline',
    'biSlug',
    'biHomepage',
    'biSupportEmail',
    'biSupportPhone',
    'biDpoEmail',
    'biEmergencyPhone',
    'biSettore',
    'biLang'
  ];
  var summaryTimer = null;

  function isFiloBiApp() {
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

  function isConfirmTypingMatch(input, expected) {
    if (window.A2W && window.A2W.UI && typeof window.A2W.UI.isConfirmTypingMatch === 'function') {
      return window.A2W.UI.isConfirmTypingMatch(input, expected);
    }
    return String(input || '').trim() === String(expected || '').trim();
  }

  function collectFormSnapshot() {
    if (typeof window.a2wBiCollectFormData === 'function') {
      try {
        return window.a2wBiCollectFormData();
      } catch (_) {}
    }
    return {
      name: document.getElementById('biName')?.value || '',
      tagline: document.getElementById('biTagline')?.value || '',
      slug: document.getElementById('biSlug')?.value || '',
      homepage: document.getElementById('biHomepage')?.value || '',
      support_email: document.getElementById('biSupportEmail')?.value || '',
      support_phone: document.getElementById('biSupportPhone')?.value || '',
      dpo_email: document.getElementById('biDpoEmail')?.value || '',
      emergency_phone: document.getElementById('biEmergencyPhone')?.value || '',
      settore: document.getElementById('biSettore')?.value || '',
      lang: document.getElementById('biLang')?.value || ''
    };
  }

  function slugPreviewUrl(slug) {
    if (typeof window.a2wBiGetSlugPreviewUrl === 'function') {
      return window.a2wBiGetSlugPreviewUrl(slug);
    }
    var s = String(slug || '').trim();
    if (!s) return '—';
    try {
      var domain = window.CUSTOM_DOMAIN || location.hostname;
      return 'https://' + domain + '/' + s;
    } catch (_) {
      return '/' + s;
    }
  }

  function brandInitial(name) {
    var n = String(name || '').trim();
    return n ? n.charAt(0).toUpperCase() : '?';
  }

  function summaryRow(label, value) {
    var v = String(value || '').trim();
    return (
      '<div class="a2w-bi-identity-summary__row">' +
      '<dt>' + esc(label) + '</dt>' +
      '<dd>' + esc(v || '—') + '</dd>' +
      '</div>'
    );
  }

  function syncAsideSummary() {
    var root = document.getElementById('fdBiIdentitySummary');
    if (!root) return;
    var data = collectFormSnapshot();
    var name = String(data.name || '').trim() || 'Nome brand';
    var tagline = String(data.tagline || '').trim();
    var slugUrl = slugPreviewUrl(data.slug);

    root.innerHTML =
      '<div class="a2w-bi-identity-summary__brand">' +
      '<span class="a2w-bi-identity-summary__initial" aria-hidden="true">' + esc(brandInitial(name)) + '</span>' +
      '<div>' +
      '<p class="a2w-bi-identity-summary__name">' + esc(name) + '</p>' +
      '<p class="a2w-bi-identity-summary__tagline">' + esc(tagline || 'Tagline non impostata') + '</p>' +
      '</div></div>' +
      '<dl class="a2w-bi-identity-summary__details">' +
      summaryRow('Landing', slugUrl) +
      summaryRow('Email supporto', data.support_email) +
      summaryRow('Telefono', data.support_phone) +
      summaryRow('DPO / Privacy', data.dpo_email) +
      summaryRow('Settore', data.settore) +
      '</dl>';

    var slugEl = document.getElementById('fdBiPreviewSlug');
    if (slugEl) slugEl.textContent = data.slug || '—';
    var urlEl = document.getElementById('fdBiPreviewUrl');
    if (urlEl) urlEl.textContent = slugUrl;
  }

  function scheduleAsideSummary() {
    if (summaryTimer) clearTimeout(summaryTimer);
    summaryTimer = setTimeout(function () {
      summaryTimer = null;
      syncAsideSummary();
    }, 80);
  }

  function bindSummaryFields() {
    SUMMARY_FIELD_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || el.dataset.fdSummaryBound === '1') return;
      el.dataset.fdSummaryBound = '1';
      el.addEventListener('input', scheduleAsideSummary);
      el.addEventListener('change', scheduleAsideSummary);
    });
  }

  function ensureAsidePanel() {
    var layout = document.querySelector('#brand-identity .a2w-bi-layout');
    if (!layout || document.getElementById('fdBiAside')) return;

    var aside = document.createElement('aside');
    aside.id = 'fdBiAside';
    aside.className = 'fd-bi-aside';
    aside.setAttribute('aria-label', 'Anteprima e guida identità brand');
    aside.innerHTML =
      '<div class="fd-card fd-bi-aside-card a2w-bi-preview-card">' +
      '<h2 class="fd-bi-aside__title">Anteprima identità</h2>' +
      '<p class="fd-bi-aside__lead">Anteprima live di nome, contatti e URL landing mentre modifichi i campi.</p>' +
      '<div class="a2w-bi-identity-summary" id="fdBiIdentitySummary"></div>' +
      '<p class="fd-bi-aside__hint">Logo, icona Wallet e strip si configurano in Media Library e Template Pass.</p>' +
      '<div class="fd-bi-aside__actions">' +
      '<button type="button" class="fd-btn fd-btn--ghost" data-fd-nav="media-library">Media Library</button>' +
      '<button type="button" class="fd-btn fd-btn--ghost" data-fd-nav="templates">Template Pass</button>' +
      '</div></div>' +
      '<div class="fd-card fd-bi-aside-card fd-bi-aside-card--help">' +
      '<h2 class="fd-bi-aside__title">Checklist rapida</h2>' +
      '<ul class="fd-bi-aside-checklist">' +
      '<li>Completa nome e slug univoco</li>' +
      '<li>Inserisci email e telefono di supporto HR</li>' +
      '<li>Carica logo in Media Library</li>' +
      '<li>Crea il template pass dipendente</li>' +
      '</ul></div>';

    layout.appendChild(aside);
    bindNavButtons(aside);
    bindSummaryFields();
    syncAsideSummary();
  }

  function bindNavButtons(container) {
    (container || document).querySelectorAll('[data-fd-nav]').forEach(function (btn) {
      if (btn.dataset.fdBound === '1') return;
      btn.dataset.fdBound = '1';
      btn.addEventListener('click', function (e) {
        var id = btn.getAttribute('data-fd-nav');
        if (document.body.classList.contains('fd-wai-open') && typeof window.fdNavigateFromWai === 'function') {
          window.fdNavigateFromWai(btn, e);
          return;
        }
        if (typeof window.nav === 'function') window.nav(id);
      });
    });
  }

  function repositionDangerZone() {
    var page = document.querySelector('#brand-identity .a2w-bi-page');
    var zone = document.querySelector('#brand-identity .a2w-bi-danger-zone');
    var layout = document.querySelector('#brand-identity .a2w-bi-layout');
    if (!page || !zone || !layout || zone.dataset.fdRepositioned === '1') return;
    zone.dataset.fdRepositioned = '1';
    layout.insertAdjacentElement('afterend', zone);
  }

  function enhanceHeader() {
    var header = document.querySelector('#brand-identity .a2w-bi-header');
    if (!header || header.dataset.fdBiHeader === '1') return;
    header.dataset.fdBiHeader = '1';
    header.classList.add('fd-page-header', 'fd-bi-header');

    var copy = header.querySelector('.a2w-bi-header__copy');
    if (copy) copy.classList.add('fd-page-header__copy');
    var title = header.querySelector('.a2w-bi-title');
    if (title) title.classList.add('fd-page-header__title');
    var lead = header.querySelector('.a2w-bi-subtitle');
    if (lead) lead.classList.add('fd-page-header__lead');

    var actions = header.querySelector('.a2w-bi-header__actions');
    if (actions) {
      actions.classList.add('fd-page-header__actions', 'fd-bi-save-bar');

      var badge = document.getElementById('a2wBiSaveStateBadge');
      var saveBtn = document.getElementById('a2wBiSaveBtn');

      if (badge && !document.getElementById('fdBiSaveStateWrap')) {
        var wrap = document.createElement('div');
        wrap.id = 'fdBiSaveStateWrap';
        wrap.className = 'fd-bi-save-meta';
        wrap.innerHTML =
          '<span class="fd-bi-save-meta__label" id="fdBiSaveStateLabel">Stato salvataggio</span>';
        badge.classList.add('fd-badge', 'fd-bi-state-badge');
        wrap.appendChild(badge);
        if (saveBtn) {
          actions.insertBefore(wrap, saveBtn);
        } else {
          actions.appendChild(wrap);
        }
      }

      if (saveBtn) {
        saveBtn.classList.add('fd-btn', 'fd-btn--primary');
      }
    }
  }

  function applyBadgeVariant(badge, modeClass) {
    if (!badge) return;
    badge.classList.remove(
      'fd-badge--success',
      'fd-badge--warning',
      'fd-badge--danger',
      'fd-badge--info',
      'fd-badge--neutral'
    );
    if (modeClass === 'is-dirty') badge.classList.add('fd-badge--warning');
    else if (modeClass === 'is-saving') badge.classList.add('fd-badge--info');
    else if (modeClass === 'is-pending') badge.classList.add('fd-badge--neutral');
    else badge.classList.add('fd-badge--success');
  }

  function enhanceFormSections() {
    document.querySelectorAll('#brand-identity .a2w-bi-section.card').forEach(function (section) {
      section.classList.add('fd-card', 'fd-form-section');
    });
  }

  function enhanceDeleteDialog() {
    var dialog = document.getElementById('a2wDeleteBrandDialog');
    if (dialog) dialog.classList.add('fd-delete-brand-dialog');
    var cancel = document.getElementById('a2wDeleteBrandCancelBtn');
    var confirm = document.getElementById('a2wDeleteBrandConfirmBtn');
    if (cancel) cancel.classList.add('fd-btn', 'fd-btn--secondary');
    if (confirm) confirm.classList.add('fd-btn', 'fd-btn--danger');
  }

  function countSocialProfiles() {
    var n = 0;
    SOCIAL_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el && String(el.value || '').trim()) n += 1;
    });
    return n;
  }

  function syncSocialToggleUi() {
    var toggle = document.getElementById('a2wBiSocialToggle');
    var body = document.getElementById('a2wBiSocialBody');
    var countEl = document.getElementById('fdBiSocialCount');
    if (!toggle) return;
    var count = countSocialProfiles();
    if (countEl) {
      countEl.textContent = count > 0 ? count + (count === 1 ? ' profilo' : ' profili') : 'Nessun profilo';
      countEl.classList.toggle('has-profiles', count > 0);
    }
    if (body && count > 0 && body.hidden) {
      body.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
    }
  }

  function enhanceSocialSection() {
    var toggle = document.getElementById('a2wBiSocialToggle');
    var body = document.getElementById('a2wBiSocialBody');
    if (!toggle || toggle.dataset.fdSocialEnhanced === '1') return;
    var section = toggle.closest('section');
    toggle.dataset.fdSocialEnhanced = '1';

    if (section && !section.querySelector('.fd-bi-social-head')) {
      var head = document.createElement('div');
      head.className = 'fd-bi-social-head';
      head.innerHTML =
        '<p class="fd-bi-social-lead">Collegamenti ai profili social del brand (opzionale). Appaiono nel pass e nelle comunicazioni.</p>';
      section.insertBefore(head, toggle);
    }

    toggle.classList.add('fd-bi-social-trigger');
    if (!toggle.querySelector('.fd-bi-social-trigger__chevron')) {
      var labelWrap = document.createElement('span');
      labelWrap.className = 'fd-bi-social-trigger__label';
      labelWrap.innerHTML =
        '<span class="fd-bi-social-trigger__title">Social</span>' +
        '<span class="fd-bi-social-trigger__meta" id="fdBiSocialCount">Nessun profilo</span>';
      var chevron = document.createElement('span');
      chevron.className = 'fd-bi-social-trigger__chevron';
      chevron.setAttribute('aria-hidden', 'true');
      chevron.textContent = '›';
      toggle.textContent = '';
      toggle.appendChild(labelWrap);
      toggle.appendChild(chevron);
    }

    if (body) body.classList.add('fd-bi-social-body');

    SOCIAL_IDS.forEach(function (id) {
      var input = document.getElementById(id);
      if (!input || input.dataset.fdSocialBound === '1') return;
      input.dataset.fdSocialBound = '1';
      input.addEventListener('input', syncSocialToggleUi);
    });

    if (!toggle.dataset.fdSocialToggleBound) {
      toggle.dataset.fdSocialToggleBound = '1';
      toggle.addEventListener('click', function () {
        requestAnimationFrame(syncSocialToggleUi);
      });
    }

    syncSocialToggleUi();
  }

  function formatBadgeLabel(stateLabel) {
    if (!stateLabel) return stateLabel;
    if (stateLabel === 'Modifiche non salvate' || stateLabel === 'Salvataggio…') return stateLabel;
    if (/^Salvato|^circa/i.test(stateLabel)) {
      return 'Ultima modifica: ' + stateLabel.replace(/^Salvato\s*/i, '');
    }
    if (stateLabel === 'Salvato') return 'Ultima modifica: ora';
    return stateLabel;
  }

  function patchSaveStateBadge() {
    if (window.__fdBiBadgePatched || typeof window.a2wBiUpdateSaveStateBadge !== 'function') return;
    window.__fdBiBadgePatched = true;
    var orig = window.a2wBiUpdateSaveStateBadge;
    window.a2wBiUpdateSaveStateBadge = function (stateLabel, modeClass, title) {
      orig(formatBadgeLabel(stateLabel), modeClass, title);
      applyBadgeVariant(document.getElementById('a2wBiSaveStateBadge'), modeClass);
    };
  }

  function patchPreviewSync() {
    if (window.__fdBiPreviewPatched || typeof window.a2wBiUpdatePreviewCard !== 'function') return;
    window.__fdBiPreviewPatched = true;
    var orig = window.a2wBiUpdatePreviewCard;
    window.a2wBiUpdatePreviewCard = function () {
      orig.apply(this, arguments);
      syncAsideSummary();
    };
  }

  function patchDeleteTypingHandler() {
    var confirmInput = document.getElementById('a2wDeleteBrandConfirmInput');
    var confirmBtn = document.getElementById('a2wDeleteBrandConfirmBtn');
    if (!confirmInput || !confirmBtn || confirmInput.dataset.fdTypingPatched === '1') return;
    confirmInput.dataset.fdTypingPatched = '1';

    var fresh = confirmInput.cloneNode(true);
    confirmInput.parentNode.replaceChild(fresh, confirmInput);
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

  function patchLoadBrandIdentity() {
    if (window.__fdBiLoadPatched || typeof window.loadBrandIdentity !== 'function') return;
    window.__fdBiLoadPatched = true;
    var orig = window.loadBrandIdentity;
    window.loadBrandIdentity = async function () {
      await orig.apply(this, arguments);
      enhanceBrandIdentityChrome();
    };
  }

  function enhanceBrandIdentityChrome() {
    enhanceHeader();
    ensureAsidePanel();
    repositionDangerZone();
    enhanceFormSections();
    enhanceSocialSection();
    syncSocialToggleUi();
    syncAsideSummary();
    patchDeleteTypingHandler();
    enhanceDeleteDialog();
    if (typeof window.fdInitDangerZone === 'function') window.fdInitDangerZone();
  }

  function initFdBrandIdentity() {
    if (!isFiloBiApp()) return;
    patchSaveStateBadge();
    patchPreviewSync();
    patchLoadBrandIdentity();
    patchDeleteTypingHandler();
    enhanceBrandIdentityChrome();
    if (typeof window.fdInitFormDirty === 'function') window.fdInitFormDirty();
  }

  window.fdEnhanceBrandIdentity = enhanceBrandIdentityChrome;
  window.fdSyncBrandIdentityAside = syncAsideSummary;
  window.fdInitBrandIdentity = initFdBrandIdentity;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFdBrandIdentity);
  } else {
    initFdBrandIdentity();
  }
})();
