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

  let state = {
    token: '',
    profile: null,
    brand: null,
    settings: null,
    merchants: [],
    category: '',
    search: '',
    detail: null,
    bootstrapped: false
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
        return `<button type="button" class="hub-card" data-merchant-id="${esc(m.id)}">
          ${logo}
          <p class="hub-card-name">${esc(m.name)}</p>
          <p class="hub-card-discount">${esc(m.discount_label)}</p>
          <p class="hub-card-cat">${esc(CATEGORY_LABELS[m.category] || m.category || '')}</p>
        </button>`;
      }).join('')
      : '<div class="hub-empty">Nessuna convenzione trovata.</div>';

    const welcome = state.settings?.welcome_message
      ? `<div class="hub-welcome">${esc(state.settings.welcome_message)}</div>`
      : '';

    $('#hub-main').innerHTML = `
      ${welcome}
      <div class="hub-search-wrap">
        <input class="hub-search" id="hub-search" type="search" placeholder="Cerca convenzioni…" value="${esc(state.search)}" autocomplete="off">
      </div>
      <div class="hub-chips" id="hub-chips">${chips}</div>
      <div class="hub-grid">${cards}</div>
    `;

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
      ? `<ul class="hub-locations">${merchant.locations.map((loc) =>
        `<li>${esc(loc.address || '')}${loc.city ? ` · ${esc(loc.city)}` : ''}</li>`
      ).join('')}</ul>`
      : '<p class="hub-meta">Nessuna sede registrata.</p>';

    const physical = merchant.physical_enabled ? `
      <section class="hub-section">
        <h2>In negozio</h2>
        ${locations}
        <button type="button" class="hub-btn secondary" disabled title="Disponibile a breve">Mostra QR</button>
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
    renderList();
  }

  $('#hub-back')?.addEventListener('click', () => navigate('/merchants'));
  window.addEventListener('popstate', renderRoute);

  registerSw();
  bootstrap();
})();
