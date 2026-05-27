/**
 * FD-13 — FiloDiretto: breadcrumb without brand prefix; searchable brand switcher + recenti.
 */
(function () {
  'use strict';

  var RECENT_KEY = 'fd:recentBrandIds';
  var RECENT_MAX = 5;
  var SHOW_RECENT_MIN = 6;

  function isFiloSwitcherApp() {
    if (document.documentElement.classList.contains('a2w-shell')) return false;
    try {
      if (window.__2WALLET_PRODUCT_LOCK__ === 'hr') return true;
    } catch (_) {}
    return document.documentElement.getAttribute('data-app') === 'filodiretto';
  }

  function readRecentIds() {
    try {
      var raw = localStorage.getItem(RECENT_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.map(String) : [];
    } catch (_) {
      return [];
    }
  }

  function writeRecentIds(ids) {
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(0, RECENT_MAX)));
    } catch (_) {}
  }

  function trackRecentBrand(id) {
    if (!id) return;
    var sid = String(id);
    var list = readRecentIds().filter(function (x) {
      return x !== sid;
    });
    list.unshift(sid);
    writeRecentIds(list);
  }

  function getFilteredBrandOptions() {
    var sel = document.getElementById('brandSelector');
    if (!sel) return [];
    var out = [];
    for (var i = 0; i < sel.options.length; i++) {
      var opt = sel.options[i];
      if (!opt.value) continue;
      out.push({ id: opt.value, name: opt.textContent || opt.value });
    }
    return out;
  }

  function applyBreadcrumbNoBrand() {
    var brandEl = document.getElementById('breadcrumbBrand');
    if (!brandEl) return;
    var li = brandEl.closest('li');
    if (!li) return;
    var hide = !!window.brandId;
    li.hidden = hide;
    if (hide) li.setAttribute('aria-hidden', 'true');
    else li.removeAttribute('aria-hidden');
  }

  function patchSyncBreadcrumb() {
    if (window.__fdBrandCrumbPatched) return;
    if (typeof window.syncBreadcrumb !== 'function') return;
    window.__fdBrandCrumbPatched = true;
    var orig = window.syncBreadcrumb;
    window.syncBreadcrumb = function (sectionId) {
      orig(sectionId);
      applyBreadcrumbNoBrand();
    };
  }

  function patchPopulateBrandSelector() {
    if (window.__fdPopulateBrandPatched) return;
    if (typeof window.populateBrandSelector !== 'function') return;
    window.__fdPopulateBrandPatched = true;
    var orig = window.populateBrandSelector;
    window.populateBrandSelector = function (brands) {
      orig(brands);
      refreshBrandSwitcher();
    };
  }

  function patchChangeBrand() {
    if (window.__fdChangeBrandPatched) return;
    if (typeof window.changeBrand !== 'function') return;
    window.__fdChangeBrandPatched = true;
    var orig = window.changeBrand;
    window.changeBrand = function () {
      var sel = document.getElementById('brandSelector');
      var id = sel && sel.value ? sel.value : null;
      var result = orig.apply(this, arguments);
      if (id) trackRecentBrand(id);
      refreshBrandSwitcher();
      applyBreadcrumbNoBrand();
      return result;
    };
  }

  var state = {
    open: false,
    query: ''
  };

  function closePanel() {
    state.open = false;
    var panel = document.getElementById('fdBrandSwitcherPanel');
    var trigger = document.getElementById('fdBrandSwitcherTrigger');
    if (panel) panel.hidden = true;
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  }

  function openPanel() {
    state.open = true;
    var panel = document.getElementById('fdBrandSwitcherPanel');
    var trigger = document.getElementById('fdBrandSwitcherTrigger');
    if (panel) panel.hidden = false;
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
    var search = document.getElementById('fdBrandSwitcherSearch');
    if (search) {
      search.value = '';
      state.query = '';
      renderLists();
      search.focus();
    }
  }

  function togglePanel() {
    if (state.open) closePanel();
    else openPanel();
  }

  function selectBrand(id) {
    var sel = document.getElementById('brandSelector');
    if (!sel) return;
    sel.value = id || '';
    if (typeof window.changeBrand === 'function') window.changeBrand();
    else {
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
    closePanel();
  }

  function matchesQuery(name) {
    var q = state.query.trim().toLowerCase();
    if (!q) return true;
    return String(name || '').toLowerCase().indexOf(q) >= 0;
  }

  function renderOptionList(ul, brands, activeId) {
    if (!ul) return;
    ul.innerHTML = '';
    var any = false;
    brands.forEach(function (b) {
      if (!matchesQuery(b.name)) return;
      any = true;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fd-brand-switcher__option' + (String(b.id) === String(activeId) ? ' is-active' : '');
      btn.setAttribute('role', 'option');
      btn.setAttribute('aria-selected', String(b.id) === String(activeId) ? 'true' : 'false');
      btn.textContent = b.name;
      btn.addEventListener('click', function () {
        selectBrand(b.id);
      });
      var li = document.createElement('li');
      li.appendChild(btn);
      ul.appendChild(li);
    });
    if (!any) {
      var empty = document.createElement('p');
      empty.className = 'fd-brand-switcher__empty';
      empty.textContent = 'Nessun brand trovato';
      ul.appendChild(document.createElement('li')).appendChild(empty);
    }
  }

  function renderLists() {
    var all = getFilteredBrandOptions();
    var activeId = window.brandId || (document.getElementById('brandSelector') || {}).value || '';
    var allUl = document.getElementById('fdBrandSwitcherAll');
    var recentUl = document.getElementById('fdBrandSwitcherRecent');
    var recentWrap = document.getElementById('fdBrandSwitcherRecentWrap');

    var recentIds = readRecentIds();
    var recentBrands = [];
    recentIds.forEach(function (id) {
      var hit = all.find(function (b) {
        return String(b.id) === String(id);
      });
      if (hit) recentBrands.push(hit);
    });

    var showRecent = all.length >= SHOW_RECENT_MIN && recentBrands.length > 0;
    if (recentWrap) recentWrap.hidden = !showRecent;
    if (showRecent && recentUl) renderOptionList(recentUl, recentBrands, activeId);
    if (allUl) renderOptionList(allUl, all, activeId);
  }

  function syncTriggerLabel() {
    var trigger = document.getElementById('fdBrandSwitcherTrigger');
    var label = trigger && trigger.querySelector('.fd-brand-switcher__label');
    if (!label) return;
    var sel = document.getElementById('brandSelector');
    if (!sel || !sel.value) {
      label.textContent = 'Seleziona brand';
      return;
    }
    label.textContent = sel.options[sel.selectedIndex]?.textContent || 'Brand';
  }

  function ensureSwitcherDom() {
    var picker = document.querySelector('.a2w-brand-picker');
    var sel = document.getElementById('brandSelector');
    if (!picker || !sel || document.getElementById('fdBrandSwitcher')) return;

    picker.classList.add('fd-brand-picker--switcher');
    sel.classList.add('fd-brand-switcher-native');

    var root = document.createElement('div');
    root.id = 'fdBrandSwitcher';
    root.className = 'fd-brand-switcher';
    root.innerHTML =
      '<button type="button" id="fdBrandSwitcherTrigger" class="fd-brand-switcher__trigger" aria-haspopup="listbox" aria-expanded="false" aria-controls="fdBrandSwitcherPanel">' +
      '<span class="fd-brand-switcher__label">Seleziona brand</span>' +
      '<span class="fd-brand-switcher__chevron" aria-hidden="true">▾</span>' +
      '</button>' +
      '<div id="fdBrandSwitcherPanel" class="fd-brand-switcher__panel" hidden role="dialog" aria-label="Seleziona brand">' +
      '<input type="search" id="fdBrandSwitcherSearch" class="fd-brand-switcher__search" placeholder="Cerca brand…" autocomplete="off" />' +
      '<div id="fdBrandSwitcherRecentWrap" class="fd-brand-switcher__section" hidden>' +
      '<p class="fd-brand-switcher__heading">Recenti</p>' +
      '<ul id="fdBrandSwitcherRecent" class="fd-brand-switcher__list" role="listbox"></ul>' +
      '</div>' +
      '<div class="fd-brand-switcher__section">' +
      '<p class="fd-brand-switcher__heading">Tutti i brand</p>' +
      '<ul id="fdBrandSwitcherAll" class="fd-brand-switcher__list" role="listbox"></ul>' +
      '</div>' +
      '</div>';

    picker.insertBefore(root, sel);

    document.getElementById('fdBrandSwitcherTrigger').addEventListener('click', function (e) {
      e.stopPropagation();
      togglePanel();
    });

    var search = document.getElementById('fdBrandSwitcherSearch');
    search.addEventListener('input', function () {
      state.query = search.value;
      renderLists();
    });
    search.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closePanel();
        document.getElementById('fdBrandSwitcherTrigger').focus();
      }
    });

    if (!document.body.dataset.fdBrandSwitcherBound) {
      document.body.dataset.fdBrandSwitcherBound = '1';
      document.addEventListener('click', function (e) {
        if (!state.open) return;
        if (e.target.closest('#fdBrandSwitcher')) return;
        closePanel();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closePanel();
      });
    }
  }

  function refreshBrandSwitcher() {
    syncTriggerLabel();
    if (state.open) renderLists();
    applyBreadcrumbNoBrand();
  }

  function initFdBrandSwitcher() {
    if (!isFiloSwitcherApp()) return;
    document.documentElement.setAttribute('data-app', 'filodiretto');
    ensureSwitcherDom();
    patchSyncBreadcrumb();
    patchPopulateBrandSelector();
    patchChangeBrand();
    refreshBrandSwitcher();
    if (window.brandId) trackRecentBrand(window.brandId);
  }

  window.fdRefreshBrandSwitcher = refreshBrandSwitcher;
  window.fdInitBrandSwitcher = initFdBrandSwitcher;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFdBrandSwitcher);
  } else {
    initFdBrandSwitcher();
  }

  /* Re-init when brands load after login */
  var tries = 0;
  var poll = setInterval(function () {
    if (!isFiloSwitcherApp()) {
      clearInterval(poll);
      return;
    }
    if (document.getElementById('fdBrandSwitcher') || tries > 40) {
      clearInterval(poll);
      if (!document.getElementById('fdBrandSwitcher')) ensureSwitcherDom();
      refreshBrandSwitcher();
      return;
    }
    tries += 1;
    ensureSwitcherDom();
  }, 500);
})();
