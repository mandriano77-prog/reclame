(function () {
  'use strict';

  function getJoinBaseUrl() {
    return `${window.location.protocol}//${window.location.host}`;
  }

  function buildJoinPreviewUrl(slug) {
    const clean = String(slug || '').trim().toLowerCase();
    if (!clean) return '';
    return `${getJoinBaseUrl()}/join/${clean}`;
  }

  function renderJoinPageCard(options) {
    const cfg = options || {};
    const host = cfg.host;
    if (!host || !window.HelpPopover || !window.DomainChipsInput) return null;

    host.classList.add('contacts-join-card');
    host.innerHTML = `
      <div class="contacts-card__heading contacts-join-card__header">
        <div class="contacts-join-card__title-wrap">
          <h2 class="contacts-card__title">Pagina Join pubblica</h2>
          <div id="contactsJoinHelp" class="contacts-card__help"></div>
        </div>
        <label class="contacts-join-card__toggle">
          <span>Pagina Join attiva</span>
          <input type="checkbox" id="contactsJoinEnabled" aria-describedby="contactsJoinToggleStatus">
          <span id="contactsJoinToggleStatus" class="contacts-join-card__toggle-status">Bozza</span>
        </label>
      </div>
      <div class="contacts-join-card__slug">
        <label class="form-label" for="contactsJoinSlug">Slug</label>
        <div class="contacts-join-card__slug-preview" id="contactsJoinSlugPreview" aria-live="polite">
          <span class="contacts-join-card__slug-domain">${getJoinBaseUrl()}/join/</span><strong id="contactsJoinSlugBold">—</strong>
        </div>
        <input type="text" id="contactsJoinSlug" class="contacts-join-card__slug-input" placeholder="es. acme-hr" autocomplete="off" spellcheck="false">
        <p class="contacts-join-card__helper">Solo lettere minuscole, numeri e trattini. Min 3 caratteri.</p>
        <p class="contacts-join-card__error" id="contactsJoinSlugError" hidden></p>
      </div>
      <div class="contacts-join-card__domains">
        <label class="form-label">Domini email ammessi</label>
        <div id="contactsJoinDomainsHost"></div>
      </div>
      <div class="contacts-join-card__link-row">
        <input type="text" id="contactsJoinLink" class="contacts-join-card__link" readonly placeholder="Imposta uno slug per generare il link">
        <button type="button" class="btn sec small" id="contactsJoinCopyBtn" disabled>Copia link</button>
        <button type="button" class="btn sec small" id="contactsJoinQrBtn" disabled>Mostra QR</button>
      </div>
      <div class="contacts-join-card__banner" id="contactsJoinBanner" role="status"></div>
    `;

    window.HelpPopover.render({
      host: host.querySelector('#contactsJoinHelp'),
      title: 'Pagina Join pubblica',
      what: 'URL pubblico dove i dipendenti richiedono il pass da soli.',
      whenToUse: [
        'Quando non hai l\'elenco completo',
        'Vuoi raccogliere iscrizioni spontanee'
      ],
      effects: 'Generiamo un link e un QR condivisibili; le richieste arrivano nello stato «Da invitare».',
      example: 'Condividi il QR in bacheca aziendale → i dipendenti scansionano e si registrano.'
    });

    const enabledEl = host.querySelector('#contactsJoinEnabled');
    const statusEl = host.querySelector('#contactsJoinToggleStatus');
    const slugEl = host.querySelector('#contactsJoinSlug');
    const slugBold = host.querySelector('#contactsJoinSlugBold');
    const slugError = host.querySelector('#contactsJoinSlugError');
    const linkEl = host.querySelector('#contactsJoinLink');
    const copyBtn = host.querySelector('#contactsJoinCopyBtn');
    const qrBtn = host.querySelector('#contactsJoinQrBtn');
    const bannerEl = host.querySelector('#contactsJoinBanner');

    let slugDuplicateError = null;

    const domainInput = window.DomainChipsInput.render({
      host: host.querySelector('#contactsJoinDomainsHost'),
      domains: cfg.domains || [],
      onChange: function () {
        if (typeof cfg.onDomainsChange === 'function') cfg.onDomainsChange(domainInput.getDomains());
      }
    });

    function updateBanner() {
      const enabled = !!enabledEl.checked;
      const slugResult = window.ContactsValidation.validateSlug(slugEl.value);
      bannerEl.className = 'contacts-join-card__banner';
      if (!enabled) {
        bannerEl.classList.add('is-disabled');
        bannerEl.textContent = '⛔ Pagina disattivata';
        return;
      }
      if (!slugResult.valid || !slugResult.slug) {
        bannerEl.classList.add('is-warning');
        bannerEl.textContent = '⚠ Imposta uno slug per pubblicare';
        return;
      }
      if (slugDuplicateError) {
        bannerEl.classList.add('is-error');
        bannerEl.textContent = slugDuplicateError;
        return;
      }
      bannerEl.classList.add('is-success');
      bannerEl.textContent = '✅ Pagina pubblicata e accessibile';
    }

    function updateToggleState() {
      const slugResult = window.ContactsValidation.validateSlug(slugEl.value);
      const canPublish = slugResult.valid && !!slugResult.slug && !slugDuplicateError;
      enabledEl.disabled = !canPublish && !enabledEl.checked;
      if (enabledEl.disabled) {
        enabledEl.title = 'Imposta uno slug valido per pubblicare';
      } else {
        enabledEl.removeAttribute('title');
      }
      statusEl.textContent = enabledEl.checked && canPublish ? 'Pubblicata' : 'Bozza';
      statusEl.classList.toggle('is-published', enabledEl.checked && canPublish);
    }

    function refreshLink() {
      const slugResult = window.ContactsValidation.validateSlug(slugEl.value);
      const preview = slugResult.slug || '';
      slugBold.textContent = preview || '—';
      const url = buildJoinPreviewUrl(preview);
      linkEl.value = url;
      const hasLink = !!url && !!enabledEl.checked;
      copyBtn.disabled = !hasLink;
      qrBtn.disabled = !hasLink;
      if (slugResult.error) {
        slugError.hidden = false;
        slugError.textContent = slugResult.error;
      } else if (slugDuplicateError) {
        slugError.hidden = false;
        slugError.textContent = slugDuplicateError;
      } else {
        slugError.hidden = true;
        slugError.textContent = '';
      }
      updateToggleState();
      updateBanner();
      if (typeof cfg.onSlugChange === 'function') {
        cfg.onSlugChange({
          slug: slugResult.slug,
          valid: slugResult.valid && !slugDuplicateError,
          url
        });
      }
    }

    slugEl.addEventListener('input', function () {
      slugDuplicateError = null;
      slugEl.value = slugEl.value.toLowerCase();
      refreshLink();
    });

    slugEl.addEventListener('blur', function () {
      if (typeof cfg.onSave === 'function') cfg.onSave();
    });

    enabledEl.addEventListener('change', function () {
      refreshLink();
      if (typeof cfg.onEnabledChange === 'function') cfg.onEnabledChange(enabledEl.checked);
      if (typeof cfg.onSave === 'function') cfg.onSave();
    });

    copyBtn.addEventListener('click', function () {
      const url = linkEl.value;
      if (!url) return;
      navigator.clipboard.writeText(url).then(function () {
        if (typeof toast === 'function') toast('Link copiato negli appunti');
      }).catch(function () {
        if (typeof toast === 'function') toast(url);
      });
    });

    qrBtn.addEventListener('click', function () {
      const url = linkEl.value;
      if (!url || !window.ContactsQrModal) return;
      window.ContactsQrModal.open(url);
    });

    function applyState(state) {
      const next = state || {};
      if (typeof next.enabled === 'boolean') enabledEl.checked = next.enabled;
      if (typeof next.slug === 'string') slugEl.value = next.slug;
      if (Array.isArray(next.domains) && domainInput) domainInput.setDomains(next.domains);
      slugDuplicateError = next.slugDuplicateError || null;
      refreshLink();
    }

    applyState(cfg);

    return {
      applyState,
      getState: function () {
        const slugResult = window.ContactsValidation.validateSlug(slugEl.value);
        return {
          enabled: !!enabledEl.checked,
          slug: slugResult.slug || '',
          domains: domainInput ? domainInput.getDomains() : [],
          url: linkEl.value || ''
        };
      },
      setSlugDuplicateError: function (message) {
        slugDuplicateError = message || null;
        refreshLink();
      },
      focusSlug: function () { slugEl.focus(); }
    };
  }

  window.JoinPageCard = {
    render: renderJoinPageCard,
    buildJoinPreviewUrl
  };
})();
