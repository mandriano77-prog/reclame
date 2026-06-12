/**
 * Legacy `.modal` accessibility — role, focus trap, Escape, focus restore.
 */
(function (global) {
  'use strict';

  var modalState = Object.create(null);
  var lastModalTrigger = null;

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

  function ensureModalLabel(modal) {
    if (!modal.getAttribute('role')) modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    if (modal.getAttribute('aria-labelledby')) return;
    var title = modal.querySelector('.modal-header, .a2w-modal__title, [id$="ModalTitle"]');
    if (!title) return;
    if (!title.id) title.id = modal.id + 'Title';
    modal.setAttribute('aria-labelledby', title.id);
  }

  function onModalOpen(modal) {
    if (!modal || !modal.id || modalState[modal.id]) return;
    ensureModalLabel(modal);
    modal.setAttribute('aria-hidden', 'false');

    var opener = lastModalTrigger || document.activeElement;
    var state = { opener: opener, onDocKeydown: null, onKeydown: null };
    modalState[modal.id] = state;

    var nodes = getFocusables(modal);
    var focusTarget = nodes[0] || modal.querySelector('.modal-content, .modal-close');
    if (focusTarget && typeof focusTarget.focus === 'function') {
      requestAnimationFrame(function () { focusTarget.focus(); });
    }

    state.onDocKeydown = function (e) {
      if (e.key !== 'Escape') return;
      if (typeof global.closeModal === 'function') global.closeModal(modal.id);
      else modal.classList.remove('active');
    };
    document.addEventListener('keydown', state.onDocKeydown);

    state.onKeydown = function (e) {
      if (e.key !== 'Tab' || !modal.classList.contains('active')) return;
      var focusNodes = getFocusables(modal);
      if (!focusNodes.length) return;
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
    modal.addEventListener('keydown', state.onKeydown);
  }

  function onModalClose(modal) {
    if (!modal || !modal.id) return;
    var state = modalState[modal.id];
    if (!state) return;
    if (state.onDocKeydown) document.removeEventListener('keydown', state.onDocKeydown);
    if (state.onKeydown) modal.removeEventListener('keydown', state.onKeydown);
    modal.setAttribute('aria-hidden', 'true');
    var opener = state.opener;
    if (opener && typeof opener.focus === 'function' && document.contains(opener)) {
      requestAnimationFrame(function () { opener.focus(); });
    }
    delete modalState[modal.id];
    lastModalTrigger = null;
  }

  function bindModal(modal) {
    if (!modal || modal.dataset.modalA11yBound === '1') return;
    modal.dataset.modalA11yBound = '1';
    if (!modal.classList.contains('active')) modal.setAttribute('aria-hidden', 'true');
    ensureModalLabel(modal);
    var observer = new MutationObserver(function () {
      if (modal.classList.contains('active')) onModalOpen(modal);
      else onModalClose(modal);
    });
    observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
    if (modal.classList.contains('active')) onModalOpen(modal);
  }

  function initLegacyModalA11y() {
    document.addEventListener('click', function (e) {
      var trigger = e.target.closest('button, [role="button"], a, [onclick]');
      if (trigger) lastModalTrigger = trigger;
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
