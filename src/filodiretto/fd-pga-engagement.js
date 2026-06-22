/**
 * FD — PGA Engagement analytics HR dashboard (Sprint 4).
 */
(function (global) {
  'use strict';

  var WEEKDAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

  var state = {
    analytics: null,
    analyticsError: false,
    days: 30
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

  function enhanceEngagementSectionDesign() {
    var section = document.getElementById('pga-engagement');
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
        'Monitora coin assegnati e riscattati, le esperienze più richieste e l\'attività per giorno della settimana.';
      copy.appendChild(lead);
      header.appendChild(copy);
      section.insertBefore(header, section.firstChild);
    }
  }

  async function fetchEngagementAnalytics(days) {
    var bid = brandId();
    if (!bid) return null;
    var res = await fetch(
      apiBase() + '/brands/' + encodeURIComponent(bid) + '/engagement-analytics?days=' + encodeURIComponent(days),
      { headers: authHeaders() }
    );
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || 'Errore analytics');
    return data;
  }

  function formatKpiNumber(value) {
    if (value == null || value === '' || Number.isNaN(Number(value))) return '0';
    return String(Number(value));
  }

  function renderKpiSkeleton() {
    var host = document.getElementById('pgaEngagementKpis');
    if (!host) return;
    var items = [
      'Coin assegnati',
      'Coin riscattati',
      'Eventi assegnazione',
      'Eventi riscatto'
    ];
    host.classList.add('fd-pga-kpi-grid--loading');
    host.innerHTML = items.map(function (label) {
      return (
        '<div class="fd-pga-kpi" aria-busy="true">' +
        '<div class="fd-pga-kpi__label">' + escapeHtml(label) + '</div>' +
        '<div class="fd-pga-kpi__value"><span class="fd-pga-kpi__value-skeleton" aria-hidden="true"></span></div>' +
        '</div>'
      );
    }).join('');
  }

  function renderKpis() {
    var host = document.getElementById('pgaEngagementKpis');
    if (!host) return;
    host.classList.remove('fd-pga-kpi-grid--loading');
    var a = state.analytics;
    var items = [
      { label: 'Coin assegnati', value: a ? formatKpiNumber(a.coins_granted) : '0', hint: 'Totale coin erogati nel periodo' },
      { label: 'Coin riscattati', value: a ? formatKpiNumber(a.coins_redeemed) : '0', hint: 'Coin spesi in prenotazioni' },
      { label: 'Eventi assegnazione', value: a ? formatKpiNumber(a.grant_events) : '0', hint: 'Azioni che hanno generato coin' },
      { label: 'Eventi riscatto', value: a ? formatKpiNumber(a.redemption_events) : '0', hint: 'Prenotazioni o riscatti confermati' }
    ];
    if (state.analyticsError && !a) {
      items.forEach(function (item) {
        item.value = '—';
      });
    }
    host.innerHTML = items.map(function (item) {
      return (
        '<div class="fd-pga-kpi' + (state.analyticsError && !a ? ' fd-pga-kpi--error' : '') + '">' +
        '<div class="fd-pga-kpi__label">' + escapeHtml(item.label) + '</div>' +
        '<div class="fd-pga-kpi__value">' + escapeHtml(item.value) + '</div>' +
        (item.hint ? '<div class="fd-pga-kpi__hint">' + escapeHtml(item.hint) + '</div>' : '') +
        '</div>'
      );
    }).join('');
  }

  function renderTopExperiences() {
    var host = document.getElementById('pgaEngagementTopExp');
    if (!host) return;
    var rows = (state.analytics && state.analytics.top_experiences) || [];
    var top5 = rows.slice(0, 5);
    if (!top5.length) {
      host.innerHTML = '<p style="color:var(--text2);font-size:13px">Nessuna prenotazione nel periodo.</p>';
      return;
    }
    host.innerHTML =
      '<table class="table"><thead><tr><th>Esperienza</th><th>Prenotazioni</th></tr></thead><tbody>' +
      top5.map(function (r) {
        return '<tr><td>' + escapeHtml(r.name) + '</td><td>' + escapeHtml(r.bookings) + '</td></tr>';
      }).join('') +
      '</tbody></table>';
  }

  function renderTopActions() {
    var host = document.getElementById('pgaEngagementTopActions');
    if (!host) return;
    var rows = (state.analytics && state.analytics.top_actions) || [];
    if (!rows.length) {
      host.innerHTML = '<p style="color:var(--text2);font-size:13px">Nessuna azione coin nel periodo.</p>';
      return;
    }
    host.innerHTML =
      '<table class="table"><thead><tr><th>Azione</th><th>Eventi</th><th>Coin totali</th></tr></thead><tbody>' +
      rows.map(function (r) {
        return (
          '<tr><td><code>' + escapeHtml(r.action_key) + '</code></td>' +
          '<td>' + escapeHtml(r.events) + '</td>' +
          '<td>' + escapeHtml(r.total_coins) + '</td></tr>'
        );
      }).join('') +
      '</tbody></table>';
  }

  function renderByWeekday() {
    var host = document.getElementById('pgaEngagementByWeekday');
    if (!host) return;
    var rows = (state.analytics && state.analytics.by_weekday) || [];
    if (!rows.length) {
      host.innerHTML = '<p style="color:var(--text2);font-size:13px">Nessun dato per giorno settimana.</p>';
      return;
    }
    host.innerHTML =
      '<table class="table"><thead><tr><th>Giorno</th><th>Eventi</th><th>Coin netti</th></tr></thead><tbody>' +
      rows.map(function (r) {
        var dow = Number(r.dow);
        return (
          '<tr><td>' + escapeHtml(WEEKDAY_LABELS[dow] || dow) + '</td>' +
          '<td>' + escapeHtml(r.events) + '</td>' +
          '<td>' + escapeHtml(r.total_coins) + '</td></tr>'
        );
      }).join('') +
      '</tbody></table>';
  }

  function exportEngagementCsv() {
    var a = state.analytics;
    if (!a) {
      toast('Nessun dato da esportare');
      return;
    }
    var lines = [
      'metrica,valore',
      'coins_granted,' + (a.coins_granted || 0),
      'coins_redeemed,' + (a.coins_redeemed || 0),
      'grant_events,' + (a.grant_events || 0),
      'redemption_events,' + (a.redemption_events || 0),
      '',
      'top_experiences,nome,prenotazioni'
    ];
    (a.top_experiences || []).slice(0, 5).forEach(function (r) {
      lines.push('experience,' + '"' + String(r.name || '').replace(/"/g, '""') + '",' + (r.bookings || 0));
    });
    lines.push('');
    lines.push('top_actions,action_key,eventi,coin');
    (a.top_actions || []).forEach(function (r) {
      lines.push('action,' + r.action_key + ',' + r.events + ',' + r.total_coins);
    });
    lines.push('');
    lines.push('by_weekday,giorno,eventi,coin');
    (a.by_weekday || []).forEach(function (r) {
      var dow = Number(r.dow);
      lines.push('weekday,' + (WEEKDAY_LABELS[dow] || dow) + ',' + r.events + ',' + r.total_coins);
    });
    var blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'pga-engagement-' + state.days + 'd.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  function bindEngagementEvents() {
    var section = document.getElementById('pga-engagement');
    if (!section || section.dataset.fdEventsBound === '1') return;
    section.dataset.fdEventsBound = '1';

    var rangeEl = document.getElementById('pgaEngagementDays');
    if (rangeEl) {
      rangeEl.addEventListener('change', function () {
        state.days = parseInt(rangeEl.value, 10) || 30;
        reloadEngagement();
      });
    }

    var exportBtn = document.getElementById('pgaEngagementExportBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', exportEngagementCsv);
    }
  }

  async function reloadEngagement() {
    state.analyticsError = false;
    renderKpiSkeleton();
    try {
      state.analytics = await fetchEngagementAnalytics(state.days);
      renderKpis();
      renderTopExperiences();
      renderTopActions();
      renderByWeekday();
    } catch (err) {
      state.analytics = null;
      state.analyticsError = true;
      renderKpis();
      toast(err.message || 'Errore caricamento engagement');
    } finally {
      var host = document.getElementById('pgaEngagementKpis');
      if (host) host.classList.remove('fd-pga-kpi-grid--loading');
    }
  }

  async function loadPgaEngagement() {
    if (!isFiloPgaApp()) return;
    enhanceEngagementSectionDesign();
    bindEngagementEvents();
    var rangeEl = document.getElementById('pgaEngagementDays');
    if (rangeEl) state.days = parseInt(rangeEl.value, 10) || 30;
    await reloadEngagement();
    if (typeof global.fdRbacHook === 'function') global.fdRbacHook('pga-engagement');
  }

  function initEngagementModule() {
    if (!isFiloPgaApp()) return;
    enhanceEngagementSectionDesign();
    bindEngagementEvents();
    var host = document.getElementById('pgaEngagementKpis');
    if (host && !host.querySelector('.fd-pga-kpi')) {
      renderKpiSkeleton();
    }
  }

  global.loadPgaEngagement = loadPgaEngagement;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEngagementModule);
  } else {
    initEngagementModule();
  }
})(typeof window !== 'undefined' ? window : global);
