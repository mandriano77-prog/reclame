'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadScript(relativePath, globals) {
  const code = fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
  const ctx = { ...globals, window: globals, global: globals, document: globals.document };
  vm.runInNewContext(code, ctx, { filename: relativePath });
  return ctx;
}

function makeClassList() {
  const set = new Set();
  return {
    toggle(name, on) {
      if (on === undefined) {
        if (set.has(name)) set.delete(name);
        else set.add(name);
      } else if (on) set.add(name);
      else set.delete(name);
    },
    contains(name) {
      return set.has(name);
    }
  };
}

function bootFdNavDom() {
  const groups = {};
  const detailsList = [];
  return {
    documentElement: { getAttribute: (k) => (k === 'data-app' ? 'filodiretto' : null) },
    querySelector(sel) {
      if (sel === '.nav-item.active') return null;
      var m = sel.match(/data-section-id="([^"]+)"/);
      if (!m) return null;
      for (var i = 0; i < detailsList.length; i++) {
        var items = detailsList[i].querySelectorAll('.nav-item');
        for (var j = 0; j < items.length; j++) {
          if (items[j].getAttribute('data-section-id') === m[1]) return items[j];
        }
      }
      return null;
    },
    querySelectorAll(sel) {
      if (sel === '.nav-group[data-nav-group]') return detailsList;
      if (sel === '.nav-item.active') return [];
      return [];
    },
    getElementById() {
      return null;
    },
    addDetails(id, items) {
      const el = {
        dataset: { navGroup: id },
        classList: makeClassList(),
        querySelector() {
          return { setAttribute() {} };
        },
        querySelectorAll(s) {
          if (s === '.nav-item') return navItems;
          return [];
        },
        setAttribute() {
          groups[id] = true;
        },
        removeAttribute() {
          groups[id] = false;
        },
        get open() {
          return !!groups[id];
        },
        set open(v) {
          groups[id] = !!v;
        },
        addEventListener() {}
      };
      const navItems = items.map((sectionId) => ({
        getAttribute(k) {
          if (k === 'data-section-id') return sectionId;
          return null;
        },
        style: { display: '' },
        classList: { contains: () => false },
        closest(sel) {
          if (sel === '.nav-group[data-nav-group]') return el;
          return null;
        }
      }));
      detailsList.push(el);
      groups[id] = true;
      return el;
    }
  };
}

test('fdSectionToNavGroup maps sections to sidebar groups', () => {
  const g = { document: bootFdNavDom(), localStorage: { getItem: () => null, setItem() {} }, __2WALLET_PRODUCT_LOCK__: 'hr' };
  g.document.addDetails('comunicazione', ['push', 'instant-win', 'gamification', 'conventions']);
  g.document.addDetails('brand-pass', ['leads']);
  loadScript('src/dashboard/lib/nav.js', g);
  loadScript('src/filodiretto/fd-nav.js', g);
  assert.equal(g.fdSectionToNavGroup('welcome'), null);
  assert.equal(g.fdSectionToNavGroup('push'), 'comunicazione');
  assert.equal(g.fdSectionToNavGroup('conventions'), 'comunicazione');
  assert.equal(g.fdSectionToNavGroup('leads'), 'brand-pass');
  assert.equal(g.fdSectionToNavGroup('activity-log'), 'insights');
  assert.equal(g.fdSectionToNavGroup('users'), 'setup');
});

test('fdSyncNavGroups opens brand-pass when Contatti is active', () => {
  const doc = bootFdNavDom();
  doc.addDetails('setup', ['users']);
  const brandPass = doc.addDetails('brand-pass', ['brand-identity', 'leads']);
  brandPass.open = false;
  const g = {
    document: doc,
    localStorage: { getItem: () => null, setItem() {} },
    __2WALLET_PRODUCT_LOCK__: 'hr',
    getActiveSectionId: () => 'leads'
  };
  loadScript('src/dashboard/lib/nav.js', g);
  loadScript('src/filodiretto/fd-nav.js', g);
  g.fdSyncNavGroups('leads');
  assert.ok(brandPass.open, 'active group should be forced open');
  assert.ok(brandPass.classList.contains('nav-group--active'));
});
