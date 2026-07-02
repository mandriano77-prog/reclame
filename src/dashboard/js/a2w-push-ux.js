/**
 * Ads2Wallet — Push immediata: anteprima lock screen, contatori caratteri, conferma invio.
 * Attivo solo su shell A2W (non FiloDiretto).
 */
(function (global) {
  'use strict';

  var TITLE_MAX = 50;
  var MESSAGE_MAX = 178;

  function isA2wPushUxActive() {
    if (!document.documentElement.classList.contains('a2w-shell')) return false;
    if (typeof global.isFiloShell === 'function' && global.isFiloShell()) return false;
    return true;
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getBrandLabel() {
    if (global.currentBrandName) return String(global.currentBrandName);
    var sel = document.getElementById('brandSelector');
    if (sel && sel.selectedIndex >= 0) return sel.options[sel.selectedIndex].textContent.trim();
    return 'Brand';
  }

  function updateCharCount(input, counter, max) {
    if (!input || !counter) return;
    var len = (input.value || '').length;
    counter.textContent = len + '/' + max;
    counter.classList.toggle('a2w-push-char-count--over', len > max);
  }

  function wrapCharField(inputId, max) {
    var input = document.getElementById(inputId);
    if (!input || input.dataset.a2wCharWrapped === '1') return;
    input.dataset.a2wCharWrapped = '1';
    var group = input.closest('.form-group');
    if (!group) return;
    var label = group.querySelector('.form-label');
    if (label && !label.parentElement.classList.contains('a2w-push-field-head')) {
      var head = document.createElement('div');
      head.className = 'a2w-push-field-head';
      label.parentNode.insertBefore(head, label);
      head.appendChild(label);
      var count = document.createElement('span');
      count.className = 'a2w-push-char-count';
      count.id = inputId === 'pushTitle' ? 'a2wPushTitleCount' : 'a2wPushMessageCount';
      count.setAttribute('aria-live', 'polite');
      count.textContent = '0/' + max;
      head.appendChild(count);
    }
    var counter = document.getElementById(inputId === 'pushTitle' ? 'a2wPushTitleCount' : 'a2wPushMessageCount');
    input.addEventListener('input', function () {
      updateCharCount(input, counter, max);
      syncPreview();
    });
    updateCharCount(input, counter, max);
  }

  function syncPreview() {
    var title = (document.getElementById('pushTitle')?.value || '').trim() || 'Titolo notifica';
    var body = (document.getElementById('pushMessage')?.value || '').trim() || 'Testo del messaggio…';
    var brand = getBrandLabel();
    document.querySelectorAll('[data-a2w-push-preview-brand]').forEach(function (el) {
      el.textContent = brand;
    });
    document.querySelectorAll('[data-a2w-push-preview-title]').forEach(function (el) {
      el.textContent = title;
    });
    document.querySelectorAll('[data-a2w-push-preview-body]').forEach(function (el) {
      el.textContent = body;
    });
    syncPushPassPreview();
  }

  function syncPushPassPreview() {
    var wrap = document.getElementById('a2wPushPassPreview');
    if (!wrap) return;
    var updateOn = !!document.getElementById('pushUpdatePass')?.checked;
    wrap.hidden = !updateOn;
    if (!updateOn) return;

    var brand = getBrandLabel();
    var title = (document.getElementById('pushTitle')?.value || '').trim() || 'NOVITÀ';
    var message = (document.getElementById('pushMessage')?.value || '').trim() || 'Testo promozione…';
    var linkLabel = (document.getElementById('pushPassLinkLabel')?.value || '').trim();
    var linkUrl = (document.getElementById('pushPassLinkUrl')?.value || '').trim();

    var frontLogo = wrap.querySelector('[data-a2w-push-pass-logo]');
    if (frontLogo) frontLogo.textContent = brand;

    var stripEl = wrap.querySelector('[data-a2w-push-pass-strip]');
    var stripPrev = document.querySelector('#pushStripPreview img');
    if (stripEl) {
      if (stripPrev && stripPrev.src) {
        stripEl.style.backgroundImage = 'url(' + stripPrev.src + ')';
        stripEl.style.display = '';
      } else {
        stripEl.style.backgroundImage = '';
        stripEl.style.display = '';
      }
    }

    var promoTitle = wrap.querySelector('[data-a2w-push-pass-promo-title]');
    var promoBody = wrap.querySelector('[data-a2w-push-pass-promo-body]');
    if (promoTitle) promoTitle.textContent = title.toUpperCase().slice(0, 30);
    if (promoBody) promoBody.textContent = message;

    var linkRow = wrap.querySelector('[data-a2w-push-pass-link]');
    if (linkRow) {
      if (linkUrl || linkLabel) {
        linkRow.hidden = false;
        linkRow.innerHTML = '<span class="a2w-push-pass-preview__link-label">' + esc(linkLabel || 'Scopri di più') + '</span>' +
          '<span class="a2w-push-pass-preview__link-url">' + esc(linkUrl || 'https://…') + '</span>';
      } else {
        linkRow.hidden = true;
        linkRow.innerHTML = '';
      }
    }
  }

  function buildPassPreviewPanel() {
    if (document.getElementById('a2wPushPassPreview')) return document.getElementById('a2wPushPassPreview');
    var block = document.createElement('div');
    block.id = 'a2wPushPassPreview';
    block.className = 'a2w-push-pass-preview';
    block.hidden = true;
    block.innerHTML =
      '<h3 class="a2w-push-pass-preview__title">Anteprima pass (retro)</h3>' +
      '<p class="a2w-push-pass-preview__hint">Dopo l\'invio: strip sul fronte, promozione + link out sul retro.</p>' +
      '<div class="a2w-push-pass-preview__faces">' +
      '<div class="a2w-push-pass-preview__face a2w-push-pass-preview__face--front">' +
      '<span class="a2w-push-pass-preview__face-label">Fronte</span>' +
      '<div class="a2w-push-pass-preview__strip" data-a2w-push-pass-strip></div>' +
      '<div class="a2w-push-pass-preview__front-row"><span data-a2w-push-pass-logo>Brand</span></div>' +
      '</div>' +
      '<div class="a2w-push-pass-preview__face a2w-push-pass-preview__face--back">' +
      '<span class="a2w-push-pass-preview__face-label">Retro</span>' +
      '<div class="a2w-push-pass-preview__back-block">' +
      '<div class="a2w-push-pass-preview__promo-label" data-a2w-push-pass-promo-title>NOVITÀ</div>' +
      '<div class="a2w-push-pass-preview__promo-body" data-a2w-push-pass-promo-body>Testo promozione…</div>' +
      '</div>' +
      '<div class="a2w-push-pass-preview__back-link" data-a2w-push-pass-link hidden></div>' +
      '</div></div>';
    return block;
  }

  function buildPreviewPanel() {
    if (document.getElementById('a2wPushPreview')) return document.getElementById('a2wPushPreview');
    var aside = document.createElement('aside');
    aside.id = 'a2wPushPreview';
    aside.className = 'a2w-push-preview';
    aside.setAttribute('aria-label', 'Anteprima notifica');
    aside.innerHTML =
      '<h2 class="a2w-push-preview__title">Anteprima live</h2>' +
      '<p class="a2w-push-preview__hint">Come apparirà sul lock screen mentre digiti.</p>' +
      '<div class="a2w-push-preview__device">' +
      '<span class="a2w-push-preview__device-label">iPhone · lock screen</span>' +
      '<div class="a2w-push-preview__lock">' +
      '<div class="a2w-push-preview__lock-app" data-a2w-push-preview-brand>Brand</div>' +
      '<div class="a2w-push-preview__lock-title" data-a2w-push-preview-title>Titolo notifica</div>' +
      '<div class="a2w-push-preview__lock-body" data-a2w-push-preview-body>Testo del messaggio…</div>' +
      '</div></div>';
    return aside;
  }

  function channelLabel(value) {
    var map = {
      apple: 'Apple Wallet (APNs)',
      google: 'Google Wallet',
      samsung: 'Samsung Wallet',
      all: 'Tutti i canali'
    };
    return map[value] || value;
  }

  function selectedOptionLabel(selectId) {
    var sel = document.getElementById(selectId);
    if (!sel || !sel.value) return null;
    var opt = sel.options[sel.selectedIndex];
    return opt ? opt.textContent.trim() : sel.value;
  }

  function firstMessageLine(text) {
    var line = String(text || '').split(/\r?\n/)[0] || '';
    return line.length > 120 ? line.slice(0, 117) + '…' : line;
  }

  function ensureConfirmModal() {
    if (document.getElementById('a2wPushConfirmModal')) return;
    var modal = document.createElement('dialog');
    modal.id = 'a2wPushConfirmModal';
    modal.className = 'a2w-push-confirm-modal';
    modal.innerHTML =
      '<form method="dialog" class="a2w-push-confirm-modal__inner">' +
      '<h2 class="a2w-push-confirm-modal__title">Conferma invio notifica</h2>' +
      '<p class="a2w-push-confirm-modal__lead">Stai per inviare una push di massa. L\'azione non è annullabile.</p>' +
      '<ul id="a2wPushConfirmSummary" class="a2w-push-confirm-modal__summary"></ul>' +
      '<p id="a2wPushConfirmZero" class="a2w-push-confirm-modal__warn" hidden>Nessun destinatario raggiungibile con il canale selezionato.</p>' +
      '<div class="a2w-push-confirm-modal__actions">' +
      '<button type="button" class="btn sec" id="a2wPushConfirmCancel">Annulla</button>' +
      '<button type="button" class="btn a2w-btn-primary" id="a2wPushConfirmSubmit">Invia ora</button>' +
      '</div></form>';
    document.body.appendChild(modal);
    modal.querySelector('#a2wPushConfirmCancel').addEventListener('click', function () {
      modal.close();
    });
    modal.addEventListener('cancel', function (e) {
      e.preventDefault();
      modal.close();
    });
  }

  function resolveBrandId() {
    if (typeof global.ensureBrandIdFromContext === 'function') {
      return global.ensureBrandIdFromContext();
    }
    return global.brandId || null;
  }

  async function fetchRecipientNote(channel) {
    var brandId = resolveBrandId();
    if (!brandId) return { note: 'Seleziona un brand per stimare i destinatari.' };
    try {
      var api = global.API || '/api/v1';
      var headers = typeof global.getAuthHeaders === 'function' ? global.getAuthHeaders() : {};
      var res = await fetch(api + '/passes?brand_id=' + encodeURIComponent(brandId) + '&limit=600', { headers: headers });
      var rows = await res.json();
      var list = Array.isArray(rows) ? rows : rows.passes || rows.items || [];
      var audienceId = document.getElementById('pushAudienceTarget')?.value || '';
      var campaignId = document.getElementById('pushCampaignTarget')?.value || '';
      var apple = 0;
      var google = 0;
      var samsung = 0;
      list.forEach(function (p) {
        if (p.push_token) apple += 1;
        if (p.google_wallet_object_id || p.google_wallet_saved) google += 1;
        if (p.samsung_wallet_ref_id || p.samsung_wallet_saved) samsung += 1;
      });
      var total = channel === 'apple' ? apple : channel === 'google' ? google : channel === 'samsung' ? samsung : Math.max(apple, google, samsung);
      var note = 'Stima sul brand';
      if (audienceId) note += ' · audience «' + esc(selectedOptionLabel('pushAudienceTarget') || audienceId) + '» applicata al invio';
      else if (campaignId) note += ' · campagna «' + esc(selectedOptionLabel('pushCampaignTarget') || campaignId) + '» applicata al invio';
      else note += ' · tutti i pass del brand';
      return { apple: apple, google: google, samsung: samsung, total: total, note: note };
    } catch (_) {
      return { note: 'Conteggio destinatari non disponibile; l\'invio userà i filtri server.' };
    }
  }

  async function openPushSendConfirm(trigger) {
    if (typeof global.clearPushFieldErrors === 'function') global.clearPushFieldErrors();
    var title = (document.getElementById('pushTitle')?.value || '').trim();
    var message = (document.getElementById('pushMessage')?.value || '').trim();
    var invalid = false;
    if (!title) {
      if (typeof global.setPushFieldError === 'function') global.setPushFieldError('pushTitle', 'Inserisci un titolo per la notifica');
      invalid = true;
    }
    if (!message) {
      if (typeof global.setPushFieldError === 'function') global.setPushFieldError('pushMessage', 'Inserisci il testo del messaggio');
      invalid = true;
    }
    if (!resolveBrandId()) {
      if (typeof global.toast === 'function') global.toast('Seleziona un brand');
      return;
    }
    if (invalid) return;

    ensureConfirmModal();
    var modal = document.getElementById('a2wPushConfirmModal');
    var summary = document.getElementById('a2wPushConfirmSummary');
    var zeroBanner = document.getElementById('a2wPushConfirmZero');
    var submitBtn = document.getElementById('a2wPushConfirmSubmit');
    var channel = document.getElementById('pushChannel')?.value || 'apple';
    var updatePass = document.getElementById('pushUpdatePass')?.checked;

    if (summary) summary.innerHTML = '<li><strong>Caricamento…</strong>Calcolo destinatari</li>';
    if (zeroBanner) zeroBanner.hidden = true;
    if (submitBtn) submitBtn.disabled = false;
    modal.showModal();

    var counts = await fetchRecipientNote(channel);
    var recipientLine = counts.total != null
      ? (channel === 'all'
        ? 'Apple ' + counts.apple + ' · Google ' + counts.google + ' · Samsung ' + counts.samsung
        : counts.total + ' pass')
      : '—';
    var html =
      '<li><strong>Canale</strong>' + esc(channelLabel(channel)) + '</li>' +
      '<li><strong>Destinatari (stima)</strong>' + esc(recipientLine) + '</li>';
    var camp = selectedOptionLabel('pushCampaignTarget');
    if (camp && document.getElementById('pushCampaignTarget')?.value) {
      html += '<li><strong>Campagna</strong>' + esc(camp) + '</li>';
    }
    var aud = selectedOptionLabel('pushAudienceTarget');
    if (aud && document.getElementById('pushAudienceTarget')?.value) {
      html += '<li><strong>Audience</strong>' + esc(aud) + '</li>';
    }
    html +=
      '<li><strong>Titolo</strong>' + esc(title) + '</li>' +
      '<li><strong>Messaggio</strong>' + esc(firstMessageLine(message)) + '</li>' +
      '<li><strong>Aggiorna pass</strong>' + (updatePass ? 'Sì' : 'No') + '</li>';
    if (counts.note) html += '<li><strong>Nota</strong>' + esc(counts.note) + '</li>';
    if (summary) summary.innerHTML = html;

    var disable = counts.total === 0;
    if (zeroBanner) zeroBanner.hidden = !disable;
    if (submitBtn) submitBtn.disabled = !!disable;
  }

  function wirePushSendConfirm() {
    var btn = document.getElementById('pushSendBtn');
    if (!btn || btn.dataset.a2wConfirmWired === '1') return;
    btn.dataset.a2wConfirmWired = '1';
    btn.removeAttribute('onclick');
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      openPushSendConfirm(btn);
    });

    ensureConfirmModal();
    var submitBtn = document.getElementById('a2wPushConfirmSubmit');
    if (submitBtn && !submitBtn.dataset.a2wWired) {
      submitBtn.dataset.a2wWired = '1';
      submitBtn.addEventListener('click', async function () {
        if (submitBtn.disabled) return;
        var modal = document.getElementById('a2wPushConfirmModal');
        if (modal) modal.close();
        if (typeof global.sendImmediatePush === 'function') {
          await global.sendImmediatePush();
        }
      });
    }
  }

  function enhanceImmediatePanel() {
    var panel = document.getElementById('pushPanel_immediate');
    if (!panel || panel.dataset.a2wPushEnhanced === '1') return;
    panel.dataset.a2wPushEnhanced = '1';
    panel.classList.add('a2w-push-panel--enhanced');

    var card = panel.querySelector('.push-card');
    if (!card) return;

    var formCol = panel.querySelector(':scope > .a2w-push-form-col');
    if (!formCol) {
      formCol = document.createElement('div');
      formCol.className = 'a2w-push-form-col';
      panel.insertBefore(formCol, panel.firstChild);
    }
    if (card.parentElement !== formCol) formCol.appendChild(card);

    var asideCol = panel.querySelector(':scope > .a2w-push-aside-col');
    if (!asideCol) {
      asideCol = document.createElement('div');
      asideCol.className = 'a2w-push-aside-col';
      var historyWrap = panel.querySelector('.fd-push-history-wrap');
      panel.insertBefore(asideCol, historyWrap || null);
    }

    var preview = buildPreviewPanel();
    if (preview.parentElement !== asideCol) asideCol.appendChild(preview);

    var passPreview = buildPassPreviewPanel();
    if (passPreview.parentElement !== asideCol) asideCol.appendChild(passPreview);

    var linkedWrap = panel.querySelector('.a2w-push-linked-content-wrap');
    if (linkedWrap) linkedWrap.classList.add('a2w-push-field--hidden');
    panel.querySelectorAll('.a2w-push-field--hidden').forEach(function (el) {
      el.style.display = 'none';
    });

    wrapCharField('pushTitle', TITLE_MAX);
    wrapCharField('pushMessage', MESSAGE_MAX);
    syncPreview();
    var updateCb = document.getElementById('pushUpdatePass');
    if (updateCb && !updateCb.dataset.a2wPassPreviewWired) {
      updateCb.dataset.a2wPassPreviewWired = '1';
      updateCb.addEventListener('change', syncPushPassPreview);
    }
    togglePushStripBlock();
    wirePushSendConfirm();
  }

  function patchNavForPush() {
    if (global.__a2wPushNavPatched || typeof global.nav !== 'function') return;
    global.__a2wPushNavPatched = true;
    var orig = global.nav;
    global.nav = function (sectionId) {
      var out = orig.apply(this, arguments);
      if (sectionId === 'push') {
        setTimeout(function () {
          if (isA2wPushUxActive()) enhanceImmediatePanel();
        }, 0);
      }
      return out;
    };
    if (typeof global.switchPushTab === 'function' && !global.__a2wPushTabPatched) {
      global.__a2wPushTabPatched = true;
      var origTab = global.switchPushTab;
      global.switchPushTab = function (tab) {
        var out = origTab.apply(this, arguments);
        if (tab === 'immediate' && isA2wPushUxActive()) enhanceImmediatePanel();
        return out;
      };
    }
  }

  function init() {
    if (!isA2wPushUxActive()) return;
    patchNavForPush();
    if (document.getElementById('push')?.classList.contains('active')) {
      enhanceImmediatePanel();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.a2wEnhancePushPanel = enhanceImmediatePanel;
  global.a2wSyncPushPassPreview = syncPushPassPreview;
})(typeof window !== 'undefined' ? window : global);
