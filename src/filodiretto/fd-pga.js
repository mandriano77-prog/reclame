/**
 * FD — PGA Catalog HR dashboard (Sprint 4).
 */
(function (global) {
  'use strict';

  var PGA_CATEGORIES = {
    career: 'Carriera',
    time: 'Tempo',
    learning: 'Formazione',
    softskill: 'Soft skill',
    purpose: 'Purpose',
    brand: 'Brand'
  };

  var BOOKING_STATUS_LABELS = {
    pending: 'In attesa',
    confirmed: 'Confermata',
    delivered: 'Erogata',
    cancelled: 'Annullata'
  };

  var state = {
    settings: null,
    experiences: [],
    bookings: [],
    coinActions: [],
    tab: 'catalog',
    bookingFilter: '',
    editingExperienceId: null,
    expFilterSearch: '',
    expFilterCategory: '',
    expFilterType: '',
    expFilterStatus: ''
  };

  function isFiloPgaApp() {
    if (document.documentElement.classList.contains('a2w-shell')) return false;
    try {
      if (global.__2WALLET_PRODUCT_LOCK__ === 'hr') return true;
    } catch (_) {}
    return document.documentElement.getAttribute('data-app') === 'filodiretto';
  }

  function apiBase() {
    return typeof global.API === 'string' ? global.API : '/api/v1';
  }

  function brandId() {
    return global.brandId || null;
  }

  function authHeaders() {
    if (typeof global.getDashboardFetchHeaders === 'function') return global.getDashboardFetchHeaders();
    if (typeof global.getAuthHeaders === 'function') return global.getAuthHeaders();
    return {};
  }

  function toast(msg) {
    if (typeof global.toast === 'function') global.toast(msg);
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function categoryLabel(id) {
    return PGA_CATEGORIES[id] || id;
  }

  function maskPassSerial(serial) {
    var s = String(serial || '');
    if (s.length <= 4) return '****';
    return '****' + s.slice(-4);
  }

  function formatDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('it-IT', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch (_) {
      return iso;
    }
  }

  function statusBadge(status) {
    var cls = 'fd-pga-status-badge fd-pga-status-badge--' + escapeHtml(status);
    return '<span class="' + cls + '">' + escapeHtml(BOOKING_STATUS_LABELS[status] || status) + '</span>';
  }

  function enhancePgaSectionDesign() {
    var section = document.getElementById('pga-catalog');
    if (!section || section.dataset.fdDsSection === '1') return;
    section.dataset.fdDsSection = '1';
    section.classList.add('pga--fd-ds');

    var title = section.querySelector('h1.page-title, h1.sec-title');
    if (title && !title.closest('.fd-page-header')) {
      var header = document.createElement('header');
      header.className = 'fd-page-header fd-pga-header';
      var copy = document.createElement('div');
      copy.className = 'fd-page-header__copy';
      copy.appendChild(title);
      title.classList.add('fd-page-header__title');
      var lead = document.createElement('p');
      lead.className = 'fd-page-header__lead fd-pga-lead';
      lead.textContent =
        'Gestisci il catalogo esperienze PGA, le prenotazioni dipendenti e le regole di assegnazione coin.';
      copy.appendChild(lead);
      header.appendChild(copy);
      section.insertBefore(header, section.firstChild);
    }

    var tabs = section.querySelector('#pgaCatalogSectionTabs');
    if (tabs) tabs.classList.add('fd-pga-tabs');
  }

  function getPgaTab() {
    var tabs = ['catalog', 'bookings', 'coins', 'settings'];
    for (var i = 0; i < tabs.length; i++) {
      var panel = document.getElementById('pgaTabPanel_' + tabs[i]);
      if (panel && !panel.hidden) return tabs[i];
    }
    return 'catalog';
  }

  function setPgaTabUi(tab) {
    ['catalog', 'bookings', 'coins', 'settings'].forEach(function (t) {
      var btn = document.getElementById('pgaTab_' + t);
      var panel = document.getElementById('pgaTabPanel_' + t);
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

  function switchPgaTab(tab, options) {
    options = options || {};
    tab = tab || 'catalog';
    setPgaTabUi(tab);
    if (!options.skipLoad) {
      if (tab === 'catalog') renderExperiencesTable();
      else if (tab === 'bookings') loadBookingsTable();
      else if (tab === 'coins') renderCoinActionsTable();
      else if (tab === 'settings') loadPgaSettingsForm();
    }
    if (typeof global.fdRbacHook === 'function') global.fdRbacHook('pga-catalog');
  }

  async function fetchPgaSettings() {
    var bid = brandId();
    if (!bid) return null;
    var res = await fetch(apiBase() + '/brands/' + encodeURIComponent(bid) + '/pga-settings', {
      headers: authHeaders()
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || 'Errore impostazioni PGA');
    return data;
  }

  async function fetchExperiences() {
    var bid = brandId();
    if (!bid) return [];
    var res = await fetch(apiBase() + '/experiences?brand_id=' + encodeURIComponent(bid), {
      headers: authHeaders()
    });
    var data = await res.json().catch(function () { return []; });
    if (!res.ok) throw new Error(data.error || 'Errore catalogo');
    return Array.isArray(data) ? data : [];
  }

  async function fetchBookings(status) {
    var bid = brandId();
    if (!bid) return [];
    var qs = 'brand_id=' + encodeURIComponent(bid);
    if (status) qs += '&status=' + encodeURIComponent(status);
    var res = await fetch(apiBase() + '/brands/' + encodeURIComponent(bid) + '/bookings?' + qs, {
      headers: authHeaders()
    });
    var data = await res.json().catch(function () { return []; });
    if (!res.ok) throw new Error(data.error || 'Errore prenotazioni');
    return Array.isArray(data) ? data : [];
  }

  async function fetchCoinActions() {
    var bid = brandId();
    if (!bid) return [];
    var res = await fetch(apiBase() + '/coins/actions?brand_id=' + encodeURIComponent(bid), {
      headers: authHeaders()
    });
    var data = await res.json().catch(function () { return []; });
    if (!res.ok) throw new Error(data.error || 'Errore regole coin');
    return Array.isArray(data) ? data : [];
  }

  function renderPgaEnabledToggle() {
    var host = document.getElementById('pgaEnabledToggleHost');
    if (!host) return;
    var enabled = !!(state.settings && state.settings.enabled);
    host.innerHTML =
      '<div class="fd-pga-toggle fd-rbac-write">' +
      '<label class="fd-switch" for="pgaEnabledCheckbox">' +
      '<input type="checkbox" class="fd-switch__input" id="pgaEnabledCheckbox"' +
      (enabled ? ' checked' : '') +
      ' aria-label="Attiva PGA — catalogo esperienze nel pass wallet">' +
      '<span class="fd-switch__track" aria-hidden="true"><span class="fd-switch__thumb"></span></span>' +
      '<span class="fd-pga-toggle__copy">' +
      '<strong>Attiva PGA</strong>' +
      '<span class="fd-pga-toggle__hint">— catalogo esperienze nel pass wallet</span>' +
      '</span></label></div>';
    var cb = document.getElementById('pgaEnabledCheckbox');
    if (cb) {
      cb.addEventListener('change', togglePgaEnabled);
    }
  }

  function ensurePgaCatalogFilters() {
    var toolbar = document.querySelector('#pgaTabPanel_catalog .fd-pga-toolbar');
    if (!toolbar || document.getElementById('pgaExpSearch')) return;

    var filters = document.createElement('div');
    filters.className = 'fd-pga-filters';
    filters.innerHTML =
      '<input type="search" id="pgaExpSearch" class="fd-pga-control" placeholder="Cerca esperienza…" aria-label="Cerca esperienza">' +
      '<select id="pgaExpCategoryFilter" class="fd-pga-control" aria-label="Filtra per categoria">' +
      '<option value="">Tutte le categorie</option>' +
      Object.keys(PGA_CATEGORIES).map(function (id) {
        return '<option value="' + escapeHtml(id) + '">' + escapeHtml(categoryLabel(id)) + '</option>';
      }).join('') +
      '</select>' +
      '<select id="pgaExpTypeFilter" class="fd-pga-control" aria-label="Filtra per tipo">' +
      '<option value="">Tutti i tipi</option>' +
      '<option value="internal">Interna</option>' +
      '<option value="external">Esterna</option>' +
      '</select>' +
      '<select id="pgaExpStatusFilter" class="fd-pga-control" aria-label="Filtra per stato">' +
      '<option value="">Tutti gli stati</option>' +
      '<option value="active">Attiva</option>' +
      '<option value="inactive">Disattiva</option>' +
      '</select>';

    toolbar.appendChild(filters);

    var searchEl = document.getElementById('pgaExpSearch');
    if (searchEl) {
      searchEl.addEventListener('input', function () {
        state.expFilterSearch = searchEl.value.trim();
        renderExperiencesTable();
      });
    }
    ['pgaExpCategoryFilter', 'pgaExpTypeFilter', 'pgaExpStatusFilter'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', function () {
        if (id === 'pgaExpCategoryFilter') state.expFilterCategory = el.value;
        else if (id === 'pgaExpTypeFilter') state.expFilterType = el.value;
        else state.expFilterStatus = el.value;
        renderExperiencesTable();
      });
    });
  }

  function filteredExperiences() {
    return (state.experiences || []).filter(function (exp) {
      if (state.expFilterCategory && exp.category !== state.expFilterCategory) return false;
      if (state.expFilterType === 'internal' && !exp.internal) return false;
      if (state.expFilterType === 'external' && exp.internal) return false;
      if (state.expFilterStatus === 'active' && !exp.active) return false;
      if (state.expFilterStatus === 'inactive' && exp.active) return false;
      if (state.expFilterSearch) {
        var q = state.expFilterSearch.toLowerCase();
        var hay = ((exp.name || '') + ' ' + categoryLabel(exp.category)).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  async function togglePgaEnabled() {
    var bid = brandId();
    if (!bid) return;
    var cb = document.getElementById('pgaEnabledCheckbox');
    var enabled = !!(cb && cb.checked);
    try {
      var res = await fetch(apiBase() + '/brands/' + encodeURIComponent(bid) + '/pga-settings', {
        method: 'PUT',
        headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
        body: JSON.stringify({ enabled: enabled })
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || 'Salvataggio fallito');
      state.settings = data;
      toast(enabled ? 'PGA attivato' : 'PGA disattivato');
      if (enabled) {
        state.experiences = await fetchExperiences();
        renderExperiencesTable();
      }
    } catch (err) {
      toast(err.message || 'Errore attivazione PGA');
      if (cb) cb.checked = !enabled;
    }
  }

  function renderExperiencesTable() {
    var table = document.getElementById('pgaExperiencesTable');
    var tbody = table ? table.querySelector('tbody') : null;
    var thead = table ? table.querySelector('thead') : null;
    if (!tbody) return;
    var allRows = state.experiences || [];
    var rows = filteredExperiences();
    if (thead) thead.hidden = !rows.length;
    if (!allRows.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="color:var(--text2)">Nessuna esperienza. Attiva PGA per generare il catalogo predefinito.</td></tr>';
      return;
    }
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="color:var(--text2);text-align:center;padding:24px">Nessuna esperienza corrisponde ai filtri.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(function (exp) {
      return (
        '<tr>' +
        '<td>' + escapeHtml(exp.name) + '</td>' +
        '<td>' + escapeHtml(categoryLabel(exp.category)) + '</td>' +
        '<td>' + escapeHtml(exp.coin_cost) + '</td>' +
        '<td>' + (exp.internal ? 'Interna' : 'Esterna') + '</td>' +
        '<td>' + (exp.active ? 'Attiva' : 'Disattiva') + '</td>' +
        '<td>' + (exp.max_per_user_per_year != null ? escapeHtml(exp.max_per_user_per_year) : '—') + '</td>' +
        '<td><button type="button" class="btn sec small fd-rbac-write" data-pga-edit="' + escapeHtml(exp.id) + '">Modifica</button></td>' +
        '</tr>'
      );
    }).join('');

    tbody.querySelectorAll('[data-pga-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openExperienceModal(btn.getAttribute('data-pga-edit'));
      });
    });
  }

  function openExperienceModal(id) {
    var exp = (state.experiences || []).filter(function (e) { return e.id === id; })[0];
    if (!exp) return;
    state.editingExperienceId = id;
    var modal = document.getElementById('pgaExperienceModal');
    if (!modal) return;
    var nameEl = document.getElementById('pgaExpModalName');
    var costEl = document.getElementById('pgaExpModalCoinCost');
    var activeEl = document.getElementById('pgaExpModalActive');
    var maxEl = document.getElementById('pgaExpModalMaxYear');
    if (nameEl) nameEl.textContent = exp.name;
    if (costEl) costEl.value = exp.coin_cost;
    if (activeEl) activeEl.checked = !!exp.active;
    if (maxEl) maxEl.value = exp.max_per_user_per_year != null ? exp.max_per_user_per_year : '';
    modal.style.display = 'flex';
    modal.classList.add('active');
    document.body.classList.add('modal-open');
  }

  function closeExperienceModal() {
    var modal = document.getElementById('pgaExperienceModal');
    if (modal) {
      modal.style.display = 'none';
      modal.classList.remove('active');
    }
    if (!document.querySelector('.modal.active')) document.body.classList.remove('modal-open');
    state.editingExperienceId = null;
  }

  async function saveExperienceModal(e) {
    if (e) e.preventDefault();
    var id = state.editingExperienceId;
    var bid = brandId();
    if (!id || !bid) return;
    var costEl = document.getElementById('pgaExpModalCoinCost');
    var activeEl = document.getElementById('pgaExpModalActive');
    var maxEl = document.getElementById('pgaExpModalMaxYear');
    var payload = {
      coin_cost: parseInt((costEl || {}).value, 10),
      active: !!(activeEl && activeEl.checked)
    };
    var maxVal = (maxEl || {}).value;
    payload.max_per_user_per_year = maxVal === '' ? null : parseInt(maxVal, 10);
    try {
      var res = await fetch(apiBase() + '/experiences/' + encodeURIComponent(id), {
        method: 'PUT',
        headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
        body: JSON.stringify(payload)
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || 'Salvataggio fallito');
      toast('Esperienza aggiornata');
      closeExperienceModal();
      state.experiences = await fetchExperiences();
      renderExperiencesTable();
    } catch (err) {
      toast(err.message || 'Errore salvataggio');
    }
  }

  async function loadBookingsTable() {
    var filterEl = document.getElementById('pgaBookingStatusFilter');
    var status = filterEl ? filterEl.value : '';
    state.bookingFilter = status;
    try {
      state.bookings = await fetchBookings(status || undefined);
      renderBookingsTable();
    } catch (err) {
      toast(err.message || 'Errore prenotazioni');
    }
  }

  function renderBookingsTable() {
    var tbody = document.querySelector('#pgaBookingsTable tbody');
    if (!tbody) return;
    var rows = state.bookings || [];
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="color:var(--text2)">Nessuna prenotazione.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(function (b) {
      var actions = '';
      if (b.status === 'pending') {
        actions =
          '<button type="button" class="btn sec small fd-rbac-write" data-pga-booking="' + escapeHtml(b.id) + '" data-pga-status="confirmed">Conferma</button>' +
          '<button type="button" class="btn sec small danger fd-rbac-write" data-pga-booking="' + escapeHtml(b.id) + '" data-pga-status="cancelled">Annulla</button>';
      } else if (b.status === 'confirmed') {
        actions =
          '<button type="button" class="btn sec small fd-rbac-write" data-pga-booking="' + escapeHtml(b.id) + '" data-pga-status="delivered">Erogata</button>' +
          '<button type="button" class="btn sec small danger fd-rbac-write" data-pga-booking="' + escapeHtml(b.id) + '" data-pga-status="cancelled">Annulla</button>';
      } else {
        actions = '—';
      }
      return (
        '<tr>' +
        '<td><code>' + escapeHtml(maskPassSerial(b.pass_serial)) + '</code></td>' +
        '<td>' + escapeHtml(b.experience_name || '—') + '</td>' +
        '<td>' + formatDate(b.scheduled_at || b.created_at) + '</td>' +
        '<td>' + statusBadge(b.status) + '</td>' +
        '<td><div class="fd-pga-booking-actions">' + actions + '</div></td>' +
        '</tr>'
      );
    }).join('');

    tbody.querySelectorAll('[data-pga-booking]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        updateBookingStatus(btn.getAttribute('data-pga-booking'), btn.getAttribute('data-pga-status'));
      });
    });
  }

  async function updateBookingStatus(bookingId, status) {
    var bid = brandId();
    if (!bid || !bookingId || !status) return;
    try {
      var res = await fetch(apiBase() + '/bookings/' + encodeURIComponent(bookingId) + '/status', {
        method: 'PUT',
        headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
        body: JSON.stringify({ brand_id: bid, status: status })
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || 'Aggiornamento fallito');
      toast('Prenotazione aggiornata');
      await loadBookingsTable();
    } catch (err) {
      toast(err.message || 'Errore aggiornamento prenotazione');
    }
  }

  function renderCoinActionsTable() {
    var tbody = document.querySelector('#pgaCoinActionsTable tbody');
    if (!tbody) return;
    var rows = state.coinActions || [];
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="4" style="color:var(--text2)">Nessuna regola coin. Attiva PGA per generare le regole predefinite.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(function (a) {
      return (
        '<tr data-pga-action-id="' + escapeHtml(a.id) + '">' +
        '<td><code>' + escapeHtml(a.action_key) + '</code></td>' +
        '<td>' + escapeHtml(a.description || '—') + '</td>' +
        '<td><input type="number" class="fd-pga-coin-input fd-rbac-write" data-pga-coin-id="' + escapeHtml(a.id) + '" value="' + escapeHtml(a.coin_amount) + '" min="0" style="width:80px"></td>' +
        '<td><button type="button" class="btn sec small fd-rbac-write" data-pga-save-coin="' + escapeHtml(a.id) + '">Salva</button></td>' +
        '</tr>'
      );
    }).join('');

    tbody.querySelectorAll('[data-pga-save-coin]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        saveCoinAction(btn.getAttribute('data-pga-save-coin'));
      });
    });
  }

  async function saveCoinAction(actionId) {
    var bid = brandId();
    if (!bid || !actionId) return;
    var input = document.querySelector('[data-pga-coin-id="' + actionId + '"]');
    var amount = parseInt((input || {}).value, 10);
    if (!Number.isFinite(amount) || amount < 0) {
      toast('Importo coin non valido');
      return;
    }
    try {
      var res = await fetch(apiBase() + '/coins/actions/' + encodeURIComponent(actionId), {
        method: 'PUT',
        headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
        body: JSON.stringify({ brand_id: bid, coin_amount: amount })
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || 'Salvataggio fallito');
      toast('Regola coin aggiornata');
      state.coinActions = await fetchCoinActions();
      renderCoinActionsTable();
    } catch (err) {
      toast(err.message || 'Errore salvataggio regola');
    }
  }

  async function loadPgaSettingsForm() {
    try {
      state.settings = await fetchPgaSettings();
    } catch (err) {
      toast(err.message || 'Errore impostazioni');
      return;
    }
    var s = state.settings || {};
    var welcome = document.getElementById('pgaSettingsWelcome');
    var email = document.getElementById('pgaSettingsNotifyEmail');
    var notifyBooking = document.getElementById('pgaSettingsNotifyBooking');
    var budget = document.getElementById('pgaSettingsBudget');
    if (welcome) welcome.value = s.welcome_message || '';
    if (email) email.value = s.notify_hr_email || '';
    if (notifyBooking) notifyBooking.checked = s.notify_hr_on_booking !== false;
    if (budget) budget.value = s.annual_budget_external_eur != null ? s.annual_budget_external_eur : '';
    renderOnboardingBanner();
  }

  function renderOnboardingBanner() {
    var host = document.getElementById('pgaOnboardingBanner');
    if (!host) return;
    var enabled = !!(state.settings && state.settings.enabled);
    var expCount = (state.experiences || []).length;
    if (enabled && expCount > 0) {
      host.hidden = true;
      return;
    }
    host.hidden = false;
    host.innerHTML =
      '<strong>Avvio rapido PGA</strong> — ' +
      '1) Importa merchant in <a href="#" data-pga-nav-conventions>Convenzioni</a> · ' +
      '2) <a href="#" data-pga-nav-enable>Attiva PGA</a> in Catalogo · ' +
      '3) <a href="#" data-pga-nav-experiences>Rivedi le esperienze</a> nel catalogo.';
  }

  function handleOnboardingBannerClick(e) {
    var link = e.target.closest('[data-pga-nav-conventions], [data-pga-nav-enable], [data-pga-nav-experiences]');
    if (!link) return;
    e.preventDefault();
    if (link.hasAttribute('data-pga-nav-conventions')) {
      if (typeof global.nav === 'function') global.nav('conventions');
      return;
    }
    if (typeof global.nav === 'function') global.nav('pga-catalog');
    switchPgaTab('catalog');
    if (link.hasAttribute('data-pga-nav-enable')) {
      var cb = document.getElementById('pgaEnabledCheckbox');
      if (cb) {
        cb.focus();
        cb.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
      return;
    }
    if (link.hasAttribute('data-pga-nav-experiences')) {
      var table = document.getElementById('pgaExperiencesTable');
      if (table) table.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  async function savePgaSettings(e) {
    if (e) e.preventDefault();
    var bid = brandId();
    if (!bid) return;
    var payload = {
      welcome_message: (document.getElementById('pgaSettingsWelcome') || {}).value || null,
      notify_hr_email: (document.getElementById('pgaSettingsNotifyEmail') || {}).value || null,
      notify_hr_on_booking: !!(document.getElementById('pgaSettingsNotifyBooking') || {}).checked,
      annual_budget_external_eur: (function () {
        var v = (document.getElementById('pgaSettingsBudget') || {}).value;
        return v === '' ? null : parseFloat(v);
      })()
    };
    try {
      var res = await fetch(apiBase() + '/brands/' + encodeURIComponent(bid) + '/pga-settings', {
        method: 'PUT',
        headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
        body: JSON.stringify(payload)
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || 'Salvataggio fallito');
      state.settings = data;
      toast('Impostazioni PGA salvate');
    } catch (err) {
      toast(err.message || 'Errore salvataggio impostazioni');
    }
  }

  async function submitManualGrant(e) {
    if (e) e.preventDefault();
    var bid = brandId();
    if (!bid) return;
    var serial = (document.getElementById('pgaManualPassSerial') || {}).value.trim();
    var amount = parseInt((document.getElementById('pgaManualCoinAmount') || {}).value, 10);
    var desc = (document.getElementById('pgaManualDescription') || {}).value.trim();
    if (!serial || !Number.isFinite(amount) || amount <= 0) {
      toast('Serial pass e importo coin obbligatori');
      return;
    }
    try {
      var res = await fetch(apiBase() + '/coins/manual-grant', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
        body: JSON.stringify({
          brand_id: bid,
          pass_serial: serial,
          coin_amount: amount,
          description: desc || 'Assegnazione manuale HR'
        })
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || 'Assegnazione fallita');
      toast('Coin assegnati');
      var serialEl = document.getElementById('pgaManualPassSerial');
      var amtEl = document.getElementById('pgaManualCoinAmount');
      var descEl = document.getElementById('pgaManualDescription');
      if (serialEl) serialEl.value = '';
      if (amtEl) amtEl.value = '';
      if (descEl) descEl.value = '';
    } catch (err) {
      toast(err.message || 'Errore assegnazione coin');
    }
  }

  function bindPgaEvents() {
    var section = document.getElementById('pga-catalog');
    if (!section || section.dataset.fdEventsBound === '1') return;
    section.dataset.fdEventsBound = '1';

    var bookingFilter = document.getElementById('pgaBookingStatusFilter');
    if (bookingFilter) {
      bookingFilter.addEventListener('change', loadBookingsTable);
    }

    var settingsForm = document.getElementById('pgaSettingsForm');
    if (settingsForm) settingsForm.addEventListener('submit', savePgaSettings);

    var grantForm = document.getElementById('pgaManualGrantForm');
    if (grantForm) grantForm.addEventListener('submit', submitManualGrant);

    var expForm = document.getElementById('pgaExperienceForm');
    if (expForm) expForm.addEventListener('submit', saveExperienceModal);

    var modal = document.getElementById('pgaExperienceModal');
    if (modal) {
      modal.querySelectorAll('[data-pga-modal-close]').forEach(function (btn) {
        btn.addEventListener('click', closeExperienceModal);
      });
    }

    var onboardingHost = document.getElementById('pgaOnboardingBanner');
    if (onboardingHost && onboardingHost.dataset.fdBannerDelegated !== '1') {
      onboardingHost.dataset.fdBannerDelegated = '1';
      onboardingHost.addEventListener('click', handleOnboardingBannerClick);
    }
  }

  async function reloadPgaData() {
    try {
      var results = await Promise.all([
        fetchPgaSettings(),
        fetchExperiences().catch(function () { return []; }),
        fetchCoinActions().catch(function () { return []; })
      ]);
      state.settings = results[0];
      state.experiences = results[1] || [];
      state.coinActions = results[2] || [];
      renderPgaEnabledToggle();
      renderOnboardingBanner();
      if (state.tab === 'catalog') renderExperiencesTable();
      else if (state.tab === 'bookings') await loadBookingsTable();
      else if (state.tab === 'coins') renderCoinActionsTable();
      else if (state.tab === 'settings') await loadPgaSettingsForm();
    } catch (err) {
      toast(err.message || 'Errore caricamento PGA');
    }
  }

  async function loadPgaCatalog() {
    if (!isFiloPgaApp()) return;
    enhancePgaSectionDesign();
    ensurePgaCatalogFilters();
    bindPgaEvents();
    switchPgaTab(getPgaTab(), { skipLoad: true });
    await reloadPgaData();
    if (typeof global.fdRbacHook === 'function') global.fdRbacHook('pga-catalog');
  }

  function initPgaModule() {
    if (!isFiloPgaApp()) return;
    enhancePgaSectionDesign();
    ensurePgaCatalogFilters();
    if (typeof global.fdInjectSectionFlowBar === 'function') {
      global.fdInjectSectionFlowBar('pga-catalog');
    }
  }

  global.switchPgaTab = switchPgaTab;
  global.loadPgaCatalog = loadPgaCatalog;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPgaModule);
  } else {
    initPgaModule();
  }
})(typeof window !== 'undefined' ? window : global);
