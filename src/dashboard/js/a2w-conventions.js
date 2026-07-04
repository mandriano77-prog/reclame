/**
 * Reclame (a2w shell) — HUB Brand / Promozioni section interactivity.
 *
 * The conventions section was built for the Filodiretto (HR) product; its logic lives in
 * src/filodiretto/fd-conventions.js, which the a2w/Reclame shell never loads. Result on Reclame:
 * `switchConventionsTab is not defined` on tab click, merchant table stuck on "Caricamento…",
 * dead template/import buttons, empty KPIs/Top10, non-opening Add/Edit modal.
 *
 * This module ports that behavior for the a2w shell. It deliberately does NOT bind the merchant
 * form submit — a2w-hub-merchant.js already owns save (base fields + Reclame checkout fields).
 */
(function (global) {
  'use strict';

  function isA2wShell() {
    return document.documentElement.classList.contains('a2w-shell');
  }
  if (!isA2wShell()) return;

  var HUB_CATEGORIES = [
    { id: 'food', label: 'Alimentare' },
    { id: 'fitness', label: 'Fitness' },
    { id: 'retail', label: 'Retail' },
    { id: 'salute', label: 'Salute' },
    { id: 'viaggi', label: 'Viaggi' },
    { id: 'tech', label: 'Tech' },
    { id: 'servizi', label: 'Servizi' },
    { id: 'altro', label: 'Altro' }
  ];

  var state = {
    merchants: [],
    analytics: null,
    settings: null,
    tab: 'merchants',
    filterCategory: '',
    filterMerchantId: '',
    editingId: null
  };

  function apiBase() { return typeof global.API === 'string' ? global.API : '/api/v1'; }
  function brandId() { return global.brandId || null; }
  function authHeaders() {
    // getAuthHeaders() only returns Authorization; add Content-Type so POST/PUT bodies parse.
    var base = { 'Content-Type': 'application/json' };
    if (typeof global.getAuthHeaders === 'function') return Object.assign(base, global.getAuthHeaders());
    return base;
  }
  function toast(msg) { if (typeof global.toast === 'function') global.toast(msg); }
  function categoryLabel(id) {
    var f = HUB_CATEGORIES.filter(function (c) { return c.id === id; })[0];
    return f ? f.label : id;
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────
  function getConventionsTab() {
    if (!(document.getElementById('conventionsTabPanel_settings') || {}).hidden) return 'settings';
    if (!(document.getElementById('conventionsTabPanel_guide') || {}).hidden) return 'guide';
    if (!(document.getElementById('conventionsTabPanel_onboarding') || {}).hidden) return 'onboarding';
    return 'merchants';
  }

  function setConventionsTabUi(tab) {
    ['merchants', 'onboarding', 'settings', 'guide'].forEach(function (t) {
      var btn = document.getElementById('conventionsTab_' + t);
      var panel = document.getElementById('conventionsTabPanel_' + t);
      var on = t === tab;
      if (btn) {
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
        btn.tabIndex = on ? 0 : -1;
      }
      if (panel) {
        panel.hidden = !on;
        panel.setAttribute('aria-hidden', on ? 'false' : 'true');
      }
    });
    state.tab = tab;
  }

  function switchConventionsTab(tab, options) {
    options = options || {};
    tab = tab || 'merchants';
    setConventionsTabUi(tab);
    if (!options.skipLoad) {
      if (tab === 'settings') loadHubSettingsForm();
      else if (tab === 'merchants') renderMerchantsTable();
    }
  }

  // ── KPIs / Top 10 ─────────────────────────────────────────────────────────
  function renderAnalyticsKpis() {
    var host = document.getElementById('hubConventionsKpis');
    if (!host) return;
    var a = state.analytics;
    var te = (a && a.total_events) || {};
    var groups = [
      { title: 'Engagement', items: [
        { label: 'Eventi totali', value: te.total || 0, primary: true },
        { label: 'Visualizzazioni', value: te.view || 0 },
        { label: 'Click sito', value: te.click_site || 0 },
        { label: 'Copy codice', value: te.copy_code || 0 }
      ] },
      { title: 'QR in negozio', items: [
        { label: 'QR mostrati', value: te.show_qr || 0 },
        { label: 'QR scansionati', value: te.scan_qr || 0 }
      ] }
    ];
    host.classList.remove('fd-conventions-kpi-grid--loading');
    host.innerHTML = '<div class="fd-conventions-kpi-groups">' + groups.map(function (g) {
      return '<section class="fd-conventions-kpi-group" aria-label="' + escapeHtml(g.title) + '">' +
        '<h3 class="fd-conventions-kpi-group__title">' + escapeHtml(g.title) + '</h3>' +
        '<div class="fd-conventions-kpi-group__grid">' +
        g.items.map(function (item) {
          return '<div class="fd-conventions-kpi' + (item.primary ? ' fd-conventions-kpi--primary' : '') + '">' +
            '<div class="fd-conventions-kpi__label">' + escapeHtml(item.label) + '</div>' +
            '<div class="fd-conventions-kpi__value">' + escapeHtml(String(item.value)) + '</div></div>';
        }).join('') + '</div></section>';
    }).join('') + '</div>';
  }

  function renderTopMerchants() {
    var host = document.getElementById('hubConventionsTop10');
    if (!host) return;
    var top = (state.analytics && state.analytics.top_10) || [];
    if (!top.length) {
      host.innerHTML = '<p style="color:var(--text2);font-size:13px;margin:0">Nessun utilizzo negli ultimi 30 giorni.</p>';
      return;
    }
    host.innerHTML = '<ol style="margin:0;padding-left:20px;font-size:13px;line-height:1.8">' +
      top.map(function (m) {
        return '<li><strong>' + escapeHtml(m.name) + '</strong> — ' + escapeHtml(String(m.total)) + ' attivazioni</li>';
      }).join('') + '</ol>';
  }

  function merchantStatsSummary(merchantId) {
    if (!state.analytics || !Array.isArray(state.analytics.by_merchant)) return '—';
    var row = state.analytics.by_merchant.filter(function (m) { return m.merchant_id === merchantId; })[0];
    if (!row || !row.total) return '0 evt';
    return row.total + ' evt · ' + (row.views || 0) + ' view';
  }

  // ── Merchant table ────────────────────────────────────────────────────────
  function filteredMerchants() {
    return state.merchants.filter(function (m) {
      if (state.filterCategory && m.category !== state.filterCategory) return false;
      if (state.filterMerchantId && m.id !== state.filterMerchantId) return false;
      return true;
    });
  }

  function renderMerchantsTable() {
    var tbody = document.querySelector('#hubMerchantsTable tbody');
    if (!tbody) return;
    var rows = filteredMerchants();
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="color:var(--text2);padding:24px;text-align:center">' +
        'Nessun merchant. Aggiungi manualmente o importa da CSV.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(function (m) {
      var badge = m.active !== false
        ? '<span class="fd-conventions-badge fd-conventions-badge--active">Attivo</span>'
        : '<span class="fd-conventions-badge fd-conventions-badge--inactive">Disattivo</span>';
      return '<tr data-merchant-id="' + escapeHtml(m.id) + '">' +
        '<td><strong>' + escapeHtml(m.name) + '</strong></td>' +
        '<td>' + escapeHtml(categoryLabel(m.category)) + '</td>' +
        '<td>' + escapeHtml(m.discount_label || '') + '</td>' +
        '<td>' + badge + '</td>' +
        '<td class="fd-conventions-stats-cell">' + escapeHtml(merchantStatsSummary(m.id)) + '</td>' +
        '<td><button type="button" class="btn sec small fd-rbac-write" data-hub-edit="' + escapeHtml(m.id) + '">Modifica</button></td>' +
        '</tr>';
    }).join('');
    tbody.querySelectorAll('[data-hub-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () { openMerchantModal(btn.getAttribute('data-hub-edit')); });
    });
  }

  // ── Fetch ─────────────────────────────────────────────────────────────────
  async function fetchMerchants() {
    var bid = brandId();
    if (!bid) return [];
    var res = await fetch(apiBase() + '/merchants?brand_id=' + encodeURIComponent(bid), { headers: authHeaders() });
    if (!res.ok) throw new Error('Errore caricamento merchant');
    return res.json();
  }
  async function fetchHubAnalytics() {
    var bid = brandId();
    if (!bid) return null;
    var res = await fetch(apiBase() + '/brands/' + encodeURIComponent(bid) + '/hub-analytics?days=30', { headers: authHeaders() });
    if (!res.ok) throw new Error('Errore caricamento analytics');
    return res.json();
  }
  async function fetchHubSettings() {
    var bid = brandId();
    if (!bid) return null;
    var res = await fetch(apiBase() + '/brands/' + encodeURIComponent(bid) + '/hub-settings', { headers: authHeaders() });
    if (!res.ok) throw new Error('Errore caricamento impostazioni Hub');
    return res.json();
  }

  // ── Filters ───────────────────────────────────────────────────────────────
  function populateCategoryFilter() {
    var sel = document.getElementById('hubMerchantCategoryFilter');
    if (!sel || sel.dataset.a2wPopulated === '1') return;
    sel.dataset.a2wPopulated = '1';
    HUB_CATEGORIES.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c.id; opt.textContent = c.label; sel.appendChild(opt);
    });
  }
  function merchantsForCategory(categoryId) {
    if (!categoryId) return state.merchants.slice();
    return state.merchants.filter(function (m) { return m.category === categoryId; });
  }
  function populateMerchantFilter() {
    var sel = document.getElementById('hubMerchantFilter');
    if (!sel) return;
    var current = sel.value || state.filterMerchantId || '';
    var pool = merchantsForCategory(state.filterCategory);
    sel.innerHTML = '<option value="">Tutti i merchant</option>';
    pool.slice().sort(function (a, b) {
      return String(a.name || '').localeCompare(String(b.name || ''), 'it', { sensitivity: 'base' });
    }).forEach(function (m) {
      var opt = document.createElement('option');
      opt.value = m.id; opt.textContent = m.name || m.id; sel.appendChild(opt);
    });
    if (current && pool.some(function (m) { return m.id === current; })) { sel.value = current; state.filterMerchantId = current; }
    else { sel.value = ''; state.filterMerchantId = ''; }
  }
  function populateMerchantFormCategories() {
    var sel = document.getElementById('hubMerchantCategory');
    if (!sel || sel.dataset.a2wPopulated === '1') return;
    sel.dataset.a2wPopulated = '1';
    HUB_CATEGORIES.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c.id; opt.textContent = c.label; sel.appendChild(opt);
    });
  }

  // ── Add/Edit modal (open only; save is owned by a2w-hub-merchant.js) ───────
  function openMerchantModal(id) {
    state.editingId = id || null;
    var modal = document.getElementById('hubMerchantModal');
    var form = document.getElementById('hubMerchantForm');
    if (!modal || !form) return;
    populateMerchantFormCategories();
    form.dataset.a2wEditingId = id || '';

    var title = document.getElementById('hubMerchantModalTitle');
    if (id) {
      var m = state.merchants.filter(function (x) { return x.id === id; })[0];
      if (!m) return;
      if (title) title.textContent = 'Modifica merchant';
      if (form.name) form.name.value = m.name || '';
      if (form.category) form.category.value = m.category || 'altro';
      if (form.discount_label) form.discount_label.value = m.discount_label || '';
      if (form.logo_url) form.logo_url.value = m.logo_url || '';
      if (form.description) form.description.value = m.description || '';
      if (form.conditions) form.conditions.value = m.conditions || '';
      if (form.valid_until) form.valid_until.value = m.valid_until ? String(m.valid_until).slice(0, 10) : '';
      if (form.online_enabled) form.online_enabled.checked = !!m.online_enabled;
      if (form.online_url) form.online_url.value = m.online_url || '';
      if (form.online_promo_code) form.online_promo_code.value = m.online_promo_code || '';
      if (form.physical_enabled) form.physical_enabled.checked = !!m.physical_enabled;
      if (form.active) form.active.checked = m.active !== false;
      if (form.sponsored) form.sponsored.checked = !!m.sponsored;
    } else {
      if (title) title.textContent = 'Aggiungi merchant';
      form.reset();
      if (form.active) form.active.checked = true;
      if (form.category) form.category.value = 'fitness';
    }
    modal.classList.add('open');
    modal.style.display = 'flex';
  }
  function closeMerchantModal() {
    var modal = document.getElementById('hubMerchantModal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.style.display = 'none';
    state.editingId = null;
  }

  // ── Import / template ─────────────────────────────────────────────────────
  function downloadCsvTemplate() {
    var a = document.createElement('a');
    a.href = '/hub-merchant-import-template.csv';
    a.download = 'hub-merchant-import-template.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  async function importMerchantsCsv(file) {
    var bid = brandId();
    if (!bid || !file) return;
    try {
      toast('Import CSV in corso…');
      var csvText = await file.text();
      var res = await fetch(apiBase() + '/merchants/import-csv', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ brand_id: bid, csv_text: csvText })
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || 'Import fallito');
      var msg = 'Import completato: ' + (data.imported || 0) + ' merchant';
      if (data.skipped) msg += ', ' + data.skipped + ' saltati';
      toast(msg);
      await reloadConventionsData();
    } catch (err) {
      toast(err.message || 'Errore import CSV');
    }
  }

  // ── Settings ──────────────────────────────────────────────────────────────
  function renderSettingsCategories(settings) {
    var host = document.getElementById('hubSettingsCategories');
    if (!host) return;
    var enabled = settings && settings.categories_enabled;
    if (typeof enabled === 'string') { try { enabled = JSON.parse(enabled); } catch (_) { enabled = []; } }
    if (!Array.isArray(enabled)) enabled = HUB_CATEGORIES.map(function (c) { return c.id; });
    host.innerHTML = HUB_CATEGORIES.map(function (c) {
      var checked = enabled.indexOf(c.id) >= 0 ? ' checked' : '';
      return '<label class="fd-conventions-cat-chip"><input type="checkbox" name="hub_cat" value="' +
        escapeHtml(c.id) + '"' + checked + '> ' + escapeHtml(c.label) + '</label>';
    }).join('');
  }
  async function loadHubSettingsForm() {
    try { state.settings = await fetchHubSettings(); }
    catch (err) { toast(err.message || 'Errore impostazioni'); return; }
    var s = state.settings || {};
    var logo = document.getElementById('hubSettingsLogoUrl');
    var accent = document.getElementById('hubSettingsAccentColor');
    var welcome = document.getElementById('hubSettingsWelcomeMessage');
    var geo = document.getElementById('hubSettingsGeofencing');
    if (logo) logo.value = s.logo_url || '';
    if (accent) accent.value = s.accent_color || '#8B5CF6';
    if (welcome) welcome.value = s.welcome_message || '';
    if (geo) geo.checked = s.geofencing_enabled !== false;
    renderSettingsCategories(s);
  }
  async function saveHubSettings(e) {
    if (e) e.preventDefault();
    var bid = brandId();
    if (!bid) return;
    var cats = [];
    document.querySelectorAll('#hubSettingsCategories input[name="hub_cat"]:checked').forEach(function (el) { cats.push(el.value); });
    var payload = {
      logo_url: (document.getElementById('hubSettingsLogoUrl') || {}).value || null,
      accent_color: (document.getElementById('hubSettingsAccentColor') || {}).value || '#8B5CF6',
      welcome_message: (document.getElementById('hubSettingsWelcomeMessage') || {}).value || null,
      geofencing_enabled: !!(document.getElementById('hubSettingsGeofencing') || {}).checked,
      categories_enabled: cats
    };
    try {
      var res = await fetch(apiBase() + '/brands/' + encodeURIComponent(bid) + '/hub-settings', {
        method: 'PUT', headers: authHeaders(), body: JSON.stringify(payload)
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || 'Salvataggio fallito');
      state.settings = data;
      toast('Impostazioni Hub salvate');
    } catch (err) { toast(err.message || 'Errore salvataggio impostazioni'); }
  }

  // ── Load / bind ───────────────────────────────────────────────────────────
  async function reloadConventionsData() {
    var host = document.getElementById('hubConventionsKpis');
    if (host) host.classList.add('fd-conventions-kpi-grid--loading');
    try {
      var results = await Promise.all([
        fetchMerchants(),
        fetchHubAnalytics().catch(function () { return null; })
      ]);
      state.merchants = results[0] || [];
      state.analytics = results[1];
      populateMerchantFilter();
      renderAnalyticsKpis();
      renderTopMerchants();
      renderMerchantsTable();
    } catch (err) {
      toast(err.message || 'Errore caricamento convenzioni');
      var tbody = document.querySelector('#hubMerchantsTable tbody');
      if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="color:var(--text2);padding:24px;text-align:center">Errore di caricamento. Riprova.</td></tr>';
    }
  }

  function bindConventionsEvents() {
    var section = document.getElementById('conventions');
    if (!section || section.dataset.a2wConvBound === '1') return;
    section.dataset.a2wConvBound = '1';

    populateCategoryFilter();

    var addBtn = document.getElementById('hubMerchantAddBtn');
    if (addBtn) addBtn.addEventListener('click', function () { openMerchantModal(null); });

    var importBtn = document.getElementById('hubMerchantImportBtn');
    var importInput = document.getElementById('hubMerchantCsvInput');
    if (importBtn && importInput) {
      importBtn.addEventListener('click', function () { importInput.click(); });
      importInput.addEventListener('change', function () {
        if (importInput.files && importInput.files[0]) { importMerchantsCsv(importInput.files[0]); importInput.value = ''; }
      });
    }

    ['hubMerchantTemplateBtn', 'hubGuideTemplateBtn', 'hubOnboardingTemplateBtn'].forEach(function (id) {
      var btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', downloadCsvTemplate);
    });

    var catFilter = document.getElementById('hubMerchantCategoryFilter');
    if (catFilter) catFilter.addEventListener('change', function () {
      state.filterCategory = catFilter.value; populateMerchantFilter(); renderMerchantsTable();
    });
    var merchantFilter = document.getElementById('hubMerchantFilter');
    if (merchantFilter) merchantFilter.addEventListener('change', function () {
      state.filterMerchantId = merchantFilter.value; renderMerchantsTable();
    });

    var settingsForm = document.getElementById('hubSettingsForm');
    if (settingsForm) settingsForm.addEventListener('submit', saveHubSettings);

    var modal = document.getElementById('hubMerchantModal');
    if (modal) modal.querySelectorAll('[data-hub-modal-close]').forEach(function (btn) {
      btn.addEventListener('click', closeMerchantModal);
    });
  }

  async function loadConventionsHub() {
    if (!isA2wShell()) return;
    bindConventionsEvents();
    switchConventionsTab(getConventionsTab(), { skipLoad: true });
    await reloadConventionsData();
    if (state.tab === 'settings') await loadHubSettingsForm();
  }

  // Expose the globals the section's inline onclicks and the nav loader expect.
  global.switchConventionsTab = switchConventionsTab;
  global.loadConventionsHub = loadConventionsHub;

  // Reload when the active brand changes while the section is open.
  document.addEventListener('brand:changed', function () {
    var section = document.getElementById('conventions');
    if (section && !section.hasAttribute('hidden')) reloadConventionsData();
  });
})(typeof window !== 'undefined' ? window : this);
