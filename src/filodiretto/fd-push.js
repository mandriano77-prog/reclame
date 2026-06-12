/**
 * FD-14 — FiloDiretto Push UI: preview, char limits, channel segmented, test send.
 */
(function () {
  'use strict';

  var TITLE_MAX = 50;
  var MESSAGE_MAX = 178;
  var TEST_PASS_KEY = 'fd:pushTestPassId';

  var CHANNELS = [
    { value: 'apple', label: 'iPhone (Apple Wallet)', icon: '', tip: 'Invio tramite APNs (Apple Push Notification service)' },
    { value: 'google', label: 'Android (Google Wallet)', icon: '', tip: 'Aggiornamento messaggio su Google Wallet' },
    { value: 'samsung', label: 'Samsung Wallet', icon: '', tip: 'Aggiornamento contenuto su Samsung Wallet' },
    { value: 'all', label: 'Tutti i canali', icon: '⇄', tip: 'Apple APNs + Google Wallet + Samsung Wallet' }
  ];

  function isFiloPushApp() {
    if (document.documentElement.classList.contains('a2w-shell')) return false;
    try {
      if (window.__2WALLET_PRODUCT_LOCK__ === 'hr') return true;
    } catch (_) {}
    return document.documentElement.getAttribute('data-app') === 'filodiretto';
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isValidBrandId(value) {
    if (value == null) return false;
    var id = String(value).trim();
    return !!(id && id !== 'undefined' && id !== 'null');
  }

  /** Stessa risoluzione brand di Contatti/Media: selector → URL → ensureBrandIdFromContext. */
  function getCurrentBrandId() {
    if (typeof window.ensureBrandIdFromContext === 'function') {
      try {
        var fromCtx = window.ensureBrandIdFromContext();
        if (isValidBrandId(fromCtx)) return String(fromCtx).trim();
      } catch (_) {}
    }
    try {
      var sel = document.getElementById('brandSelector');
      if (sel && isValidBrandId(sel.value)) return String(sel.value).trim();
    } catch (_) {}
    try {
      var qpBrandId = new URLSearchParams(window.location.search || '').get('brand_id');
      if (isValidBrandId(qpBrandId)) return String(qpBrandId).trim();
    } catch (_) {}
    try {
      if (isValidBrandId(window.brandId)) return String(window.brandId).trim();
    } catch (_) {}
    return '';
  }

  function syncBrandIdForPush() {
    var id = getCurrentBrandId();
    if (!id) return '';
    try {
      window.brandId = id;
    } catch (_) {}
    if (typeof window.ensureBrandIdFromContext === 'function') {
      try {
        window.ensureBrandIdFromContext();
      } catch (_) {}
    }
    return id;
  }

  function getBrandLabel() {
    var sel = document.getElementById('brandSelector');
    if (sel && sel.value && sel.selectedIndex >= 0) {
      return sel.options[sel.selectedIndex].textContent || 'Brand';
    }
    return (window.currentBrandName || 'Brand');
  }

  function updateCharCount(input, counter, max) {
    if (!input || !counter) return;
    var len = (input.value || '').length;
    counter.textContent = len + '/' + max;
    counter.classList.remove('is-warn', 'is-over');
    if (len > max) counter.classList.add('is-over');
    else if (len > max * 0.9) counter.classList.add('is-warn');
  }

  function syncPreview() {
    var title = (document.getElementById('pushTitle') || {}).value || 'Titolo notifica';
    var message = (document.getElementById('pushMessage') || {}).value || 'Testo del messaggio…';
    var brand = getBrandLabel();
    document.querySelectorAll('[data-fd-push-preview-title]').forEach(function (el) {
      el.textContent = title;
    });
    document.querySelectorAll('[data-fd-push-preview-body]').forEach(function (el) {
      el.textContent = message;
    });
    document.querySelectorAll('[data-fd-push-preview-brand]').forEach(function (el) {
      el.textContent = brand;
    });
  }

  function setChannelValue(value) {
    var sel = document.getElementById('pushChannel');
    if (!sel) return;
    sel.value = value;
    document.querySelectorAll('.fd-push-channel-seg__btn').forEach(function (btn) {
      var on = btn.getAttribute('data-channel') === value;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var help = document.getElementById('fdPushChannelHelp');
    var ch = CHANNELS.find(function (c) {
      return c.value === value;
    });
    if (help && ch) help.textContent = ch.tip;
  }

  function buildPushBody(extra) {
    extra = extra || {};
    var title = document.getElementById('pushTitle').value;
    var message = document.getElementById('pushMessage').value;
    var campaignId =
      typeof window.isLegacyCampaignsUiEnabled === 'function' && window.isLegacyCampaignsUiEnabled()
        ? document.getElementById('pushCampaignTarget')?.value || null
        : null;
    var audienceId = document.getElementById('pushAudienceTarget')?.value || null;
    var channel = document.getElementById('pushChannel').value || 'apple';
    var updatePass = document.getElementById('pushUpdatePass').checked;

    var body = {
      brand_id: syncBrandIdForPush(),
      title: title,
      message: message,
      update_pass: updatePass,
      channel: channel
    };
    if (audienceId) body.audience_id = audienceId;
    else if (campaignId) body.campaign_id = campaignId;

    var iwId = document.getElementById('pushInstantWin').value;
    if (iwId) body.instant_win_id = iwId;
    var gamId = document.getElementById('pushGamification').value;
    if (gamId) body.gamification_id = gamId;

    if (document.getElementById('pushIncludePassLink')?.checked) {
      body.include_pass_link = true;
      body.pass_link_url = (document.getElementById('pushPassLinkUrl')?.value || '').trim();
      body.pass_link_label = (document.getElementById('pushPassLinkLabel')?.value || '').trim();
      var expLocal = document.getElementById('pushPassLinkExpires')?.value;
      if (expLocal) body.pass_link_expires_at = new Date(expLocal).toISOString();
    }

    if (updatePass && window.pushStripMediaId) body.strip_media_id = window.pushStripMediaId;
    if (extra.test_pass_id) body.test_pass_id = extra.test_pass_id;
    return body;
  }

  async function loadTestPasses() {
    var sel = document.getElementById('fdPushTestPass');
    var brandId = syncBrandIdForPush();
    if (!sel || !brandId) return;
    sel.innerHTML = '<option value="">— Caricamento… —</option>';
    try {
      var api = window.API || '/api';
      var res = await fetch(api + '/passes?brand_id=' + encodeURIComponent(brandId) + '&limit=200', {
        headers: typeof getAuthHeaders === 'function' ? getAuthHeaders() : {}
      });
      var rows = await res.json();
      var list = Array.isArray(rows) ? rows : rows.passes || rows.items || [];
      var withPush = list.filter(function (p) {
        return (
          p.push_token ||
          p.device_source === 'apple' ||
          p.device_source === 'google' ||
          p.device_source === 'samsung' ||
          p.google_wallet_saved ||
          p.samsung_wallet_saved ||
          p.samsung_wallet_ref_id
        );
      });
      sel.innerHTML = '<option value="">— Seleziona pass di prova —</option>';
      if (!withPush.length) {
        sel.innerHTML = '<option value="">— Nessun pass con Wallet installato —</option>';
        return;
      }
      withPush.forEach(function (p) {
        var opt = document.createElement('option');
        opt.value = p.id;
        var label = (p.member_name || p.holder_name || p.email || p.serial_number || p.id).toString();
        if (p.push_token || p.device_source === 'apple') label += ' · iPhone';
        else if (p.google_wallet_saved || p.device_source === 'google') label += ' · Google';
        else if (p.samsung_wallet_saved || p.samsung_wallet_ref_id || p.device_source === 'samsung') label += ' · Samsung';
        opt.textContent = label.slice(0, 72);
        sel.appendChild(opt);
      });
      var saved = localStorage.getItem(TEST_PASS_KEY);
      if (saved && withPush.some(function (p) {
        return String(p.id) === String(saved);
      })) {
        sel.value = saved;
      }
    } catch (e) {
      sel.innerHTML = '<option value="">— Errore caricamento —</option>';
    }
  }

  async function sendTestPush() {
    if (!syncBrandIdForPush()) {
      if (typeof toast === 'function') toast('Seleziona un brand');
      return;
    }
    var passId = document.getElementById('fdPushTestPass')?.value;
    if (!passId) {
      if (typeof toast === 'function') toast('Seleziona un dispositivo di prova');
      return;
    }
    var title = (document.getElementById('pushTitle')?.value || '').trim();
    var message = (document.getElementById('pushMessage')?.value || '').trim();
    if (typeof window.clearPushFieldErrors === 'function') window.clearPushFieldErrors();
    if (!title) {
      if (typeof window.setPushFieldError === 'function') {
        window.setPushFieldError('pushTitle', 'Inserisci un titolo per la notifica');
      } else if (typeof alert === 'function') alert('Compila titolo e messaggio');
      return;
    }
    if (!message) {
      if (typeof window.setPushFieldError === 'function') {
        window.setPushFieldError('pushMessage', 'Inserisci il testo del messaggio');
      } else if (typeof alert === 'function') alert('Compila titolo e messaggio');
      return;
    }
    if (title.length > TITLE_MAX || message.length > MESSAGE_MAX) {
      if (typeof alert === 'function') alert('Titolo o messaggio supera il limite consigliato per APNs');
      return;
    }

    var btn = document.getElementById('fdPushTestBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Invio prova…';
    }
    var controller = new AbortController();
    var timeoutId = setTimeout(function () {
      controller.abort();
    }, 60000);
    try {
      var body = buildPushBody({ test_pass_id: passId });
      var api = window.API || '/api';
      var res = await fetch(api + '/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(typeof getAuthHeaders === 'function' ? getAuthHeaders() : {}) },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok || data.error) {
        var errMsg = data.error || 'Invio non riuscito, riprova';
        var banner = document.getElementById('pushSendError');
        if (banner) {
          banner.textContent = errMsg;
          banner.hidden = false;
        } else if (typeof alert === 'function') alert('Errore: ' + errMsg);
        return;
      }
      localStorage.setItem(TEST_PASS_KEY, passId);
      var msg =
        typeof buildPushDeliveryMessage === 'function'
          ? buildPushDeliveryMessage(data)
          : 'Push di prova inviata';
      if (typeof toast === 'function') toast(msg);
      else if (typeof alert === 'function') alert(msg);
    } catch (e) {
      var failMsg = (e && e.name === 'AbortError')
        ? 'Invio non riuscito, riprova'
        : (e.message || 'Invio non riuscito, riprova');
      var failBanner = document.getElementById('pushSendError');
      if (failBanner) {
        failBanner.textContent = failMsg;
        failBanner.hidden = false;
      } else if (typeof alert === 'function') alert('Errore: ' + failMsg);
    } finally {
      clearTimeout(timeoutId);
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Invia di prova';
      }
    }
  }

  function wrapCharField(inputId, max) {
    var input = document.getElementById(inputId);
    if (!input || input.dataset.fdCharWrapped === '1') return;
    input.dataset.fdCharWrapped = '1';
    var group = input.closest('.form-group');
    if (!group) return;
    var label = group.querySelector('.form-label');
    if (label && !label.parentElement.classList.contains('fd-push-field-head')) {
      var head = document.createElement('div');
      head.className = 'fd-push-field-head';
      label.parentNode.insertBefore(head, label);
      head.appendChild(label);
      var count = document.createElement('span');
      count.className = 'fd-push-char-count';
      count.id = inputId === 'pushTitle' ? 'fdPushTitleCount' : 'fdPushMessageCount';
      count.textContent = '0/' + max;
      head.appendChild(count);
    }
    var counter = document.getElementById(inputId === 'pushTitle' ? 'fdPushTitleCount' : 'fdPushMessageCount');
    input.addEventListener('input', function () {
      updateCharCount(input, counter, max);
      syncPreview();
    });
    updateCharCount(input, counter, max);
  }

  function buildChannelSegmented() {
    var sel = document.getElementById('pushChannel');
    if (!sel || document.getElementById('fdPushChannelSeg')) return;
    sel.classList.add('fd-push-channel-native');

    var group = sel.closest('.form-group');
    if (!group) return;

    var seg = document.createElement('div');
    seg.id = 'fdPushChannelSeg';
    seg.className = 'fd-push-channel-seg';
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-label', 'Canale invio');

    CHANNELS.forEach(function (ch) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fd-push-channel-seg__btn';
      btn.setAttribute('data-channel', ch.value);
      btn.setAttribute('aria-pressed', sel.value === ch.value ? 'true' : 'false');
      btn.title = ch.tip;
      btn.innerHTML =
        (ch.icon ? '<span aria-hidden="true">' + ch.icon + '</span> ' : '') + esc(ch.label);
      btn.addEventListener('click', function () {
        setChannelValue(ch.value);
      });
      seg.appendChild(btn);
    });

    var help = document.createElement('p');
    help.id = 'fdPushChannelHelp';
    help.className = 'fd-push-channel-help';

    group.appendChild(seg);
    group.appendChild(help);
    setChannelValue(sel.value || 'apple');
  }

  function buildPreviewPanel() {
    if (document.getElementById('fdPushPreview')) return;
    var aside = document.createElement('aside');
    aside.id = 'fdPushPreview';
    aside.className = 'fd-push-preview';
    aside.setAttribute('aria-label', 'Anteprima notifica');
    aside.innerHTML =
      '<h2 class="fd-push-preview__title">Anteprima live</h2>' +
      '<div class="fd-push-preview__device fd-push-preview__device--ios">' +
      '<span class="fd-push-preview__device-label">iPhone · lock screen</span>' +
      '<div class="fd-push-preview__lock">' +
      '<div class="fd-push-preview__lock-app" data-fd-push-preview-brand>Brand</div>' +
      '<div class="fd-push-preview__lock-title" data-fd-push-preview-title>Titolo notifica</div>' +
      '<div class="fd-push-preview__lock-body" data-fd-push-preview-body>Testo del messaggio…</div>' +
      '</div></div>' +
      '<div class="fd-push-preview__device fd-push-preview__device--android">' +
      '<span class="fd-push-preview__device-label">Android · notifica</span>' +
      '<div class="fd-push-preview__lock">' +
      '<div class="fd-push-preview__lock-app" data-fd-push-preview-brand>Brand</div>' +
      '<div class="fd-push-preview__lock-title" data-fd-push-preview-title>Titolo notifica</div>' +
      '<div class="fd-push-preview__lock-body" data-fd-push-preview-body>Testo del messaggio…</div>' +
      '</div></div>' +
      '<div class="fd-push-preview__device fd-push-preview__device--samsung">' +
      '<span class="fd-push-preview__device-label">Samsung · notifica</span>' +
      '<div class="fd-push-preview__lock">' +
      '<div class="fd-push-preview__lock-app" data-fd-push-preview-brand>Brand</div>' +
      '<div class="fd-push-preview__lock-title" data-fd-push-preview-title>Titolo notifica</div>' +
      '<div class="fd-push-preview__lock-body" data-fd-push-preview-body>Testo del messaggio…</div>' +
      '</div></div>' +
      '<div class="fd-push-preview__pass">' +
      '<div class="fd-push-preview__pass-name" data-fd-push-preview-brand>Brand</div>' +
      '<div>Anteprima pass Wallet (contenuto aggiornato se attivo)</div>' +
      '</div>';
    return aside;
  }

  function buildTestBlock() {
    if (document.getElementById('fdPushTestBlock')) return;
    var card = document.querySelector('#pushPanel_immediate .push-card');
    if (!card) return;
    var block = document.createElement('div');
    block.id = 'fdPushTestBlock';
    block.className = 'fd-push-test';
    block.innerHTML =
      '<label class="form-label" for="fdPushTestPass">Dispositivo di prova</label>' +
      '<p class="form-hint" style="margin:0 0 8px">Invia solo al pass selezionato (utile prima della campagna massiva).</p>' +
      '<div class="fd-push-test__row">' +
      '<select id="fdPushTestPass" aria-label="Pass di prova"></select>' +
      '<button type="button" class="btn sec" id="fdPushTestBtn">Invia di prova</button>' +
      '</div>';
    var sendBtn = card.querySelector('button[onclick*="sendImmediatePush"]');
    if (sendBtn) card.insertBefore(block, sendBtn);
    else card.appendChild(block);
    document.getElementById('fdPushTestBtn').addEventListener('click', sendTestPush);
  }

  var fdModalOpeners = Object.create(null);

  function getFocusables(root) {
    var sel = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.prototype.filter.call(root.querySelectorAll(sel), function (el) {
      return el.getAttribute('aria-hidden') !== 'true' && !el.closest('[hidden]');
    });
  }

  function setupFdModal(modal) {
    if (!modal || modal.dataset.fdModalSetup === '1') return;
    modal.dataset.fdModalSetup = '1';
    var dialog = modal.querySelector('.modal-content') || modal;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    var title = dialog.querySelector('.modal-header');
    if (title) {
      if (!title.id) title.id = modal.id + 'Title';
      dialog.setAttribute('aria-labelledby', title.id);
    }
    if (!dialog.hasAttribute('tabindex')) dialog.setAttribute('tabindex', '-1');

    modal.addEventListener('click', function (e) {
      if (e.target === modal && modal.classList.contains('active')) closeFdModal(modal.id);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !modal.classList.contains('active')) return;
      e.preventDefault();
      closeFdModal(modal.id);
    });

    dialog.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab' || !modal.classList.contains('active')) return;
      var nodes = getFocusables(dialog);
      if (!nodes.length) return;
      var first = nodes[0];
      var last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  function openFdModal(modalId, trigger) {
    if (typeof window.prepareModalOpen === 'function') window.prepareModalOpen(modalId, trigger);
    fdModalOpeners[modalId] = trigger || document.activeElement;
    var modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    var dialog = modal.querySelector('.modal-content') || modal;
    var nodes = getFocusables(dialog);
    requestAnimationFrame(function () {
      (nodes[0] || dialog).focus();
    });
  }

  function closeFdModal(modalId) {
    var modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    if (!document.querySelector('.modal.active')) document.body.classList.remove('modal-open');
    var opener = fdModalOpeners[modalId];
    delete fdModalOpeners[modalId];
    requestAnimationFrame(function () {
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus();
    });
  }

  function ensurePushConfirmModal() {
    if (document.getElementById('fdPushConfirmModal')) return;
    var wrap = document.createElement('div');
    wrap.id = 'fdPushConfirmModal';
    wrap.className = 'modal';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML =
      '<div class="modal-content">' +
      '<button type="button" class="modal-close" data-fd-close="fdPushConfirmModal" aria-label="Chiudi">&times;</button>' +
      '<div class="modal-header" id="fdPushConfirmTitle">Conferma invio notifica</div>' +
      '<p class="form-hint" style="margin:0 0 12px">Verifica destinatari e contenuto prima dell’invio massivo.</p>' +
      '<ul class="fd-push-confirm-summary" id="fdPushConfirmSummary"></ul>' +
      '<p class="fd-push-confirm-zero" id="fdPushConfirmZero" hidden>Nessun pass raggiungibile per questo canale.</p>' +
      '<div class="modal-actions">' +
      '<button type="button" class="btn sec" id="fdPushConfirmCancel">Annulla</button>' +
      '<button type="button" class="btn" id="fdPushConfirmSubmit">Conferma invio</button>' +
      '</div></div>';
    document.body.appendChild(wrap);
    setupFdModal(wrap);
    wrap.querySelector('[data-fd-close]').addEventListener('click', function () {
      closeFdModal('fdPushConfirmModal');
    });
    document.getElementById('fdPushConfirmCancel').addEventListener('click', function () {
      closeFdModal('fdPushConfirmModal');
    });
  }

  function ensurePushHistoryConfirmModal() {
    if (document.getElementById('fdPushHistoryConfirmModal')) return;
    var wrap = document.createElement('div');
    wrap.id = 'fdPushHistoryConfirmModal';
    wrap.className = 'modal';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML =
      '<div class="modal-content">' +
      '<button type="button" class="modal-close" data-fd-close="fdPushHistoryConfirmModal" aria-label="Chiudi">&times;</button>' +
      '<div class="modal-header" id="fdPushHistoryConfirmTitle">Elimina dallo storico</div>' +
      '<p id="fdPushHistoryConfirmMessage" class="form-hint" style="margin:0"></p>' +
      '<div class="modal-actions">' +
      '<button type="button" class="btn sec" id="fdPushHistoryConfirmCancel">Annulla</button>' +
      '<button type="button" class="btn danger" id="fdPushHistoryConfirmSubmit">Elimina</button>' +
      '</div></div>';
    document.body.appendChild(wrap);
    setupFdModal(wrap);
    wrap.querySelector('[data-fd-close]').addEventListener('click', function () {
      closeFdModal('fdPushHistoryConfirmModal');
    });
    document.getElementById('fdPushHistoryConfirmCancel').addEventListener('click', function () {
      closeFdModal('fdPushHistoryConfirmModal');
    });
  }

  function fdConfirmDialog(opts) {
    ensurePushHistoryConfirmModal();
    return new Promise(function (resolve) {
      var titleEl = document.getElementById('fdPushHistoryConfirmTitle');
      var msgEl = document.getElementById('fdPushHistoryConfirmMessage');
      var submit = document.getElementById('fdPushHistoryConfirmSubmit');
      var cancel = document.getElementById('fdPushHistoryConfirmCancel');
      if (titleEl) titleEl.textContent = opts.title || 'Confermi?';
      if (msgEl) msgEl.textContent = opts.message || '';
      if (submit) submit.textContent = opts.confirmLabel || 'Conferma';
      submit.classList.toggle('danger', opts.tone === 'danger');

      function cleanup(result) {
        submit.removeEventListener('click', onConfirm);
        cancel.removeEventListener('click', onCancel);
        closeFdModal('fdPushHistoryConfirmModal');
        resolve(result);
      }
      function onConfirm() { cleanup(true); }
      function onCancel() { cleanup(false); }

      submit.addEventListener('click', onConfirm);
      cancel.addEventListener('click', onCancel);
      openFdModal('fdPushHistoryConfirmModal', opts.trigger || document.activeElement);
    });
  }

  function passGoogleSavedLocal(p) {
    if (typeof window.passGoogleSaved === 'function') return window.passGoogleSaved(p);
    if (!p) return false;
    if (p.google_wallet_saved === true || p.google_wallet_saved === 'true' || p.google_wallet_saved === 1) return true;
    if (p.google_installed_at || p.device_source === 'google') return true;
    return false;
  }

  function passGooglePendingLocal(p) {
    if (typeof window.passGooglePending === 'function') return window.passGooglePending(p);
    if (!p || !p.google_wallet_object_id) return false;
    return !passGoogleSavedLocal(p);
  }

  function passSamsungSavedLocal(p) {
    if (typeof window.passSamsungSaved === 'function') return window.passSamsungSaved(p);
    if (!p) return false;
    if (p.samsung_wallet_saved === true || p.samsung_wallet_saved === 'true' || p.samsung_wallet_saved === 1) return true;
    if (p.samsung_installed_at || p.device_source === 'samsung') return true;
    return false;
  }

  function passSamsungPendingLocal(p) {
    if (typeof window.passSamsungPending === 'function') return window.passSamsungPending(p);
    if (!p || !p.samsung_wallet_ref_id) return false;
    return !passSamsungSavedLocal(p);
  }

  function isAppleReachable(p) {
    return !!p.push_token;
  }

  function isGoogleReachable(p) {
    return !!(p.google_wallet_object_id || passGoogleSavedLocal(p) || passGooglePendingLocal(p));
  }

  function isSamsungReachable(p) {
    return !!(p.samsung_wallet_ref_id && passSamsungSavedLocal(p)) || passSamsungPendingLocal(p);
  }

  function countRecipients(passes, channel) {
    var apple = 0;
    var google = 0;
    var samsung = 0;
    var any = 0;
    passes.forEach(function (p) {
      var a = isAppleReachable(p);
      var g = isGoogleReachable(p);
      var s = isSamsungReachable(p);
      if (a) apple += 1;
      if (g) google += 1;
      if (s) samsung += 1;
      if (a || g || s) any += 1;
    });
    if (channel === 'apple') return { total: apple, apple: apple, google: 0, samsung: 0, any: any };
    if (channel === 'google') return { total: google, apple: 0, google: google, samsung: 0, any: any };
    if (channel === 'samsung') return { total: samsung, apple: 0, google: 0, samsung: samsung, any: any };
    return { total: any, apple: apple, google: google, samsung: samsung, any: any };
  }

  async function fetchRecipientCounts(channel) {
    var brandId = syncBrandIdForPush();
    if (!brandId) return { counts: null, note: null };
    try {
      var api = window.API || '/api';
      var res = await fetch(
        api + '/passes?brand_id=' + encodeURIComponent(brandId) + '&limit=600',
        { headers: typeof getAuthHeaders === 'function' ? getAuthHeaders() : {} }
      );
      var rows = await res.json();
      var list = Array.isArray(rows) ? rows : rows.passes || rows.items || [];
      var audienceId = document.getElementById('pushAudienceTarget')?.value || '';
      var campaignId =
        typeof window.isLegacyCampaignsUiEnabled === 'function' && window.isLegacyCampaignsUiEnabled()
          ? document.getElementById('pushCampaignTarget')?.value || ''
          : '';
      var note = null;
      if (audienceId || campaignId) {
        note = 'Conteggio sul brand; audience/campagna applicata al momento dell’invio.';
      }
      return { counts: countRecipients(list, channel), note: note };
    } catch (e) {
      console.warn('[fd-push] recipient count unavailable', e);
      return { counts: null, note: 'Conteggio destinatari non disponibile; l’invio userà i filtri server.' };
    }
  }

  function firstMessageLine(text) {
    var line = String(text || '').split(/\r?\n/)[0] || '';
    return line.length > 120 ? line.slice(0, 117) + '…' : line;
  }

  function selectedOptionLabel(selectId) {
    var sel = document.getElementById(selectId);
    if (!sel || !sel.value) return null;
    var opt = sel.options[sel.selectedIndex];
    return opt ? opt.textContent.trim() : sel.value;
  }

  function channelLabel(value) {
    var ch = CHANNELS.find(function (c) { return c.value === value; });
    return ch ? ch.label : value;
  }

  function renderRecipientLines(counts, channel) {
    if (!counts) return '<li><strong>Destinatari</strong>Conteggio non disponibile</li>';
    if (channel === 'all') {
      return (
        '<li><strong>Destinatari raggiungibili</strong>' +
        'Apple: ' + counts.apple + ' · Google: ' + counts.google + ' · Samsung: ' + counts.samsung +
        ' (totale unico: ' + counts.total + ')</li>'
      );
    }
    var names = { apple: 'Apple', google: 'Google', samsung: 'Samsung' };
    return '<li><strong>Destinatari raggiungibili</strong>' +
      (names[channel] || channel) + ': ' + counts.total + ' pass</li>';
  }

  async function openPushSendConfirm(trigger) {
    if (typeof window.clearPushFieldErrors === 'function') window.clearPushFieldErrors();
    var title = (document.getElementById('pushTitle')?.value || '').trim();
    var message = (document.getElementById('pushMessage')?.value || '').trim();
    var invalid = false;
    if (!title) {
      if (typeof window.setPushFieldError === 'function') {
        window.setPushFieldError('pushTitle', 'Inserisci un titolo per la notifica');
      }
      invalid = true;
    }
    if (!message) {
      if (typeof window.setPushFieldError === 'function') {
        window.setPushFieldError('pushMessage', 'Inserisci il testo del messaggio');
      }
      invalid = true;
    }
    if (!syncBrandIdForPush()) {
      if (typeof toast === 'function') toast('Seleziona un brand');
      return;
    }
    if (invalid) return;

    ensurePushConfirmModal();
    var channel = document.getElementById('pushChannel')?.value || 'apple';
    var updatePass = document.getElementById('pushUpdatePass')?.checked;
    var summary = document.getElementById('fdPushConfirmSummary');
    var zeroBanner = document.getElementById('fdPushConfirmZero');
    var submitBtn = document.getElementById('fdPushConfirmSubmit');
    if (summary) summary.innerHTML = '<li><strong>Caricamento…</strong>Calcolo destinatari</li>';

    openFdModal('fdPushConfirmModal', trigger || document.getElementById('pushSendBtn'));

    var result = await fetchRecipientCounts(channel);
    var counts = result.counts;
    var html =
      '<li><strong>Canale</strong>' + esc(channelLabel(channel)) + '</li>' +
      renderRecipientLines(counts, channel) +
      '<li><strong>Titolo</strong>' + esc(title) + '</li>' +
      '<li><strong>Messaggio</strong>' + esc(firstMessageLine(message)) + '</li>';
    var iw = selectedOptionLabel('pushInstantWin');
    if (iw) html += '<li><strong>Reward collegato</strong>' + esc(iw) + '</li>';
    var gam = selectedOptionLabel('pushGamification');
    if (gam) html += '<li><strong>Challenge collegata</strong>' + esc(gam) + '</li>';
    html += '<li><strong>Aggiorna contenuto pass</strong>' + (updatePass ? 'Sì' : 'No') + '</li>';
    if (result.note) html += '<li><strong>Nota</strong>' + esc(result.note) + '</li>';
    if (summary) summary.innerHTML = html;

    var disable = counts && counts.total === 0;
    if (zeroBanner) zeroBanner.hidden = !disable;
    if (submitBtn) submitBtn.disabled = !!disable;
  }

  function wirePushSendConfirm() {
    var btn = document.getElementById('pushSendBtn');
    if (!btn || btn.dataset.fdConfirmWired === '1') return;
    btn.dataset.fdConfirmWired = '1';
    btn.removeAttribute('onclick');
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      openPushSendConfirm(btn);
    });

    ensurePushConfirmModal();
    var submitBtn = document.getElementById('fdPushConfirmSubmit');
    if (submitBtn && !submitBtn.dataset.fdWired) {
      submitBtn.dataset.fdWired = '1';
      submitBtn.addEventListener('click', async function () {
        if (submitBtn.disabled) return;
        if (!syncBrandIdForPush()) {
          if (typeof toast === 'function') toast('Seleziona un brand');
          return;
        }
        closeFdModal('fdPushConfirmModal');
        if (typeof window.sendImmediatePush === 'function') {
          await window.sendImmediatePush();
        }
      });
    }
  }

  async function deletePushHistoryCore(pushId) {
    try {
      var api = window.API || '/api';
      var res = await fetch(api + '/push/' + encodeURIComponent(pushId), {
        method: 'DELETE',
        headers: typeof getAuthHeaders === 'function' ? getAuthHeaders() : {}
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok || data.error) throw new Error(data.error || 'Eliminazione non riuscita');
      if (typeof toast === 'function') toast('Voce eliminata');
      if (typeof window.getPushSelectedIds === 'function') window.getPushSelectedIds().delete(String(pushId));
      if (typeof window.loadPushHistory === 'function') await window.loadPushHistory();
    } catch (err) {
      if (typeof toast === 'function') toast('Errore eliminazione: ' + (err.message || err));
    }
  }

  async function deleteSelectedPushHistoryCore(ids) {
    var ok = 0;
    var fail = 0;
    var api = window.API || '/api';
    for (var i = 0; i < ids.length; i += 1) {
      try {
        var res = await fetch(api + '/push/' + encodeURIComponent(ids[i]), {
          method: 'DELETE',
          headers: typeof getAuthHeaders === 'function' ? getAuthHeaders() : {}
        });
        var data = await res.json().catch(function () { return {}; });
        if (res.ok && !data.error) {
          ok += 1;
          if (typeof window.getPushSelectedIds === 'function') window.getPushSelectedIds().delete(ids[i]);
        } else fail += 1;
      } catch (_) {
        fail += 1;
      }
    }
    if (ok && typeof toast === 'function') toast('Eliminate ' + ok + ' voci dallo storico');
    if (fail && typeof toast === 'function') toast(fail + ' voci non eliminate');
    if (typeof window.updatePushBulkBar === 'function') window.updatePushBulkBar();
    if (typeof window.loadPushHistory === 'function') await window.loadPushHistory();
  }

  function patchPushHistoryDelete() {
    if (window.__fdPushHistoryPatched || !isFiloPushApp()) return;
    window.__fdPushHistoryPatched = true;
    ensurePushHistoryConfirmModal();

    window.deletePushFromHistory = async function (pushId) {
      var log = (window.pushHistoryCache || []).find(function (row) {
        return String(row.id) === String(pushId);
      });
      var ok = await fdConfirmDialog({
        title: 'Elimina dallo storico',
        message: 'Eliminare 1 notifica dallo storico' + (log && log.title ? ' («' + log.title + '»)' : '') + '?',
        confirmLabel: 'Elimina',
        tone: 'danger',
        trigger: document.activeElement
      });
      if (!ok) return;
      return deletePushHistoryCore(pushId);
    };

    window.deleteSelectedPushHistory = async function () {
      var ids = typeof window.getPushSelectedIds === 'function' ? [...window.getPushSelectedIds()] : [];
      if (!ids.length) return;
      var ok = await fdConfirmDialog({
        title: 'Elimina notifiche selezionate',
        message: 'Eliminare ' + ids.length + ' voci dallo storico?',
        confirmLabel: 'Elimina',
        tone: 'danger',
        trigger: document.activeElement
      });
      if (!ok) return;
      return deleteSelectedPushHistoryCore(ids);
    };
  }

  function enhanceImmediatePanel() {
    var panel = document.getElementById('pushPanel_immediate');
    if (!panel || panel.dataset.fdPushEnhanced === '1') return;
    panel.dataset.fdPushEnhanced = '1';
    panel.classList.add('fd-push-panel--enhanced');

    var card = panel.querySelector('.push-card');
    if (!card) return;

    var formCol = document.createElement('div');
    formCol.className = 'fd-push-form-col';
    formCol.appendChild(card);
    panel.insertBefore(formCol, panel.firstChild);

    var preview = buildPreviewPanel();
    if (preview) panel.appendChild(preview);

    buildChannelSegmented();
    buildTestBlock();
    wrapCharField('pushTitle', TITLE_MAX);
    wrapCharField('pushMessage', MESSAGE_MAX);
    syncPreview();
    loadTestPasses();
    wirePushSendConfirm();
  }

  function enhanceIntro() {
    var push = document.getElementById('push');
    if (!push) return;
    var intro = push.querySelector('p');
    if (!intro || intro.classList.contains('fd-push-intro')) return;
    intro.classList.add('fd-push-intro');
    intro.innerHTML =
      'Invia notifiche ai dipendenti con pass in Wallet. Scegli il <strong>canale</strong>, ' +
      'controlla i limiti di caratteri e usa l’<strong>anteprima</strong> prima dell’invio massivo.';
  }

  function patchNavForPush() {
    if (window.__fdPushNavPatched || typeof window.nav !== 'function') return;
    window.__fdPushNavPatched = true;
    var orig = window.nav;
    window.nav = function (sectionId) {
      var out = orig.apply(this, arguments);
      if (sectionId === 'push' && isFiloPushApp()) {
        setTimeout(initFdPush, 80);
      }
      return out;
    };
  }

  function initFdPush() {
    if (!isFiloPushApp()) return;
    var push = document.getElementById('push');
    if (push) push.classList.add('push--fd');
    enhanceIntro();
    enhanceImmediatePanel();
    patchNavForPush();
    patchPushHistoryDelete();
  }

  window.fdInitPush = initFdPush;
  window.fdSendTestPush = sendTestPush;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFdPush);
  } else {
    initFdPush();
  }
})();
