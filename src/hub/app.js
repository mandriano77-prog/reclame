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
    altro: 'Altro',
    career: 'Carriera',
    time: 'Tempo',
    learning: 'Formazione',
    softskill: 'Soft skill',
    purpose: 'Purpose'
  };

  const STORAGE_KEY = 'hub_bootstrap_v1';
  const TOKEN_KEY = 'hub_token';
  const GEO_CONSENT_KEY = 'hub_geo_consent_v1';

  let state = {
    token: '',
    profile: null,
    brand: null,
    settings: null,
    pga_settings: null,
    coin_balance: 0,
    coin_actions: [],
    experiences: [],
    meData: null,
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

  function ensureModalShell() {
    let modal = $('#hub-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'hub-modal';
    modal.className = 'hub-modal hidden';
    modal.innerHTML = `
      <div class="hub-modal-backdrop" data-modal-close></div>
      <div class="hub-modal-panel" role="dialog" aria-modal="true">
        <h2 class="hub-modal-title" id="hub-modal-title"></h2>
        <div class="hub-modal-body" id="hub-modal-body"></div>
        <div class="hub-modal-actions" id="hub-modal-actions"></div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('[data-modal-close]')?.addEventListener('click', hideModal);
    return modal;
  }

  function hideModal() {
    const modal = $('#hub-modal');
    if (modal) modal.classList.add('hidden');
  }

  function showModal({ title, bodyHtml, actions }) {
    const modal = ensureModalShell();
    const titleEl = $('#hub-modal-title');
    const bodyEl = $('#hub-modal-body');
    const actionsEl = $('#hub-modal-actions');
    if (titleEl) titleEl.textContent = title || '';
    if (bodyEl) bodyEl.innerHTML = bodyHtml || '';
    if (actionsEl) {
      actionsEl.innerHTML = '';
      (actions || []).forEach((action) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `hub-btn${action.secondary ? ' secondary' : ''}`;
        btn.textContent = action.label;
        btn.addEventListener('click', () => {
          if (action.close !== false) hideModal();
          action.onClick?.();
        });
        actionsEl.appendChild(btn);
      });
    }
    modal.classList.remove('hidden');
  }

  async function apiGet(path) {
    const res = await fetch(`${apiBase()}${path}?token=${encodeURIComponent(getToken())}`);
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  async function apiPost(path, body) {
    const res = await fetch(`${apiBase()}${path}?token=${encodeURIComponent(getToken())}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...(body || {}), token: getToken() })
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  /** WCAG relative luminance (0 = black, 1 = white) of a #rrggbb color. */
  function luminance(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!m) return 0;
    const n = parseInt(m[1], 16);
    const ch = (v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    const r = ch((n >> 16) & 255);
    const g = ch((n >> 8) & 255);
    const b = ch(n & 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  /** WCAG contrast ratio between two luminances. */
  function contrastRatio(l1, l2) {
    const hi = Math.max(l1, l2);
    const lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  }

  const DARK_INK = '#111827';

  /** The label color (white or near-black) that reads best on the given background. */
  function onColorFor(bg) {
    const l = luminance(bg);
    return contrastRatio(l, luminance(DARK_INK)) >= contrastRatio(l, 1) ? DARK_INK : '#ffffff';
  }

  /** Best contrast achievable on bg with either ink. */
  function bestContrast(bg) {
    const l = luminance(bg);
    return Math.max(contrastRatio(l, 1), contrastRatio(l, luminance(DARK_INK)));
  }

  function darkenHex(hex, factor) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    const s = (v) => Math.max(0, Math.min(255, Math.round(v * factor)));
    const rgb = [s((n >> 16) & 255), s((n >> 8) & 255), s(n & 255)]
      .map((v) => v.toString(16).padStart(2, '0')).join('');
    return `#${rgb}`;
  }

  function lightenHex(hex, amount) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    const s = (v) => Math.max(0, Math.min(255, Math.round(v + (255 - v) * amount)));
    const rgb = [s((n >> 16) & 255), s((n >> 8) & 255), s(n & 255)]
      .map((v) => v.toString(16).padStart(2, '0')).join('');
    return `#${rgb}`;
  }

  /** La superficie delle card: rgba(255,255,255,.035) sopra --hub-bg #08090B. */
  const CARD_SURFACE = '#111214';
  /** Quanto accent c'è in --hub-accent-soft (vedi hub.css). */
  const ACCENT_SOFT_MIX = 0.16;

  function mixHex(fg, bg, amount) {
    const p = (h) => { const n = parseInt(String(h).replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
    const A = p(fg); const B = p(bg);
    return '#' + A.map((v, i) => Math.round(B[i] + (v - B[i]) * amount).toString(16).padStart(2, '0')).join('');
  }

  /**
   * L'accent come COLORE TESTO, schiarito quanto basta a leggersi.
   * buttonBgFor() protegge solo il riempimento dei bottoni: l'accent grezzo finiva sullo
   * sconto delle card, sul saldo coin e sul codice da mostrare in cassa — e lì è testo.
   * Falliva per OGNI accent realistico, incluso il viola di default (4.43:1) e il rosso
   * del brand (3.43:1); su un blu scendeva a 1.64:1.
   * Su fondo scuro si schiarisce: scurire, come fanno i bottoni, peggiorerebbe.
   * Il riferimento è il fondo PIÙ CHIARO su cui questo colore farà da testo, cioè
   * --hub-accent-soft (accent al 16% sulla card) di .hub-promo e .hub-discount-badge:
   * è lì che il cliente legge il codice da mostrare in cassa. Tarare sulla card e basta
   * lasciava indietro gli accent più chiari — il magenta si fermava a 4.37:1.
   */
  function accentTextFor(accent) {
    const fondoPeggiore = mixHex(accent, CARD_SURFACE, ACCENT_SOFT_MIX);
    const lFondo = luminance(fondoPeggiore);
    let c = accent;
    for (let i = 0; i < 12 && contrastRatio(luminance(c), lFondo) < 4.5; i += 1) {
      c = lightenHex(c, 0.14);
    }
    return c;
  }

  /** Button fill: the brand accent, darkened just enough that its label clears WCAG AA.
   *  (The stock purple #8B5CF6 only reaches 4.23:1 with white — hence this step.) */
  function buttonBgFor(accent) {
    let bg = accent;
    for (let i = 0; i < 5 && bestContrast(bg) < 4.5; i += 1) {
      bg = darkenHex(bg, 0.86);
    }
    return bg;
  }

  function applyWhiteLabel() {
    const accent = state.settings?.accent_color || '#8B5CF6';
    // --hub-accent resta grezzo: è giusto per bordi, riempimenti e aloni, dove il colore
    // non deve essere letto. Dove invece è TESTO si usa --hub-accent-text, schiarito
    // quanto basta: senza, lo sconto e il saldo coin erano illeggibili per ogni brand.
    document.documentElement.style.setProperty('--hub-accent', accent);
    document.documentElement.style.setProperty('--hub-accent-text', accentTextFor(accent));
    // Buttons are filled with the brand accent (darkened if needed for contrast), and the
    // label color is whichever of white/near-black actually reads better on it.
    const btnBg = buttonBgFor(accent);
    document.documentElement.style.setProperty('--hub-btn-bg', btnBg);
    document.documentElement.style.setProperty('--hub-btn-fg', onColorFor(btnBg));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', accent);

    const logoEl = $('#hub-logo');
    // Icona notifica prima del logo: il riquadro in testa è quadrato e taglierebbe un
    // logo largo (object-fit: cover).
    const logoUrl = state.settings?.logo_url || state.brand?.icon_url || state.brand?.logo_url;
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
    if (state.brand?.name) document.title = `${state.brand.name} · ${hubListTitle()}`;
    updateCoinWidget();
  }

  function pgaEnabled() {
    return !!state.pga_settings?.enabled;
  }

  function updateCoinWidget() {
    const pill = $('#hub-coin-pill');
    if (!pill) return;
    if (!pgaEnabled()) {
      pill.classList.add('hidden');
      return;
    }
    pill.classList.remove('hidden');
    const val = $('#hub-coin-value');
    if (val) val.textContent = String(state.coin_balance ?? 0);
  }

  /** Reclame is a two-area product — DEAL (offers) and COIN — so its shell always shows the
   *  tab bar. HR keeps its own 3-tab layout, gated on the coin program being enabled. */
  function hasTabBar() {
    return hubIsAdsMode() || pgaEnabled();
  }

  function setTabbarPadding(on) {
    const main = $('#hub-main');
    if (!main) return;
    main.classList.toggle('has-tabbar', on && hasTabBar());
  }

  function renderTabBar(active) {
    const bar = $('#hub-tabbar');
    if (!bar) return;
    if (!hasTabBar() || active == null) {
      bar.classList.add('hidden');
      bar.innerHTML = '';
      return;
    }
    bar.classList.remove('hidden');
    const tabs = hubIsAdsMode()
      ? [['conv', 'Deal'], ['pga', 'Coin']]
      : [['conv', hubListTitle()], ['pga', 'PGA'], ['me', 'Profilo']];
    bar.innerHTML = tabs.map(([key, label]) =>
      `<a href="#" class="hub-tab${active === key ? ' active' : ''}" data-tab="${key}">${esc(label)}</a>`
    ).join('');
    bar.querySelectorAll('[data-tab]').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = link.getAttribute('data-tab');
        if (tab === 'conv') navigate('/conv');
        else if (tab === 'pga') navigate('/pga');
        else if (tab === 'me') navigate('/me');
      });
    });
  }

  function parseRoute() {
    const path = window.location.pathname.replace(BASE, '') || '/';
    const parts = path.split('/').filter(Boolean);
    if (parts[0] === 'error') return { name: 'error' };
    if (parts[0] === 'me') return { name: 'me' };
    if (parts[0] === 'pga' && parts[1]) return { name: 'pga-detail', id: parts[1] };
    if (parts[0] === 'pga') return { name: 'pga' };
    if (parts[0] === 'qr') {
      const id = parts[1] === 'conv' ? parts[2] : parts[1];
      if (id) return { name: 'qr', id };
    }
    if ((parts[0] === 'conv' || parts[0] === 'merchants') && parts[1]) {
      return { name: 'detail', id: parts[1] };
    }
    if (parts[0] === 'conv' || parts[0] === 'merchants' || parts.length === 0) {
      return { name: 'list' };
    }
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
      state.pga_settings = data.pga_settings || null;
      state.coin_balance = Number(data.coin_balance || 0);
      state.coin_actions = Array.isArray(data.coin_actions) ? data.coin_actions : [];
      state.experiences = Array.isArray(data.experiences) ? data.experiences : [];
      state.merchants = Array.isArray(data.merchants) ? data.merchants : [];
      state.bootstrapped = true;

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          profile: state.profile,
          brand: state.brand,
          settings: state.settings,
          pga_settings: state.pga_settings,
          coin_balance: state.coin_balance,
          coin_actions: state.coin_actions,
          experiences: state.experiences,
          merchants: state.merchants,
          saved_at: Date.now()
        }));
      } catch (_) {}

      applyWhiteLabel();

      const route = parseRoute();
      if (route.name === 'list' && (window.location.pathname === BASE || window.location.pathname === `${BASE}/`)) {
        navigate('/conv');
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
          state.pga_settings = cached.pga_settings || null;
          state.coin_balance = Number(cached.coin_balance || 0);
          state.coin_actions = Array.isArray(cached.coin_actions) ? cached.coin_actions : [];
          state.experiences = Array.isArray(cached.experiences) ? cached.experiences : [];
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
      state.geoError = `Errore nel caricamento delle ${hubNoun(true)} vicine`;
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

  function formatDateTime(value) {
    if (!value) return null;
    try {
      return new Date(value).toLocaleString('it-IT', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return value;
    }
  }

  function hubIsAdsMode() {
    return String(state.brand?.product_line || 'ads').toLowerCase() === 'ads';
  }

  function hubListTitle() {
    return hubIsAdsMode() ? 'Offerte' : 'Convenzioni';
  }

  /** The noun for what the HUB lists, per product: Reclame sells "offerte", HR "convenzioni". */
  function hubNoun(plural) {
    if (hubIsAdsMode()) return plural ? 'offerte' : 'offerta';
    return plural ? 'convenzioni' : 'convenzione';
  }

  function renderLoading() {
    $('#hub-back')?.classList.add('hidden');
    $('#hub-title').textContent = hubListTitle();
    $('#hub-main').innerHTML = '<div class="hub-loading"><div class="hub-spinner"></div><div>Caricamento…</div></div>';
  }

  function renderList() {
    $('#hub-back')?.classList.add('hidden');
    $('#hub-title').textContent = hubListTitle();

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
      ? rows.map((m, i) => {
        const logo = m.logo_url
          ? `<img class="hub-card-logo" src="${esc(m.logo_url)}" alt="">`
          : `<div class="hub-card-logo placeholder">${esc(merchantInitial(m.name))}</div>`;
        const dist = state.nearbyEnabled ? formatDistance(state.nearbyMap[m.id]) : null;
        const distHtml = dist ? `<p class="hub-card-distance">${esc(dist)}</p>` : '';
        return `<button type="button" class="hub-card${m.sponsored ? ' hub-card--sponsored' : ''}" style="--i:${i}" data-merchant-id="${esc(m.id)}">
          ${m.sponsored ? '<span class="hub-sponsored-badge">In evidenza</span>' : ''}
          ${logo}
          <span class="hub-card-body">
            <p class="hub-card-name">${esc(m.name)}</p>
            <p class="hub-card-discount">${esc(m.discount_label)}</p>
            <p class="hub-card-cat">${esc(CATEGORY_LABELS[m.category] || m.category || '')}</p>
            ${distHtml}
          </span>
        </button>`;
      }).join('')
      : `<div class="hub-empty">${state.nearbyEnabled ? `Nessuna ${hubNoun(false)} entro 5 km.` : `Nessuna ${hubNoun(false)} trovata.`}</div>`;

    const geoBanner = !state.geoConsent ? `
      <div class="hub-geo-banner" id="hub-geo-banner">
        <p><strong>Posizione (GDPR)</strong> — Per mostrarti le ${hubNoun(true)} vicine usiamo la posizione del dispositivo solo mentre l'app è aperta. Non memorizziamo coordinate permanenti.</p>
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
        <input class="hub-search" id="hub-search" type="search" placeholder="Cerca ${hubNoun(true)}…" value="${esc(state.search)}" autocomplete="off">
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
      navigate(`/conv/${card.getAttribute('data-merchant-id')}`);
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
      $('#hub-main').innerHTML = `<div class="hub-empty">${hubIsAdsMode() ? 'Offerta' : 'Convenzione'} non trovata.</div>`;
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
      navigate(`/qr/conv/${merchant.id}`);
    });
  }

  const COIN_ICONS = {
    checkout: '🧾', purchase: '🧾', scan: '🧾', coupon: '🧾',
    visit: '📍', geofence: '📍',
    signup: '🎁', welcome: '🎁',
    birthday: '🎂', offer: '🏷️',
    review: '⭐', referral: '👥'
  };

  function coinActionIcon(key) {
    const k = String(key || '').toLowerCase();
    const hit = Object.keys(COIN_ICONS).find((needle) => k.includes(needle));
    return hit ? COIN_ICONS[hit] : '🪙';
  }

  /** "checkout_bonus" → "Checkout bonus" — used when the retailer left no description. */
  function humanizeKey(key) {
    const s = String(key || '').replace(/[_-]+/g, ' ').trim();
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Azione';
  }

  /** COIN area (Reclame): balance, how you earn, what you can redeem. */
  function renderCoin() {
    $('#hub-back')?.classList.add('hidden');
    $('#hub-title').textContent = 'Coin';

    if (!pgaEnabled()) {
      $('#hub-main').innerHTML = `
        <div class="hub-coin-hero">
          <p class="hub-coin-hero-label">Il tuo saldo</p>
          <p class="hub-coin-hero-value">—</p>
          <p class="hub-coin-hero-sub">Il programma Coin non è ancora attivo.</p>
        </div>
        <div class="hub-empty">Quando sarà attivo, qui accumuli coin con i tuoi acquisti e li spendi in premi.</div>`;
      return;
    }

    const balance = Number(state.coin_balance || 0);
    // Only rules the customer can actually earn from — a 0-coin admin grant is not a way to earn.
    // Highest reward first: it reads as an incentive list, not a config dump.
    const actions = (Array.isArray(state.coin_actions) ? state.coin_actions : [])
      .filter((a) => Number(a.coins) > 0)
      .sort((a, b) => Number(b.coins) - Number(a.coins));
    const rewards = (Array.isArray(state.experiences) ? [...state.experiences] : [])
      .sort((a, b) => (Number(a.display_order) || 100) - (Number(b.display_order) || 100));

    const earn = actions.length ? `
      <p class="hub-section">Come guadagni</p>
      <div class="hub-earn-list">
        ${actions.map((a) => `
          <div class="hub-earn-item">
            <div class="hub-earn-icon" aria-hidden="true">${esc(coinActionIcon(a.key))}</div>
            <div class="hub-earn-text">
              <p class="hub-earn-title">${esc(a.description || humanizeKey(a.key))}</p>
            </div>
            <span class="hub-earn-value">+${esc(String(a.coins))}</span>
          </div>`).join('')}
      </div>` : '';

    const catalog = rewards.length ? `
      <p class="hub-section">Premi</p>
      <div class="hub-pga-grid">
        ${rewards.map((e, i) => {
          const cat = e.category ? (CATEGORY_LABELS[e.category] || e.category) : '';
          const afford = balance >= Number(e.coin_cost || 0);
          return `<button type="button" class="hub-pga-card" style="--i:${i}" data-exp-id="${esc(e.id)}">
            <div class="hub-pga-card-head">
              <strong>${esc(e.name)}</strong>
              <span class="hub-pga-cost">${esc(String(e.coin_cost))} coin</span>
            </div>
            ${cat ? `<span class="hub-pga-category">${esc(cat)}</span>` : ''}
            ${e.description ? `<p class="hub-pga-desc">${esc(e.description)}</p>` : ''}
            ${afford ? '' : `<p class="hub-pga-limits">Ti mancano ${esc(String(Number(e.coin_cost || 0) - balance))} coin</p>`}
          </button>`;
        }).join('')}
      </div>`
      : '<div class="hub-empty">Nessun premio disponibile al momento.</div>';

    const welcome = state.pga_settings?.welcome_message
      ? `<div class="hub-welcome">${esc(state.pga_settings.welcome_message)}</div>`
      : '';

    $('#hub-main').innerHTML = `
      ${welcome}
      <div class="hub-coin-hero">
        <p class="hub-coin-hero-label">Il tuo saldo</p>
        <p class="hub-coin-hero-value">${esc(String(balance))}</p>
        <p class="hub-coin-hero-sub">coin disponibili</p>
      </div>
      ${earn}
      ${catalog}`;

    $('#hub-main').querySelectorAll('[data-exp-id]').forEach((btn) => {
      btn.addEventListener('click', () => navigate(`/pga/${btn.getAttribute('data-exp-id')}`));
    });

    // A live code is the most urgent thing on this screen — put it on top.
    apiGet('/hub/rewards/active-redemption').then((res) => {
      const r = res.ok && res.data && res.data.redemption;
      if (!r) return;
      const main = $('#hub-main');
      if (!main) return;
      const banner = document.createElement('button');
      banner.type = 'button';
      banner.className = 'hub-active-ticket';
      banner.innerHTML = `
        <span class="hub-active-ticket-label">Da ritirare in cassa</span>
        <span class="hub-active-ticket-name">${esc(r.reward_name)}</span>
        <span class="hub-active-ticket-code">${esc(r.code)}</span>`;
      banner.addEventListener('click', () => renderCoinTicket(res.data));
      main.insertBefore(banner, main.firstChild);
    }).catch(() => {});
  }

  /* ── Coin reward: detail → redeem → till ticket ─────────────────────── */

  let ticketTimer = null;

  function clearTicketTimer() {
    if (ticketTimer) { clearInterval(ticketTimer); ticketTimer = null; }
  }

  function formatCountdown(untilIso) {
    const ms = new Date(untilIso).getTime() - Date.now();
    if (!(ms > 0)) return null;
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  /** The code the customer shows at the till. Coins are already spent at this point. */
  function renderCoinTicket(payload) {
    clearTicketTimer();
    const r = payload?.redemption;
    if (!r) return renderCoin();

    $('#hub-back')?.classList.remove('hidden');
    $('#hub-title').textContent = 'Da ritirare';

    $('#hub-main').innerHTML = `
      <div class="hub-ticket">
        <p class="hub-ticket-label">Mostra questo codice alla cassa</p>
        <p class="hub-ticket-reward">${esc(r.reward_name)}</p>
        ${payload.qr_url ? `<img class="hub-ticket-qr" src="${esc(payload.qr_url)}" alt="Codice ${esc(r.code)}">` : ''}
        <p class="hub-ticket-code">${esc(r.code)}</p>
        <p class="hub-ticket-timer" id="hub-ticket-timer"></p>
        <p class="hub-ticket-hint">Se scade senza essere ritirato, i <strong>${esc(String(r.coins_spent))} coin</strong> ti tornano indietro.</p>
      </div>`;

    const timerEl = $('#hub-ticket-timer');
    const tick = () => {
      const left = formatCountdown(r.expires_at);
      if (!left) {
        clearTicketTimer();
        if (timerEl) timerEl.textContent = 'Codice scaduto — coin restituiti';
        showToast('Codice scaduto: i coin ti sono stati restituiti');
        bootstrap().then(() => navigate('/pga')).catch(() => navigate('/pga'));
        return;
      }
      if (timerEl) timerEl.textContent = `Valido ancora ${left}`;
    };
    tick();
    ticketTimer = setInterval(tick, 1000);
  }

  async function doRedeem(reward) {
    const res = await apiPost(`/hub/rewards/${reward.id}/redeem`);
    if (res.ok) {
      state.coin_balance = Number(res.data.balance ?? state.coin_balance);
      updateCoinWidget();
      renderCoinTicket(res.data);
      return;
    }
    if (res.data?.code === 'redemption_pending' && res.data.redemption) {
      showToast('Hai già un premio da ritirare');
      const active = await apiGet('/hub/rewards/active-redemption');
      if (active.ok && active.data?.redemption) return renderCoinTicket(active.data);
    }
    showToast(res.data?.error || 'Riscatto non riuscito');
  }

  function renderCoinReward(id) {
    clearTicketTimer();
    const reward = (state.experiences || []).find((e) => String(e.id) === String(id));
    if (!reward) return renderCoin();

    $('#hub-back')?.classList.remove('hidden');
    $('#hub-title').textContent = 'Premio';

    const balance = Number(state.coin_balance || 0);
    const cost = Number(reward.coin_cost || 0);
    const afford = balance >= cost;
    const cat = reward.category ? (CATEGORY_LABELS[reward.category] || reward.category) : '';

    $('#hub-main').innerHTML = `
      <div class="hub-detail-hero">
        <div class="hub-detail-logo placeholder">🎁</div>
        <div>
          <h2 class="hub-reward-name">${esc(reward.name)}</h2>
          ${cat ? `<span class="hub-pga-category">${esc(cat)}</span>` : ''}
        </div>
      </div>
      <div class="hub-discount-badge">${esc(String(cost))} coin</div>
      ${reward.description ? `<div class="hub-field"><p>${esc(reward.description)}</p></div>` : ''}
      <div class="hub-field">
        <p class="hub-field-label">Il tuo saldo</p>
        <p>${esc(String(balance))} coin${afford ? '' : ` — te ne mancano ${esc(String(cost - balance))}`}</p>
      </div>
      <button type="button" class="hub-btn" id="hub-redeem-btn" ${afford ? '' : 'disabled'}>
        ${afford ? 'Riscatta' : 'Coin insufficienti'}
      </button>
      <p class="hub-pga-hint">Riscattando ricevi un <strong>codice da mostrare in cassa</strong>, valido pochi minuti. Nessun importo in denaro.</p>`;

    const btn = $('#hub-redeem-btn');
    btn?.addEventListener('click', () => {
      showModal({
        title: 'Confermi il riscatto?',
        bodyHtml: `Verranno scalati <strong>${esc(String(cost))} coin</strong> e riceverai un codice da mostrare in cassa.`,
        actions: [
          { label: 'Riscatta', onClick: () => doRedeem(reward) },
          { label: 'Annulla', secondary: true }
        ]
      });
    });
  }

  function renderPga() {
    if (hubIsAdsMode()) return renderCoin();

    $('#hub-back')?.classList.add('hidden');
    $('#hub-title').textContent = 'PGA Marketplace';

    if (!pgaEnabled()) {
      $('#hub-main').innerHTML = '<div class="hub-empty">PGA non attivo per la tua azienda.</div>';
      return;
    }

    const welcome = state.pga_settings?.welcome_message
      ? `<div class="hub-welcome">${esc(state.pga_settings.welcome_message)}</div>`
      : '';

    const rows = (Array.isArray(state.experiences) ? [...state.experiences] : [])
      .sort((a, b) => (Number(a.display_order) || 100) - (Number(b.display_order) || 100));

    const cards = rows.length
      ? `<div class="hub-pga-grid">${rows.map((e) => {
        const cat = e.category ? (CATEGORY_LABELS[e.category] || e.category) : '';
        const maxYear = e.max_per_user_per_year != null
          ? `<span class="hub-pga-hint">Max ${esc(String(e.max_per_user_per_year))}/anno</span>`
          : '';
        return `<button type="button" class="hub-pga-card" data-exp-id="${esc(e.id)}">
          <div class="hub-pga-card-head">
            <strong>${esc(e.name)}</strong>
            <span class="hub-pga-cost">${esc(String(e.coin_cost))} coin</span>
          </div>
          ${cat ? `<span class="hub-pga-category">${esc(cat)}</span>` : ''}
          ${e.description ? `<p class="hub-meta hub-pga-desc">${esc(e.description)}</p>` : ''}
          ${maxYear}
        </button>`;
      }).join('')}</div>`
      : '<div class="hub-empty">Nessuna esperienza disponibile.</div>';

    $('#hub-main').innerHTML = `${welcome}${cards}`;
    $('#hub-main').querySelectorAll('[data-exp-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        navigate(`/pga/${btn.getAttribute('data-exp-id')}`);
      });
    });
  }

  async function renderPgaDetail(id) {
    $('#hub-back')?.classList.remove('hidden');
    $('#hub-title').textContent = 'Esperienza';
    $('#hub-main').innerHTML = '<div class="hub-loading"><div class="hub-spinner"></div><div>Caricamento…</div></div>';

    try {
      const res = await fetch(`${apiBase()}/hub/experiences/${encodeURIComponent(id)}?token=${encodeURIComponent(getToken())}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Esperienza non trovata');

      const exp = data.experience;
      const avail = data.availability || {};
      const balance = Number(data.coin_balance ?? state.coin_balance ?? 0);
      state.coin_balance = balance;
      updateCoinWidget();

      const cat = exp.category ? (CATEGORY_LABELS[exp.category] || exp.category) : '';
      const limits = [];
      if (avail.max_per_user_per_year != null) {
        limits.push(`Limite personale: ${avail.user_bookings_this_year}/${avail.max_per_user_per_year} quest&apos;anno`);
      }
      if (avail.max_total_per_month != null) {
        limits.push(`Posti mese: ${avail.slots_remaining_this_month ?? 0} rimasti su ${avail.max_total_per_month}`);
      }

      let blockReason = '';
      if (!avail.can_redeem) {
        if (avail.reason === 'MONTHLY_EXHAUSTED') blockReason = 'esaurito questo mese';
        else if (avail.reason === 'YEARLY_LIMIT') blockReason = 'limite annuale raggiunto';
      } else if (balance < Number(exp.coin_cost)) {
        blockReason = 'saldo insufficiente';
      }

      const canRedeem = avail.can_redeem && balance >= Number(exp.coin_cost);
      const slots = Array.isArray(data.suggested_slots) ? data.suggested_slots : [];
      const slotPicker = exp.requires_booking && slots.length
        ? `<label class="hub-field">
            <span class="hub-field-label">Scegli data e ora</span>
            <select class="hub-select" id="hub-pga-slot">
              ${slots.map((s) => `<option value="${esc(s)}">${esc(formatDateTime(s))}</option>`).join('')}
            </select>
          </label>`
        : '';

      const afterBalance = balance - Number(exp.coin_cost);

      $('#hub-main').innerHTML = `
        <section class="hub-section hub-pga-detail">
          <h2 style="margin-top:0">${esc(exp.name)}</h2>
          ${cat ? `<span class="hub-pga-category">${esc(cat)}</span>` : ''}
          ${exp.description ? `<p>${esc(exp.description)}</p>` : ''}
          <span class="hub-pga-cost">${esc(String(exp.coin_cost))} coin</span>
          ${limits.length ? `<ul class="hub-pga-limits">${limits.map((l) => `<li>${l}</li>`).join('')}</ul>` : ''}
          ${slotPicker}
          ${blockReason ? `<p class="hub-pga-blocked">${esc(blockReason)}</p>` : ''}
          <button type="button" class="hub-btn" id="hub-pga-redeem"${canRedeem ? '' : ' disabled'}>
            Riscatta con ${esc(String(exp.coin_cost))} coin
          </button>
        </section>
      `;

      const redeemBtn = $('#hub-pga-redeem');
      if (!redeemBtn || !canRedeem) return;

      redeemBtn.addEventListener('click', () => {
        showModal({
          title: 'Conferma riscatto',
          bodyHtml: `
            <p>Stai per riscattare <strong>${esc(exp.name)}</strong> per <strong>${esc(String(exp.coin_cost))} coin</strong>.</p>
            <p class="hub-meta">Saldo dopo il riscatto: <strong>${esc(String(afterBalance))} coin</strong></p>
          `,
          actions: [
            { label: 'Annulla', secondary: true },
            {
              label: 'Conferma riscatto',
              onClick: async () => {
                redeemBtn.disabled = true;
                const slotEl = $('#hub-pga-slot');
                const payload = {};
                if (slotEl?.value) payload.scheduled_at = slotEl.value;
                const out = await apiPost(`/hub/experiences/${encodeURIComponent(id)}/redeem`, payload);
                if (!out.ok) {
                  redeemBtn.disabled = false;
                  showToast(out.data.error || 'Riscatto non riuscito');
                  return;
                }
                state.coin_balance = Number(out.data.new_balance ?? afterBalance);
                updateCoinWidget();
                showToast('Prenotazione inviata!');
                navigate('/me');
              }
            }
          ]
        });
      });
    } catch (err) {
      $('#hub-main').innerHTML = `<div class="hub-empty">${esc(err.message || 'Impossibile caricare l&apos;esperienza')}</div>`;
    }
  }

  async function renderMe() {
    $('#hub-back')?.classList.add('hidden');
    $('#hub-title').textContent = 'Profilo';
    $('#hub-main').innerHTML = '<div class="hub-loading"><div class="hub-spinner"></div><div>Caricamento…</div></div>';

    if (!pgaEnabled()) {
      $('#hub-main').innerHTML = '<div class="hub-empty">PGA non attivo per la tua azienda.</div>';
      return;
    }

    try {
      const res = await fetch(`${apiBase()}/hub/me?token=${encodeURIComponent(getToken())}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Errore profilo');

      state.meData = data;
      state.coin_balance = Number(data.coin_balance || 0);
      updateCoinWidget();

      const profileName = [data.profile?.first_name, data.profile?.last_name]
        .filter(Boolean)
        .join(' ') || (hubIsAdsMode() ? 'Cliente' : 'Dipendente');
      const ledger = Array.isArray(data.ledger) ? data.ledger : [];
      const bookings = Array.isArray(data.bookings) ? data.bookings : [];

      const ledgerHtml = ledger.length
        ? `<ul class="hub-ledger-list">${ledger.map((row) => {
          const amt = Number(row.coin_amount || 0);
          const cls = amt >= 0 ? 'positive' : 'negative';
          const sign = amt >= 0 ? '+' : '';
          const when = formatDateTime(row.created_at);
          return `<li class="hub-ledger-item ${cls}">
            <div class="hub-ledger-row">
              <span>${esc(row.description || row.action_key || 'Movimento')}</span>
              <span class="hub-ledger-amount">${sign}${amt}</span>
            </div>
            ${when ? `<p class="hub-meta">${esc(when)}</p>` : ''}
          </li>`;
        }).join('')}</ul>`
        : '<div class="hub-empty">Nessun movimento ancora.</div>';

      const bookingsHtml = bookings.length
        ? `<ul class="hub-booking-list">${bookings.map((b) => {
          const when = formatDateTime(b.created_at);
          const sched = b.scheduled_at ? formatDateTime(b.scheduled_at) : null;
          const status = b.status || 'pending';
          const cancelBtn = status === 'pending'
            ? `<button type="button" class="hub-btn secondary hub-booking-cancel" data-booking-id="${esc(b.id)}">Annulla</button>`
            : '';
          return `<li class="hub-booking-item">
            <strong>${esc(b.experience_name || 'Esperienza')}</strong>
            <p class="hub-meta">${esc(status)}${when ? ` · ${esc(when)}` : ''}${sched ? `<br>Slot: ${esc(sched)}` : ''}</p>
            ${cancelBtn}
          </li>`;
        }).join('')}</ul>`
        : '';

      $('#hub-main').innerHTML = `
        <p class="hub-meta" style="margin-top:0">${esc(profileName)}</p>
        <div class="hub-me-balance">
          <div class="hub-me-balance-value">${esc(String(data.coin_balance ?? 0))}</div>
          <div class="hub-me-balance-label">Coin disponibili</div>
        </div>
        <section class="hub-section"><h2>Ultimi movimenti</h2>${ledgerHtml}</section>
        ${bookings.length ? `<section class="hub-section"><h2>Prenotazioni</h2>${bookingsHtml}</section>` : ''}
      `;

      $('#hub-main').querySelectorAll('.hub-booking-cancel').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const bookingId = btn.getAttribute('data-booking-id');
          if (!bookingId) return;
          btn.disabled = true;
          const out = await apiPost(`/hub/bookings/${encodeURIComponent(bookingId)}/cancel`, {});
          if (!out.ok) {
            btn.disabled = false;
            showToast(out.data.error || 'Annullamento non riuscito');
            return;
          }
          state.coin_balance = Number(out.data.new_balance ?? state.coin_balance);
          updateCoinWidget();
          showToast('Prenotazione annullata — coin rimborsati');
          renderMe();
        });
      });
    } catch (err) {
      $('#hub-main').innerHTML = `<div class="hub-empty">${esc(err.message || 'Impossibile caricare il profilo')}</div>`;
    }
  }

  async function renderQr(merchantId) {
    $('#hub-back')?.classList.remove('hidden');
    $('#hub-title').textContent = `QR ${hubNoun(false)}`;
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
          <img class="hub-qr-image" src="${esc(data.qr_url)}" alt="QR ${hubNoun(false)}">
          <p class="hub-qr-hint">Mostra questo QR al banco per attivare la ${hubNoun(false)}.</p>
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
        <p>Apri di nuovo il pass dal Wallet per accedere alle ${hubNoun(true)}.</p>
      </div>
    `;
  }

  function renderRoute() {
    if (!state.bootstrapped && parseRoute().name !== 'error') {
      bootstrap();
      return;
    }
    const route = parseRoute();
    updateCoinWidget();

    if (route.name === 'error') {
      renderTabBar(null);
      setTabbarPadding(false);
      renderError();
      return;
    }
    if (route.name === 'me') {
      renderTabBar('me');
      setTabbarPadding(true);
      renderMe();
      return;
    }
    if (route.name === 'pga') {
      renderTabBar('pga');
      setTabbarPadding(true);
      renderPga();
      return;
    }
    if (route.name === 'pga-detail') {
      renderTabBar('pga');
      setTabbarPadding(true);
      if (hubIsAdsMode()) renderCoinReward(route.id);
      else renderPgaDetail(route.id);
      return;
    }
    if (route.name === 'detail') {
      renderTabBar('conv');
      setTabbarPadding(true);
      renderDetail(route.id);
      return;
    }
    if (route.name === 'qr') {
      renderTabBar(null);
      setTabbarPadding(false);
      renderQr(route.id);
      return;
    }
    renderTabBar('conv');
    setTabbarPadding(true);
    renderList();
  }

  $('#hub-back')?.addEventListener('click', () => {
    const route = parseRoute();
    if (route.name === 'qr') {
      navigate(`/conv/${route.id}`);
      return;
    }
    if (route.name === 'pga-detail') {
      navigate('/pga');
      return;
    }
    if (route.name === 'detail') {
      navigate('/conv');
      return;
    }
    navigate('/conv');
  });
  $('#hub-coin-link')?.addEventListener('click', () => navigate('/me'));
  window.addEventListener('popstate', renderRoute);

  registerSw();
  loadGeoConsent();
  bootstrap();
})();
