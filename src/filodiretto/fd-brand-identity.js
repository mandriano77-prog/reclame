/**
 * FD — Identità Brand (FASE 4): layout DS, pannello laterale, save bar, social, delete.
 */
(function () {
  'use strict';

  var SOCIAL_IDS = ['biSocialInstagram', 'biSocialFacebook', 'biSocialLinkedin', 'biSocialTiktok', 'biSocialX'];
  var biAccordionCollapsed = { base: false, contacts: false, social: false };

  var BI_ACCORDION_CONFIGS = [
    {
      collapsedKey: 'base',
      sectionSelector: '#brand-identity .a2w-bi-section--base',
      detailsId: 'fdBiBaseDetails',
      summaryId: 'fdBiBaseSummary',
      title: 'Informazioni base',
      metaId: 'fdBiBaseMeta',
      fieldIds: ['biName', 'biSlug', 'biTagline', 'biSettore', 'biLang'],
      defaultOpen: true,
      metaFn: function () {
        var nameEl = document.getElementById('biName');
        var name = nameEl && String(nameEl.value || '').trim();
        return name || 'Da completare';
      }
    },
    {
      collapsedKey: 'contacts',
      sectionSelector: '#brand-identity .a2w-bi-section--contacts',
      detailsId: 'fdBiContactsDetails',
      summaryId: 'fdBiContactsSummary',
      title: 'Contatti pubblici',
      metaId: 'fdBiContactsMeta',
      fieldIds: ['biHomepage', 'biSupportEmail', 'biSupportPhone', 'biDpoEmail', 'biEmergencyPhone'],
      defaultOpen: true,
      metaFn: function () {
        var ids = ['biHomepage', 'biSupportEmail', 'biSupportPhone', 'biDpoEmail', 'biEmergencyPhone'];
        var n = 0;
        ids.forEach(function (id) {
          var el = document.getElementById(id);
          if (el && String(el.value || '').trim()) n += 1;
        });
        if (!n) return 'Nessun contatto';
        return n + (n === 1 ? ' campo' : ' campi');
      }
    },
    {
      collapsedKey: 'social',
      sectionSelector: '#brand-identity .a2w-bi-section--social',
      detailsId: 'fdBiSocialDetails',
      summaryId: 'a2wBiSocialToggle',
      title: 'Social',
      metaId: 'fdBiSocialCount',
      legacyToggleId: 'a2wBiSocialToggle',
      bodyId: 'a2wBiSocialBody',
      leadHtml: 'Collegamenti ai profili social del brand (opzionale). Appaiono nel pass e nelle comunicazioni.',
      fieldIds: SOCIAL_IDS,
      defaultOpen: false,
      metaFn: function () {
        var count = countSocialProfiles();
        if (!count) return 'Nessun profilo';
        return count + (count === 1 ? ' profilo' : ' profili');
      }
    }
  ];
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

  function bindAsideActions(container) {
    var root = container || document.getElementById('fdBiAside');
    if (!root || root.dataset.fdAsideBound === '1') return;
    root.dataset.fdAsideBound = '1';
    root.addEventListener('click', function (e) {
      var copyBtn = e.target.closest('[data-fd-copy-url]');
      if (!copyBtn) return;
      e.preventDefault();
      copyLandingUrl(copyBtn.getAttribute('data-fd-copy-url'));
    });
  }

  function ensureAsidePanel() {
    var layout = document.querySelector('#brand-identity .a2w-bi-layout');
    if (!layout || document.getElementById('fdBiAside')) return;

    var aside = document.createElement('aside');
    aside.id = 'fdBiAside';
    aside.className = 'fd-bi-aside';
    aside.setAttribute('aria-label', 'Anteprima identità brand');
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
      '</div></div></div>';

    layout.appendChild(aside);
    bindNavButtons(aside);
    bindAsideActions(aside);
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
        wrap.className = 'fd-bi-save-meta fd-bi-save-meta--sr';
        wrap.innerHTML =
          '<span class="fd-bi-save-meta__label" id="fdBiSaveStateLabel">Stato salvataggio</span>';
        badge.classList.add('fd-badge', 'fd-bi-state-badge');
        wrap.appendChild(badge);
        actions.appendChild(wrap);
      }

      if (saveBtn && saveBtn.dataset.fdRelocated !== '1') {
        saveBtn.classList.remove('a2w-btn-primary', 'sec');
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
    if (cancel) {
      cancel.classList.remove('fd-btn', 'fd-btn--secondary');
      cancel.classList.add('btn', 'sec');
    }
    if (confirm) {
      confirm.classList.remove('fd-btn', 'fd-btn--danger');
      confirm.classList.add('btn', 'danger');
    }
  }

  function countSocialProfiles() {
    var n = 0;
    SOCIAL_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el && String(el.value || '').trim()) n += 1;
    });
    return n;
  }

  function syncBiAccordionMeta(cfg) {
    var metaEl = document.getElementById(cfg.metaId);
    var details = document.getElementById(cfg.detailsId);
    var summary = document.getElementById(cfg.summaryId);
    if (!metaEl || typeof cfg.metaFn !== 'function') return;
    var label = cfg.metaFn();
    metaEl.textContent = label;
    metaEl.classList.toggle(
      'has-profiles',
      label !== 'Da completare' && label !== 'Nessun contatto' && label !== 'Nessun profilo'
    );
    if (cfg.collapsedKey === 'social' && details) {
      if (countSocialProfiles() > 0 && !biAccordionCollapsed.social && !details.open) {
        details.open = true;
      }
    }
    if (details && summary) {
      summary.setAttribute('aria-expanded', details.open ? 'true' : 'false');
    }
  }

  function enhanceBiAccordionSection(cfg) {
    var section = document.querySelector(cfg.sectionSelector);
    if (!section || section.dataset.fdDetailsEnhanced === '1') return;
    section.dataset.fdDetailsEnhanced = '1';

    var head = section.querySelector('.a2w-bi-section__head');
    var leadText = cfg.leadHtml || (head && head.querySelector('p') ? head.querySelector('p').textContent.trim() : '');
    if (head) head.remove();

    if (cfg.legacyToggleId) {
      var legacyToggle = document.getElementById(cfg.legacyToggleId);
      if (legacyToggle && legacyToggle.tagName === 'BUTTON') legacyToggle.remove();
    }

    if (leadText && !section.querySelector('.fd-bi-section-lead')) {
      var lead = document.createElement('p');
      lead.className = 'fd-bi-section-lead fd-bi-social-lead';
      lead.textContent = leadText;
      section.insertBefore(lead, section.firstChild);
    }

    var details = document.createElement('details');
    details.className = 'fd-bi-section-details fd-bi-social-details';
    details.id = cfg.detailsId;
    details.open = cfg.defaultOpen !== false && !biAccordionCollapsed[cfg.collapsedKey];

    var summary = document.createElement('summary');
    summary.className = 'fd-bi-section-trigger fd-bi-social-trigger a2w-bi-accordion-trigger';
    summary.id = cfg.summaryId;
    if (cfg.bodyId) summary.setAttribute('aria-controls', cfg.bodyId);

    var labelWrap = document.createElement('span');
    labelWrap.className = 'fd-bi-social-trigger__label';
    labelWrap.innerHTML =
      '<span class="fd-bi-social-trigger__title">' + cfg.title + '</span>' +
      '<span class="fd-bi-social-trigger__meta" id="' + cfg.metaId + '"></span>';
    var chevron = document.createElement('span');
    chevron.className = 'fd-bi-social-trigger__chevron';
    chevron.setAttribute('aria-hidden', 'true');
    chevron.textContent = '›';
    summary.appendChild(labelWrap);
    summary.appendChild(chevron);

    var body = null;
    if (cfg.bodyId) {
      body = document.getElementById(cfg.bodyId);
      if (body) {
        body.hidden = false;
        body.removeAttribute('hidden');
      }
    }
    if (!body) {
      body = document.createElement('div');
      body.className = 'fd-bi-section-body fd-bi-social-body';
    } else {
      body.classList.add('fd-bi-section-body', 'fd-bi-social-body');
    }

    var movable = [];
    Array.prototype.forEach.call(section.children, function (child) {
      if (child.classList.contains('fd-bi-section-lead')) return;
      movable.push(child);
    });

    section.appendChild(details);
    details.appendChild(summary);
    movable.forEach(function (child) {
      if (child === body) return;
      body.appendChild(child);
    });
    details.appendChild(body);

    details.addEventListener('toggle', function () {
      summary.setAttribute('aria-expanded', details.open ? 'true' : 'false');
      biAccordionCollapsed[cfg.collapsedKey] = !details.open;
      syncBiAccordionMeta(cfg);
    });

    (cfg.fieldIds || []).forEach(function (id) {
      var input = document.getElementById(id);
      if (!input || input.dataset.fdAccordionMetaBound === '1') return;
      input.dataset.fdAccordionMetaBound = '1';
      input.addEventListener('input', function () {
        syncBiAccordionMeta(cfg);
        if (cfg.collapsedKey === 'base' && typeof syncAsideSummary === 'function') syncAsideSummary();
      });
    });

    syncBiAccordionMeta(cfg);
  }

  function enhanceBiAccordionSections() {
    if (!isFiloBiApp()) return;
    BI_ACCORDION_CONFIGS.forEach(enhanceBiAccordionSection);
  }

  function syncAllBiAccordionMeta() {
    BI_ACCORDION_CONFIGS.forEach(syncBiAccordionMeta);
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
    enhanceBiAccordionSections();
    syncAllBiAccordionMeta();
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
  window.fdInitBrandIdentity = initFdBrandIdentity;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFdBrandIdentity);
  } else {
    initFdBrandIdentity();
  }
})();
