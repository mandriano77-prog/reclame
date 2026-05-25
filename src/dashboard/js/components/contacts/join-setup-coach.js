(function () {
  'use strict';

  const STORAGE_KEY_BASE = 'filo_contacts_coach_done_v1';

  function getUserCoachKey() {
    const userEmail = document.getElementById('dashboardUserEmail')?.textContent?.trim()?.toLowerCase();
    const userId = document.getElementById('dashboardUserRole')?.dataset?.userId;
    const suffix = userId || userEmail || 'anon';
    return `${STORAGE_KEY_BASE}:${suffix}`;
  }

  const STEPS = [
    {
      id: 'distribution',
      title: 'Scegli come distribuire i pass',
      body: 'Seleziona invito diretto, pagina Join pubblica o modalità ibrida.',
      target: '#contactsCardBHost'
    },
    {
      id: 'slug',
      title: 'Imposta lo slug della tua pagina Join',
      body: 'Lo slug compone l\'URL pubblico che condividerai con i dipendenti.',
      target: '#contactsJoinSlug'
    },
    {
      id: 'share',
      title: 'Condividi il link o invita dall\'anagrafica',
      body: 'Copia il link Join oppure usa «Invia attivazione» dalla toolbar anagrafica.',
      target: '#contactsJoinCopyBtn, #leadsDistributeBtn'
    }
  ];

  let overlayEl = null;
  let stepIndex = 0;
  let onComplete = null;

  function isDone() {
    try {
      return localStorage.getItem(getUserCoachKey()) === '1';
    } catch (e) {
      return false;
    }
  }

  function markDone() {
    try {
      localStorage.setItem(getUserCoachKey(), '1');
    } catch (e) { /* ignore */ }
  }

  function ensureOverlay() {
    if (overlayEl) return;
    overlayEl = document.createElement('div');
    overlayEl.className = 'contacts-coach';
    overlayEl.hidden = true;
    overlayEl.innerHTML = `
      <div class="contacts-coach__backdrop"></div>
      <div class="contacts-coach__spotlight" aria-hidden="true"></div>
      <div class="contacts-coach__card" role="dialog" aria-modal="true" aria-labelledby="contactsCoachTitle">
        <p class="contacts-coach__step" id="contactsCoachStep"></p>
        <h3 id="contactsCoachTitle" class="contacts-coach__title"></h3>
        <p class="contacts-coach__body" id="contactsCoachBody"></p>
        <div class="contacts-coach__actions">
          <button type="button" class="btn sec small" id="contactsCoachSkip">Salta</button>
          <button type="button" class="btn small" id="contactsCoachNext">Avanti</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlayEl);

    overlayEl.querySelector('#contactsCoachSkip').addEventListener('click', finish);
    overlayEl.querySelector('#contactsCoachNext').addEventListener('click', next);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlayEl && !overlayEl.hidden) finish();
    });
  }

  function resolveTarget(selector) {
    const parts = String(selector || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    for (let i = 0; i < parts.length; i += 1) {
      const el = document.querySelector(parts[i]);
      if (el && el.offsetParent !== null) return el;
    }
    return document.querySelector(parts[0]) || null;
  }

  function positionSpotlight(target) {
    const spot = overlayEl.querySelector('.contacts-coach__spotlight');
    if (!target || !spot) {
      spot.style.display = 'none';
      return;
    }
    const rect = target.getBoundingClientRect();
    spot.style.display = 'block';
    spot.style.top = `${Math.max(8, rect.top - 8)}px`;
    spot.style.left = `${Math.max(8, rect.left - 8)}px`;
    spot.style.width = `${rect.width + 16}px`;
    spot.style.height = `${rect.height + 16}px`;
  }

  function renderStep() {
    const step = STEPS[stepIndex];
    if (!step) return finish();
    overlayEl.querySelector('#contactsCoachStep').textContent = `Passo ${stepIndex + 1} di ${STEPS.length}`;
    overlayEl.querySelector('#contactsCoachTitle').textContent = step.title;
    overlayEl.querySelector('#contactsCoachBody').textContent = step.body;
    overlayEl.querySelector('#contactsCoachNext').textContent = stepIndex >= STEPS.length - 1 ? 'Fine' : 'Avanti';
    const target = resolveTarget(step.target);
    positionSpotlight(target);
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  function next() {
    if (stepIndex >= STEPS.length - 1) return finish();
    stepIndex += 1;
    renderStep();
  }

  function finish() {
    if (overlayEl) overlayEl.hidden = true;
    markDone();
    if (typeof onComplete === 'function') onComplete();
    onComplete = null;
  }

  function start(options) {
    const cfg = options || {};
    onComplete = cfg.onComplete || null;
    ensureOverlay();
    stepIndex = 0;
    overlayEl.hidden = false;
    renderStep();
    window.addEventListener('resize', renderStep, { once: true });
  }

  function maybeAutoStart() {
    if (isDone()) return;
    setTimeout(function () { start(); }, 400);
  }

  window.JoinSetupCoach = {
    start,
    maybeAutoStart,
    isDone,
    markDone,
    reset: function () {
      try { localStorage.removeItem(getUserCoachKey()); } catch (e) { /* ignore */ }
    }
  };
})();
