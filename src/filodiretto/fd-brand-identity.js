/**
 * FD — Identità Brand (FASE 4): layout DS, pannello laterale, save bar, social, delete.
 */
(function () {
  'use strict';

  var SOCIAL_IDS = ['biSocialInstagram', 'biSocialFacebook', 'biSocialLinkedin', 'biSocialTiktok', 'biSocialX'];
  var socialAccordionCollapsedByUser = false;
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

  var LANDING_TOOLTIP =
    'Link pubblico della landing del brand. La parte finale dell\'URL corrisponde allo slug (campo Slug nel form).';

  function slugPreviewUrl(slug) {
    if (typeof window.getPublicLandingUrl === 'function') {
      var direct = window.getPublicLandingUrl(slug);
      if (direct) return direct;
    }
    if (typeof window.a2wBiGetSlugPreviewUrl === 'function') {
      var fromHelper = window.a2wBiGetSlugPreviewUrl(slug);
      if (fromHelper) return fromHelper;
    }
    var s = String(slug || '').trim();
    if (!s) return '';
    try {
      if (typeof window.getPublicBaseUrl === 'function') {
        var base = window.getPublicBaseUrl();
        if (base) return base + '/' + s;
      }
      return window.location.origin + '/' + s;
    } catch (_) {
      return '/' + s;
    }
  }

  function copyLandingUrl(url) {
    if (!url) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () {
        if (typeof window.toast === 'function') window.toast('URL landing copiata');
      }).catch(function () {
        if (typeof window.toast === 'function') window.toast('Copia non riuscita');
      });
      return;
    }
    if (typeof window.toast === 'function') window.toast('Copia non disponibile');
  }

  function openLandingUrl(url) {
    if (!url) {
      if (typeof window.toast === 'function') window.toast('Inserisci uno slug per aprire la landing');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function summarySlugLink(slug) {
    var slugPart = String(slug || '').trim();
    if (!slugPart) {
      return summaryRow('Slug landing', '—');
    }
    var fullUrl = slugPreviewUrl(slugPart);
    return (
      '<div class="a2w-bi-identity-summary__row a2w-bi-identity-summary__row--slug">' +
      '<dt>Slug landing</dt>' +
      '<dd class="a2w-bi-identity-summary__slug-cell">' +
      '<a class="a2w-bi-identity-summary__slug-link" href="' + esc(fullUrl) + '" target="_blank" rel="noopener noreferrer" title="' + esc(LANDING_TOOLTIP) + '">' + esc(slugPart) + '</a>' +
      '<button type="button" class="fd-btn fd-btn--ghost fd-btn--sm fd-bi-slug-copy" data-fd-copy-url="' + esc(fullUrl) + '" aria-label="Copia URL landing" title="Copia URL">' +
      '<span aria-hidden="true">⧉</span></button>' +
      '</dd></div>'
    );
  }

  function brandInitial(name) {
    var n = String(name || '').trim();
    return n ? n.charAt(0).toUpperCase() : '?';
  }

  function fieldVal(data, camelKey, snakeKey) {
    if (!data) return '';
    if (data[camelKey] != null && String(data[camelKey]).trim()) return data[camelKey];
    if (snakeKey && data[snakeKey] != null && String(data[snakeKey]).trim()) return data[snakeKey];
    return '';
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

  function scrollToBrandField(fieldId) {
    var el = document.getElementById(fieldId);
    if (!el) return;
    try {
      el.focus({ preventScroll: true });
    } catch (_) {
      el.focus();
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function scrollToContactsSection() {
    var email = document.getElementById('biSupportEmail');
    var section = email && email.closest('section');
    if (email) scrollToBrandField('biSupportEmail');
    else if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function hasBrandLogo() {
    var state = window.brandIdentityState;
    if (state && state.selectedAssets && state.selectedAssets.logo) return true;
    if (state && state.mediaByType && Array.isArray(state.mediaByType.logo) && state.mediaByType.logo.length > 0) {
      return true;
    }
    var logoBox = document.getElementById('mediaLogoBox');
    if (logoBox && logoBox.querySelector('img[src]:not([src=""])')) return true;
    return false;
  }

  function isNameSlugComplete(data) {
    var name = String(data.name || '').trim();
    var slug = String(data.slug || '').trim();
    if (!name || !slug || !/^[a-z0-9-]+$/.test(slug)) return false;
    var state = window.brandIdentityState || {};
    if (state.slugChecking) return false;
    if (state.slugAvailable === false) return false;
    if (state.slugAvailable === true) return true;
    return false;
  }

  function isSupportContactsComplete(data) {
    var email = String(fieldVal(data, 'supportEmail', 'support_email') || '').trim();
    var phone = String(fieldVal(data, 'supportPhone', 'support_phone') || '').trim();
    return !!(email && phone);
  }

  function isTemplateReady() {
    return !!window.__fdBiTemplateReady;
  }

  var CHECKLIST_DEF = [
    {
      id: 'name-slug',
      label: 'Nome e slug univoco',
      isComplete: function (data) { return isNameSlugComplete(data); },
      go: function () {
        var data = collectFormSnapshot();
        if (!String(data.name || '').trim()) scrollToBrandField('biName');
        else scrollToBrandField('biSlug');
      }
    },
    {
      id: 'support-hr',
      label: 'Email e telefono di supporto HR',
      isComplete: function (data) { return isSupportContactsComplete(data); },
      go: scrollToContactsSection
    },
    {
      id: 'logo',
      label: 'Logo in Media Library',
      isComplete: function () { return hasBrandLogo(); },
      go: function () {
        if (typeof window.nav === 'function') window.nav('media-library');
      }
    },
    {
      id: 'template',
      label: 'Template pass dipendente',
      isComplete: function () { return isTemplateReady(); },
      go: function () {
        if (typeof window.nav === 'function') window.nav('templates');
      }
    }
  ];

  function renderChecklistItem(item, data) {
    var done = item.isComplete(data);
    var mark = done
      ? '<span class="fd-bi-checklist__mark fd-bi-checklist__mark--done" aria-hidden="true">✓</span>'
      : '<span class="fd-bi-checklist__mark" aria-hidden="true"></span>';
    if (done) {
      return (
        '<li class="fd-bi-checklist__item is-done">' + mark +
        '<span class="fd-bi-checklist__label">' + esc(item.label) + '</span></li>'
      );
    }
    return (
      '<li class="fd-bi-checklist__item is-pending">' +
      '<button type="button" class="fd-bi-checklist__link" data-fd-checklist="' + esc(item.id) + '">' +
      mark + '<span class="fd-bi-checklist__label">' + esc(item.label) + '</span></button></li>'
    );
  }

  function syncChecklist() {
    var list = document.getElementById('fdBiChecklist');
    var status = document.getElementById('fdBiChecklistStatus');
    if (!list) return;
    var data = collectFormSnapshot();
    var itemsHtml = CHECKLIST_DEF.map(function (item) {
      return renderChecklistItem(item, data);
    }).join('');
    var allDone = CHECKLIST_DEF.every(function (item) { return item.isComplete(data); });
    if (allDone) {
      list.innerHTML =
        '<li class="fd-bi-checklist__item fd-bi-checklist__item--complete-all is-done">' +
        '<span class="fd-bi-checklist__mark fd-bi-checklist__mark--done" aria-hidden="true">✓</span>' +
        '<span class="fd-bi-checklist__label">Identità completata ✓</span></li>' +
        itemsHtml;
    } else {
      list.innerHTML = itemsHtml;
    }
    if (status) {
      status.textContent = allDone ? 'Tutti i passi completati' : '';
      status.hidden = !allDone;
    }
  }

  var checklistTemplateTimer = null;

  function refreshChecklistTemplates() {
    if (checklistTemplateTimer) clearTimeout(checklistTemplateTimer);
    checklistTemplateTimer = setTimeout(async function () {
      checklistTemplateTimer = null;
      window.__fdBiTemplateReady = false;
      try {
        var brandId = window.brandId;
        var api = window.API;
        if (!brandId || !api) {
          syncChecklist();
          return;
        }
        var headers = typeof window.getAuthHeaders === 'function' ? window.getAuthHeaders() : {};
        var res = await fetch(api + '/templates?brand_id=' + encodeURIComponent(brandId), { headers: headers });
        if (!res.ok) {
          syncChecklist();
          return;
        }
        var templates = await res.json();
        var list = Array.isArray(templates) ? templates : [];
        window.__fdBiTemplateReady = list.length > 0;
      } catch (_) {
        window.__fdBiTemplateReady = false;
      }
      syncChecklist();
    }, 120);
  }

  function bindChecklistActions(container) {
    var root = container || document.getElementById('fdBiAside');
    if (!root || root.dataset.fdChecklistBound === '1') return;
    root.dataset.fdChecklistBound = '1';
    root.addEventListener('click', function (e) {
      var copyBtn = e.target.closest('[data-fd-copy-url]');
      if (copyBtn) {
        e.preventDefault();
        copyLandingUrl(copyBtn.getAttribute('data-fd-copy-url'));
        return;
      }
      var btn = e.target.closest('[data-fd-checklist]');
      if (!btn) return;
      e.preventDefault();
      var id = btn.getAttribute('data-fd-checklist');
      var item = CHECKLIST_DEF.find(function (x) { return x.id === id; });
      if (item && typeof item.go === 'function') item.go();
    });
  }

  function scheduleChecklistRefresh() {
    syncChecklist();
    refreshChecklistTemplates();
  }

  function syncAsideSummary() {
    var root = document.getElementById('fdBiIdentitySummary');
    if (!root) return;
    var data = collectFormSnapshot();
    var name = String(data.name || '').trim() || 'Nome brand';
    var tagline = String(data.tagline || '').trim();
    var slugUrl = slugPreviewUrl(data.slug);
    var supportEmail = fieldVal(data, 'supportEmail', 'support_email');
    var supportPhone = fieldVal(data, 'supportPhone', 'support_phone');
    var dpoEmail = fieldVal(data, 'dpoEmail', 'dpo_email');

    root.innerHTML =
      '<div class="a2w-bi-identity-summary__brand">' +
      '<span class="a2w-bi-identity-summary__initial" aria-hidden="true">' + esc(brandInitial(name)) + '</span>' +
      '<div>' +
      '<p class="a2w-bi-identity-summary__name">' + esc(name) + '</p>' +
      '<p class="a2w-bi-identity-summary__tagline">' + esc(tagline || '—') + '</p>' +
      '</div></div>' +
      '<dl class="a2w-bi-identity-summary__details">' +
      summarySlugLink(data.slug) +
      summaryRow('Email supporto', supportEmail) +
      summaryRow('Telefono', supportPhone) +
      summaryRow('DPO / Privacy', dpoEmail) +
      summaryRow('Settore', data.settore) +
      '</dl>';

    var legacyPreview = document.getElementById('a2wBiPreviewUrl');
    if (legacyPreview) legacyPreview.textContent = slugUrl || '—';
    var legacySlug = document.getElementById('a2wBiPreviewSlug');
    if (legacySlug && !document.getElementById('fdBiIdentitySummary')) {
      legacySlug.textContent = data.slug || '—';
    }
    scheduleChecklistRefresh();
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
      '<div class="fd-bi-aside-grid">' +
      '<div class="fd-card fd-bi-aside-card a2w-bi-preview-card">' +
      '<h2 class="fd-bi-aside__title">Anteprima identità</h2>' +
      '<p class="fd-bi-aside__lead">Anteprima live di nome, contatti e URL landing mentre modifichi i campi.</p>' +
      '<div class="a2w-bi-identity-summary" id="fdBiIdentitySummary"></div>' +
      '<p class="fd-bi-aside__hint">Logo, icona Wallet e strip si configurano in Media Library e Template Pass.</p>' +
      '<div class="fd-bi-aside__actions">' +
      '<button type="button" class="fd-btn fd-btn--ghost" data-fd-nav="media-library">Media Library</button>' +
      '<button type="button" class="fd-btn fd-btn--ghost" data-fd-nav="templates">Template Pass</button>' +
      '</div></div>' +
      '<div class="fd-card fd-bi-aside-card fd-bi-aside-card--checklist">' +
      '<h2 class="fd-bi-aside__title">Checklist setup</h2>' +
      '<p class="fd-bi-aside__lead">Passi per completare l\'identità del brand.</p>' +
      '<p class="fd-bi-checklist-status" id="fdBiChecklistStatus" hidden></p>' +
      '<ul class="fd-bi-checklist" id="fdBiChecklist" aria-live="polite"></ul>' +
      '</div></div>';

    layout.appendChild(aside);
    bindNavButtons(aside);
    bindChecklistActions(aside);
    bindSummaryFields();
    syncAsideSummary();
    scheduleChecklistRefresh();
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
        wrap.className = 'fd-bi-save-meta fd-bi-save-meta--sr';
        wrap.innerHTML =
          '<span class="fd-bi-save-meta__label" id="fdBiSaveStateLabel">Stato salvataggio</span>';
        badge.classList.add('fd-badge', 'fd-bi-state-badge');
        wrap.appendChild(badge);
        actions.appendChild(wrap);
      }

      if (saveBtn && saveBtn.dataset.fdRelocated !== '1') {
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
    if (body && count > 0 && body.hidden && !socialAccordionCollapsedByUser) {
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
      toggle.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (body) {
          var open = body.hidden;
          body.hidden = !open;
          toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
          socialAccordionCollapsedByUser = !open;
          if (open && countSocialProfiles() === 0) socialAccordionCollapsedByUser = false;
        }
        requestAnimationFrame(syncSocialToggleUi);
      }, true);
    }

    syncSocialToggleUi();
  }

  function formatBadgeLabel(stateLabel) {
    if (!stateLabel) return stateLabel;
    if (
      stateLabel === 'Modifiche non salvate' ||
      stateLabel === 'Salvataggio…' ||
      stateLabel === 'Non ancora salvato' ||
      /^Salvato\s*✓/i.test(stateLabel) ||
      /^Salvato(\s|$)/i.test(stateLabel) ||
      /^circa/i.test(stateLabel)
    ) {
      return stateLabel;
    }
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
    if (typeof window.a2wBiSyncDirtyState === 'function' && !window.__fdBiDirtyChecklistPatched) {
      window.__fdBiDirtyChecklistPatched = true;
      var origDirty = window.a2wBiSyncDirtyState;
      window.a2wBiSyncDirtyState = function () {
        origDirty.apply(this, arguments);
        syncChecklist();
      };
    }
    if (typeof window.a2wBiCheckSlugAvailabilityNow === 'function' && !window.__fdBiSlugChecklistPatched) {
      window.__fdBiSlugChecklistPatched = true;
      var origSlug = window.a2wBiCheckSlugAvailabilityNow;
      window.a2wBiCheckSlugAvailabilityNow = async function () {
        await origSlug.apply(this, arguments);
        syncChecklist();
      };
    }
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
      if (typeof window.fdRefreshBrandChecklist === 'function') window.fdRefreshBrandChecklist();
      if (typeof window.fdSyncBrandIdentitySectionSaves === 'function') window.fdSyncBrandIdentitySectionSaves();
    };
  }

  function hideLegacyLandingPreview() {
    document.querySelectorAll('#brand-identity .fd-bi-landing-preview, #brand-identity .a2w-bi-preview-column').forEach(function (el) {
      el.hidden = true;
      el.setAttribute('aria-hidden', 'true');
    });
  }

  function enhanceBrandIdentityChrome() {
    enhanceHeader();
    ensureAsidePanel();
    hideLegacyLandingPreview();
    repositionDangerZone();
    enhanceFormSections();
    enhanceSocialSection();
    syncSocialToggleUi();
    syncAsideSummary();
    patchDeleteTypingHandler();
    enhanceDeleteDialog();
    if (typeof window.fdInitDangerZone === 'function') window.fdInitDangerZone();
    if (typeof window.fdInjectBrandPassFlowBar === 'function') {
      window.fdInjectBrandPassFlowBar('brand-identity');
    }
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
  window.fdRefreshBrandChecklist = scheduleChecklistRefresh;
  window.fdInitBrandIdentity = initFdBrandIdentity;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFdBrandIdentity);
  } else {
    initFdBrandIdentity();
  }
})();
