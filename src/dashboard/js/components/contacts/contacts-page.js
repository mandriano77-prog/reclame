(function () {
  'use strict';

  let distributionCtrl = null;
  let joinCtrl = null;
  let currentMode = 'hybrid';
  let saveTimer = null;
  let pageInitialized = false;
  let lastBrandId = null;

  function getCardBHost() {
    return document.getElementById('contactsCardBHost');
  }

  function getCardCHost() {
    return document.getElementById('contactsCardCHost');
  }

  function normalizeMode(mode) {
    if (mode === 'direct_invite' || mode === 'public_join' || mode === 'hybrid') return mode;
    if (mode === 'direct') return 'direct_invite';
    if (mode === 'join') return 'public_join';
    return 'hybrid';
  }

  function inferModeFromBrand(brand, stats) {
    const fromConfig = brand && brand.config && brand.config.distribution_mode;
    if (fromConfig) return normalizeMode(fromConfig);
    if (stats && stats.public_qr_enabled) return 'hybrid';
    return 'hybrid';
  }

  function setHrCardsVisible(hrMode) {
    const cardB = getCardBHost();
    const cardC = getCardCHost();
    const menu = document.getElementById('contactsPageMenu');
    if (cardB) {
      cardB.hidden = !hrMode;
      cardB.classList.toggle('is-visible', !!hrMode);
    }
    if (!hrMode && cardC) {
      cardC.hidden = true;
      cardC.classList.remove('is-visible');
    }
    if (menu) menu.hidden = !hrMode;
  }

  function setJoinCardVisible(visible) {
    const host = getCardCHost();
    if (!host) return;
    host.classList.toggle('is-visible', visible);
    host.hidden = !visible;
    if (!visible) host.setAttribute('aria-hidden', 'true');
    else host.removeAttribute('aria-hidden');
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      saveDistributionSettings();
    }, 500);
  }

  async function saveDistributionSettings() {
    if (!brandId || typeof API === 'undefined') return;
    const mode = distributionCtrl ? normalizeMode(distributionCtrl.getMode()) : currentMode;
    currentMode = mode;

    let joinState = { enabled: false, slug: '', domains: [] };
    if (joinCtrl && window.ContactsValidation.shouldShowJoinCard(mode)) {
      joinState = joinCtrl.getState();
    }

    const public_qr_enabled = mode === 'direct_invite' ? false : !!joinState.enabled;
    const body = {
      public_qr_enabled,
      public_qr_slug: joinState.slug || null,
      allowed_email_domains: joinState.domains || [],
      config: { distribution_mode: mode }
    };

    try {
      const res = await fetch(`${API}/brands/${brandId}`, {
        method: 'PUT',
        headers: Object.assign(
          { 'Content-Type': 'application/json' },
          typeof getAuthHeaders === 'function' ? getAuthHeaders() : {}
        ),
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || 'Errore salvataggio';
        if (/duplicate|unique|idx_brands_qr_slug/i.test(msg) && joinCtrl) {
          joinCtrl.setSlugDuplicateError('Questo slug è già in uso');
        }
        if (typeof toast === 'function') toast(msg);
        return;
      }
      if (joinCtrl) joinCtrl.setSlugDuplicateError(null);
    } catch (e) {
      if (typeof toast === 'function') toast(e.message || 'Errore salvataggio');
    }
  }

  function renderCardAHelp() {
    const host = document.getElementById('contactsCardAHelp');
    if (!host || !window.HelpPopover) return;
    window.HelpPopover.render({
      host,
      title: 'Anagrafica dipendenti',
      what: 'Elenco centrale di tutti i dipendenti del brand con stato anagrafico e distribuzione pass.',
      whenToUse: [
        'Cercare o filtrare dipendenti',
        'Aggiungere o importare anagrafica',
        'Inviare attivazioni e monitorare lo stato pass'
      ],
      effects: 'Le azioni qui aggiornano la tabella sottostante e i KPI di riepilogo.',
      example: 'Filtra «Da invitare», seleziona i contatti e invia l\'email di attivazione del pass.'
    });
  }

  function ensureJoinCard(mode, state) {
    const cardC = getCardCHost();
    if (!cardC || !window.JoinPageCard) return;
    const showJoin = window.ContactsValidation.shouldShowJoinCard(mode);
    setJoinCardVisible(showJoin);
    if (!showJoin) {
      joinCtrl = null;
      return;
    }
    if (!joinCtrl) {
      cardC.innerHTML = '';
      joinCtrl = window.JoinPageCard.render({
        host: cardC,
        onSave: scheduleSave,
        onEnabledChange: scheduleSave,
        onDomainsChange: scheduleSave
      });
    }
    if (joinCtrl && state) joinCtrl.applyState(state);
  }

  function initDistributionCards(mode) {
    const cardB = getCardBHost();
    if (!cardB || !window.DistributionModeCard) return;

    cardB.innerHTML = '';
    distributionCtrl = window.DistributionModeCard.render({
      host: cardB,
      mode: normalizeMode(mode),
      onChange: function (nextMode) {
        currentMode = normalizeMode(nextMode);
        if (typeof setDistributionMode === 'function') {
          setDistributionMode(currentMode);
        } else {
          ensureJoinCard(currentMode);
        }
        scheduleSave();
      }
    });
  }

  function applyActivationData(stats, brand) {
    const mode = inferModeFromBrand(brand, stats);
    currentMode = mode;
    if (!distributionCtrl) initDistributionCards(mode);
    else distributionCtrl.setMode(mode);

    ensureJoinCard(mode, {
      enabled: !!stats.public_qr_enabled,
      slug: stats.public_qr_slug || '',
      domains: stats.allowed_email_domains || [],
      slugDuplicateError: null
    });
  }

  function initPageMenu() {
    const btn = document.getElementById('contactsPageMenuBtn');
    const panel = document.getElementById('contactsPageMenuPanel');
    const tourBtn = document.getElementById('contactsShowTourBtn');
    if (!btn || !panel) return;

    btn.addEventListener('click', function () {
      const open = panel.hidden;
      panel.hidden = !open;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    document.addEventListener('click', function (e) {
      if (!panel.hidden && !panel.contains(e.target) && e.target !== btn) {
        panel.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
      }
    });

    if (tourBtn) {
      tourBtn.addEventListener('click', function () {
        panel.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
        showTour();
      });
    }
  }

  function initContactsPage(hrMode) {
    if (String(lastBrandId) !== String(brandId)) {
      distributionCtrl = null;
      joinCtrl = null;
      pageInitialized = false;
      lastBrandId = brandId;
    }
    setHrCardsVisible(!!hrMode);
    if (!pageInitialized) {
      renderCardAHelp();
      initPageMenu();
      pageInitialized = true;
    }
    if (hrMode && !distributionCtrl) {
      const stored = typeof getDistributionModeFromStorage === 'function'
        ? getDistributionModeFromStorage()
        : 'hybrid';
      initDistributionCards(stored);
      ensureJoinCard(stored);
    }
  }

  async function onHrLeadsLoaded(stats) {
    initContactsPage(true);
    let brand = null;
    try {
      const res = await fetch(`${API}/brands/${brandId}`, {
        headers: typeof getAuthHeaders === 'function' ? getAuthHeaders() : {}
      });
      if (res.ok) brand = await res.json();
    } catch (e) { /* ignore */ }
    applyActivationData(stats || {}, brand);
    if (window.JoinSetupCoach && typeof JoinSetupCoach.maybeAutoStart === 'function') {
      JoinSetupCoach.maybeAutoStart();
    }
  }

  function showTour() {
    if (window.JoinSetupCoach) JoinSetupCoach.start();
  }

  window.ContactsPage = {
    init: initContactsPage,
    onHrLeadsLoaded,
    showTour,
    saveDistributionSettings,
    setJoinCardVisible,
    ensureJoinCard,
    normalizeMode
  };
})();
