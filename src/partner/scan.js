(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);

  function apiBase() {
    return `${window.location.origin}/api/v1`;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderOk(data) {
    $('#partner-status').className = 'partner-card ok';
    $('#partner-status').innerHTML = `
      <div class="partner-icon" aria-hidden="true">✅</div>
      <h1 class="partner-title">Convenzione attiva</h1>
      <p class="partner-subtitle">${esc(data.employee_name)} · dipendente ${esc(data.company)}</p>
      <p class="partner-discount">Sconto ${esc(data.discount_label)}</p>
    `;
  }

  function renderKo(reason) {
    $('#partner-status').className = 'partner-card ko';
    $('#partner-status').innerHTML = `
      <div class="partner-icon" aria-hidden="true">❌</div>
      <h1 class="partner-title">Convenzione non valida</h1>
      <p class="partner-subtitle">${esc(reason || 'Convenzione non valida o scaduta')}</p>
    `;
  }

  async function validateScan() {
    const params = new URLSearchParams(window.location.search);
    const serial = params.get('serial');
    const merchant = params.get('merchant');
    const t = params.get('t');
    const sig = params.get('sig');

    if (!serial || !merchant || !t || !sig) {
      renderKo('Parametri QR mancanti');
      return;
    }

    const qs = new URLSearchParams({ serial, merchant, t, sig });
    try {
      const res = await fetch(`${apiBase()}/hub/scan?${qs.toString()}`, {
        headers: { Accept: 'application/json' }
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.valid) {
        renderOk(data);
        return;
      }
      renderKo(data.reason || 'Convenzione non valida o scaduta');
    } catch (_) {
      renderKo('Errore di rete durante la verifica');
    }
  }

  validateScan();
})();
