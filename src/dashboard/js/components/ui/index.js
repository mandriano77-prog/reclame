/**
 * Ads2Wallet UI kit — vanilla components (A2W shell only).
 * Type definitions: src/components/ui/index.ts
 */
(function (global) {
  'use strict';

  global.A2W = global.A2W || {};
  global.A2W.UI = global.A2W.UI || {};

  const UI = global.A2W.UI;

  UI.init = function initA2wUiKit() {
    if (UI.actionMenuContext) UI.actionMenuContext.ensureDismissBound();
    if (document.documentElement.dataset.a2wUiDismissBound === '1') return;
    document.documentElement.dataset.a2wUiDismissBound = '1';
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-a2w-dropdown-root]')) return;
      if (global.A2W && typeof global.A2W.closeDropdownMenus === 'function') {
        global.A2W.closeDropdownMenus();
      } else if (UI.actionMenuContext) {
        UI.actionMenuContext.closeAll();
        document.querySelectorAll('.a2w-ui-action-menu__panel, .a2w-row-kebab-menu').forEach((el) => {
          el.hidden = true;
        });
      }
    }, true);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && global.A2W && typeof global.A2W.closeDropdownMenus === 'function') {
        global.A2W.closeDropdownMenus();
      }
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', UI.init);
  } else {
    UI.init();
  }
})((typeof window !== 'undefined' ? window : global));
