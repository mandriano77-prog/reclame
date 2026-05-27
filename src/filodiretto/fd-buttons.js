/**
 * FD-11 — FdButton helper: variant (primary|secondary|ghost), tone (neutral|danger|success), size, loading.
 */
(function () {
  'use strict';

  function isFiloApp() {
    return document.documentElement.getAttribute('data-app') === 'filodiretto';
  }

  /**
   * @param {{ variant?: string, tone?: string, size?: string, loading?: boolean }} opts
   * @returns {string}
   */
  function className(opts) {
    opts = opts || {};
    var classes = ['btn'];
    var variant = String(opts.variant || 'primary').toLowerCase();

    if (variant === 'secondary') {
      classes.push('sec');
    } else if (variant === 'ghost') {
      classes.push('fd-btn-ghost');
    }

    var tone = String(opts.tone || 'neutral').toLowerCase();
    if (tone === 'danger') classes.push('danger');
    if (tone === 'success') classes.push('fd-btn--success');

    var size = String(opts.size || 'md').toLowerCase();
    if (size === 'sm' || size === 'small') classes.push('small');

    if (opts.loading) classes.push('is-loading');

    return classes.join(' ');
  }

  /**
   * @param {{
   *   variant?: string,
   *   tone?: string,
   *   size?: string,
   *   label?: string,
   *   html?: string,
   *   type?: string,
   *   id?: string,
   *   className?: string,
   *   disabled?: boolean,
   *   loading?: boolean,
   *   onclick?: function,
   *   attributes?: Record<string, string>
   * }} opts
   * @returns {HTMLButtonElement}
   */
  function render(opts) {
    opts = opts || {};
    var btn = document.createElement('button');
    btn.type = opts.type || 'button';
    var extra = opts.className ? String(opts.className).trim() : '';
    btn.className = (className(opts) + (extra ? ' ' + extra : '')).trim();

    if (opts.id) btn.id = opts.id;
    if (opts.label) btn.textContent = opts.label;
    if (opts.html) btn.innerHTML = opts.html;

    var disabled = !!(opts.disabled || opts.loading);
    btn.disabled = disabled;
    if (opts.loading) {
      btn.setAttribute('aria-busy', 'true');
    }

    if (opts.attributes && typeof opts.attributes === 'object') {
      Object.keys(opts.attributes).forEach(function (key) {
        if (opts.attributes[key] != null) btn.setAttribute(key, String(opts.attributes[key]));
      });
    }

    if (typeof opts.onclick === 'function') {
      btn.addEventListener('click', opts.onclick);
    }

    return btn;
  }

  /**
   * @param {HTMLButtonElement} btn
   * @param {boolean} loading
   */
  function setLoading(btn, loading) {
    if (!btn) return;
    if (loading) {
      btn.classList.add('is-loading');
      btn.setAttribute('aria-busy', 'true');
      btn.disabled = true;
    } else {
      btn.classList.remove('is-loading');
      btn.removeAttribute('aria-busy');
      btn.disabled = false;
    }
  }

  window.FdButton = {
    className: className,
    render: render,
    setLoading: setLoading,
    isFiloApp: isFiloApp
  };
})();
