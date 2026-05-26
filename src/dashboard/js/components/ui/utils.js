/**
 * A2W UI kit — DOM helpers (vanilla, scoped to a2w-shell).
 */
(function (global) {
  'use strict';

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function createEl(tag, className, attrs) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (attrs) {
      Object.keys(attrs).forEach((key) => {
        if (key === 'text') el.textContent = attrs[key];
        else if (key === 'html') el.innerHTML = attrs[key];
        else el.setAttribute(key, attrs[key]);
      });
    }
    return el;
  }

  function appendChildren(parent, children) {
    if (!parent || children == null) return parent;
    const list = Array.isArray(children) ? children : [children];
    list.forEach((child) => {
      if (child == null) return;
      if (typeof child === 'string') parent.appendChild(document.createTextNode(child));
      else parent.appendChild(child);
    });
    return parent;
  }

  function isA2wUiActive() {
    return document.documentElement.classList.contains('a2w-shell')
      && document.documentElement.getAttribute('data-shell') === 'dark';
  }

  global.A2W = global.A2W || {};
  global.A2W.UI = global.A2W.UI || {};
  global.A2W.UI.utils = { esc, createEl, appendChildren, isA2wUiActive };
})((typeof window !== 'undefined' ? window : global));
