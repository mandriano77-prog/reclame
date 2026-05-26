(function (global) {
  'use strict';

  const { createEl } = global.A2W.UI.utils;

  /**
   * @param {{ icon?: HTMLElement|string, title: string, description?: string, primaryAction?: {label:string,onClick:()=>void}, secondaryAction?: {label:string,onClick:()=>void}, tertiaryAction?: {label:string,onClick:()=>void} }} props
   */
  function createEmptyState(props) {
    props = props || {};
    const root = createEl('div', 'a2w-ui-empty-state', { 'data-a2w-component': 'empty-state', role: 'status' });

    if (props.icon) {
      const iconWrap = createEl('div', 'a2w-ui-empty-state__icon');
      if (typeof props.icon === 'string') iconWrap.innerHTML = props.icon;
      else iconWrap.appendChild(props.icon);
      root.appendChild(iconWrap);
    }

    root.appendChild(createEl('h2', 'a2w-ui-empty-state__title', { text: props.title || '' }));
    if (props.description) {
      root.appendChild(createEl('p', 'a2w-ui-empty-state__description', { text: props.description }));
    }

    const actions = createEl('div', 'a2w-ui-empty-state__actions');
    [
      { action: props.primaryAction, className: 'a2w-btn-primary' },
      { action: props.secondaryAction, className: 'a2w-btn-secondary' },
      { action: props.tertiaryAction, className: 'a2w-ui-empty-state__tertiary' }
    ].forEach(({ action, className }) => {
      if (!action) return;
      const btn = createEl('button', 'btn ' + className, { type: 'button', text: action.label });
      btn.addEventListener('click', action.onClick);
      actions.appendChild(btn);
    });
    if (actions.childElementCount) root.appendChild(actions);

    return root;
  }

  global.A2W.UI.createEmptyState = createEmptyState;
})((typeof window !== 'undefined' ? window : global));
