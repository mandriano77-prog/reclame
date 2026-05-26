(function (global) {
  'use strict';

  const { createEl, esc } = global.A2W.UI.utils;

  let pendingResolve = null;
  let dialogEl = null;

  function isConfirmTypingMatch(input, expected) {
    return String(input || '').trim() === String(expected || '').trim();
  }
  /* Keep in sync with logic/confirm-typing.cjs (unit tests) */

  function ensureDialog() {
    if (dialogEl) return dialogEl;
    dialogEl = createEl('dialog', 'a2w-ui-confirm-dialog', {
      id: 'a2wUiConfirmDialog',
      'aria-labelledby': 'a2wUiConfirmTitle'
    });
    dialogEl.innerHTML = [
      '<form method="dialog" class="a2w-ui-confirm-dialog__inner" id="a2wUiConfirmForm">',
      '  <h2 id="a2wUiConfirmTitle" class="a2w-ui-confirm-dialog__title"></h2>',
      '  <p id="a2wUiConfirmDesc" class="a2w-ui-confirm-dialog__description"></p>',
      '  <ul id="a2wUiConfirmImpact" class="a2w-ui-confirm-dialog__impact" hidden></ul>',
      '  <label id="a2wUiConfirmTypeWrap" class="a2w-ui-confirm-dialog__type-wrap" hidden>',
      '    <span id="a2wUiConfirmTypeLabel" class="a2w-ui-confirm-dialog__type-label"></span>',
      '    <input type="text" id="a2wUiConfirmTypeInput" class="a2w-ui-confirm-dialog__type-input" autocomplete="off" />',
      '  </label>',
      '  <div class="a2w-ui-confirm-dialog__actions">',
      '    <button type="submit" value="cancel" class="btn a2w-btn-secondary" id="a2wUiConfirmCancel">Annulla</button>',
      '    <button type="submit" value="confirm" class="btn a2w-ui-btn-destructive" id="a2wUiConfirmSubmit" disabled>Conferma</button>',
      '  </div>',
      '</form>'
    ].join('');
    document.body.appendChild(dialogEl);

    const form = dialogEl.querySelector('#a2wUiConfirmForm');
    const input = dialogEl.querySelector('#a2wUiConfirmTypeInput');
    const submit = dialogEl.querySelector('#a2wUiConfirmSubmit');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const val = e.submitter && e.submitter.value === 'confirm';
      finish(val && !submit.disabled);
    });

    dialogEl.addEventListener('cancel', function (e) {
      e.preventDefault();
      finish(false);
    });

    if (input && submit) {
      input.addEventListener('input', function () {
        const expected = input.dataset.expected || '';
        submit.disabled = !isConfirmTypingMatch(input.value, expected);
      });
    }

    return dialogEl;
  }

  function finish(confirmed) {
    if (dialogEl && dialogEl.open) dialogEl.close();
    if (pendingResolve) {
      pendingResolve(!!confirmed);
      pendingResolve = null;
    }
  }

  /**
   * @param {{ title: string, description?: string, impactedItems?: string[], requireTyping?: boolean, confirmText?: string, confirmLabel?: string }} opts
   */
  function openConfirmDialog(opts) {
    opts = opts || {};
    const dlg = ensureDialog();
    const title = dlg.querySelector('#a2wUiConfirmTitle');
    const desc = dlg.querySelector('#a2wUiConfirmDesc');
    const impact = dlg.querySelector('#a2wUiConfirmImpact');
    const typeWrap = dlg.querySelector('#a2wUiConfirmTypeWrap');
    const typeLabel = dlg.querySelector('#a2wUiConfirmTypeLabel');
    const input = dlg.querySelector('#a2wUiConfirmTypeInput');
    const submit = dlg.querySelector('#a2wUiConfirmSubmit');
    const cancel = dlg.querySelector('#a2wUiConfirmCancel');

    if (title) title.textContent = opts.title || 'Confermi?';
    if (desc) desc.textContent = opts.description || '';
    if (cancel) cancel.focus();

    if (impact) {
      const items = Array.isArray(opts.impactedItems) ? opts.impactedItems : [];
      if (items.length) {
        impact.hidden = false;
        impact.innerHTML = items.map((item) => '<li>' + esc(item) + '</li>').join('');
      } else {
        impact.hidden = true;
        impact.innerHTML = '';
      }
    }

    const requireTyping = !!(opts.requireTyping && opts.confirmText);
    if (typeWrap && typeLabel && input && submit) {
      if (requireTyping) {
        typeWrap.hidden = false;
        typeLabel.textContent = 'Digita "' + opts.confirmText + '" per confermare';
        input.value = '';
        input.dataset.expected = opts.confirmText;
        submit.disabled = true;
      } else {
        typeWrap.hidden = true;
        input.value = '';
        input.dataset.expected = '';
        submit.disabled = false;
      }
    }
    if (submit) submit.textContent = opts.confirmLabel || 'Conferma';

    return new Promise(function (resolve) {
      pendingResolve = resolve;
      dlg.showModal();
      if (requireTyping && input) input.focus();
    });
  }

  global.A2W.UI.isConfirmTypingMatch = isConfirmTypingMatch;
  global.A2W.UI.openConfirmDialog = openConfirmDialog;
})((typeof window !== 'undefined' ? window : global));
