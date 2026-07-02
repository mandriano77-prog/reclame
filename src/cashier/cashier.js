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

  function brandSlugFromPath() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('cashier');
    if (idx >= 0 && parts[idx + 1]) return decodeURIComponent(parts[idx + 1]);
    return '';
  }

  const slug = brandSlugFromPath();
  const pinKey = `reclame_cashier_pin_${slug}`;
  let sessionPin = sessionStorage.getItem(pinKey) || '';

  function showStep(step) {
    $('#cashierPinStep').hidden = step !== 'pin';
    $('#cashierScanStep').hidden = step !== 'scan';
  }

  function renderResult(html, kind) {
    const el = $('#cashierResult');
    el.hidden = false;
    el.className = `cashier-result ${kind || ''}`;
    el.innerHTML = html;
  }

  async function postJson(path, body) {
    const res = await fetch(`${apiBase()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  async function preview() {
    const serial = ($('#cashierSerial')?.value || '').trim();
    const storeLabel = ($('#cashierStore')?.value || '').trim();
    if (!serial) {
      renderResult('<h2>Codice mancante</h2><p>Scansiona il QR sul pass Wallet.</p>', 'ko');
      return;
    }
    const btn = $('#cashierPreviewBtn');
    if (btn) btn.disabled = true;
    renderResult('<p>Verifica in corso…</p>', '');
    const { ok, data } = await postJson('/redeem/preview', {
      brand_slug: slug,
      serial_number: serial,
      pin: sessionPin
    });
    if (btn) btn.disabled = false;

    if (!ok || !data.valid) {
      renderResult(
        `<h2>${esc(data.reason || 'Non valido')}</h2>` +
        (data.already_redeemed ? '<p>Questo pass ha già riscattato l\'offerta attiva.</p>' : '') +
        `<p class="cashier-meta">Pass ${esc(data.serial_masked || serial)}</p>`,
        'ko'
      );
      return;
    }

    renderResult(
      `<h2>${esc(data.offer?.title || 'Offerta valida')}</h2>` +
      `<div class="cashier-offer">${esc(data.offer?.message || '')}</div>` +
      `<p class="cashier-meta">Pass ${esc(data.serial_masked)} · ${esc(data.brand_name || '')}</p>` +
      `<div class="cashier-actions">` +
      `<button type="button" class="cashier-btn cashier-btn--ok" id="cashierConfirmBtn">Conferma riscatto in cassa</button>` +
      `<button type="button" class="cashier-btn cashier-link-btn" id="cashierResetBtn">Nuova scansione</button>` +
      `</div>`,
      'ok'
    );

    $('#cashierConfirmBtn')?.addEventListener('click', async () => {
      const confirmBtn = $('#cashierConfirmBtn');
      if (confirmBtn) confirmBtn.disabled = true;
      const out = await postJson('/redeem/confirm', {
        brand_slug: slug,
        serial_number: serial,
        pin: sessionPin,
        store_label: storeLabel
      });
      if (out.ok && out.data.valid) {
        renderResult(
          `<h2>Riscatto confermato</h2>` +
          `<p>${esc(out.data.offer?.title || 'Coupon CPA registrato')}</p>` +
          `<p class="cashier-meta">Pass ${esc(out.data.serial_masked)} · ${new Date(out.data.redeemed_at).toLocaleString('it-IT')}</p>` +
          `<div class="cashier-actions"><button type="button" class="cashier-btn" id="cashierNextBtn">Prossimo cliente</button></div>`,
          'ok'
        );
        $('#cashierNextBtn')?.addEventListener('click', () => {
          $('#cashierSerial').value = '';
          $('#cashierResult').hidden = true;
          $('#cashierSerial').focus();
        });
        return;
      }
      renderResult(`<h2>${esc(out.data.reason || 'Riscatto non riuscito')}</h2>`, 'ko');
      if (confirmBtn) confirmBtn.disabled = false;
    });

    $('#cashierResetBtn')?.addEventListener('click', () => {
      $('#cashierSerial').value = '';
      $('#cashierResult').hidden = true;
      $('#cashierSerial').focus();
    });
  }

  function boot() {
    if (!slug) {
      renderResult('<h2>Link cassa non valido</h2><p>Apri il link dal back office Reclame.</p>', 'ko');
      return;
    }

    const title = slug.replace(/-/g, ' ');
    $('#cashierBrandName').textContent = title.charAt(0).toUpperCase() + title.slice(1);

    if (sessionPin) {
      showStep('scan');
    } else {
      showStep('pin');
    }

    $('#cashierPinSubmit')?.addEventListener('click', () => {
      const pin = ($('#cashierPin')?.value || '').trim();
      if (!pin) return;
      sessionPin = pin;
      sessionStorage.setItem(pinKey, pin);
      showStep('scan');
      $('#cashierSerial')?.focus();
    });

    $('#cashierPreviewBtn')?.addEventListener('click', preview);
    $('#cashierSerial')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') preview();
    });
  }

  boot();
})();
