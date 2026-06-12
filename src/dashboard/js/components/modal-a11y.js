/**
 * Legacy `.modal` / `.modal-content` — dialog semantics, focus trap, unified close + focus restore.
 */
(function (global) {
  'use strict';

  var modalState = Object.create(null);
  var pendingOpeners = Object.create(null);

  function getDialogRoot(modal) {
    if (!modal) return null;
    return modal.querySelector('.modal-content') || modal;
  }

  function getFocusables(root) {
    var sel = [
      'button:not([disabled])',
      '[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(', ');
    return Array.prototype.filter.call(root.querySelectorAll(sel), function (el) {
      return el.getAttribute('aria-hidden') !== 'true' && !el.closest('[hidden]');
    });
  }

  function ensureModalLabel(dialog) {
    if (!dialog) return;
    if (!dialog.getAttribute('role')) dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    if (dialog.getAttribute('aria-labelledby') || dialog.getAttribute('aria-label')) return;
    var title = dialog.querySelector('.modal-header, .a2w-modal__title, [id$="ModalTitle"]');
    if (title) {
      if (!title.id) title.id = (dialog.id || 'modal') + 'Title';
      dialog.setAttribute('aria-labelledby', title.id);
      return;
    }
    dialog.setAttribute('aria-label', 'Finestra di dialogo');
  }

  function isValidTrigger(el) {
    return !!(el && el !== document.body && el !== document.documentElement && typeof el.focus === 'function');
  }

  function buildRestoreSelector(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id) return '#' + CSS.escape(el.id);
    var onclick = el.getAttribute('onclick');
    if (onclick) {
      return 'button[onclick="' + onclick.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"],' +
        '[onclick="' + onclick.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"]';
    }
    var dataId = el.getAttribute('data-focus-restore');
    if (dataId) return '[data-focus-restore="' + dataId.replace(/"/g, '\\"') + '"]';
    return '';
  }

  function storeOpener(modalId, trigger) {
    if (!modalId) return;
    var el = trigger || global.__modalLastTrigger || document.activeElement;
    if (!isValidTrigger(el) || el.closest && el.closest('.modal')) {
      el = global.__modalLastTrigger;
    }
    if (!isValidTrigger(el)) return;
    pendingOpeners[modalId] = {
      el: el,
      selector: buildRestoreSelector(el)
    };
  }

  function restoreFocus(stored) {
    if (!stored) return;
    var target = stored.el;
    if (target && document.contains(target)) {
      target.focus();
      return;
    }
    if (stored.selector) {
      var parts = stored.selector.split(',');
      for (var i = 0; i < parts.length; i++) {
        var candidate = document.querySelector(parts[i].trim());
        if (candidate && isValidTrigger(candidate)) {
          candidate.focus();
          return;
        }
      }
    }
  }

  function teardownModal(modal) {
    if (!modal || !modal.id) return null;
    var state = modalState[modal.id];
    if (!state) return null;

    if (state.onDocKeydown) document.removeEventListener('keydown', state.onDocKeydown);
    if (state.onKeydown && state.dialog) state.dialog.removeEventListener('keydown', state.onKeydown);
    if (state.onBackdropClick) modal.removeEventListener('click', state.onBackdropClick);

    modal.setAttribute('aria-hidden', 'true');
    if (state.dialog) state.dialog.setAttribute('aria-hidden', 'true');

    delete modalState[modal.id];
    return state.opener;
  }

  function finishModalClose(modal) {
    if (!modal || !modal.id) return;
    var opener = teardownModal(modal);
    if (!document.querySelector('.modal.active')) {
      document.body.classList.remove('modal-open');
    }
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        restoreFocus(opener);
      });
    });
  }

  function legacyCloseModalDom(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    if (el.classList.contains('active')) el.classList.remove('active');
    return el;
  }

  function closeModal(id) {
    var el = legacyCloseModalDom(id);
    if (el) finishModalClose(el);
    else if (!document.querySelector('.modal.active')) document.body.classList.remove('modal-open');
  }

  function onModalOpen(modal) {
    if (!modal || !modal.id || modalState[modal.id]) return;
    var dialog = getDialogRoot(modal);
    if (!dialog) return;

    ensureModalLabel(dialog);
    modal.setAttribute('aria-hidden', 'false');
    dialog.setAttribute('aria-hidden', 'false');
    if (!dialog.hasAttribute('tabindex')) dialog.setAttribute('tabindex', '-1');

    var pending = pendingOpeners[modal.id];
    delete pendingOpeners[modal.id];
    var opener = pending || (modal.__modalOpener ? { el: modal.__modalOpener, selector: buildRestoreSelector(modal.__modalOpener) } : null);
    if (!opener && isValidTrigger(global.__modalLastTrigger)) {
      opener = { el: global.__modalLastTrigger, selector: buildRestoreSelector(global.__modalLastTrigger) };
    }

    var state = {
      dialog: dialog,
      opener: opener,
      onDocKeydown: null,
      onKeydown: null,
      onBackdropClick: null
    };
    modalState[modal.id] = state;

    var nodes = getFocusables(dialog);
    var focusTarget = nodes[0] || dialog;
    requestAnimationFrame(function () {
      if (typeof focusTarget.focus === 'function') focusTarget.focus();
    });

    state.onDocKeydown = function (e) {
      if (e.key !== 'Escape' || !modal.classList.contains('active')) return;
      e.preventDefault();
      e.stopPropagation();
      closeModal(modal.id);
    };
    document.addEventListener('keydown', state.onDocKeydown);

    state.onKeydown = function (e) {
      if (e.key !== 'Tab' || !modal.classList.contains('active')) return;
      var focusNodes = getFocusables(dialog);
      if (!focusNodes.length) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      var first = focusNodes[0];
      var last = focusNodes[focusNodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener('keydown', state.onKeydown);

    state.onBackdropClick = function (e) {
      if (e.target !== modal) return;
      closeModal(modal.id);
    };
    modal.addEventListener('click', state.onBackdropClick);
  }

  function onModalCloseFromObserver(modal) {
    if (!modal || !modal.id || !modalState[modal.id]) return;
    finishModalClose(modal);
  }

  function bindModal(modal) {
    if (!modal || modal.dataset.modalA11yBound === '1') return;
    modal.dataset.modalA11yBound = '1';

    var dialog = getDialogRoot(modal);
    if (!modal.classList.contains('active')) {
      modal.setAttribute('aria-hidden', 'true');
      if (dialog) {
        dialog.setAttribute('aria-hidden', 'true');
        ensureModalLabel(dialog);
      }
    }

    var observer = new MutationObserver(function () {
      if (modal.classList.contains('active')) {
        document.body.classList.add('modal-open');
        onModalOpen(modal);
      } else {
        onModalCloseFromObserver(modal);
      }
    });
    observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
    if (modal.classList.contains('active')) onModalOpen(modal);
  }

  function prepareModalOpen(modalId, trigger) {
    storeOpener(modalId, trigger);
  }

  function openLegacyModal(modalId, trigger) {
    storeOpener(modalId, trigger);
    var modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.add('active');
    document.body.classList.add('modal-open');
  }

  function initLegacyModalA11y() {
    document.addEventListener('pointerdown', function (e) {
      var trigger = e.target.closest('button, [role="button"], a, [onclick]');
      if (trigger && !trigger.closest('.modal-content')) {
        global.__modalLastTrigger = trigger;
      }
    }, true);

    document.querySelectorAll('.modal').forEach(bindModal);

    global.prepareModalOpen = prepareModalOpen;
    global.openLegacyModal = openLegacyModal;
    global.closeModal = closeModal;
  }

  global.initLegacyModalA11y = initLegacyModalA11y;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLegacyModalA11y);
  } else {
    initLegacyModalA11y();
  }
})(typeof window !== 'undefined' ? window : global);
