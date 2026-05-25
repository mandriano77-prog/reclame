(function () {
  'use strict';

  const MODES = [
    {
      id: 'direct_invite',
      title: 'Invito diretto',
      description: 'Invii pass via email/SMS dall\'anagrafica.'
    },
    {
      id: 'public_join',
      title: 'Pagina Join pubblica',
      description: 'I dipendenti si registrano da soli su una pagina dedicata.'
    },
    {
      id: 'hybrid',
      title: 'Ibrida',
      description: 'Entrambe attive contemporaneamente.',
      default: true
    }
  ];

  const MODE_COPY = {
    direct_invite: 'Gli inviti partono solo dall\'anagrafica: seleziona i dipendenti e usa «Invia attivazione». La pagina Join pubblica resta disattivata.',
    public_join: 'I dipendenti ottengono il pass solo dalla pagina Join pubblica. Configura slug, domini e condividi il link o il QR.',
    hybrid: 'Inviti email dall\'anagrafica e auto-iscrizione dalla pagina Join pubblica restano entrambi attivi. Ideale con anagrafica parziale o popolazione in crescita.'
  };

  function renderDistributionModeCard(options) {
    const cfg = options || {};
    const host = cfg.host;
    if (!host || !window.HelpPopover) return null;

    host.classList.add('contacts-distribution-card');
    host.innerHTML = `
      <div class="contacts-card__heading">
        <h2 class="contacts-card__title">Distribuzione pass</h2>
        <div id="contactsDistributionHelp" class="contacts-card__help"></div>
      </div>
      <div class="contacts-distribution-card__modes" role="radiogroup" aria-label="Modalità distribuzione pass"></div>
      <p class="contacts-distribution-card__hint" id="contactsDistributionHint"></p>
    `;

    window.HelpPopover.render({
      host: host.querySelector('#contactsDistributionHelp'),
      title: 'Distribuzione pass — Ibrida',
      what: 'Permette ai dipendenti di ottenere il pass sia tramite invito diretto sia auto-iscrivendosi dalla pagina Join pubblica.',
      whenToUse: [
        'Anagrafica parziale',
        'Popolazione in crescita',
        'Vuoi lasciare libertà di self-onboarding'
      ],
      effects: 'Restano attivi gli inviti email e in più la pagina /join/{slug} accetta nuove registrazioni filtrate per dominio.',
      example: 'Slug acme-hr, domini acme.it, acme.com → solo email aziendali possono registrarsi dalla pagina pubblica.'
    });

    const modesHost = host.querySelector('.contacts-distribution-card__modes');
    const hintEl = host.querySelector('#contactsDistributionHint');

    MODES.forEach(function (mode) {
      const id = `contactsMode_${mode.id}`;
      const card = document.createElement('label');
      card.className = 'contacts-distribution-card__mode';
      card.setAttribute('for', id);
      card.innerHTML = `
        <input type="radio" name="contactsDistributionMode" id="${id}" value="${mode.id}">
        <span class="contacts-distribution-card__mode-title">${mode.title}</span>
        <span class="contacts-distribution-card__mode-desc">${mode.description}</span>
      `;
      modesHost.appendChild(card);
    });

    function setMode(nextMode) {
      const mode = MODES.some(function (m) { return m.id === nextMode; }) ? nextMode : 'hybrid';
      modesHost.querySelectorAll('input[type="radio"]').forEach(function (input) {
        input.checked = input.value === mode;
        input.closest('.contacts-distribution-card__mode').classList.toggle('is-selected', input.checked);
      });
      hintEl.textContent = MODE_COPY[mode] || '';
      if (typeof cfg.onChange === 'function') cfg.onChange(mode);
    }

    modesHost.addEventListener('change', function (e) {
      if (e.target.name !== 'contactsDistributionMode') return;
      setMode(e.target.value);
    });

    setMode(cfg.mode || 'hybrid');

    return {
      setMode,
      getMode: function () {
        const checked = modesHost.querySelector('input[type="radio"]:checked');
        return checked ? checked.value : 'hybrid';
      }
    };
  }

  window.DistributionModeCard = {
    render: renderDistributionModeCard,
    MODES,
    MODE_COPY
  };
})();
