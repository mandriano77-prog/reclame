/**
 * FD — Log Attività: filtri, ricerca, export CSV, copia ID, dettagli leggibili.
 */
(function () {
  'use strict';

  var cache = [];
  var filters = { type: '', q: '', dateFrom: '', dateTo: '' };

  var META_LABELS = {
    source: 'Fonte',
    channel: 'Canale',
    member_id: 'Member',
    email: 'Email',
    reason: 'Motivo',
    push_id: 'Push',
    title: 'Titolo',
    message: 'Messaggio',
    campaign_id: 'Campagna',
    audience_id: 'Audience',
    serial_number: 'Serial',
    user_agent: 'User-Agent',
    ip: 'IP',
    refId: 'Rif.',
    ref_id: 'Rif.'
  };

  var EVENT_TYPE_LABELS = {
    pass_fetched: 'Pass recuperato',
    pass_downloaded: 'Pass scaricato',
    samsung_wallet_link_generated: 'Link Samsung Wallet generato',
    pass_installed: 'Pass installato',
    pass_created: 'Pass creato',
    pass_updated: 'Pass aggiornato',
    pass_deleted: 'Pass eliminato',
    push_sent: 'Push inviata',
    push_delivered: 'Push consegnata',
    push_failed: 'Push non consegnata',
    member_created: 'Membro creato',
    member_updated: 'Membro aggiornato',
    google_wallet_saved: 'Google Wallet salvato',
    apple_wallet_registered: 'Apple Wallet registrato'
  };

  function eventTypeLabel(type) {
    var key = String(type || '');
    if (!key) return '—';
    if (EVENT_TYPE_LABELS[key]) return EVENT_TYPE_LABELS[key];
    return key.replace(/_/g, ' ');
  }

  function isFilo() {
    return document.documentElement.getAttribute('data-app') === 'filodiretto';
  }

  function esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function toast(msg) {
    if (typeof window.toast === 'function') window.toast(msg);
  }

  function formatPassIdShort(s) {
    if (typeof window.formatPassIdShort === 'function') return window.formatPassIdShort(s);
    s = String(s || '');
    if (!s) return '—';
    if (s.length <= 14) return s;
    return s.slice(0, 8) + '…' + s.slice(-4);
  }

  function formatDeviceShort(s) {
    s = String(s || '');
    if (!s) return '—';
    if (s.length <= 24) return s;
    return s.slice(0, 20) + '…';
  }

  function normalizeMeta(meta) {
    if (meta == null) return null;
    if (typeof meta === 'string') {
      var t = meta.trim();
      if (!t || t === '{}') return null;
      try {
        var parsed = JSON.parse(t);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
      } catch (_) {}
      return { _raw: t };
    }
    if (typeof meta === 'object') {
      if (Array.isArray(meta)) return meta.length ? { items: meta.join(', ') } : null;
      if (Object.keys(meta).length === 0) return null;
      return meta;
    }
    return null;
  }

  function formatMetaParts(meta, forExport) {
    var obj = normalizeMeta(meta);
    if (!obj) return [];
    if (obj._raw) return [obj._raw];
    var parts = [];
    Object.keys(obj).forEach(function (key) {
      var val = obj[key];
      if (val == null || val === '') return;
      if (typeof val === 'object') {
        try {
          var inner = JSON.stringify(val);
          if (inner === '{}') return;
          parts.push((META_LABELS[key] || key) + ': ' + (forExport ? inner : inner.slice(0, 80)));
        } catch (_) {}
        return;
      }
      var text = String(val);
      if (!forExport && text.length > 96) text = text.slice(0, 93) + '…';
      parts.push((META_LABELS[key] || key) + ': ' + text);
    });
    return parts;
  }

  function formatActivityDetails(ev, forExport) {
    var parts = formatMetaParts(ev && ev.metadata, forExport);
    if (parts.length) return parts.join(' · ');
    return '—';
  }

  function copyValue(value, label) {
    if (!value) return;
    var text = String(value);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        toast(label + ' copiato');
      }).catch(function () {
        toast('Copia non riuscita');
      });
      return;
    }
    toast('Copia non disponibile');
  }

  function renderIdButton(value, shortLabel, copyLabel) {
    if (!value) return '—';
    return (
      '<button type="button" class="pass-id-copy fd-activity-id-copy" data-copy-value="' +
      esc(value) + '" data-copy-label="' + esc(copyLabel) + '" title="' +
      esc(value) + ' — clic per copiare" aria-label="Copia ' + esc(copyLabel) + ' completo">' +
      '<span class="fd-activity-id-copy__icon" aria-hidden="true">⧉</span>' +
      '<span class="fd-activity-id-copy__text">' + esc(shortLabel) + '</span>' +
      '</button>'
    );
  }

  function renderDetailsCell(ev) {
    var details = formatActivityDetails(ev, false);
    if (!details || details === '—') return '—';
    return (
      '<span class="fd-activity-log-details__text" title="' + esc(details) + '" data-event-raw="' +
      esc(ev.event_type || '') + '">' + esc(details) + '</span>'
    );
  }

  function renderEventBadge(ev) {
    var raw = ev.event_type || '';
    var label = eventTypeLabel(raw);
    return (
      '<span class="badge inactive fd-activity-event" data-event-type="' + esc(raw) + '" ' +
      'title="' + esc(raw) + '" style="text-transform:none;font-size:11px;">' +
      esc(label) + '</span>'
    );
  }

  function rowMatchesFilters(ev) {
    if (filters.type && String(ev.event_type || '') !== filters.type) return false;

    if (filters.dateFrom) {
      var from = new Date(filters.dateFrom);
      if (isNaN(from.getTime())) return false;
      var created = ev.created_at ? new Date(ev.created_at) : null;
      if (!created || created < from) return false;
    }

    if (filters.dateTo) {
      var to = new Date(filters.dateTo);
      if (isNaN(to.getTime())) return false;
      to.setHours(23, 59, 59, 999);
      var createdTo = ev.created_at ? new Date(ev.created_at) : null;
      if (!createdTo || createdTo > to) return false;
    }

    if (filters.q) {
      var q = filters.q.toLowerCase();
      var haystack = [
        ev.event_type,
        ev.pass_id,
        ev.device_id,
        formatActivityDetails(ev, true),
        ev.metadata && typeof ev.metadata === 'object' ? JSON.stringify(ev.metadata) : ev.metadata
      ].filter(Boolean).join(' ').toLowerCase();
      if (haystack.indexOf(q) === -1) return false;
    }

    return true;
  }

  function getFilteredEvents() {
    return cache.filter(rowMatchesFilters);
  }

  function populateTypeFilter() {
    var sel = document.getElementById('fdActivityLogTypeFilter');
    if (!sel) return;
    var current = filters.type || sel.value || '';
    var types = [];
    cache.forEach(function (ev) {
      if (ev.event_type && types.indexOf(ev.event_type) === -1) types.push(ev.event_type);
    });
    types.sort();
    sel.innerHTML = '<option value="">Tutti</option>' +
      types.map(function (t) {
        return '<option value="' + esc(t) + '" title="' + esc(t) + '">' + esc(eventTypeLabel(t)) + '</option>';
      }).join('');
    sel.value = types.indexOf(current) !== -1 || current === '' ? current : '';
    filters.type = sel.value;
  }

  function updateFilterHint() {
    var hint = document.getElementById('fdActivityLogFilterHint');
    if (!hint) return;
    var shown = getFilteredEvents().length;
    var total = cache.length;
    if (!total) {
      hint.textContent = '';
      return;
    }
    if (shown === total) {
      hint.textContent = total + ' eventi caricati';
    } else {
      hint.textContent = 'Mostrati ' + shown + ' di ' + total + ' eventi';
    }
  }

  function renderTableBody() {
    var body = document.getElementById('activityLogBody');
    if (!body) return;

    var events = getFilteredEvents();
    if (!cache.length) {
      body.innerHTML = '<tr><td colspan="5">' +
        (typeof window.renderEmptyState === 'function'
          ? window.renderEmptyState({
            title: 'Nessun evento',
            description: 'Le attività su pass e campagne compariranno qui.',
            icon: 'inbox'
          })
          : '<span style="color:var(--text2)">Nessun evento</span>') +
        '</td></tr>';
      updateFilterHint();
      return;
    }

    if (!events.length) {
      body.innerHTML = '<tr><td colspan="5" style="color:var(--text2);text-align:center;padding:24px;">Nessun evento corrisponde ai filtri attivi.</td></tr>';
      updateFilterHint();
      return;
    }

    body.innerHTML = events.map(function (ev) {
      var when = ev.created_at ? new Date(ev.created_at).toLocaleString('it-IT') : '—';
      return (
        '<tr data-event-type="' + esc(ev.event_type || '') + '">' +
        '<td style="font-size:12px;white-space:nowrap;">' + esc(when) + '</td>' +
        '<td>' + renderEventBadge(ev) + '</td>' +
        '<td>' + renderIdButton(ev.pass_id, formatPassIdShort(ev.pass_id), 'Pass ID') + '</td>' +
        '<td class="fd-activity-log-device">' + renderIdButton(ev.device_id, formatDeviceShort(ev.device_id), 'Device ID') + '</td>' +
        '<td class="fd-activity-log-details">' + renderDetailsCell(ev) + '</td>' +
        '</tr>'
      );
    }).join('');

    updateFilterHint();
  }

  function readFiltersFromUi() {
    filters.type = document.getElementById('fdActivityLogTypeFilter')?.value || '';
    filters.q = (document.getElementById('fdActivityLogSearch')?.value || '').trim();
    filters.dateFrom = document.getElementById('fdActivityLogDateFrom')?.value || '';
    filters.dateTo = document.getElementById('fdActivityLogDateTo')?.value || '';
  }

  function onFiltersChange() {
    readFiltersFromUi();
    renderTableBody();
  }

  function exportCsv() {
    readFiltersFromUi();
    var rows = getFilteredEvents();
    if (!rows.length) {
      toast('Nessun evento da esportare');
      return;
    }
    var header = 'Data ora,Evento,Pass ID,Device,Dettagli';
    var lines = rows.map(function (ev) {
      return [
        ev.created_at ? new Date(ev.created_at).toLocaleString('it-IT') : '',
        ev.event_type || '',
        ev.pass_id || '',
        ev.device_id || '',
        formatActivityDetails(ev, true)
      ].map(function (v) {
        return '"' + String(v).replace(/"/g, '""') + '"';
      }).join(',');
    });
    var csv = [header].concat(lines).join('\n');
    var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'activity-log-' + (new Date().toISOString().slice(0, 10)) + '.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast('CSV esportato (' + rows.length + ' righe)');
  }

  function wireToolbar() {
    var typeSel = document.getElementById('fdActivityLogTypeFilter');
    var search = document.getElementById('fdActivityLogSearch');
    var dateFrom = document.getElementById('fdActivityLogDateFrom');
    var dateTo = document.getElementById('fdActivityLogDateTo');
    var exportBtn = document.getElementById('fdActivityLogExportBtn');

    if (typeSel && !typeSel.dataset.fdWired) {
      typeSel.dataset.fdWired = '1';
      typeSel.addEventListener('change', onFiltersChange);
    }
    if (search && !search.dataset.fdWired) {
      search.dataset.fdWired = '1';
      search.addEventListener('input', onFiltersChange);
    }
    if (dateFrom && !dateFrom.dataset.fdWired) {
      dateFrom.dataset.fdWired = '1';
      dateFrom.addEventListener('change', onFiltersChange);
    }
    if (dateTo && !dateTo.dataset.fdWired) {
      dateTo.dataset.fdWired = '1';
      dateTo.addEventListener('change', onFiltersChange);
    }
    if (exportBtn && !exportBtn.dataset.fdWired) {
      exportBtn.dataset.fdWired = '1';
      exportBtn.addEventListener('click', exportCsv);
    }
  }

  function buildToolbar() {
    if (document.getElementById('fdActivityLogToolbar')) {
      wireToolbar();
      return;
    }
    var tableWrap = document.querySelector('#activity-log .pass-table-wrap');
    if (!tableWrap) return;

    var bar = document.createElement('div');
    bar.id = 'fdActivityLogToolbar';
    bar.className = 'fd-activity-log-toolbar fd-rbac-read-scope';
    bar.setAttribute('data-rbac-read-scope', 'true');
    bar.innerHTML =
      '<div class="fd-activity-log-toolbar__group">' +
      '<label class="fd-activity-log-toolbar__label" for="fdActivityLogTypeFilter">Tipo evento</label>' +
      '<select id="fdActivityLogTypeFilter" aria-label="Filtra per tipo evento"><option value="">Tutti</option></select>' +
      '</div>' +
      '<div class="fd-activity-log-toolbar__group fd-activity-log-toolbar__group--search">' +
      '<label class="fd-activity-log-toolbar__label" for="fdActivityLogSearch">Cerca</label>' +
      '<input type="search" id="fdActivityLogSearch" placeholder="Pass ID, device, dettagli…" autocomplete="off" aria-label="Cerca nel log attività">' +
      '</div>' +
      '<div class="fd-activity-log-toolbar__group">' +
      '<label class="fd-activity-log-toolbar__label" for="fdActivityLogDateFrom">Dal</label>' +
      '<input type="date" id="fdActivityLogDateFrom" aria-label="Filtra eventi dal">' +
      '</div>' +
      '<div class="fd-activity-log-toolbar__group">' +
      '<label class="fd-activity-log-toolbar__label" for="fdActivityLogDateTo">Al</label>' +
      '<input type="date" id="fdActivityLogDateTo" aria-label="Filtra eventi al">' +
      '</div>' +
      '<div class="fd-activity-log-toolbar__actions">' +
      '<button type="button" class="btn" id="fdActivityLogExportBtn" data-allow-readonly="true">Esporta CSV</button>' +
      '</div>' +
      '<p class="fd-activity-log-filter-hint" id="fdActivityLogFilterHint" aria-live="polite"></p>';

    tableWrap.parentNode.insertBefore(bar, tableWrap);
    wireToolbar();
  }

  function wireCopyDelegation() {
    var table = document.getElementById('activityLogTable');
    if (!table || table.dataset.fdCopyWired === '1') return;
    table.dataset.fdCopyWired = '1';
    table.addEventListener('click', function (e) {
      var btn = e.target.closest('.fd-activity-id-copy');
      if (!btn) return;
      e.preventDefault();
      var val = btn.getAttribute('data-copy-value');
      var label = btn.getAttribute('data-copy-label') || 'ID';
      copyValue(val, label);
      btn.classList.add('is-copied');
      setTimeout(function () {
        btn.classList.remove('is-copied');
      }, 1200);
    });
  }

  async function loadActivityLogEnhanced() {
    var body = document.getElementById('activityLogBody');
    if (!body) return;

    var brandId = typeof window.ensureBrandIdFromContext === 'function'
      ? window.ensureBrandIdFromContext()
      : window.brandId;
    if (!brandId) return;

    body.innerHTML = typeof window.renderTableSkeletonRows === 'function'
      ? window.renderTableSkeletonRows(8, 5)
      : '<tr><td colspan="5" style="color:var(--text2)">Caricamento…</td></tr>';

    try {
      var api = typeof window.API === 'string' && window.API ? window.API : '/api/v1';
      var headers = typeof window.getAuthHeaders === 'function' ? window.getAuthHeaders() : {};
      var res = await fetch(api + '/events/' + encodeURIComponent(brandId) + '?limit=250', {
        headers: headers
      });
      if (!res.ok) throw new Error((await res.json().catch(function () { return {}; })).error || res.status);
      var events = await res.json();
      cache = Array.isArray(events) ? events : [];
      populateTypeFilter();
      renderTableBody();
      syncActivityLogChrome();
      if (typeof window.fdRbacHook === 'function') window.fdRbacHook('activity-log');
    } catch (e) {
      body.innerHTML = typeof window.renderTableErrorRow === 'function'
        ? window.renderTableErrorRow(5, e.message || 'Errore caricamento log', 'loadActivityLog()')
        : '<tr><td colspan="5" style="color:var(--red)">Errore: ' + esc(e.message) + '</td></tr>';
    }
  }

  function patchLoader() {
    if (window.__fdActivityLogPatched) return;
    window.__fdActivityLogPatched = true;
    window.loadActivityLog = loadActivityLogEnhanced;
  }

  function syncActivityLogChrome() {
    if (typeof window.fdSyncAnalyticsHrChrome === 'function') {
      window.fdSyncAnalyticsHrChrome('activity-log');
    }
    var h1 = document.querySelector(
      '#analytics h1.page-title, #analytics h1.sec-title, #analytics h1.fd-page-header__title, #analytics .fd-page-header__title'
    );
    if (h1) h1.textContent = 'Log Attività';
  }

  function patchNav() {
    if (window.__fdActivityLogNavPatched || typeof window.nav !== 'function') return;
    window.__fdActivityLogNavPatched = true;
    var orig = window.nav;
    window.nav = function (sectionId, options) {
      var out = orig.apply(this, arguments);
      options = options || {};
      var resolved = typeof window.resolveNavTarget === 'function'
        ? window.resolveNavTarget(sectionId, options)
        : { section: sectionId, tab: options.tab || '' };
      var isActivityLog = sectionId === 'activity-log'
        || (resolved.section === 'analytics' && resolved.tab === 'activity-log');
      if (isActivityLog) {
        setTimeout(function () {
          syncActivityLogChrome();
          buildToolbar();
          wireCopyDelegation();
          if (typeof window.fdRbacHook === 'function') window.fdRbacHook('activity-log');
        }, 60);
      }
      return out;
    };
  }

  function init() {
    if (!isFilo()) return;
    var section = document.getElementById('activity-log');
    if (section) section.classList.add('activity-log--fd');
    patchLoader();
    patchNav();
    buildToolbar();
    wireCopyDelegation();
  }

  window.fdInitActivityLog = init;
  window.fdLoadActivityLog = loadActivityLogEnhanced;
  window.fdEventTypeLabel = eventTypeLabel;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
