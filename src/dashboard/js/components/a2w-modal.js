/**
 * Ads2Wallet — accessible modal overlay (focus trap, scroll lock, ESC / backdrop).
 * Usage:
 *   A2wModal.mount('myModal', { closeOnBackdrop: true, closeOnEscape: true });
 *   A2wModal.open('myModal', { onOpen(root) { ... } });
 *   await A2wModal.close('myModal', { force: true });
 */
(function (global) {
  'use strict';

  var OPEN_CLASS = 'a2w-modal--open';
  var BODY_LOCK_CLASS = 'a2w-modal-open';
  var registry = Object.create(null);

  function getRoot(id) {
    return typeof id === 'string' ? document.getElementById(id) : id;
  }

  function getFocusables(root) {
    var sel = [
      'button:not([disabled])',
      '[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'details summary',
      '[tabindex]:not([tabindex="-1"])'
    ].join(', ');
    return Array.prototype.filter.call(root.querySelectorAll(sel), function (el) {
      return el.getAttribute('aria-hidden') !== 'true' && el.offsetParent !== null;
    });
  }

  function ensureOnBody(root) {
    if (root && root.parentElement !== document.body) {
      document.body.appendChild(root);
    }
  }

  function mount(id, options) {
    var root = getRoot(id);
    if (!root) return null;
    if (registry[id]) return registry[id];

    options = options || {};
    ensureOnBody(root);

    if (!root.classList.contains('a2w-modal')) {
      root.classList.add('a2w-modal');
    }

    var backdrop = root.querySelector('[data-a2w-modal-backdrop]');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'a2w-modal__backdrop';
      backdrop.setAttribute('data-a2w-modal-backdrop', '');
      backdrop.setAttribute('aria-hidden', 'true');
      root.insertBefore(backdrop, root.firstChild);
    }

    var dialog = root.querySelector('.a2w-modal__dialog');
    if (!dialog) {
      var legacy = root.querySelector('.import-modal-card, .card');
      if (legacy) {
        legacy.classList.add('a2w-modal__dialog');
      }
    }

    var state = {
      id: id,
      root: root,
      options: options,
      opener: null,
      onKeydown: null,
      onDocKeydown: null
    };

    if (options.closeOnBackdrop !== false) {
      backdrop.addEventListener('click', function () {
        A2wModal.close(id);
      });
      root.addEventListener('click', function (e) {
        if (e.target === root) A2wModal.close(id);
      });
    }

    registry[id] = state;
    return state;
  }

  function lockBody() {
    var n = document.body.dataset.a2wModalOpenCount || '0';
    var count = parseInt(n, 10) || 0;
    count += 1;
    document.body.dataset.a2wModalOpenCount = String(count);
    if (count === 1) {
      document.body.classList.add(BODY_LOCK_CLASS);
      document.documentElement.classList.add(BODY_LOCK_CLASS);
    }
  }

  function unlockBody() {
    var n = document.body.dataset.a2wModalOpenCount || '0';
    var count = Math.max(0, (parseInt(n, 10) || 0) - 1);
    document.body.dataset.a2wModalOpenCount = String(count);
    if (count === 0) {
      document.body.classList.remove(BODY_LOCK_CLASS);
      document.documentElement.classList.remove(BODY_LOCK_CLASS);
      delete document.body.dataset.a2wModalOpenCount;
    }
  }

  function open(id, hooks) {
    var state = registry[id] || mount(id, {});
    if (!state) return false;
    var root = state.root;
    hooks = hooks || {};

    state.opener = document.activeElement;
    root.hidden = false;
    root.setAttribute('aria-hidden', 'false');
    root.classList.add(OPEN_CLASS);
    lockBody();

    var focusTarget = hooks.initialFocus;
    if (typeof focusTarget === 'string') {
      focusTarget = root.querySelector(focusTarget);
    }
    if (!focusTarget) {
      var nodes = getFocusables(root);
      focusTarget = nodes[0] || root.querySelector('.a2w-modal__dialog');
    }
    if (focusTarget && typeof focusTarget.focus === 'function') {
      requestAnimationFrame(function () { focusTarget.focus(); });
    }

    state.onDocKeydown = function (e) {
      if (e.key === 'Escape' && state.options.closeOnEscape !== false) {
        A2wModal.close(id);
      }
    };
    document.addEventListener('keydown', state.onDocKeydown);

    state.onKeydown = function (e) {
      if (e.key !== 'Tab' || !root.classList.contains(OPEN_CLASS)) return;
      var nodes = getFocusables(root);
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
    };
    root.addEventListener('keydown', state.onKeydown);

    if (typeof hooks.onOpen === 'function') hooks.onOpen(root, state);
    return true;
  }

  function close(id, opts) {
    var state = registry[id];
    if (!state) return Promise.resolve(true);
    opts = opts || {};

    if (typeof state.options.beforeClose === 'function') {
      var result = state.options.beforeClose(opts);
      if (result && typeof result.then === 'function') {
        return result.then(function (ok) {
          if (ok === false) return false;
          return finishClose(state, opts);
        });
      }
      if (result === false) return Promise.resolve(false);
    }

    return Promise.resolve(finishClose(state, opts));
  }

  function finishClose(state, opts) {
    var root = state.root;
    root.classList.remove(OPEN_CLASS);
    root.hidden = true;
    root.setAttribute('aria-hidden', 'true');
    unlockBody();

    if (state.onDocKeydown) {
      document.removeEventListener('keydown', state.onDocKeydown);
      state.onDocKeydown = null;
    }
    if (state.onKeydown) {
      root.removeEventListener('keydown', state.onKeydown);
      state.onKeydown = null;
    }

    var opener = opts.restoreFocus !== false ? state.opener : null;
    if (opener && typeof opener.focus === 'function') opener.focus();
    state.opener = null;

    if (typeof state.options.onClose === 'function') state.options.onClose(root, opts);
    return true;
  }

  function isOpen(id) {
    var state = registry[id];
    return !!(state && state.root.classList.contains(OPEN_CLASS));
  }

  global.A2wModal = {
    mount: mount,
    open: open,
    close: close,
    isOpen: isOpen
  };
})(typeof window !== 'undefined' ? window : global);
