/**
 * Reclame — HUB merchant checkout fields (without editing fd-conventions.js).
 */
(function () {
  'use strict';

  function isA2wShell() {
    return document.documentElement.classList.contains('a2w-shell');
  }

  function apiBase() {
    return `${window.location.origin}/api/v1`;
  }

  function authHeaders() {
    const h = { 'Content-Type': 'application/json', Accept: 'application/json' };
    const token = localStorage.getItem('ads2wallet:jwt');
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }

  function brandId() {
    return window.brandId || null;
  }

  function toast(msg) {
    if (typeof window.toast === 'function') window.toast(msg);
  }

  function reclameCheckoutPayload(form) {
    return {
      checkout_prefix: (form.checkout_prefix?.value || '').trim() || null,
      checkout_mode: form.checkout_mode?.value === 'static' ? 'static' : 'dynamic_per_pass',
      checkout_static_code: (form.checkout_static_code?.value || '').trim() || null,
      merchant_cashier_pin: (form.merchant_cashier_pin?.value || '').trim() || null
    };
  }

  function fillReclameCheckoutFields(form, merchant) {
    if (!form || !merchant) return;
    if (form.checkout_prefix) form.checkout_prefix.value = merchant.checkout_prefix || '';
    if (form.checkout_mode) form.checkout_mode.value = merchant.checkout_mode === 'static' ? 'static' : 'dynamic_per_pass';
    if (form.checkout_static_code) form.checkout_static_code.value = merchant.checkout_static_code || '';
    if (form.merchant_cashier_pin) form.merchant_cashier_pin.value = merchant.merchant_cashier_pin || '';
  }

  function clearReclameCheckoutFields(form) {
    if (!form) return;
    ['checkout_prefix', 'checkout_static_code', 'merchant_cashier_pin'].forEach((name) => {
      if (form[name]) form[name].value = '';
    });
    if (form.checkout_mode) form.checkout_mode.value = 'dynamic_per_pass';
  }

  async function saveMerchantWithCheckout(e) {
    if (!isA2wShell()) return;
    e.preventDefault();
    e.stopImmediatePropagation();

    const bid = brandId();
    const form = document.getElementById('hubMerchantForm');
    if (!bid || !form) return;

    const payload = {
      brand_id: bid,
      name: form.name.value.trim(),
      category: form.category.value,
      discount_label: form.discount_label.value.trim(),
      logo_url: form.logo_url.value.trim() || null,
      description: form.description.value.trim() || null,
      conditions: form.conditions.value.trim() || null,
      valid_until: form.valid_until.value || null,
      online_enabled: form.online_enabled.checked,
      online_url: form.online_url.value.trim() || null,
      online_promo_code: form.online_promo_code.value.trim() || null,
      physical_enabled: form.physical_enabled.checked,
      active: form.active.checked,
      sponsored: form.sponsored ? form.sponsored.checked : false,
      ...reclameCheckoutPayload(form)
    };

    if (!payload.name || !payload.discount_label) {
      toast('Nome e sconto sono obbligatori');
      return;
    }

    const editingId = form.dataset.a2wEditingId || '';
    const url = editingId
      ? `${apiBase()}/merchants/${encodeURIComponent(editingId)}`
      : `${apiBase()}/merchants`;
    const method = editingId ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error || 'Salvataggio merchant non riuscito');
        return;
      }
      toast(editingId ? 'Merchant aggiornato' : 'Merchant creato');
      const modal = document.getElementById('hubMerchantModal');
      if (modal) {
        modal.classList.remove('open');
        modal.style.display = 'none';
      }
      form.dataset.a2wEditingId = '';
      if (typeof loadConventionsHub === 'function') loadConventionsHub();
      if (typeof window.a2wLoadPushMerchants === 'function') window.a2wLoadPushMerchants();
    } catch (err) {
      toast(err.message || 'Errore di rete');
    }
  }

  function patchMerchantForm() {
    const form = document.getElementById('hubMerchantForm');
    if (!form || form.dataset.a2wCheckoutPatched === '1') return;
    form.dataset.a2wCheckoutPatched = '1';
    form.addEventListener('submit', saveMerchantWithCheckout, true);
  }

  function hookMerchantModal() {
    document.addEventListener('click', async function (e) {
      if (!isA2wShell()) return;
      const editBtn = e.target.closest('[data-hub-edit]');
      const addBtn = e.target.closest('#hubMerchantAddBtn');
      const form = document.getElementById('hubMerchantForm');
      if (!form) return;

      if (addBtn) {
        form.dataset.a2wEditingId = '';
        clearReclameCheckoutFields(form);
        return;
      }

      if (!editBtn) return;
      const id = editBtn.getAttribute('data-hub-edit');
      form.dataset.a2wEditingId = id || '';

      const bid = brandId();
      if (!bid || !id) return;
      try {
        const res = await fetch(`${apiBase()}/merchants?brand_id=${encodeURIComponent(bid)}`, {
          headers: authHeaders()
        });
        const rows = res.ok ? await res.json() : [];
        const merchant = rows.find(function (m) { return m.id === id; });
        if (merchant) fillReclameCheckoutFields(form, merchant);
      } catch (_) { /* fd modal still opens */ }
    });
  }

  // La visibilità del blocco negozio è decisa dal radio "Sul retro del pass" (vedi
  // syncPushBackMode() in index.html): qui popoliamo solo la select, nessuna logica di
  // reveal-on-select — scegliere un negozio qui è già, di per sé, la scelta del modo "Codice".
  async function loadPushMerchants() {
    if (!isA2wShell()) return;
    const sel = document.getElementById('pushCouponMerchant');
    if (!sel) return;
    const bid = brandId();
    if (!bid) {
      sel.innerHTML = '<option value="">— Seleziona brand —</option>';
      return;
    }
    try {
      const res = await fetch(`${apiBase()}/merchants?brand_id=${encodeURIComponent(bid)}&active=true`, {
        headers: authHeaders()
      });
      const rows = res.ok ? await res.json() : [];
      const current = sel.value;
      sel.innerHTML = '<option value="">— Seleziona negozio —</option>';
      rows.slice().sort(function (a, b) {
        return String(a.name || '').localeCompare(String(b.name || ''), 'it', { sensitivity: 'base' });
      }).forEach(function (m) {
        const opt = document.createElement('option');
        opt.value = m.id;
        const prefix = m.checkout_prefix ? ` [${m.checkout_prefix}]` : '';
        opt.textContent = `${m.name || m.id}${prefix}`;
        sel.appendChild(opt);
      });
      if (current && rows.some(function (m) { return m.id === current; })) sel.value = current;
    } catch (_) {
      sel.innerHTML = '<option value="">— Errore caricamento —</option>';
    }
  }

  window.a2wLoadPushMerchants = loadPushMerchants;

  function boot() {
    if (!isA2wShell()) return;
    patchMerchantForm();
    hookMerchantModal();
    loadPushMerchants();
    document.addEventListener('brand:changed', loadPushMerchants);
  }

  // initA2wShell() (a2w-shell.js) aggiunge la classe a2w-shell e SOLO DOPO spara
  // 'a2w:shell:ready'. Prima si aspettava DOMContentLoaded — ma quel listener (registrato
  // dal tag <script> di QUESTO file, che precede nel documento il blocco che chiama
  // initA2wShell()) scattava sempre PRIMA che la shell fosse attiva: isA2wShell() era
  // sempre falso, boot() usciva subito e l'ascoltatore 'brand:changed' non veniva MAI
  // registrato — il merchant del push restava vuoto a vita, indipendentemente da chi
  // sparava l'evento. 'a2w:shell:ready' è il segnale giusto: arriva quando la classe c'è già.
  document.addEventListener('a2w:shell:ready', boot);
  if (isA2wShell()) boot(); // shell già attiva (script ri-eseguito dopo l'evento)
})();
