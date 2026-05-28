/**
 * FD-02 — FiloDiretto home dashboard (KPI, onboarding, ultime attività).
 * No-op on ads2wallet / non-HR shells.
 */
(function () {
  'use strict';

  function injectFiloWelcomeCriticalCss() {
    var isFilo = document.documentElement.getAttribute('data-app') === 'filodiretto';
    if (!isFilo) {
      try { isFilo = window.__2WALLET_PRODUCT_LOCK__ === 'hr'; } catch (_) {}
    }
    if (!isFilo || document.getElementById('fdHomeWelcomeCritical')) return;
    var el = document.createElement('style');
    el.id = 'fdHomeWelcomeCritical';
    el.textContent =
      "html[data-app='filodiretto'] #welcome .page-lead," +
      "html[data-app='filodiretto'] #welcome .fd-welcome-legacy{display:none!important}";
    (document.head || document.documentElement).appendChild(el);
  }
  injectFiloWelcomeCriticalCss();

  var EVENT_LABELS = {
    signup: 'Iscrizione',
    pass_created: 'Pass creato',
    pass_download: 'Download pass',
    pass_install: 'Installazione Wallet',
    points_added: 'Punti aggiunti',
    points_redeemed: 'Punti riscattati',
    push_sent: 'Push inviata',
    reward_claimed: 'Premio riscattato',
    challenge_completed: 'Challenge completata',
    tier_upgrade: 'Upgrade tier',
    email_sent: 'Email inviata',
    google_wallet_save: 'Salvataggio Google Wallet',
    samsung_wallet_save: 'Salvataggio Samsung Wallet'
  };

  function isFiloHomeApp() {
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

  function getApiBase() {
    if (typeof window.API === 'string' && window.API) return window.API;
    return '/api/v1';
  }

  function authHeaders() {
    if (typeof window.getAuthHeaders === 'function') return window.getAuthHeaders();
    var t = '';
    try { t = localStorage.getItem('a2w_token') || ''; } catch (_) {}
    return t ? { Authorization: 'Bearer ' + t } : {};
  }

  function isValidBrandId(value) {
    if (value == null) return false;
    var id = String(value).trim();
    return !!(id && id !== 'undefined' && id !== 'null');
  }

  function getBrandId() {
    var candidates = [];
    try {
      if (window.brandId) candidates.push(window.brandId);
    } catch (_) {}
    var sel = document.getElementById('brandSelector');
    if (sel && sel.value) candidates.push(sel.value);
    try {
      var qp = new URLSearchParams(window.location.search || '').get('brand_id');
      if (qp) candidates.push(qp);
    } catch (_) {}
    for (var i = 0; i < candidates.length; i++) {
      var id = String(candidates[i]).trim();
      if (isValidBrandId(id)) return id;
    }
    return null;
  }

  function getBrandName() {
    try {
      if (window.currentBrandName) return window.currentBrandName;
    } catch (_) {}
    var sel = document.getElementById('brandSelector');
    if (!sel || !sel.value) return '';
    return sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].textContent : '';
  }

  async function fetchJson(url) {
    var res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) {
      var err = {};
      try { err = await res.json(); } catch (_) {}
      throw new Error(err.error || res.statusText || String(res.status));
    }
    return res.json();
  }

  function ensureMount() {
    var welcome = document.getElementById('welcome');
    if (!welcome) return null;
    welcome.classList.add('welcome--fd-home');
    var root = document.getElementById('fdHomeRoot');
    if (!root) {
      root = document.createElement('div');
      root.id = 'fdHomeRoot';
      root.className = 'fd-home-root';
      root.setAttribute('role', 'region');
      root.setAttribute('aria-label', 'Home operativa');
      var lead = welcome.querySelector('.page-lead');
      if (lead && lead.parentNode) lead.parentNode.insertBefore(root, lead.nextSibling);
      else welcome.appendChild(root);
    }
    root.hidden = false;
    return root;
  }

  function setHomeState(welcome, state) {
    if (!welcome) return;
    var next = state || 'no-brand';
    welcome.setAttribute('data-fd-home-state', next);
    var root = document.getElementById('fdHomeRoot');
    if (root) {
      root.classList.remove(
        'fd-home-root--setup',
        'fd-home-root--operational',
        'fd-home-root--no-brand',
        'fd-home-root--loading',
        'fd-home-root--error'
      );
      if (next === 'setup') root.classList.add('fd-home-root--setup');
      else if (next === 'operational') root.classList.add('fd-home-root--operational');
      else if (next === 'loading') root.classList.add('fd-home-root--loading');
      else if (next === 'error') root.classList.add('fd-home-root--error');
      else root.classList.add('fd-home-root--no-brand');
    }
  }

  function renderLoading(root) {
    var welcome = document.getElementById('welcome');
    setHomeState(welcome, 'loading');
    root.innerHTML =
      '<div class="fd-home-loading" aria-live="polite" aria-busy="true">' +
      '<p class="fd-home-empty">Caricamento dati brand…</p>' +
      '</div>';
  }

  function buildHomeContext(data) {
    var a = data.analytics || {};
    var apple = a.appleDeviceCount != null ? a.appleDeviceCount : (a.deviceCount || 0);
    var google = a.googleWalletSavedCount || 0;
    var samsung = a.samsungWalletSavedCount || 0;
    var walletInstalls = apple + google + samsung;
    return {
      hasBrandIdentity: data.hasBrandIdentity,
      templateCount: data.templateCount,
      employeeCount: data.employeeCount,
      employeesWithPass: data.employeesWithPass,
      pushCount: data.pushCount,
      walletInstalls: walletInstalls,
      totalPasses: a.totalPasses || 0,
      apple: apple,
      google: google,
      samsung: samsung
    };
  }

  function getOnboardingProgress(ctx) {
    var steps = onboardingSteps();
    var doneCount = 0;
    var nextStep = null;
    steps.forEach(function (step) {
      var done = step.done(ctx);
      if (done) doneCount += 1;
      else if (!nextStep) nextStep = step;
    });
    return {
      steps: steps,
      doneCount: doneCount,
      total: steps.length,
      nextStep: nextStep,
      isOperational: doneCount === steps.length
    };
  }

  function renderNoBrand(root) {
    setHomeState(document.getElementById('welcome'), 'no-brand');
    root.innerHTML =
      '<header class="fd-home-hero fd-home-hero--no-brand">' +
      '<p class="fd-home-hero__eyebrow">Inizio</p>' +
      '<h2 class="fd-home-hero__title">Scegli un brand per iniziare</h2>' +
      '<p class="fd-home-hero__desc">Seleziona un brand dall’header o creane uno nuovo per vedere KPI, setup e attività.</p>' +
      '</header>' +
      '<div class="fd-home-primary">' +
      '<p class="fd-home-primary__label">Azione consigliata</p>' +
      '<button type="button" class="btn" data-fd-nav="brand-identity">Crea o seleziona brand</button>' +
      '</div>';
    bindNavButtons(root);
  }

  function bindNavButtons(container) {
    container.querySelectorAll('[data-fd-nav]').forEach(function (btn) {
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

  function onboardingSteps() {
    return [
      {
        id: 'identity',
        label: 'Dati azienda',
        desc: 'Nome, slug, contatti HR e DPO',
        section: 'brand-identity',
        done: function (ctx) { return !!ctx.hasBrandIdentity; }
      },
      {
        id: 'template',
        label: 'Template pass dipendente',
        desc: 'Logo, strip e testi del pass Wallet',
        section: 'templates',
        done: function (ctx) { return ctx.templateCount > 0; }
      },
      {
        id: 'employees',
        label: 'Dipendenti',
        desc: 'Importa o aggiungi anagrafica',
        section: 'leads',
        done: function (ctx) { return ctx.employeeCount > 0; }
      },
      {
        id: 'push',
        label: 'Prima notifica push',
        desc: 'Comunica con chi ha il pass in Wallet',
        section: 'push',
        done: function (ctx) { return ctx.pushCount > 0; }
      },
      {
        id: 'install',
        label: 'Pass installati in Wallet',
        desc: 'Almeno un dipendente con pass attivo su dispositivo',
        section: 'passes',
        done: function (ctx) { return ctx.walletInstalls > 0; }
      }
    ];
  }

  function renderOnboarding(ctx, options) {
    var opts = options || {};
    var progress = getOnboardingProgress(ctx);
    var steps = progress.steps;
    var doneCount = progress.doneCount;
    var items = steps.map(function (step) {
      var done = step.done(ctx);
      return (
        '<li class="fd-onboarding-item' + (done ? ' fd-onboarding-item--done' : '') + '">' +
        '<span class="fd-onboarding-item__check" aria-hidden="true">' + (done ? '✓' : '') + '</span>' +
        '<div class="fd-onboarding-item__body">' +
        '<div class="fd-onboarding-item__label">' + esc(step.label) + '</div>' +
        '<div class="fd-onboarding-item__desc">' + esc(step.desc) + '</div>' +
        '</div>' +
        (done ? '' : '<button type="button" class="fd-onboarding-item__action" data-fd-nav="' + esc(step.section) + '">Vai →</button>') +
        '</li>'
      );
    }).join('');
    var compactClass = opts.compact ? ' fd-home-card--compact' : ' fd-home-card--primary';
    var title = opts.compact ? 'Configurazione' : 'Setup guidato';
    var intro = opts.compact
      ? 'Tutti i passaggi sono completati.'
      : 'Completa questi passaggi per rendere il brand pienamente operativo.';
    return (
      '<div class="fd-home-card fd-home-onboarding' + compactClass + '">' +
      '<h2 class="fd-home-card__title">' + esc(title) + '</h2>' +
      '<p class="fd-home-progress" aria-live="polite">' + doneCount + ' di ' + steps.length + ' completati</p>' +
      '<p class="fd-home-card__intro">' + esc(intro) + '</p>' +
      '<ul class="fd-onboarding-list' + (opts.compact ? ' fd-onboarding-list--compact' : '') + '">' + items + '</ul>' +
      '</div>'
    );
  }

  function renderKpiGrid(ctx, compact) {
    var gridClass = 'fd-home-kpi-grid' + (compact ? ' fd-home-kpi-grid--compact' : ' fd-home-kpi-grid--primary');
    return (
      '<div class="' + gridClass + '">' +
      '<div class="fd-home-kpi"><div class="fd-home-kpi__label">Pass totali</div><div class="fd-home-kpi__value">' + esc(ctx.totalPasses) + '</div></div>' +
      '<div class="fd-home-kpi"><div class="fd-home-kpi__label">Install Wallet</div><div class="fd-home-kpi__value">' + esc(ctx.walletInstalls) + '</div>' +
      '<div class="fd-home-kpi__hint">Apple ' + esc(ctx.apple) + ' · Google ' + esc(ctx.google) + ' · Samsung ' + esc(ctx.samsung) + '</div></div>' +
      '<div class="fd-home-kpi"><div class="fd-home-kpi__label">Dipendenti</div><div class="fd-home-kpi__value">' + esc(ctx.employeeCount) + '</div>' +
      '<div class="fd-home-kpi__hint">Con pass: ' + esc(ctx.employeesWithPass) + '</div></div>' +
      '<div class="fd-home-kpi"><div class="fd-home-kpi__label">Push inviate</div><div class="fd-home-kpi__value">' + esc(ctx.pushCount) + '</div></div>' +
      '</div>'
    );
  }

  function renderQuickActions(primarySection, secondarySections) {
    var secondary = (secondarySections || []).map(function (id) {
      var labels = {
        leads: 'Dipendenti',
        push: 'Push',
        analytics: 'Analytics',
        templates: 'Template pass',
        passes: 'Pass emessi',
        'brand-identity': 'Dati azienda'
      };
      return '<button type="button" class="btn sec small" data-fd-nav="' + esc(id) + '">' + esc(labels[id] || id) + '</button>';
    }).join('');
    return (
      '<div class="fd-home-quick">' +
      '<p class="fd-home-quick__label">Collegamenti rapidi</p>' +
      '<div class="fd-home-quick__actions">' + secondary + '</div>' +
      '</div>'
    );
  }

  function renderPrimaryAction(progress, brandName) {
    var step = progress.nextStep;
    if (!step) {
      return (
        '<div class="fd-home-primary fd-home-primary--done">' +
        '<p class="fd-home-primary__label">Stato brand</p>' +
        '<h3 class="fd-home-primary__title">Configurazione completata</h3>' +
        '<p class="fd-home-primary__desc">' + esc(brandName) + ' è operativo. Monitora KPI e invia comunicazioni ai dipendenti.</p>' +
        '<button type="button" class="btn" data-fd-nav="push">Invia una push</button>' +
        '</div>'
      );
    }
    return (
      '<div class="fd-home-primary">' +
      '<p class="fd-home-primary__label">Prossimo passo</p>' +
      '<h3 class="fd-home-primary__title">' + esc(step.label) + '</h3>' +
      '<p class="fd-home-primary__desc">' + esc(step.desc) + '</p>' +
      '<button type="button" class="btn" data-fd-nav="' + esc(step.section) + '">Continua setup →</button>' +
      '</div>'
    );
  }

  function formatEventType(type) {
    if (!type) return 'Evento';
    return EVENT_LABELS[type] || type.replace(/_/g, ' ');
  }

  function renderActivity(events) {
    if (!events.length) {
      return (
        '<div class="fd-home-card">' +
        '<h2 class="fd-home-card__title">Ultime attività</h2>' +
        '<p class="fd-home-empty">Nessuna attività registrata. Gli eventi su pass e notifiche compariranno qui.</p>' +
        '<button type="button" class="btn sec small" style="margin-top:10px" data-fd-nav="activity-log">Apri log completo</button>' +
        '</div>'
      );
    }
    var list = events.slice(0, 5).map(function (ev) {
      var when = ev.created_at ? new Date(ev.created_at).toLocaleString('it-IT') : '—';
      var meta = '';
      if (ev.metadata && typeof ev.metadata === 'object') {
        try { meta = JSON.stringify(ev.metadata); } catch (_) { meta = ''; }
      } else if (ev.metadata) meta = String(ev.metadata);
      if (meta.length > 120) meta = meta.slice(0, 117) + '…';
      return (
        '<li class="fd-home-activity-item">' +
        '<time datetime="' + esc(ev.created_at || '') + '">' + esc(when) + '</time>' +
        '<span class="fd-act-type">' + esc(formatEventType(ev.event_type)) + '</span>' +
        '<span class="fd-act-meta">' + esc(meta || '—') + '</span>' +
        '</li>'
      );
    }).join('');
    return (
      '<div class="fd-home-card">' +
      '<h2 class="fd-home-card__title">Ultime attività</h2>' +
      '<ul class="fd-home-activity-list">' + list + '</ul>' +
      '<button type="button" class="btn sec small" style="margin-top:12px" data-fd-nav="activity-log">Vedi tutto</button>' +
      '</div>'
    );
  }

  function renderBrandHome(root, data) {
    var brandName = getBrandName() || 'Brand';
    var ctx = buildHomeContext(data);
    var progress = getOnboardingProgress(ctx);
    var welcome = document.getElementById('welcome');
    var isOperational = progress.isOperational;

    setHomeState(welcome, isOperational ? 'operational' : 'setup');

    if (isOperational) {
      root.innerHTML =
        '<header class="fd-home-hero fd-home-hero--operational">' +
        '<div class="fd-home-hero__head">' +
        '<p class="fd-home-hero__eyebrow">Brand operativo</p>' +
        '<h2 class="fd-home-hero__title">' + esc(brandName) + '</h2>' +
        '</div>' +
        '<span class="fd-home-status fd-home-status--ok">Operativo</span>' +
        '</header>' +
        renderPrimaryAction(progress, brandName) +
        renderKpiGrid(ctx, false) +
        renderQuickActions(null, ['leads', 'push', 'analytics']) +
        '<div class="fd-home-grid-2 fd-home-grid-2--operational">' +
        renderOnboarding(ctx, { compact: true }) +
        renderActivity(data.events || []) +
        '</div>';
    } else {
      root.innerHTML =
        '<header class="fd-home-hero fd-home-hero--setup">' +
        '<div class="fd-home-hero__head">' +
        '<p class="fd-home-hero__eyebrow">Configurazione in corso</p>' +
        '<h2 class="fd-home-hero__title">' + esc(brandName) + '</h2>' +
        '</div>' +
        '<span class="fd-home-status fd-home-status--setup">' + esc(progress.doneCount) + '/' + esc(progress.total) + '</span>' +
        '</header>' +
        renderPrimaryAction(progress, brandName) +
        '<div class="fd-home-layout-setup">' +
        renderOnboarding(ctx, { compact: false }) +
        '<aside class="fd-home-aside">' +
        renderKpiGrid(ctx, true) +
        renderActivity(data.events || []) +
        '</aside>' +
        '</div>' +
        renderQuickActions(null, ['brand-identity', 'templates', 'leads']);
    }

    bindNavButtons(root);
  }

  function brandHasIdentity(brand) {
    if (!brand) return false;
    var c = brand.config || {};
    var logos = c.logos || {};
    if (logos.logo || logos.wallet_icon || brand.logo_url) return true;
    if (brand.name && brand.slug) return true;
    return false;
  }

  async function loadHomeData(bid) {
    var api = getApiBase();
    var h = authHeaders();
    var results = await Promise.all([
      fetchJson(api + '/analytics/' + bid).catch(function () { return {}; }),
      fetchJson(api + '/brands/' + bid).catch(function () { return null; }),
      fetchJson(api + '/templates?brand_id=' + encodeURIComponent(bid)).catch(function () { return []; }),
      fetchJson(api + '/brands/' + bid + '/employees').catch(function () { return { employees: [], total_employees: 0, with_pass: 0 }; }),
      fetchJson(api + '/push/history?brand_id=' + encodeURIComponent(bid)).catch(function () { return []; }),
      fetchJson(api + '/events/' + bid + '?limit=8').catch(function () { return []; })
    ]);
    var analytics = results[0] || {};
    var brand = results[1];
    var templates = Array.isArray(results[2]) ? results[2] : [];
    var empPayload = results[3] || {};
    var employees = empPayload.employees || [];
    var pushes = Array.isArray(results[4]) ? results[4] : [];
    var events = Array.isArray(results[5]) ? results[5] : [];

    return {
      analytics: analytics,
      hasBrandIdentity: brandHasIdentity(brand),
      templateCount: templates.length,
      employeeCount: empPayload.total_employees != null ? empPayload.total_employees : employees.length,
      employeesWithPass: empPayload.with_pass != null ? empPayload.with_pass : employees.filter(function (e) { return e.pass_id; }).length,
      pushCount: pushes.length,
      events: events,
      walletInstalls: (analytics.appleDeviceCount || analytics.deviceCount || 0) +
        (analytics.googleWalletSavedCount || 0) +
        (analytics.samsungWalletSavedCount || 0)
    };
  }

  async function fdLoadHome() {
    if (!isFiloHomeApp()) return;
    var welcome = document.getElementById('welcome');
    var root = ensureMount();
    if (!root) return;

    var bid = getBrandId();
    if (!bid) {
      renderNoBrand(root);
      return;
    }

    renderLoading(root);
    try {
      var data = await loadHomeData(bid);
      renderBrandHome(root, data);
    } catch (e) {
      setHomeState(welcome, 'error');
      root.innerHTML =
        '<div class="fd-home-loading" aria-live="polite">' +
        '<p class="fd-home-empty">Errore caricamento home: ' + esc(e.message) + '</p>' +
        '<button type="button" class="btn sec small" style="margin-top:10px" id="fdHomeRetryBtn">Riprova</button>' +
        '</div>';
      var retry = document.getElementById('fdHomeRetryBtn');
      if (retry && retry.dataset.fdBound !== '1') {
        retry.dataset.fdBound = '1';
        retry.addEventListener('click', function () { fdLoadHome(); });
      }
    }
  }

  window.fdLoadHome = fdLoadHome;
  window.isFiloOperationalHome = isFiloHomeApp;
  window.fdIsFiloOperationalHome = isFiloHomeApp;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (isFiloHomeApp() && document.getElementById('welcome') && document.getElementById('welcome').classList.contains('active')) {
        fdLoadHome();
      }
    });
  }
})();
