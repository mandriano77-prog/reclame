'use strict';

function createActionMenuRegistry() {
  const menus = new Map();
  let openId = null;

  function registerMenu(id, api) {
    menus.set(id, api);
  }

  function closeAllExcept(keepId) {
    menus.forEach((api, id) => {
      if (id !== keepId) api.close();
    });
    openId = keepId == null ? null : keepId;
  }

  function notifyOpened(id) {
    closeAllExcept(id);
    openId = id;
  }

  function getOpenId() {
    return openId;
  }

  return { registerMenu, closeAllExcept, notifyOpened, getOpenId, menus };
}

module.exports = { createActionMenuRegistry };
