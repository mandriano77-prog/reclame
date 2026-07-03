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

  function pathParts() {
    return window.location.pathname.split('/').filter(Boolean);
  }

  function brandSlugFromPath() {
    const parts = pathParts();
    const idx = parts.indexOf('cashier');
    if (idx >= 0 && parts[idx + 1]) return decodeURIComponent(parts[idx + 1]);
    return '';
  }

  function merchantSlugFromPath() {
    const parts = pathParts();
    const idx = parts.indexOf('cashier');
    if (idx >= 0 && parts[idx + 2]) return decodeURIComponent(parts[idx + 2]);
    return '';
  }

  const slug = brandSlugFromPath();
  const merchantSlug = merchantSlugFromPath();
  const pinKey = `reclame_cashier_pin_${slug}_${merchantSlug || 'mall'}`;
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

  function buildRedeemPayload(code, storeLabel) {
    const payload = {
      brand_slug: slug,
      pin: sessionPin,
      store_label: storeLabel
    };
    if (merchantSlug) payload.merchant_slug = merchantSlug;
    const trimmed = (code || '').trim();
    if (trimmed.includes('-') && !trimmed.startsWith('pass.')) {
      payload.checkout_code = trimmed.toUpperCase();
    } else {
      payload.serial_number = trimmed;
    }
    return payload;
  }

  async function preview() {
    const code = ($('#cashierCode')?.value || '').trim();
    const storeLabel = ($('#cashierStore')?.value || '').trim();
    if (!code) {
      renderResult('<h2>Codice mancante</h2><p>Inserisci il codice sul retro del pass Wallet.</p>', 'ko');
      return;
    }
    const btn = $('#cashierPreviewBtn');
    if (btn) btn.disabled = true;
    renderResult('<p>Verifica in corso…</p>', '');
    const { ok, data } = await postJson('/redeem/preview', buildRedeemPayload(code, storeLabel));
    if (btn) btn.disabled = false;

    if (!ok || !data.valid) {
      renderResult(
        `<h2>${esc(data.reason || 'Non valido')}</h2>` +
        (data.already_redeemed ? '<p>Questo codice ha già riscattato l\'offerta attiva.</p>' : '') +
        (data.merchant_slug && !merchantSlug
          ? `<p>Apri la cassa del negozio: <code>${esc(data.merchant_slug)}</code></p>`
          : '') +
        `<p class="cashier-meta">${data.checkout_code_masked ? `Codice ${esc(data.checkout_code_masked)}` : ''}${data.serial_masked ? ` · Pass ${esc(data.serial_masked)}` : ''}</p>`,
        'ko'
      );
      return;
    }

    renderResult(
      `<h2>${esc(data.offer?.title || 'Offerta valida')}</h2>` +
      (data.merchant_name ? `<p><strong>${esc(data.merchant_name)}</strong>${data.merchant_discount ? ` · ${esc(data.merchant_discount)}` : ''}</p>` : '') +
      `<div class="cashier-offer">${esc(data.offer?.message || '')}</div>` +
      `<p class="cashier-meta">${data.checkout_code_masked ? `Codice ${esc(data.checkout_code_masked)}` : ''}${data.serial_masked ? ` · Pass ${esc(data.serial_masked)}` : ''}</p>` +
      `<div class="cashier-actions">` +
      `<button type="button" class="cashier-btn cashier-btn--ok" id="cashierConfirmBtn">Conferma riscatto in cassa</button>` +
      `<button type="button" class="cashier-btn cashier-link-btn" id="cashierResetBtn">Nuovo codice</button>` +
      `</div>`,
      'ok'
    );

    $('#cashierConfirmBtn')?.addEventListener('click', async () => {
      const confirmBtn = $('#cashierConfirmBtn');
      if (confirmBtn) confirmBtn.disabled = true;
      const out = await postJson('/redeem/confirm', buildRedeemPayload(code, storeLabel));
      if (out.ok && out.data.valid) {
        renderResult(
          `<h2>Riscatto confermato</h2>` +
          `<p>${esc(out.data.offer?.title || 'Coupon CPA registrato')}</p>` +
          `<p class="cashier-meta">${out.data.checkout_code_masked ? `Codice ${esc(out.data.checkout_code_masked)}` : ''}${out.data.serial_masked ? ` · Pass ${esc(out.data.serial_masked)}` : ''} · ${new Date(out.data.redeemed_at).toLocaleString('it-IT')}</p>` +
          `<div class="cashier-actions"><button type="button" class="cashier-btn" id="cashierNextBtn">Prossimo cliente</button></div>`,
          'ok'
        );
        $('#cashierNextBtn')?.addEventListener('click', () => {
          $('#cashierCode').value = '';
          $('#cashierResult').hidden = true;
          $('#cashierCode').focus();
        });
        return;
      }
      renderResult(`<h2>${esc(out.data.reason || 'Riscatto non riuscito')}</h2>`, 'ko');
      if (confirmBtn) confirmBtn.disabled = false;
    });

    $('#cashierResetBtn')?.addEventListener('click', () => {
      $('#cashierCode').value = '';
      $('#cashierResult').hidden = true;
      $('#cashierCode').focus();
    });
  }

  function boot() {
    if (!slug) {
      renderResult('<h2>Link cassa non valido</h2><p>Apri il link dal back office Reclame.</p>', 'ko');
      return;
    }

    const mallTitle = slug.replace(/-/g, ' ');
    const merchantTitle = merchantSlug ? merchantSlug.replace(/-/g, ' ') : '';
    const heading = merchantTitle
      ? `${merchantTitle.charAt(0).toUpperCase()}${merchantTitle.slice(1)}`
      : mallTitle.charAt(0).toUpperCase() + mallTitle.slice(1);
    $('#cashierBrandName').textContent = heading;
    if (merchantSlug) {
      const kicker = $('#cashierKicker');
      if (kicker) kicker.textContent = `Reclame · ${mallTitle}`;
    }

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
      $('#cashierCode')?.focus();
    });

    $('#cashierPreviewBtn')?.addEventListener('click', preview);
    $('#cashierCode')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') preview();
    });
  }

  boot();
})();
