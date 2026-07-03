/**
 * Reclame — commercial calendar, billing summary, audience presets.
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

  async function loadCommercialCalendar() {
    var bid = brandId();
    if (!bid) return;
    var pkgEl = document.getElementById('commercialPackages');
    var bookEl = document.getElementById('commercialBookings');
    var billEl = document.getElementById('commercialBilling');
    if (!pkgEl) return;

    try {
      var res = await fetch(API + '/brands/' + encodeURIComponent(bid) + '/commercial/calendar', { headers: authHeaders() });
      var data = res.ok ? await res.json() : {};
      if (!res.ok) {
        pkgEl.innerHTML = '<p style="color:var(--text2);">Calendario non disponibile.</p>';
        return;
      }

      var packages = data.packages || [];
      pkgEl.innerHTML = packages.map(function (pkg) {
        var slots = (pkg.formats || []).map(function (f) {
          return '<div class="a2w-commercial-slot"><span>' + esc(f.label) + '</span><span>' + esc(f.booked) + ' / ' + esc(f.package_slots) + '</span></div>';
        }).join('');
        return '<div class="a2w-commercial-pkg">' +
          '<div class="a2w-commercial-pkg__title">' + esc(pkg.label) + '</div>' +
          '<div class="a2w-commercial-pkg__desc">' + esc(pkg.description) + ' · ' + esc(euros(pkg.suggested_price_cents)) + '</div>' +
          slots +
          '</div>';
      }).join('') || '<p style="color:var(--text2);">Nessun pacchetto configurato.</p>';

      var bookings = data.bookings || [];
      bookEl.innerHTML = bookings.length ? bookings.map(function (b) {
        return '<tr><td>' + esc(b.tenant_name) + '</td><td>' + esc(b.package_key) + '</td><td>' + esc(b.format) + '</td><td>' + esc(b.status) + '</td><td>' + esc(euros(b.amount_cents)) + '</td></tr>';
      }).join('') : '<tr><td colspan="5" style="color:var(--text2);">Nessuna prenotazione — crea la prima dal form sotto.</td></tr>';

      var bill = data.billing || {};
      billEl.innerHTML =
        '<div class="stat-card"><div class="stat-num">' + esc(euros(bill.gross_cents)) + '</div><div class="stat-label">Fatturato lordo</div></div>' +
        '<div class="stat-card"><div class="stat-num">' + esc(euros(bill.retailer_cents)) + '</div><div class="stat-label">Quota retailer</div></div>' +
        '<div class="stat-card"><div class="stat-num">' + esc(euros(bill.reclame_cents)) + '</div><div class="stat-label">Take-rate Reclame (' + esc(data.take_rate_pct) + '%)</div></div>' +
        '<div class="stat-card"><div class="stat-num">' + esc(bill.pending || 0) + '</div><div class="stat-label">Fatture pendenti</div></div>';

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

    var body = {
      tenant_name: tenant,
      package_key: packageKey,
      format: format,
      start_at: startAt ? new Date(startAt).toISOString() : null,
      end_at: endAt ? new Date(endAt).toISOString() : null,
      merchant_id: merchantId || null
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
      toast('Prenotazione commerciale creata');
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

  function toggleCommercialPoiFields() {
    var fmt = document.getElementById('commercialBookingFormat')?.value;
    var wrap = document.getElementById('commercialPoiFields');
    if (wrap) wrap.hidden = fmt !== 'geofence_recall';
  }

  function initReclameAdsCopy() {
    var blurb = document.getElementById('conventionsPageBlurb');
    if (blurb && document.documentElement.classList.contains('a2w-shell')) {
      blurb.textContent = 'HUB brand-tenant sponsorizzati nel pass wallet. I merchant in evidenza compaiono per primi; collega una prenotazione commerciale per attivare slot HUB o geofence.';
    }
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
      fmt.addEventListener('change', toggleCommercialPoiFields);
      toggleCommercialPoiFields();
    }
  }

  function init() {
    if (!document.documentElement.classList.contains('a2w-shell')) return;
    initReclameAdsCopy();
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
