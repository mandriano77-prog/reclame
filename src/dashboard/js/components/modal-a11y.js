/**
 * Legacy `.modal` / `.modal-content` accessibility — dialog role, focus trap, Escape, focus restore.
 */
(function (global) {
  'use strict';

  var modalState = Object.create(null);
  var lastModalTrigger = null;

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

  function resolveOpener(modal) {
    var opener = lastModalTrigger || document.activeElement;
    if (!opener || opener === document.body || opener === document.documentElement) {
      opener = modal && modal.__modalOpener;
    }
    if (opener && (opener === modal || (modal && modal.contains(opener)))) {
      opener = modal.__modalOpener || lastModalTrigger;
    }
    if (opener && !document.contains(opener)) opener = null;
    return opener;
  }

  function closeLegacyModal(modal) {
    if (!modal || !modal.id) return;
    if (typeof global.closeModal === 'function') global.closeModal(modal.id);
    else modal.classList.remove('active');
  }

  function onModalOpen(modal) {
    if (!modal || !modal.id || modalState[modal.id]) return;
    var dialog = getDialogRoot(modal);
    if (!dialog) return;

    ensureModalLabel(dialog);
    modal.setAttribute('aria-hidden', 'false');
    dialog.setAttribute('aria-hidden', 'false');
    if (!dialog.hasAttribute('tabindex')) dialog.setAttribute('tabindex', '-1');

    var opener = resolveOpener(modal);
    modal.__modalOpener = opener;

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
      if (e.key !== 'Escape') return;
      e.preventDefault();
      closeLegacyModal(modal);
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
      closeLegacyModal(modal);
    };
    modal.addEventListener('click', state.onBackdropClick);
  }

  function onModalClose(modal) {
    if (!modal || !modal.id) return;
    var state = modalState[modal.id];
    if (!state) return;

    if (state.onDocKeydown) document.removeEventListener('keydown', state.onDocKeydown);
    if (state.onKeydown && state.dialog) state.dialog.removeEventListener('keydown', state.onKeydown);
    if (state.onBackdropClick) modal.removeEventListener('click', state.onBackdropClick);

    modal.setAttribute('aria-hidden', 'true');
    if (state.dialog) state.dialog.setAttribute('aria-hidden', 'true');

    var opener = state.opener || modal.__modalOpener;
    if (opener && typeof opener.focus === 'function' && document.contains(opener)) {
      requestAnimationFrame(function () { opener.focus(); });
    }

    delete modalState[modal.id];
    delete modal.__modalOpener;
    lastModalTrigger = null;
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
        onModalClose(modal);
        if (!document.querySelector('.modal.active')) document.body.classList.remove('modal-open');
      }
    });
    observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
    if (modal.classList.contains('active')) onModalOpen(modal);
  }

  function initLegacyModalA11y() {
    document.addEventListener('mousedown', function (e) {
      var trigger = e.target.closest('button, [role="button"], a, [onclick]');
      if (trigger && !trigger.closest('.modal-content')) lastModalTrigger = trigger;
    }, true);

    document.querySelectorAll('.modal').forEach(bindModal);

    if (typeof global.closeModal === 'function' && !global.__modalA11yClosePatched) {
      global.__modalA11yClosePatched = true;
      var origClose = global.closeModal;
      global.closeModal = function (id) {
        var el = document.getElementById(id);
        origClose.apply(this, arguments);
        if (el) onModalClose(el);
      };
    }
  }

  global.initLegacyModalA11y = initLegacyModalA11y;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLegacyModalA11y);
  } else {
    initLegacyModalA11y();
  }
})(typeof window !== 'undefined' ? window : global);
