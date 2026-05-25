(function () {
  'use strict';

  function escHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getFocusable(root) {
    return Array.from(root.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    )).filter(function (el) {
      return el.offsetParent !== null || el === document.activeElement;
    });
  }

  function trapFocus(panel, trigger) {
    const focusable = getFocusable(panel);
    if (!focusable.length) return function () {};
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    function close() {
      panel.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onOutside);
      trigger.focus();
    }

    function onOutside(e) {
      if (panel.contains(e.target) || trigger.contains(e.target)) return;
      close();
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onOutside);
    first.focus();
    return close;
  }

  function renderHelpPopover(options) {
    const cfg = options || {};
    const host = cfg.host;
    if (!host) return null;

    host.classList.add('contacts-help');
    host.innerHTML = `
      <button
        type="button"
        class="contacts-help__trigger"
        aria-label="Aiuto: ${escHtml(cfg.title)}"
        aria-expanded="false"
        aria-haspopup="dialog"
      >?</button>
      <div
        class="contacts-help__panel"
        role="dialog"
        aria-label="Aiuto: ${escHtml(cfg.title)}"
        hidden
      >
        <p class="contacts-help__section-title">${escHtml(cfg.title)}</p>
        <p class="contacts-help__label">Cos'è</p>
        <p class="contacts-help__text">${escHtml(cfg.what)}</p>
        <p class="contacts-help__label">Quando usarlo</p>
        <ul class="contacts-help__list">
          ${(cfg.whenToUse || []).map(function (item) {
            return `<li>${escHtml(item)}</li>`;
          }).join('')}
        </ul>
        <p class="contacts-help__label">Cosa succede se lo attivo</p>
        <p class="contacts-help__text">${escHtml(cfg.effects)}</p>
        <p class="contacts-help__label">Esempio</p>
        <p class="contacts-help__text">${escHtml(cfg.example)}</p>
        <div class="contacts-help__links">
          ${cfg.docsUrl ? `<a href="${escHtml(cfg.docsUrl)}" target="_blank" rel="noopener noreferrer">📖 Guida completa</a>` : ''}
          ${cfg.videoUrl ? `<a href="${escHtml(cfg.videoUrl)}" target="_blank" rel="noopener noreferrer">▶ Video 30s</a>` : ''}
        </div>
      </div>
    `;

    const trigger = host.querySelector('.contacts-help__trigger');
    const panel = host.querySelector('.contacts-help__panel');
    let releaseFocus = null;

    trigger.addEventListener('click', function () {
      const willOpen = panel.hidden;
      if (releaseFocus) {
        releaseFocus();
        releaseFocus = null;
      }
      if (willOpen) {
        panel.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        releaseFocus = trapFocus(panel, trigger);
      } else {
        panel.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
      }
    });

    return { trigger, panel };
  }

  window.HelpPopover = {
    render: renderHelpPopover
  };
})();
