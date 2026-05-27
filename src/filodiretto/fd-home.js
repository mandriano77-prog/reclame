/**
 * FD-02 — FiloDiretto home dashboard (KPI, onboarding, ultime attività).
 * No-op on ads2wallet / non-HR shells.
 */
(function () {
  'use strict';

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

  function getBrandId() {
    try {
      if (window.brandId) return window.brandId;
    } catch (_) {}
    var sel = document.getElementById('brandSelector');
    return sel && sel.value ? sel.value : null;
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

  function renderNoBrand(root) {
    root.innerHTML =
      '<p class="fd-home-lead">Seleziona un brand dall’header per vedere KPI e avanzamento setup.</p>' +
      '<div class="fd-home-quick">' +
      '<button type="button" class="btn sec" data-fd-nav="brand-identity">Crea / modifica brand</button>' +
      '</div>';
    bindNavButtons(root);
  }

  function bindNavButtons(container) {
    container.querySelectorAll('[data-fd-nav]').forEach(function (btn) {
      if (btn.dataset.fdBound === '1') return;
      btn.dataset.fdBound = '1';
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-fd-nav');
        if (typeof window.nav === 'function') window.nav(id);
      });
    });
  }

  function onboardingSteps() {
    return [
      {
        id: 'identity',
        label: 'Identità brand',
        desc: 'Logo, colori e dati azienda',
        section: 'brand-identity',
        done: function (ctx) { return !!ctx.hasBrandIdentity; }
      },
      {
        id: 'template',
        label: 'Template pass dipendente',
        desc: 'Configura il design del pass HR',
        section: 'templates',
        done: function (ctx) { return ctx.templateCount > 0; }
      },
      {
        id: 'employees',
        label: 'Anagrafica dipendenti',
        desc: 'Aggiungi o importa i dipendenti',
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

  function renderOnboarding(ctx) {
    var steps = onboardingSteps();
    var doneCount = 0;
    var items = steps.map(function (step) {
      var done = step.done(ctx);
      if (done) doneCount += 1;
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
    return (
      '<div class="fd-home-card">' +
      '<h2 class="fd-home-card__title">Setup guidato</h2>' +
      '<p class="fd-home-progress">' + doneCount + ' di ' + steps.length + ' completati</p>' +
      '<ul class="fd-onboarding-list">' + items + '</ul>' +
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
    var a = data.analytics || {};
    var totalPasses = a.totalPasses || 0;
    var apple = a.appleDeviceCount != null ? a.appleDeviceCount : (a.deviceCount || 0);
    var google = a.googleWalletSavedCount || 0;
    var samsung = a.samsungWalletSavedCount || 0;
    var walletInstalls = apple + google + samsung;
    var brandName = getBrandName() || 'Brand';

    var ctx = {
      hasBrandIdentity: data.hasBrandIdentity,
      templateCount: data.templateCount,
      employeeCount: data.employeeCount,
      pushCount: data.pushCount,
      walletInstalls: walletInstalls
    };

    root.innerHTML =
      '<p class="fd-home-lead">Panoramica operativa per <strong>' + esc(brandName) + '</strong>. KPI aggiornati e prossimi passi di configurazione.</p>' +
      '<div class="fd-home-quick">' +
      '<button type="button" class="btn sec small" data-fd-nav="leads">Dipendenti</button>' +
      '<button type="button" class="btn sec small" data-fd-nav="push">Push</button>' +
      '<button type="button" class="btn sec small" data-fd-nav="analytics">Analytics</button>' +
      '</div>' +
      '<div class="fd-home-kpi-grid">' +
      '<div class="fd-home-kpi"><div class="fd-home-kpi__label">Pass totali</div><div class="fd-home-kpi__value">' + esc(totalPasses) + '</div></div>' +
      '<div class="fd-home-kpi"><div class="fd-home-kpi__label">Install Wallet</div><div class="fd-home-kpi__value">' + esc(walletInstalls) + '</div>' +
      '<div class="fd-home-kpi__hint">Apple ' + esc(apple) + ' · Google ' + esc(google) + ' · Samsung ' + esc(samsung) + '</div></div>' +
      '<div class="fd-home-kpi"><div class="fd-home-kpi__label">Dipendenti</div><div class="fd-home-kpi__value">' + esc(data.employeeCount) + '</div>' +
      '<div class="fd-home-kpi__hint">Con pass: ' + esc(data.employeesWithPass) + '</div></div>' +
      '<div class="fd-home-kpi"><div class="fd-home-kpi__label">Push inviate</div><div class="fd-home-kpi__value">' + esc(data.pushCount) + '</div></div>' +
      '</div>' +
      '<div class="fd-home-grid-2">' +
      renderOnboarding(ctx) +
      renderActivity(data.events || []) +
      '</div>';

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
    var root = ensureMount();
    if (!root) return;

    var bid = getBrandId();
    if (!bid) {
      renderNoBrand(root);
      return;
    }

    root.innerHTML = '<p class="fd-home-empty">Caricamento…</p>';
    try {
      var data = await loadHomeData(bid);
      renderBrandHome(root, data);
    } catch (e) {
      root.innerHTML = '<p class="fd-home-empty" style="color:var(--red)">Errore caricamento home: ' + esc(e.message) + '</p>';
    }
  }

  window.fdLoadHome = fdLoadHome;
  window.isFiloOperationalHome = isFiloHomeApp;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (isFiloHomeApp() && document.getElementById('welcome') && document.getElementById('welcome').classList.contains('active')) {
        fdLoadHome();
      }
    });
  }
})();
