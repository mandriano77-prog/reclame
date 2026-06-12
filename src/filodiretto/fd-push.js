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
      brand_id: window.brandId,
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
    if (!sel || !window.brandId) return;
    sel.innerHTML = '<option value="">— Caricamento… —</option>';
    try {
      var api = window.API || '/api';
      var res = await fetch(api + '/passes?brand_id=' + encodeURIComponent(window.brandId) + '&limit=200', {
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
    if (!window.brandId) {
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
  }

  window.fdInitPush = initFdPush;
  window.fdSendTestPush = sendTestPush;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFdPush);
  } else {
    initFdPush();
  }
})();
