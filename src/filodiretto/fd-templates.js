/**
 * FD — Template Pass (FASE 4): DS layout, richer cards, completeness, skeleton loading.
 */
(function () {
  'use strict';

  function isFiloTplApp() {
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

  function formatDateIt(value) {
    if (!value) return '—';
    try {
      return new Intl.DateTimeFormat('it-IT', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }).format(new Date(value));
    } catch (_) {
      return '—';
    }
  }

  function templateImages(t) {
    var style = t.style;
    if (typeof style === 'string') {
      try {
        style = JSON.parse(style);
      } catch (_) {
        style = {};
      }
    }
    return (style && style.images) || {};
  }

  function templateStyle(t) {
    var style = t.style;
    if (typeof style === 'string') {
      try {
        style = JSON.parse(style);
      } catch (_) {
        style = {};
      }
    }
    return style || {};
  }

  function apiBase() {
    return window.API || '/api/v1';
  }

  function walletImageSrc(templateId, imageType, rawValue) {
    if (!rawValue) return '';
    var value = String(rawValue);
    if (value.indexOf('data:image/') === 0) return value;
    if (value.length > 120 && !/^https?:\/\//i.test(value)) {
      return 'data:image/png;base64,' + value;
    }
    return apiBase() + '/templates/' + encodeURIComponent(templateId) + '/wallet-image/' + imageType;
  }

  function evaluateCompleteness(t, brandSnapshot) {
    var images = templateImages(t);
    var checks = [
      { id: 'logo', label: 'Logo', ok: !!images.logo },
      { id: 'strip', label: 'Strip', ok: !!images.strip },
      {
        id: 'contacts',
        label: 'Contatti HR',
        ok: !!(brandSnapshot && (brandSnapshot.hr_email || brandSnapshot.support_email))
      }
    ];
    var done = checks.filter(function (c) {
      return c.ok;
    }).length;
    var ready = done === checks.length;
    return { checks: checks, done: done, total: checks.length, ready: ready };
  }

  function renderPreview(t) {
    var style = templateStyle(t);
    var images = templateImages(t);
    var strip = walletImageSrc(t.id, 'strip', images.strip);
    var logo = walletImageSrc(t.id, 'logo', images.logo);
    var bg = style.backgroundColor || style.background || '#1e1b4b';
    var fg = style.foregroundColor || style.foreground || '#ffffff';
    return (
      '<div class="fd-tpl-card__preview" style="background:' + esc(bg) + ';color:' + esc(fg) + '">' +
      '<div class="fd-tpl-card__strip"' +
      (strip ? ' style="background-image:url(\'' + esc(strip) + '\')"' : '') +
      '></div>' +
      '<div class="fd-tpl-card__body">' +
      (logo
        ? '<img class="fd-tpl-card__logo" src="' + esc(logo) + '" alt="">'
        : '<span class="fd-tpl-card__logo fd-tpl-card__logo--empty" aria-hidden="true"></span>') +
      '<div class="fd-tpl-card__fields">' +
      '<span class="fd-tpl-card__line"></span><span class="fd-tpl-card__line fd-tpl-card__line--short"></span>' +
      '</div></div></div>'
    );
  }

  function renderTemplateCard(t, passCount, brandSnapshot) {
    var completeness = evaluateCompleteness(t, brandSnapshot);
    var statusClass = completeness.ready ? 'is-ready' : 'is-incomplete';
    var statusLabel = completeness.ready ? 'Pronto' : 'Incompleto';
    var checksHtml = completeness.checks
      .map(function (c) {
        return (
          '<span class="fd-tpl-check' +
          (c.ok ? ' is-done' : '') +
          '" title="' +
          esc(c.label) +
          '">' +
          esc(c.label) +
          '</span>'
        );
      })
      .join('');
    var typeLabel =
      typeof window.formatTemplatePassTypeLabel === 'function'
        ? window.formatTemplatePassTypeLabel(t.pass_type)
        : t.pass_type || 'Pass';
    var updated = t.updated_at || t.created_at;
    return (
      '<article class="fd-card fd-tpl-card">' +
      '<div class="fd-tpl-card__grid">' +
      renderPreview(t) +
      '<div class="fd-tpl-card__content">' +
      '<div class="fd-tpl-card__head">' +
      '<h3 class="fd-tpl-card__title">' +
      esc(t.name) +
      '</h3>' +
      '<span class="fd-tpl-card__status ' +
      statusClass +
      '">' +
      esc(statusLabel) +
      '</span></div>' +
      '<p class="fd-tpl-card__meta">' +
      esc(typeLabel) +
      ' · ' +
      (passCount > 0 ? passCount + ' pass emessi' : 'Nessun pass emesso') +
      ' · Ultima modifica ' +
      esc(formatDateIt(updated)) +
      '</p>' +
      '<div class="fd-tpl-card__checks" aria-label="Completezza template">' +
      checksHtml +
      '</div>' +
      '<div class="fd-tpl-card__actions">' +
      '<button type="button" class="fd-btn fd-btn--secondary fd-btn--sm" onclick="editTemplate(\'' +
      esc(t.id) +
      '\')">Modifica</button>' +
      '<button type="button" class="fd-btn fd-btn--danger fd-btn--sm" onclick="deleteTemplate(\'' +
      esc(t.id) +
      '\')">Elimina</button>' +
      '</div></div></div></article>'
    );
  }

  function renderLoadingSkeleton() {
    function cardSkeleton() {
      return (
        '<article class="fd-card fd-tpl-card fd-tpl-card--skeleton" aria-hidden="true">' +
        '<div class="fd-tpl-card__grid">' +
        '<div class="fd-skeleton fd-tpl-card__preview-skeleton"></div>' +
        '<div class="fd-tpl-card__content">' +
        '<span class="fd-skeleton fd-skeleton--title" style="width:52%"></span>' +
        '<span class="fd-skeleton fd-skeleton--text" style="width:78%;margin-top:10px"></span>' +
        '<span class="fd-skeleton fd-skeleton--text" style="width:42%;margin-top:6px"></span>' +
        '</div></div></article>'
      );
    }
    return (
      '<div class="fd-tpl-list fd-tpl-skeleton" aria-busy="true" aria-live="polite">' +
      cardSkeleton() +
      cardSkeleton() +
      '</div>'
    );
  }

  function enhanceTemplatesSectionDesign() {
    var section = document.getElementById('templates');
    if (!section || section.dataset.fdDsSection === '1') return;
    section.dataset.fdDsSection = '1';
    section.classList.add('templates--fd-layout');

    var headerWrap = section.querySelector(':scope > div');
    var title = section.querySelector('h1.page-title, h1.sec-title');
    var createBtn = section.querySelector('[onclick*="openTemplateModal"]');
    if (headerWrap && title && !headerWrap.classList.contains('fd-page-header')) {
      headerWrap.classList.add('fd-page-header', 'fd-tpl-header');
      headerWrap.style.display = '';
      headerWrap.style.justifyContent = '';
      headerWrap.style.alignItems = '';
      headerWrap.style.marginBottom = '';

      var copy = headerWrap.querySelector('.fd-page-header__copy');
      if (!copy) {
        copy = document.createElement('div');
        copy.className = 'fd-page-header__copy';
        copy.appendChild(title);
        var lead = document.createElement('p');
        lead.className = 'fd-page-header__lead fd-tpl-lead';
        lead.textContent =
          'Definisci layout, immagini e testi del pass dipendente riutilizzabile in tutte le attivazioni.';
        copy.appendChild(lead);
        headerWrap.insertBefore(copy, headerWrap.firstChild);
      }

      title.classList.add('fd-page-header__title');
      var existingLead = copy.querySelector('.fd-page-header__lead, .fd-tpl-lead');
      if (existingLead) existingLead.classList.add('fd-page-header__lead');

      if (createBtn) {
        var actions = headerWrap.querySelector('.fd-page-header__actions');
        if (!actions) {
          actions = document.createElement('div');
          actions.className = 'fd-page-header__actions fd-tpl-header__actions';
          actions.appendChild(createBtn);
          headerWrap.appendChild(actions);
        }
        createBtn.classList.add('fd-btn', 'fd-btn--primary');
        createBtn.classList.remove('sec', 'small');
      }
    }

    var list = document.getElementById('templatesList');
    if (list) list.classList.add('fd-tpl-list-host');

    if (typeof window.fdRelocateBrandPassFlowBar === 'function') {
      window.fdRelocateBrandPassFlowBar(section);
    }
  }

  async function fetchBrandSnapshot() {
    var brandId = window.brandId;
    if (!brandId) return window.__fdBrandPassSnapshot || null;
    if (window.__fdBrandPassSnapshot && window.__fdBrandPassSnapshot.id === brandId) {
      return window.__fdBrandPassSnapshot;
    }
    try {
      var api = window.API || '/api/v1';
      var res = await fetch(api + '/brands/' + encodeURIComponent(brandId), {
        headers: typeof window.getAuthHeaders === 'function' ? window.getAuthHeaders() : {}
      });
      if (!res.ok) return null;
      var brand = await res.json();
      window.__fdBrandPassSnapshot = {
        id: brandId,
        hr_email: brand.hr_email,
        support_email: brand.support_email || (brand.config && brand.config.support_email)
      };
      return window.__fdBrandPassSnapshot;
    } catch (_) {
      return null;
    }
  }

  async function fetchPassCountsByTemplate() {
    var brandId = window.brandId;
    if (!brandId) return {};
    try {
      var api = window.API || '/api/v1';
      var res = await fetch(
        api + '/passes?brand_id=' + encodeURIComponent(brandId) + '&limit=500&offset=0',
        { headers: typeof window.getAuthHeaders === 'function' ? window.getAuthHeaders() : {} }
      );
      if (!res.ok) return {};
      var payload = await res.json();
      var rows = Array.isArray(payload) ? payload : payload.passes || [];
      var map = {};
      rows.forEach(function (p) {
        if (!p.template_id) return;
        map[p.template_id] = (map[p.template_id] || 0) + 1;
      });
      return map;
    } catch (_) {
      return {};
    }
  }

  function patchLoadTemplates() {
    if (window.__fdTplListPatched || typeof window.loadTemplates !== 'function') return;
    window.__fdTplListPatched = true;
    var orig = window.loadTemplates;
    window.loadTemplates = async function () {
      if (!isFiloTplApp() || !window.brandId) return orig.apply(this, arguments);
      var el = document.getElementById('templatesList');
      if (!el) return orig.apply(this, arguments);
      enhanceTemplatesSectionDesign();
      el.innerHTML = renderLoadingSkeleton();
      try {
        var api = window.API || '/api/v1';
        var templates = await window.fetchCachedJson(api + '/templates?brand_id=' + window.brandId, {
          headers: typeof window.getAuthHeaders === 'function' ? window.getAuthHeaders() : {}
        });
        var passCounts = await fetchPassCountsByTemplate();
        var brandSnapshot = await fetchBrandSnapshot();
        if (!templates.length) {
          if (typeof window.renderEmptyState === 'function') {
            el.innerHTML = window.renderEmptyState({
              title: 'Nessun template',
              description: 'Crea un template dipendente con logo, strip e testi del pass.',
              ctaLabel: 'Nuovo template',
              ctaOnclick: 'openTemplateModal()',
              icon: 'inbox'
            });
          } else {
            el.innerHTML = '<p>Nessun template</p>';
          }
          if (typeof window.fdRbacHook === 'function') window.fdRbacHook('templates');
          return;
        }
        el.innerHTML =
          '<div class="fd-tpl-list">' +
          templates
            .map(function (t) {
              return renderTemplateCard(t, passCounts[t.id] || 0, brandSnapshot);
            })
            .join('') +
          '</div>';
        if (typeof window.fdRbacHook === 'function') window.fdRbacHook('templates');
      } catch (e) {
        console.error('fd-templates loadTemplates', e);
        return orig.apply(this, arguments);
      }
    };
  }

  function patchNavForTemplates() {
    if (window.__fdTplNavPatched || typeof window.nav !== 'function') return;
    window.__fdTplNavPatched = true;
    var origNav = window.nav;
    window.nav = function (id) {
      var r = origNav.apply(this, arguments);
      var done = function () {
        if (id === 'templates') enhanceTemplatesSectionDesign();
      };
      if (r && typeof r.then === 'function') return r.then(done);
      setTimeout(done, 0);
      return r;
    };
  }

  function initFdTemplates() {
    if (!isFiloTplApp()) return;
    patchLoadTemplates();
    patchNavForTemplates();
    enhanceTemplatesSectionDesign();
  }

  window.fdInitTemplates = initFdTemplates;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFdTemplates);
  } else {
    initFdTemplates();
  }
})();
