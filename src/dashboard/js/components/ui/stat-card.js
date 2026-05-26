(function (global) {
  'use strict';

  const { createEl } = global.A2W.UI.utils;

  /**
   * @param {{ label: string, value: string|number, delta?: { value: string, direction: 'up'|'down'|'neutral' }, icon?: HTMLElement|string, tone?: 'default'|'primary', tooltip?: string }} props
   */
  function createStatCard(props) {
    props = props || {};
    const tone = props.tone === 'primary' ? 'primary' : 'default';
    const root = createEl('div', 'a2w-ui-stat-card a2w-ui-stat-card--' + tone, {
      'data-a2w-component': 'stat-card'
    });
    if (props.tooltip) root.setAttribute('title', props.tooltip);

    const body = createEl('div', 'a2w-ui-stat-card__body');
    if (props.icon) {
      const iconEl = createEl('div', 'a2w-ui-stat-card__icon');
      if (typeof props.icon === 'string') iconEl.innerHTML = props.icon;
      else iconEl.appendChild(props.icon);
      body.appendChild(iconEl);
    }

    const text = createEl('div', 'a2w-ui-stat-card__text');
    text.appendChild(createEl('div', 'a2w-ui-stat-card__value', { text: String(props.value ?? '—') }));
    text.appendChild(createEl('div', 'a2w-ui-stat-card__label', { text: props.label || '' }));
    body.appendChild(text);
    root.appendChild(body);

    if (props.delta) {
      const dir = props.delta.direction || 'neutral';
      const delta = createEl('div', 'a2w-ui-stat-card__delta a2w-ui-stat-card__delta--' + dir, {
        text: props.delta.value
      });
      root.appendChild(delta);
    }

    return root;
  }

  global.A2W.UI.createStatCard = createStatCard;
})((typeof window !== 'undefined' ? window : global));
