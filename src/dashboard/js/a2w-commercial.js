/**
 * Reclame — commercial calendar, billing, tenant performance.
 */
(function (global) {
  'use strict';

  var API = '/api/v1';

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function authHeaders() {
    if (typeof global.getAuthHeaders === 'function') return global.getAuthHeaders();
    return {};
  }

  function brandId() {
    return global.brandId || null;
  }

  function toast(msg) {
    if (typeof global.toast === 'function') global.toast(msg);
  }

  function euros(cents) {
    return (Number(cents || 0) / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
    } catch (_) {
      return String(iso).slice(0, 10);
    }
  }

  function calendarQuery() {
    var from = document.getElementById('commercialFilterFrom')?.value;
    var to = document.getElementById('commercialFilterTo')?.value;
    var q = '';
    if (from) q += '&from=' + encodeURIComponent(new Date(from + 'T00:00:00').toISOString());
    if (to) q += '&to=' + encodeURIComponent(new Date(to + 'T23:59:59').toISOString());
    return q;
  }

  function initCommercialDateFilters() {
    var fromEl = document.getElementById('commercialFilterFrom');
    var toEl = document.getElementById('commercialFilterTo');
    if (!fromEl || fromEl.dataset.init) return;
    fromEl.dataset.init = '1';
    var now = new Date();
    var start = new Date(now.getFullYear(), now.getMonth(), 1);
    var end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    fromEl.value = start.toISOString().slice(0, 10);
    toEl.value = end.toISOString().slice(0, 10);
    document.getElementById('commercialFilterApply')?.addEventListener('click', loadCommercialCalendar);
    document.getElementById('commercialBillingExport')?.addEventListener('click', exportBillingCsv);
  }

  async function loadMerchantsForCommercial() {
    var bid = brandId();
    var sel = document.getElementById('commercialBookingMerchant');
    if (!bid || !sel) return;
    try {
      var res = await fetch(API + '/merchants?brand_id=' + encodeURIComponent(bid), { headers: authHeaders() });
      var merchants = res.ok ? await res.json() : [];
      sel.innerHTML = '<option value="">— Nessuno —</option>' + merchants.map(function (m) {
        return '<option value="' + esc(m.id) + '">' + esc(m.name) + (m.sponsored ? ' ★' : '') + '</option>';
      }).join('');
    } catch (_) {}
  }

  async function loadCommercialCalendar() {
    var bid = brandId();
    if (!bid) return;
    initCommercialDateFilters();
    var pkgEl = document.getElementById('commercialPackages');
    var bookEl = document.getElementById('commercialBookings');
    var billEl = document.getElementById('commercialBilling');
    var billRows = document.getElementById('commercialBillingEntries');
    if (!pkgEl) return;

    await loadMerchantsForCommercial();

    try {
      var res = await fetch(API + '/brands/' + encodeURIComponent(bid) + '/commercial/calendar?' + calendarQuery().replace(/^&/, ''), { headers: authHeaders() });
      var data = res.ok ? await res.json() : {};
      if (!res.ok) {
        pkgEl.innerHTML = '<p style="color:var(--text2);">Calendario non disponibile.</p>';
        return;
      }

      var perfMap = {};
      (data.tenant_performance || []).forEach(function (p) { perfMap[p.booking_id] = p; });

      var packages = data.packages || [];
      pkgEl.innerHTML = packages.map(function (pkg) {
        var slots = (pkg.formats || []).map(function (f) {
          var cap = f.capacity != null ? f.capacity : f.package_slots;
          var avail = f.available != null ? f.available : Math.max(0, cap - (f.booked || 0));
          return '<div class="a2w-commercial-slot"><span>' + esc(f.label) + '</span><span>' + esc(f.booked) + ' / ' + esc(cap) + ' (' + esc(avail) + ' liberi)</span></div>';
        }).join('');
        return '<div class="a2w-commercial-pkg">' +
          '<div class="a2w-commercial-pkg__title">' + esc(pkg.label) + '</div>' +
          '<div class="a2w-commercial-pkg__desc">' + esc(pkg.description) + ' · ' + esc(euros(pkg.suggested_price_cents)) + '</div>' +
          slots +
          '</div>';
      }).join('') || '<p style="color:var(--text2);">Nessun pacchetto configurato.</p>';

      var bookings = data.bookings || [];
      bookEl.innerHTML = bookings.length ? bookings.map(function (b) {
        var p = perfMap[b.id] || {};
        var period = fmtDate(b.start_at) + (b.end_at ? ' → ' + fmtDate(b.end_at) : '');
        var conv = p.tap_to_redeem_pct != null ? p.tap_to_redeem_pct + '%' : '—';
        return '<tr data-booking-id="' + esc(b.id) + '">' +
          '<td>' + esc(b.tenant_name) + '</td>' +
          '<td>' + esc(b.format) + '</td>' +
          '<td style="font-size:11px;">' + esc(period) + '</td>' +
          '<td><select class="commercial-status-select fd-rbac-write" data-booking-status="' + esc(b.id) + '">' +
          ['pending', 'confirmed', 'live', 'completed', 'cancelled'].map(function (s) {
            return '<option value="' + s + '"' + (b.status === s ? ' selected' : '') + '>' + s + '</option>';
          }).join('') +
          '</select></td>' +
          '<td>' + esc(p.link_clicks != null ? p.link_clicks : '—') + '</td>' +
          '<td>' + esc(p.coupon_redemptions != null ? p.coupon_redemptions : '—') + '</td>' +
          '<td>' + esc(conv) + '</td>' +
          '<td>' + esc(euros(b.amount_cents)) + '</td>' +
          '<td><button type="button" class="btn sec small" data-refresh-perf="' + esc(b.id) + '">↻</button></td>' +
          '</tr>';
      }).join('') : '<tr><td colspan="9" style="color:var(--text2);">Nessuna prenotazione nel periodo.</td></tr>';

      bookEl.querySelectorAll('.commercial-status-select').forEach(function (sel) {
        sel.addEventListener('change', function () {
          patchBookingStatus(sel.getAttribute('data-booking-status'), sel.value);
        });
      });
      bookEl.querySelectorAll('[data-refresh-perf]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          refreshBookingPerformance(btn.getAttribute('data-refresh-perf'));
        });
      });

      var bill = data.billing || {};
      billEl.innerHTML =
        '<div class="stat-card"><div class="stat-num">' + esc(euros(bill.gross_cents)) + '</div><div class="stat-label">Fatturato lordo</div></div>' +
        '<div class="stat-card"><div class="stat-num">' + esc(euros(bill.retailer_cents)) + '</div><div class="stat-label">Quota retailer</div></div>' +
        '<div class="stat-card"><div class="stat-num">' + esc(euros(bill.reclame_cents)) + '</div><div class="stat-label">Take-rate Reclame (' + esc(data.take_rate_pct) + '%)</div></div>' +
        '<div class="stat-card"><div class="stat-num">' + esc(bill.pending || 0) + '</div><div class="stat-label">Fatture pendenti</div></div>';

      var entries = data.billing_entries || [];
      if (billRows) {
        billRows.innerHTML = entries.length ? entries.map(function (e) {
          return '<tr><td>' + esc(e.tenant_name) + '</td><td>' + esc(euros(e.gross_cents)) + '</td><td>' + esc(euros(e.retailer_cents)) + '</td><td>' + esc(euros(e.reclame_cents)) + '</td>' +
            '<td>' + esc(e.status) + '</td><td style="font-size:11px;">' + esc(fmtDate(e.created_at)) + '</td>' +
            '<td>' + (e.status === 'pending' ? '<button type="button" class="btn sec small fd-rbac-write" data-mark-paid="' + esc(e.id) + '">Segna pagato</button>' : '') + '</td></tr>';
        }).join('') : '<tr><td colspan="7" style="color:var(--text2);">Nessuna voce fatturazione.</td></tr>';
        billRows.querySelectorAll('[data-mark-paid]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            markBillingPaid(btn.getAttribute('data-mark-paid'));
          });
        });
      }

      var pkgSel = document.getElementById('commercialBookingPackage');
      if (pkgSel && !pkgSel.dataset.wired) {
        pkgSel.dataset.wired = '1';
        pkgSel.innerHTML = packages.map(function (p) {
          return '<option value="' + esc(p.key) + '">' + esc(p.label) + '</option>';
        }).join('');
      }
    } catch (e) {
      console.error('loadCommercialCalendar', e);
    }
  }

  async function patchBookingStatus(bookingId, status) {
    var bid = brandId();
    if (!bid) return;
    try {
      var res = await fetch(API + '/brands/' + encodeURIComponent(bid) + '/commercial/bookings/' + encodeURIComponent(bookingId), {
        method: 'PATCH',
        headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
        body: JSON.stringify({ status: status })
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || 'Aggiornamento fallito');
      toast('Stato prenotazione aggiornato');
      loadCommercialCalendar();
    } catch (err) {
      toast(err.message || 'Errore');
    }
  }

  async function refreshBookingPerformance(bookingId) {
    var bid = brandId();
    if (!bid || !bookingId) return;
    try {
      var res = await fetch(API + '/brands/' + encodeURIComponent(bid) + '/commercial/bookings/' + encodeURIComponent(bookingId) + '/performance', { headers: authHeaders() });
      if (!res.ok) throw new Error('Performance non disponibile');
      toast('Performance aggiornata');
      loadCommercialCalendar();
    } catch (err) {
      toast(err.message || 'Errore');
    }
  }

  async function markBillingPaid(entryId) {
    var bid = brandId();
    if (!bid) return;
    try {
      var res = await fetch(API + '/brands/' + encodeURIComponent(bid) + '/commercial/billing/' + encodeURIComponent(entryId), {
        method: 'PATCH',
        headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
        body: JSON.stringify({ status: 'paid' })
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || 'Errore');
      toast('Voce segnata come pagata');
      loadCommercialCalendar();
    } catch (err) {
      toast(err.message || 'Errore');
    }
  }

  function exportBillingCsv() {
    var bid = brandId();
    if (!bid) return;
    var url = API + '/brands/' + encodeURIComponent(bid) + '/commercial/billing/export.csv';
    fetch(url, { headers: authHeaders() })
      .then(function (r) {
        if (!r.ok) throw new Error('Export fallito');
        return r.blob();
      })
      .then(function (blob) {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'reclame-billing-' + bid + '.csv';
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(function (err) { toast(err.message || 'Errore export'); });
  }

  async function submitCommercialBooking(e) {
    if (e) e.preventDefault();
    var bid = brandId();
    if (!bid) return;
    var tenant = (document.getElementById('commercialBookingTenant')?.value || '').trim();
    var packageKey = document.getElementById('commercialBookingPackage')?.value;
    var format = document.getElementById('commercialBookingFormat')?.value;
    var startAt = document.getElementById('commercialBookingStart')?.value;
    var endAt = document.getElementById('commercialBookingEnd')?.value;
    var merchantId = document.getElementById('commercialBookingMerchant')?.value || null;
    if (!tenant) { toast('Inserisci il nome brand-tenant'); return; }
    if (!startAt) { toast('Data inizio obbligatoria'); return; }

    var body = {
      tenant_name: tenant,
      package_key: packageKey,
      format: format,
      start_at: new Date(startAt).toISOString(),
      end_at: endAt ? new Date(endAt).toISOString() : null,
      merchant_id: merchantId || null,
      push_title: (document.getElementById('commercialPushTitle')?.value || '').trim() || null,
      push_message: (document.getElementById('commercialPushMessage')?.value || '').trim() || null,
      push_link_url: (document.getElementById('commercialPushLink')?.value || '').trim() || null
    };

    if (format === 'geofence_recall') {
      var lat = parseFloat(document.getElementById('commercialPoiLat')?.value);
      var lon = parseFloat(document.getElementById('commercialPoiLon')?.value);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        body.poi = {
          latitude: lat,
          longitude: lon,
          name: tenant,
          relevantText: (document.getElementById('commercialPoiText')?.value || 'Sei vicino! Scopri l\'offerta').trim(),
          radius: parseInt(document.getElementById('commercialPoiRadius')?.value, 10) || 300
        };
      } else {
        toast('Coordinate POI obbligatorie per geofence');
        return;
      }
    }

    try {
      var res = await fetch(API + '/brands/' + encodeURIComponent(bid) + '/commercial/bookings', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
        body: JSON.stringify(body)
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || 'Prenotazione non riuscita');
      var msg = 'Prenotazione creata';
      if (data._actions?.geofence?.pushes_sent) msg += ' · ' + data._actions.geofence.pushes_sent + ' push geofence';
      if (data._actions?.push?.mode) msg += ' · push ' + data._actions.push.mode;
      if (data._actions?.coupon?.mode) msg += ' · CPA ' + data._actions.coupon.mode;
      toast(msg);
      document.getElementById('commercialBookingForm')?.reset();
      loadCommercialCalendar();
      if (format === 'geofence_recall' && typeof global.loadGeofencing === 'function') global.loadGeofencing();
    } catch (err) {
      toast(err.message || 'Errore');
    }
  }

  async function loadAudiencePresets() {
    var el = document.getElementById('audiencePresetsList');
    if (!el || !brandId()) return;
    try {
      var res = await fetch(API + '/audience-presets', { headers: authHeaders() });
      var presets = res.ok ? await res.json() : [];
      el.innerHTML = presets.map(function (p) {
        return '<div class="a2w-audience-preset" data-preset="' + esc(p.key) + '">' +
          '<div class="a2w-audience-preset__meta"><div class="a2w-audience-preset__title">' + esc(p.label) + '</div>' +
          '<div class="a2w-audience-preset__desc">' + esc(p.description) + '</div></div>' +
          '<div><span class="a2w-audience-preset__count" data-preset-count="' + esc(p.key) + '">…</span> ' +
          '<button type="button" class="btn sec small" data-preset-save="' + esc(p.key) + '">Salva audience</button></div></div>';
      }).join('');

      presets.forEach(function (p) {
        fetch(API + '/brands/' + encodeURIComponent(brandId()) + '/audience-presets/' + encodeURIComponent(p.key) + '/preview', { headers: authHeaders() })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            var c = document.querySelector('[data-preset-count="' + p.key + '"]');
            if (c) c.textContent = (data.count != null ? data.count : '—') + ' pass';
          }).catch(function () {});
      });

      el.querySelectorAll('[data-preset-save]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          savePresetAsAudience(btn.getAttribute('data-preset-save'));
        });
      });
    } catch (e) {
      el.innerHTML = '<p style="color:var(--text2);">Preset non disponibili.</p>';
    }
  }

  async function savePresetAsAudience(key) {
    var bid = brandId();
    if (!bid || !key) return;
    var name = prompt('Nome audience', key);
    if (!name) return;
    try {
      var prev = await fetch(API + '/brands/' + encodeURIComponent(bid) + '/audience-presets/' + encodeURIComponent(key) + '/preview', { headers: authHeaders() });
      var pdata = await prev.json();
      var res = await fetch(API + '/brands/' + encodeURIComponent(bid) + '/audiences', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
        body: JSON.stringify({ name: name.trim(), rules: pdata.preset?.rules || {} })
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || 'Salvataggio fallito');
      toast('Audience salvata');
      if (typeof global.loadAudiences === 'function') global.loadAudiences();
    } catch (err) {
      toast(err.message || 'Errore');
    }
  }

  function toggleCommercialFormatFields() {
    var fmt = document.getElementById('commercialBookingFormat')?.value;
    var poi = document.getElementById('commercialPoiFields');
    var push = document.getElementById('commercialPushFields');
    if (poi) poi.hidden = fmt !== 'geofence_recall';
    if (push) push.hidden = fmt !== 'push_lockscreen' && fmt !== 'coupon_cpa';
  }

  function wireCommercialForm() {
    var form = document.getElementById('commercialBookingForm');
    if (form && !form.dataset.wired) {
      form.dataset.wired = '1';
      form.addEventListener('submit', submitCommercialBooking);
    }
    var fmt = document.getElementById('commercialBookingFormat');
    if (fmt && !fmt.dataset.wired) {
      fmt.dataset.wired = '1';
      fmt.addEventListener('change', toggleCommercialFormatFields);
      toggleCommercialFormatFields();
    }
  }

  function init() {
    if (!document.documentElement.classList.contains('a2w-shell')) return;
    wireCommercialForm();
  }

  global.loadCommercialCalendar = loadCommercialCalendar;
  global.loadAudiencePresets = loadAudiencePresets;
  global.A2W = global.A2W || {};
  global.A2W.loadCommercialCalendar = loadCommercialCalendar;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
