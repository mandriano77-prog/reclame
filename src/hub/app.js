(function () {
  'use strict';

  const CATEGORY_LABELS = {
    food: 'Food',
    fitness: 'Fitness',
    retail: 'Retail',
    salute: 'Salute',
    viaggi: 'Viaggi',
    tech: 'Tech',
    servizi: 'Servizi',
    altro: 'Altro'
  };

  const STORAGE_KEY = 'hub_bootstrap_v1';
  const TOKEN_KEY = 'hub_token';
  const GEO_CONSENT_KEY = 'hub_geo_consent_v1';

  let state = {
    token: '',
    profile: null,
    brand: null,
    settings: null,
    merchants: [],
    category: '',
    search: '',
    detail: null,
    bootstrapped: false,
    nearbyEnabled: false,
    userLat: null,
    userLon: null,
    nearbyMap: {},
    geoConsent: false,
    geoError: null,
    geoLoading: false
  };

  let searchTimer = null;

  const $ = (sel) => document.querySelector(sel);

  function detectBasePath() {
    const path = window.location.pathname || '/';
    if (path.startsWith('/hub')) return '/hub';
    return '';
  }

  const BASE = detectBasePath();

  function apiBase() {
    return `${window.location.origin}/api/v1`;
  }

  function assetUrl(path) {
    return `${BASE}${path.startsWith('/') ? path : `/${path}`}`.replace('//', '/');
  }

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY) || state.token || '';
  }

  function setToken(token) {
    if (!token) return;
    state.token = token;
    sessionStorage.setItem(TOKEN_KEY, token);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showToast(msg) {
    const el = $('#hub-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => el.classList.add('hidden'), 2400);
  }

  function applyWhiteLabel() {
    const accent = state.settings?.accent_color || '#8B5CF6';
    document.documentElement.style.setProperty('--hub-accent', accent);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', accent);

    const logoEl = $('#hub-logo');
    const logoUrl = state.settings?.logo_url || state.brand?.logo_url;
    if (logoEl && logoUrl) {
      logoEl.src = logoUrl;
      logoEl.classList.remove('hidden');
    } else if (logoEl) {
      logoEl.classList.add('hidden');
    }

    const subtitle = $('#hub-subtitle');
    if (subtitle && state.brand?.name) {
      subtitle.textContent = state.brand.name;
      subtitle.classList.remove('hidden');
    }
  }

  function parseRoute() {
    const path = window.location.pathname.replace(BASE, '') || '/';
    const parts = path.split('/').filter(Boolean);
    if (parts[0] === 'error') return { name: 'error' };
    if (parts[0] === 'qr' && parts[1]) return { name: 'qr', id: parts[1] };
    if (parts[0] === 'merchants' && parts[1]) return { name: 'detail', id: parts[1] };
    if (parts[0] === 'merchants' || parts.length === 0) return { name: 'list' };
    return { name: 'list' };
  }

  function navigate(path) {
    const target = `${BASE}${path}`.replace(/\/{2,}/g, '/');
    if (window.location.pathname !== target) {
      history.pushState(null, '', target);
    }
    renderRoute();
  }

  function registerSw() {
    if (!('serviceWorker' in navigator)) return;
    const swPath = `${BASE}/sw.js`.replace('//', '/');
    navigator.serviceWorker.register(swPath, { scope: `${BASE}/`.replace('//', '/') || '/' })
      .catch(() => {});
  }

  async function bootstrap() {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken) setToken(urlToken);

    const token = getToken();
    if (!token) {
      navigate('/error');
      return;
    }

    renderLoading();
    try {
      const res = await fetch(`${apiBase()}/hub/bootstrap?token=${encodeURIComponent(token)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Bootstrap fallito');

      state.profile = data.profile;
      state.brand = data.brand;
      state.settings = data.settings;
      state.merchants = Array.isArray(data.merchants) ? data.merchants : [];
      state.bootstrapped = true;

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          profile: state.profile,
          brand: state.brand,
          settings: state.settings,
          merchants: state.merchants,
          saved_at: Date.now()
        }));
      } catch (_) {}

      applyWhiteLabel();

      const route = parseRoute();
      if (route.name === 'list' && (window.location.pathname === BASE || window.location.pathname === `${BASE}/`)) {
        navigate('/merchants');
        return;
      }
      renderRoute();
    } catch (err) {
      try {
        const cached = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
        if (cached?.merchants?.length) {
          state.profile = cached.profile;
          state.brand = cached.brand;
          state.settings = cached.settings;
          state.merchants = cached.merchants;
          state.bootstrapped = true;
          applyWhiteLabel();
          showToast('Modalità offline — dati in cache');
          renderRoute();
          return;
        }
      } catch (_) {}
      navigate('/error');
    }
  }

  async function logEvent(activation_type, merchant_id, metadata) {
    const token = getToken();
    if (!token || !merchant_id) return;
    try {
      await fetch(`${apiBase()}/hub/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, merchant_id, activation_type, metadata: metadata || null })
      });
    } catch (_) {}
  }

  function formatDistance(km) {
    if (km == null || !Number.isFinite(km)) return null;
    if (km < 1) return `${Math.round(km * 1000)} m`;
    return `${km.toFixed(1)} km`;
  }

  function loadGeoConsent() {
    try {
      state.geoConsent = localStorage.getItem(GEO_CONSENT_KEY) === '1';
    } catch (_) {
      state.geoConsent = false;
    }
  }

  function saveGeoConsent() {
    try {
      localStorage.setItem(GEO_CONSENT_KEY, '1');
    } catch (_) {}
    state.geoConsent = true;
  }

  async function requestGeolocation() {
    if (!navigator.geolocation) {
      state.geoError = 'Geolocalizzazione non supportata';
      return false;
    }
    state.geoLoading = true;
    state.geoError = null;
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          state.userLat = pos.coords.latitude;
          state.userLon = pos.coords.longitude;
          state.geoLoading = false;
          resolve(true);
        },
        (err) => {
          state.geoLoading = false;
          state.geoError = err.code === 1
            ? 'Permesso posizione negato'
            : 'Impossibile ottenere la posizione';
          resolve(false);
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
      );
    });
  }

  async function fetchNearbyMerchants() {
    if (state.userLat == null || state.userLon == null) return;
    const token = getToken();
    const qs = new URLSearchParams({
      token,
      lat: String(state.userLat),
      lon: String(state.userLon),
      radius_km: '5'
    });
    try {
      const res = await fetch(`${apiBase()}/hub/merchants/nearby?${qs}`);
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error('nearby failed');
      state.nearbyMap = {};
      (Array.isArray(data) ? data : []).forEach((m) => {
        state.nearbyMap[m.id] = m.distance_km;
      });
    } catch (_) {
      state.geoError = 'Errore nel caricamento delle convenzioni vicine';
    }
  }

  async function enableNearby() {
    if (!state.geoConsent) return;
    state.nearbyEnabled = true;
    const ok = await requestGeolocation();
    if (!ok) {
      state.nearbyEnabled = false;
      return;
    }
    await fetchNearbyMerchants();
    renderRoute();
  }

  function disableNearby() {
    state.nearbyEnabled = false;
    state.nearbyMap = {};
    state.geoError = null;
    renderRoute();
  }

  function filteredMerchants() {
    let rows = state.merchants.slice();
    if (state.category) {
      rows = rows.filter((m) => m.category === state.category);
    }
    const q = state.search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((m) =>
        [m.name, m.description, m.category, CATEGORY_LABELS[m.category]]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      );
    }
    if (state.nearbyEnabled) {
      rows = rows
        .filter((m) => state.nearbyMap[m.id] != null)
        .sort((a, b) => (state.nearbyMap[a.id] || 999) - (state.nearbyMap[b.id] || 999));
    }
    return rows;
  }

  function merchantInitial(name) {
    return String(name || '?').trim().charAt(0).toUpperCase() || '?';
  }

  function formatDate(value) {
    if (!value) return null;
    try {
      return new Date(value).toLocaleDateString('it-IT');
    } catch {
      return value;
    }
  }

  function renderLoading() {
    $('#hub-back')?.classList.add('hidden');
    $('#hub-title').textContent = 'Convenzioni';
    $('#hub-main').innerHTML = '<div class="hub-loading"><div class="hub-spinner"></div><div>Caricamento…</div></div>';
  }

  function renderList() {
    $('#hub-back')?.classList.add('hidden');
    $('#hub-title').textContent = 'Convenzioni';

    const enabled = Array.isArray(state.settings?.categories_enabled)
      ? state.settings.categories_enabled
      : [];

    const chips = [''].concat(enabled).map((cat) => {
      const label = cat ? (CATEGORY_LABELS[cat] || cat) : 'Tutte';
      const active = state.category === cat ? ' active' : '';
      return `<button type="button" class="hub-chip${active}" data-category="${esc(cat)}">${esc(label)}</button>`;
    }).join('');

    const rows = filteredMerchants();
    const cards = rows.length
      ? rows.map((m) => {
        const logo = m.logo_url
          ? `<img class="hub-card-logo" src="${esc(m.logo_url)}" alt="">`
          : `<div class="hub-card-logo placeholder">${esc(merchantInitial(m.name))}</div>`;
        const dist = state.nearbyEnabled ? formatDistance(state.nearbyMap[m.id]) : null;
        const distHtml = dist ? `<p class="hub-card-distance">${esc(dist)}</p>` : '';
        return `<button type="button" class="hub-card" data-merchant-id="${esc(m.id)}">
          ${logo}
          <p class="hub-card-name">${esc(m.name)}</p>
          <p class="hub-card-discount">${esc(m.discount_label)}</p>
          <p class="hub-card-cat">${esc(CATEGORY_LABELS[m.category] || m.category || '')}</p>
          ${distHtml}
        </button>`;
      }).join('')
      : `<div class="hub-empty">${state.nearbyEnabled ? 'Nessuna convenzione entro 5 km.' : 'Nessuna convenzione trovata.'}</div>`;

    const geoBanner = !state.geoConsent ? `
      <div class="hub-geo-banner" id="hub-geo-banner">
        <p><strong>Posizione (GDPR)</strong> — Per mostrarti le convenzioni vicine usiamo la posizione del dispositivo solo mentre l'app è aperta. Non memorizziamo coordinate permanenti.</p>
        <button type="button" class="hub-btn" id="hub-geo-accept">Accetto e attiva</button>
      </div>
    ` : '';

    const nearbyToggle = `
      <div class="hub-nearby-row">
        <label class="hub-toggle">
          <input type="checkbox" id="hub-nearby-toggle" ${state.nearbyEnabled ? 'checked' : ''} ${!state.geoConsent ? 'disabled' : ''}>
          <span>Vicino a me</span>
        </label>
        ${state.geoLoading ? '<span class="hub-meta">Localizzazione…</span>' : ''}
        ${state.geoError ? `<span class="hub-meta hub-error-text">${esc(state.geoError)}</span>` : ''}
      </div>
    `;

    const welcome = state.settings?.welcome_message
      ? `<div class="hub-welcome">${esc(state.settings.welcome_message)}</div>`
      : '';

    $('#hub-main').innerHTML = `
      ${welcome}
      ${geoBanner}
      ${nearbyToggle}
      <div class="hub-search-wrap">
        <input class="hub-search" id="hub-search" type="search" placeholder="Cerca convenzioni…" value="${esc(state.search)}" autocomplete="off">
      </div>
      <div class="hub-chips" id="hub-chips">${chips}</div>
      <div class="hub-grid">${cards}</div>
    `;

    $('#hub-geo-accept')?.addEventListener('click', async () => {
      saveGeoConsent();
      await enableNearby();
    });

    $('#hub-nearby-toggle')?.addEventListener('change', async (e) => {
      if (e.target.checked) {
        if (!state.geoConsent) {
          e.target.checked = false;
          return;
        }
        await enableNearby();
      } else {
        disableNearby();
      }
    });

    $('#hub-search')?.addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.search = e.target.value || '';
        renderList();
      }, 300);
    });

    $('#hub-chips')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-category]');
      if (!btn) return;
      state.category = btn.getAttribute('data-category') || '';
      renderList();
    });

    $('#hub-main').addEventListener('click', (e) => {
      const card = e.target.closest('[data-merchant-id]');
      if (!card) return;
      navigate(`/merchants/${card.getAttribute('data-merchant-id')}`);
    }, { once: true });
  }

  async function renderDetail(id) {
    $('#hub-back')?.classList.remove('hidden');
    $('#hub-title').textContent = 'Dettaglio';
    $('#hub-main').innerHTML = '<div class="hub-loading"><div class="hub-spinner"></div><div>Caricamento…</div></div>';

    let merchant = state.merchants.find((m) => m.id === id);
    try {
      const res = await fetch(`${apiBase()}/hub/merchants/${encodeURIComponent(id)}?token=${encodeURIComponent(getToken())}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) merchant = data;
    } catch (_) {}

    if (!merchant) {
      $('#hub-main').innerHTML = '<div class="hub-empty">Convenzione non trovata.</div>';
      return;
    }

    state.detail = merchant;
    logEvent('view', merchant.id);

    const logo = merchant.logo_url
      ? `<img class="hub-detail-logo" src="${esc(merchant.logo_url)}" alt="">`
      : `<div class="hub-detail-logo placeholder">${esc(merchantInitial(merchant.name))}</div>`;

    const expiry = formatDate(merchant.valid_until);
    const online = merchant.online_enabled ? `
      <section class="hub-section">
        <h2>Online</h2>
        ${merchant.online_promo_code ? `<div class="hub-promo" id="hub-promo">${esc(merchant.online_promo_code)}</div>` : ''}
        <button type="button" class="hub-btn" id="hub-open-site"${merchant.online_url ? '' : ' disabled'}>Vai al sito</button>
        ${merchant.online_promo_code ? '<button type="button" class="hub-btn secondary" id="hub-copy-code">Copia codice</button>' : ''}
      </section>
    ` : '';

    const locations = Array.isArray(merchant.locations) && merchant.locations.length
      ? `<ul class="hub-locations">${merchant.locations.map((loc) => {
        const dist = loc.distance_km != null
          ? formatDistance(loc.distance_km)
          : (state.nearbyMap[merchant.id] != null ? formatDistance(state.nearbyMap[merchant.id]) : null);
        const distSuffix = dist ? ` <span class="hub-loc-distance">· ${esc(dist)}</span>` : '';
        return `<li>${esc(loc.address || '')}${loc.city ? ` · ${esc(loc.city)}` : ''}${distSuffix}</li>`;
      }).join('')}</ul>`
      : '<p class="hub-meta">Nessuna sede registrata.</p>';

    const physical = merchant.physical_enabled ? `
      <section class="hub-section">
        <h2>In negozio</h2>
        ${locations}
        <button type="button" class="hub-btn" id="hub-show-qr">Mostra QR</button>
      </section>
    ` : '';

    $('#hub-main').innerHTML = `
      <div class="hub-detail-hero">
        ${logo}
        <div>
          <h2 style="margin:0;font-size:1.1rem;">${esc(merchant.name)}</h2>
          <span class="hub-discount-badge">${esc(merchant.discount_label)}</span>
        </div>
      </div>
      ${merchant.description ? `<section class="hub-section"><h2>Descrizione</h2><p>${esc(merchant.description)}</p></section>` : ''}
      ${merchant.conditions ? `<section class="hub-section"><h2>Condizioni</h2><p>${esc(merchant.conditions)}</p></section>` : ''}
      ${expiry ? `<p class="hub-meta">Valida fino al ${esc(expiry)}</p>` : ''}
      ${online}
      ${physical}
    `;

    $('#hub-open-site')?.addEventListener('click', async () => {
      if (!merchant.online_url) return;
      if (merchant.online_promo_code) {
        try {
          await navigator.clipboard.writeText(merchant.online_promo_code);
          logEvent('copy_code', merchant.id);
          showToast('Codice copiato');
        } catch (_) {
          showToast('Copia il codice manualmente');
        }
      }
      logEvent('click_site', merchant.id);
      window.open(merchant.online_url, '_blank', 'noopener,noreferrer');
    });

    $('#hub-copy-code')?.addEventListener('click', async () => {
      if (!merchant.online_promo_code) return;
      try {
        await navigator.clipboard.writeText(merchant.online_promo_code);
        logEvent('copy_code', merchant.id);
        showToast('Codice copiato');
      } catch (_) {
        showToast('Impossibile copiare automaticamente');
      }
    });

    $('#hub-show-qr')?.addEventListener('click', () => {
      navigate(`/qr/${merchant.id}`);
    });
  }

  async function renderQr(merchantId) {
    $('#hub-back')?.classList.remove('hidden');
    $('#hub-title').textContent = 'QR convenzione';
    $('#hub-main').innerHTML = '<div class="hub-loading"><div class="hub-spinner"></div><div>Generazione QR…</div></div>';

    try {
      const qs = new URLSearchParams({
        token: getToken(),
        merchant_id: merchantId
      });
      const res = await fetch(`${apiBase()}/hub/qr-token?${qs}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'QR non disponibile');

      const expires = data.expires_at
        ? new Date(data.expires_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
        : null;

      $('#hub-main').innerHTML = `
        <div class="hub-qr-screen">
          <img class="hub-qr-image" src="${esc(data.qr_url)}" alt="QR convenzione">
          <p class="hub-qr-hint">Mostra questo QR al banco per attivare la convenzione.</p>
          ${expires ? `<p class="hub-meta">Valido fino alle ${esc(expires)}</p>` : ''}
        </div>
      `;
    } catch (err) {
      $('#hub-main').innerHTML = `<div class="hub-empty">${esc(err.message || 'Impossibile generare il QR')}</div>`;
    }
  }

  function renderError() {
    $('#hub-back')?.classList.add('hidden');
    $('#hub-title').textContent = 'Accesso non valido';
    $('#hub-main').innerHTML = `
      <div class="hub-error">
        <h2>Link scaduto o non valido</h2>
        <p>Apri di nuovo il pass dal Wallet aziendale per accedere alle convenzioni.</p>
      </div>
    `;
  }

  function renderRoute() {
    if (!state.bootstrapped && parseRoute().name !== 'error') {
      bootstrap();
      return;
    }
    const route = parseRoute();
    if (route.name === 'error') {
      renderError();
      return;
    }
    if (route.name === 'detail') {
      renderDetail(route.id);
      return;
    }
    if (route.name === 'qr') {
      renderQr(route.id);
      return;
    }
    renderList();
  }

  $('#hub-back')?.addEventListener('click', () => {
    const route = parseRoute();
    if (route.name === 'qr') {
      const merchantId = route.id;
      navigate(`/merchants/${merchantId}`);
      return;
    }
    navigate('/merchants');
  });
  window.addEventListener('popstate', renderRoute);

  registerSw();
  loadGeoConsent();
  bootstrap();
})();
