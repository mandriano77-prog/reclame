/**
 * Global ActionMenu registry — only one menu open at a time.
 */
(function (global) {
  'use strict';

  const menus = new Map();
  let openId = null;

  function registerMenu(id, api) {
    menus.set(id, api);
    return function unregister() {
      menus.delete(id);
      if (openId === id) openId = null;
    };
  }

  function closeAllExcept(keepId) {
    menus.forEach((api, id) => {
      if (id !== keepId) api.close();
    });
    if (keepId == null) openId = null;
    else openId = keepId;
  }

  function notifyOpened(id) {
    closeAllExcept(id);
    openId = id;
    if (global.A2W && typeof global.A2W.closeDropdownMenus === 'function') {
      global.A2W.closeDropdownMenus();
    }
  }

  function closeAll() {
    menus.forEach((api) => api.close());
    openId = null;
  }

  function ensureDismissBound() {
    /* Global dismiss: A2W.closeDropdownMenus + capture listener in a2w-shell.js */
  }

  global.A2W = global.A2W || {};
  global.A2W.UI = global.A2W.UI || {};
  global.A2W.UI.actionMenuContext = {
    registerMenu,
    closeAllExcept,
    closeAll,
    notifyOpened,
    ensureDismissBound,
    _getOpenId: function () { return openId; },
    _resetForTests: function () { menus.clear(); openId = null; }
  };
})((typeof window !== 'undefined' ? window : global));
