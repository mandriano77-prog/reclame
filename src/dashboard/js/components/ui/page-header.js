(function (global) {
  'use strict';

  const { createEl, appendChildren } = global.A2W.UI.utils;

  /**
   * @param {{ breadcrumb?: {label:string,href?:string}[], title: string, description?: string, actions?: HTMLElement|HTMLElement[], status?: HTMLElement }} props
   */
  function createPageHeader(props) {
    props = props || {};
    const root = createEl('header', 'a2w-ui-page-header', { 'data-a2w-component': 'page-header' });

    if (props.breadcrumb && props.breadcrumb.length) {
      const nav = createEl('nav', 'a2w-ui-page-header__breadcrumb', { 'aria-label': 'Breadcrumb' });
      props.breadcrumb.forEach((crumb, i) => {
        if (i > 0) {
          const sep = createEl('span', 'a2w-ui-page-header__breadcrumb-sep', { text: '›', 'aria-hidden': 'true' });
          nav.appendChild(sep);
        }
        if (crumb.href) {
          const a = createEl('a', 'a2w-ui-page-header__breadcrumb-link', { href: crumb.href, text: crumb.label });
          nav.appendChild(a);
        } else {
          nav.appendChild(createEl('span', 'a2w-ui-page-header__breadcrumb-current', { text: crumb.label }));
        }
      });
      root.appendChild(nav);
    }

    const row = createEl('div', 'a2w-ui-page-header__row');
    const main = createEl('div', 'a2w-ui-page-header__main');
    main.appendChild(createEl('h1', 'a2w-ui-page-header__title', { text: props.title || '' }));
    if (props.description) {
      main.appendChild(createEl('p', 'a2w-ui-page-header__description', { text: props.description }));
    }
    if (props.status) main.appendChild(props.status);
    row.appendChild(main);

    if (props.actions) {
      const actions = createEl('div', 'a2w-ui-page-header__actions');
      appendChildren(actions, props.actions);
      row.appendChild(actions);
    }

    root.appendChild(row);
    return root;
  }

  global.A2W.UI.createPageHeader = createPageHeader;
})((typeof window !== 'undefined' ? window : global));
