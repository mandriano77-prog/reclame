(function (global) {
  'use strict';

  const { createEl } = global.A2W.UI.utils;
  const ctx = () => global.A2W.UI.actionMenuContext;
  let idSeq = 0;

  const KEBAB_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>';

  /**
   * @param {{ label?: string, items: { icon?: string, label: string, onClick: () => void, destructive?: boolean }[] }} props
   */
  function createActionMenu(props) {
    props = props || {};
    const menuId = 'a2w-ui-action-menu-' + (++idSeq);
    ctx().ensureDismissBound();

    const root = createEl('div', 'a2w-ui-action-menu', {
      'data-a2w-dropdown-root': '',
      'data-a2w-component': 'action-menu'
    });

    const trigger = createEl('button', 'a2w-icon-btn a2w-ui-action-menu__trigger', {
      type: 'button',
      'aria-label': props.label || 'Altre azioni',
      'aria-expanded': 'false',
      'aria-haspopup': 'menu'
    });
    trigger.innerHTML = KEBAB_SVG;

    const panel = createEl('div', 'a2w-ui-action-menu__panel a2w-row-kebab-menu', {
      role: 'menu',
      hidden: ''
    });

    (props.items || []).forEach((item) => {
      const btn = createEl('button', 'a2w-row-kebab-item' + (item.destructive ? ' a2w-row-kebab-item--danger' : ''), {
        type: 'button',
        role: 'menuitem'
      });
      if (item.icon) {
        const icon = createEl('span', 'a2w-row-kebab-icon');
        icon.innerHTML = item.icon;
        btn.appendChild(icon);
      }
      btn.appendChild(createEl('span', '', { text: item.label }));
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        api.close();
        if (typeof item.onClick === 'function') item.onClick();
      });
      panel.appendChild(btn);
    });

    const api = {
      close: function () {
        panel.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
      },
      open: function () {
        ctx().notifyOpened(menuId);
        panel.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
      },
      toggle: function () {
        if (panel.hidden) api.open();
        else api.close();
      },
      root: root
    };

    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      api.toggle();
    });

    ctx().registerMenu(menuId, api);

    root.appendChild(trigger);
    root.appendChild(panel);
    return root;
  }

  global.A2W.UI.createActionMenu = createActionMenu;
})((typeof window !== 'undefined' ? window : global));
