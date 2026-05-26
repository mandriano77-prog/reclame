(function (global) {
  'use strict';

  const { createEl } = global.A2W.UI.utils;

  const ALERT_ICON = '<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>';

  /**
   * @param {{ title: string, message: string, errorCode?: string, onRetry?: () => void }} props
   */
  function createErrorState(props) {
    props = props || {};
    const root = createEl('div', 'a2w-ui-error-state', { 'data-a2w-component': 'error-state', role: 'alert' });
    const icon = createEl('div', 'a2w-ui-error-state__icon');
    icon.innerHTML = ALERT_ICON;
    root.appendChild(icon);
    root.appendChild(createEl('h2', 'a2w-ui-error-state__title', { text: props.title || 'Errore' }));
    root.appendChild(createEl('p', 'a2w-ui-error-state__message', { text: props.message || '' }));
    if (props.errorCode) {
      root.appendChild(createEl('code', 'a2w-ui-error-state__code', { text: props.errorCode }));
    }
    if (typeof props.onRetry === 'function') {
      const btn = createEl('button', 'btn a2w-btn-secondary', { type: 'button', text: 'Riprova' });
      btn.addEventListener('click', props.onRetry);
      root.appendChild(btn);
    }
    return root;
  }

  global.A2W.UI.createErrorState = createErrorState;
})((typeof window !== 'undefined' ? window : global));
