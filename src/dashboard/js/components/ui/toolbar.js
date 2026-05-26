(function (global) {
  'use strict';

  const { createEl, appendChildren } = global.A2W.UI.utils;

  /**
   * @param {{ left?: HTMLElement|HTMLElement[], right?: HTMLElement|HTMLElement[] }} props
   */
  function createToolbar(props) {
    props = props || {};
    const root = createEl('div', 'a2w-ui-toolbar', { 'data-a2w-component': 'toolbar' });
    const left = createEl('div', 'a2w-ui-toolbar__left');
    const right = createEl('div', 'a2w-ui-toolbar__right');
    appendChildren(left, props.left);
    appendChildren(right, props.right);
    root.appendChild(left);
    root.appendChild(right);
    return root;
  }

  global.A2W.UI.createToolbar = createToolbar;
})((typeof window !== 'undefined' ? window : global));
