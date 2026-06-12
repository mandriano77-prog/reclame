(function () {
  'use strict';
  function isFiloApp() {
    return document.documentElement.getAttribute('data-app') === 'filodiretto';
  }
  function className(opts) {
    opts = opts || {};
    var classes = ['btn'];
    var variant = String(opts.variant || 'primary').toLowerCase();
    if (variant === 'secondary') {
      classes.push('sec');
    } else if (variant === 'ghost') {
      classes.push('fd-btn-ghost');
    }
    var tone = String(opts.tone || 'neutral').toLowerCase();
    if (tone === 'danger') classes.push('danger');
    if (tone === 'success') classes.push('fd-btn--success');
    var size = String(opts.size || 'md').toLowerCase();
    if (size === 'sm' || size === 'small') classes.push('small');
    if (opts.loading) classes.push('is-loading');
    return classes.join(' ');
  }
  function render(opts) {
    opts = opts || {};
    var btn = document.createElement('button');
    btn.type = opts.type || 'button';
    var extra = opts.className ? String(opts.className).trim() : '';
    btn.className = (className(opts) + (extra ? ' ' + extra : '')).trim();
    if (opts.id) btn.id = opts.id;
    if (opts.label) btn.textContent = opts.label;
    if (opts.html) btn.innerHTML = opts.html;
    var disabled = !!(opts.disabled || opts.loading);
    btn.disabled = disabled;
    if (opts.loading) {
      btn.setAttribute('aria-busy', 'true');
    }
    if (opts.attributes && typeof opts.attributes === 'object') {
      Object.keys(opts.attributes).forEach(function (key) {
        if (opts.attributes[key] != null) btn.setAttribute(key, String(opts.attributes[key]));
      });
    }
    if (typeof opts.onclick === 'function') {
      btn.addEventListener('click', opts.onclick);
    }
    return btn;
  }
  function setLoading(btn, loading) {
    if (!btn) return;
    if (loading) {
      btn.classList.add('is-loading');
      btn.setAttribute('aria-busy', 'true');
      btn.disabled = true;
    } else {
      btn.classList.remove('is-loading');
      btn.removeAttribute('aria-busy');
      btn.disabled = false;
    }
  }
  window.FdButton = {
    className: className,
    render: render,
    setLoading: setLoading,
    isFiloApp: isFiloApp
  };
})();
(function () {
  'use strict';
  function isFiloApp() {
    if (document.documentElement.classList.contains('a2w-shell')) return false;
    try {
      if (window.__2WALLET_PRODUCT_LOCK__ === 'hr') return true;
    } catch (_) {}
    return document.documentElement.getAttribute('data-shell') === 'light';
  }
  function fdGoHome() {
    if (typeof nav === 'function') {
      try {
        nav('welcome');
      } catch (_) {}
    }
    try {
      const target = '/dashboard/home';
      const path = window.location.pathname.replace(/\/$/, '');
      if (path !== target) {
        history.pushState({ fdHome: true }, '', target);
      }
    } catch (_) {}
  }
  function fdSyncHomeFromPath() {
    const path = window.location.pathname.replace(/\/$/, '');
    if (!path.endsWith('/dashboard/home')) return;
    if (typeof nav !== 'function') return;
    const welcome = document.getElementById('welcome');
    if (welcome && welcome.classList.contains('active')) return;
    try {
      nav('welcome');
    } catch (_) {}
  }
  function fdEnhanceLogo() {
    const logo = document.querySelector('.sidebar .logo');
    if (!logo || logo.querySelector('.fd-logo-link')) return;
    const link = document.createElement('a');
    link.href = '/dashboard/home';
    link.className = 'fd-logo-link';
    link.setAttribute('aria-label', 'FiloDiretto — Home');
    while (logo.firstChild) {
      link.appendChild(logo.firstChild);
    }
    logo.appendChild(link);
    link.addEventListener('click', (e) => {
      e.preventDefault();
      fdGoHome();
    });
  }
  function fdEnhanceBreadcrumbProduct() {
    const brandEl = document.getElementById('breadcrumbBrand');
    if (!brandEl || brandEl.dataset.fdHomeBound === '1') return;
    const productTitle = (brandEl.textContent || '').trim();
    const appTitle = (function () {
      try {
        return (window.__2WALLET_PRODUCT_TITLE__ || '').trim();
      } catch (_) {
        return '';
      }
    })();
    const isProductCrumb = !window.brandId && (
      productTitle === 'Filo Diretto'
      || productTitle === 'FiloDiretto'
      || (appTitle && productTitle === appTitle)
    );
    if (!isProductCrumb) return;
    brandEl.dataset.fdHomeBound = '1';
    brandEl.classList.add('fd-breadcrumb-home');
    brandEl.setAttribute('role', 'link');
    brandEl.setAttribute('tabindex', '0');
    brandEl.setAttribute('title', 'Vai alla home');
    const go = (e) => {
      if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
      if (e.type === 'keydown') e.preventDefault();
      fdGoHome();
    };
    brandEl.addEventListener('click', go);
    brandEl.addEventListener('keydown', go);
  }
  function fdEnhanceUserMenu() {
    const trigger = document.getElementById('userMenuTrigger');
    if (!trigger || trigger.dataset.fdEnhanced === '1') return;
    trigger.dataset.fdEnhanced = '1';
    trigger.setAttribute('data-fd-tooltip', 'Account');
    trigger.setAttribute('title', 'Account');
    trigger.setAttribute('aria-label', 'Menu account');
    if (!trigger.querySelector('.user-menu-chevron')) {
      const chevron = document.createElement('span');
      chevron.className = 'user-menu-chevron';
      chevron.setAttribute('aria-hidden', 'true');
      chevron.textContent = '▾';
      trigger.appendChild(chevron);
    }
  }
  function initFdHeader() {
    if (!isFiloApp()) return;
    document.documentElement.setAttribute('data-app', 'filodiretto');
    fdEnhanceLogo();
    fdEnhanceUserMenu();
    fdEnhanceBreadcrumbProduct();
    fdSyncHomeFromPath();
    window.addEventListener('popstate', fdSyncHomeFromPath);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFdHeader);
  } else {
    initFdHeader();
  }
  const origSyncBreadcrumb = window.syncBreadcrumb;
  if (typeof origSyncBreadcrumb === 'function' && !window.__fdBreadcrumbPatched) {
    window.__fdBreadcrumbPatched = true;
    window.syncBreadcrumb = function (sectionId) {
      origSyncBreadcrumb(sectionId);
      fdEnhanceBreadcrumbProduct();
    };
  }
})();
(function () {
  'use strict';
  var STORAGE_COLLAPSED = 'fd:sidebar:collapsed';
  var mobileFocusRestore = null;
  var mobileFocusTrapBound = false;
  function isFilo() {
    return document.documentElement.getAttribute('data-app') === 'filodiretto';
  }
  function isDesktop() {
    return window.matchMedia('(min-width: 768px)').matches;
  }
  function positionFloatingMenu(trigger, panel) {
    if (!trigger || !panel) return;
    var collisionPadding = 16;
    panel.classList.add('fd-floating-menu-panel');
    panel.hidden = false;
    var rect = trigger.getBoundingClientRect();
    var width = panel.offsetWidth || 168;
    var idealLeft = rect.right - width;
    var maxLeft = window.innerWidth - width - collisionPadding;
    var left = Math.min(Math.max(collisionPadding, idealLeft), Math.max(collisionPadding, maxLeft));
    var top = rect.bottom + 8;
    var maxTop = window.innerHeight - panel.offsetHeight - collisionPadding;
    if (top > maxTop) top = Math.max(collisionPadding, maxTop);
    panel.style.position = 'fixed';
    panel.style.top = top + 'px';
    panel.style.left = left + 'px';
    panel.style.right = 'auto';
    panel.style.zIndex = '9200';
  }
  function initSidebarToggle() {
    if (!isFilo()) return;
    var toggle = document.getElementById('sidebarToggle');
    var backdrop = document.getElementById('sidebarBackdrop');
    if (!toggle || toggle.dataset.fdLayoutBound === '1') return;
    toggle.dataset.fdLayoutBound = '1';
    var sidebarBtn = null;
    function ensureSidebarCollapseButton() {
      var footer = document.querySelector('.sidebar .sidebar-footer');
      if (!footer) return null;
      var btn = document.getElementById('fdSidebarCollapseBtn');
      if (btn) return btn;
      btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'fdSidebarCollapseBtn';
      btn.className = 'fd-sidebar-collapse-btn';
      btn.textContent = 'Comprimi menu';
      footer.appendChild(btn);
      return btn;
    }
    function applyDesktop(collapsed) {
      document.body.classList.toggle('fd-sidebar-collapsed', collapsed);
      document.body.classList.remove('sidebar-open');
      toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      toggle.setAttribute('aria-label', collapsed ? 'Apri menu laterale' : 'Chiudi menu laterale');
      if (sidebarBtn) {
        sidebarBtn.textContent = collapsed ? 'Espandi menu' : 'Comprimi menu';
        sidebarBtn.setAttribute('aria-label', sidebarBtn.textContent);
      }
    }
    function sidebarFocusables() {
      var sidebar = document.querySelector('.sidebar');
      if (!sidebar) return [];
      return Array.prototype.slice.call(
        sidebar.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), .nav-item'
        )
      ).filter(function (el) {
        return !el.hidden && el.getAttribute('aria-hidden') !== 'true';
      });
    }
    function trapMobileFocus(e) {
      if (!document.body.classList.contains('sidebar-open') || isDesktop()) return;
      if (e.key !== 'Tab') return;
      var nodes = sidebarFocusables();
      if (nodes.length < 2) return;
      var first = nodes[0];
      var last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    function bindMobileFocusTrap() {
      if (mobileFocusTrapBound) return;
      mobileFocusTrapBound = true;
      document.addEventListener('keydown', trapMobileFocus);
    }
    function unbindMobileFocusTrap() {
      if (!mobileFocusTrapBound) return;
      mobileFocusTrapBound = false;
      document.removeEventListener('keydown', trapMobileFocus);
    }
    function applyMobile(open) {
      document.body.classList.toggle('sidebar-open', open);
      document.body.classList.remove('fd-sidebar-collapsed');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Chiudi menu laterale' : 'Apri menu laterale');
      if (open) {
        mobileFocusRestore = document.activeElement;
        bindMobileFocusTrap();
        requestAnimationFrame(function () {
          var nodes = sidebarFocusables();
          if (nodes.length) nodes[0].focus();
          else toggle.focus();
        });
      } else {
        unbindMobileFocusTrap();
        var restore = mobileFocusRestore;
        mobileFocusRestore = null;
        requestAnimationFrame(function () {
          if (restore && typeof restore.focus === 'function') restore.focus();
          else toggle.focus();
        });
      }
    }
    try {
      if (isDesktop() && localStorage.getItem(STORAGE_COLLAPSED) === '1') {
        applyDesktop(true);
      }
    } catch (_) {}
    toggle.addEventListener('click', function () {
      if (isDesktop()) {
        var next = !document.body.classList.contains('fd-sidebar-collapsed');
        applyDesktop(next);
        try {
          localStorage.setItem(STORAGE_COLLAPSED, next ? '1' : '0');
        } catch (_) {}
        return;
      }
      applyMobile(!document.body.classList.contains('sidebar-open'));
    });
    sidebarBtn = ensureSidebarCollapseButton();
    if (sidebarBtn) {
      sidebarBtn.addEventListener('click', function () {
        if (!isDesktop()) return;
        var next = !document.body.classList.contains('fd-sidebar-collapsed');
        applyDesktop(next);
        try {
          localStorage.setItem(STORAGE_COLLAPSED, next ? '1' : '0');
        } catch (_) {}
      });
    }
    if (backdrop) {
      backdrop.addEventListener('click', function () {
        if (!isDesktop()) applyMobile(false);
      });
    }
    document.querySelectorAll('.sidebar .nav-item').forEach(function (el) {
      el.addEventListener('click', function () {
        if (!isDesktop()) applyMobile(false);
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (document.querySelector('.modal.active, .a2w-modal--open, dialog[open]')) return;
      if (document.body.classList.contains('modal-open')) return;
      if (!isDesktop()) applyMobile(false);
    });
    window.addEventListener('resize', function () {
      if (isDesktop()) {
        document.body.classList.remove('sidebar-open');
        try {
          applyDesktop(localStorage.getItem(STORAGE_COLLAPSED) === '1');
        } catch (_) {
          applyDesktop(false);
        }
      } else {
        document.body.classList.remove('fd-sidebar-collapsed');
      }
    });
  }
  function boot() {
    if (!isFilo()) return;
    initSidebarToggle();
  }
  window.fdPositionFloatingMenu = positionFloatingMenu;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
(function () {
  'use strict';
  var CRITICAL_SECTIONS = [];
  var lastActiveSection = '';
  var patchRetryTimer = null;
  var patchRetryCount = 0;
  var PATCH_RETRY_MAX = 120;
  function isFiloWai() {
    if (document.documentElement.classList.contains('a2w-shell')) return false;
    try {
      if (window.__2WALLET_PRODUCT_LOCK__ === 'hr') return true;
    } catch (_) {}
    return document.documentElement.getAttribute('data-app') === 'filodiretto';
  }
  function getActiveSectionId() {
    var el = document.querySelector('.section.active');
    return el ? el.id : '';
  }
  function isCriticalSection(id) {
    return CRITICAL_SECTIONS.indexOf(id || getActiveSectionId()) !== -1;
  }
  function isPanelOpen() {
    var el = document.getElementById('waiOverlay');
    if (!el) return false;
    return el.style.display === 'flex' || getComputedStyle(el).display === 'flex';
  }
  function syncWaiLayoutState() {
    if (!isFiloWai()) return;
    var critical = isCriticalSection();
    document.body.classList.toggle('fd-wai-critical-page', critical);
    document.body.classList.toggle('fd-wai-open', isPanelOpen());
    document.documentElement.classList.toggle('fd-wai-active', isPanelOpen());
  }
  function closeWaiPanel() {
    if (!isPanelOpen()) {
      syncWaiLayoutState();
      return;
    }
    if (typeof window.toggleWaiOverlay === 'function') {
      window.toggleWaiOverlay(false);
    } else {
      var el = document.getElementById('waiOverlay');
      if (el) el.style.display = 'none';
    }
    syncWaiLayoutState();
  }
  function resolveFdNavSectionId(el) {
    if (!el) return '';
    var fdNav = el.closest('[data-fd-nav]');
    if (fdNav) return fdNav.getAttribute('data-fd-nav') || '';
    var navItem = el.closest('.nav-item[data-section-id]');
    if (navItem) return navItem.getAttribute('data-section-id') || '';
    return '';
  }
  function navigateFdSection(sectionId) {
    if (!sectionId || typeof window.nav !== 'function') return;
    window.nav(sectionId);
  }
  function handleFdNavWhileWaiOpen(trigger, e) {
    var sectionId = resolveFdNavSectionId(trigger);
    if (!sectionId) return false;
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    navigateFdSection(sectionId);
    setTimeout(closeWaiPanel, 0);
    return true;
  }
  function onSectionChanged() {
    var id = getActiveSectionId();
    if (id && lastActiveSection && id !== lastActiveSection) {
      closeWaiPanel();
    }
    if (id) lastActiveSection = id;
    rationalizeAudienceCopy();
    syncWaiLayoutState();
  }
  function bindInlineWaiLinks(root) {
    if (!root) return;
    root.querySelectorAll('[data-fd-wai-open]').forEach(function (btn) {
      if (btn.dataset.fdWaiBound === '1') return;
      btn.dataset.fdWaiBound = '1';
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var mode = btn.getAttribute('data-fd-wai-mode') || '';
        if (mode === 'audience' && typeof window.openWaiForAudience === 'function') {
          window.openWaiForAudience();
          syncWaiLayoutState();
          return;
        }
        if (typeof window.toggleWaiOverlay === 'function') window.toggleWaiOverlay(true);
        syncWaiLayoutState();
      });
    });
  }
  function rationalizeAudienceCopy() {
    var section = document.getElementById('audiences');
    if (!section || section.dataset.fdWaiCopy === '1') return;
    section.dataset.fdWaiCopy = '1';
    var intro = section.querySelector('p');
    if (intro && /W\.AI/i.test(intro.textContent || '')) {
      intro.innerHTML =
        'Segmentazione possessori pass, statistiche di apertura e click sul retro, audience salvate. ' +
        'Per segmenti in linguaggio naturale usa l\'assistente ' +
        '<button type="button" class="fd-wai-inline-link" data-fd-wai-open data-fd-wai-mode="audience">W.AI</button>.';
    }
    var pageCta = section.querySelector('button[onclick*="openWaiForAudience"]');
    if (pageCta) {
      pageCta.classList.add('fd-wai-page-cta--hidden');
      pageCta.setAttribute('aria-hidden', 'true');
      pageCta.tabIndex = -1;
    }
    bindInlineWaiLinks(section);
  }
  function patchToggleWaiOverlay() {
    if (window.__fdWaiTogglePatched || typeof window.toggleWaiOverlay !== 'function') return false;
    window.__fdWaiTogglePatched = true;
    var orig = window.toggleWaiOverlay;
    window.toggleWaiOverlay = function (forceOpen) {
      var res = orig.apply(this, arguments);
      syncWaiLayoutState();
      return res;
    };
    return true;
  }
  function patchNav() {
    if (window.__fdWaiNavPatched || typeof window.nav !== 'function') return false;
    window.__fdWaiNavPatched = true;
    var orig = window.nav;
    window.nav = function (id) {
      if (isPanelOpen()) closeWaiPanel();
      var out = orig.apply(this, arguments);
      var done = function () {
        onSectionChanged();
      };
      if (out && typeof out.then === 'function') return out.then(done);
      setTimeout(done, 0);
      return out;
    };
    return true;
  }
  function patchSyncWaiUi() {
    if (window.__fdWaiSyncPatched || typeof window.syncWaiUi !== 'function') return false;
    window.__fdWaiSyncPatched = true;
    var orig = window.syncWaiUi;
    window.syncWaiUi = function () {
      orig.apply(this, arguments);
      syncWaiLayoutState();
    };
    return true;
  }
  function ensureRuntimePatches() {
    var toggleOk = patchToggleWaiOverlay();
    var navOk = patchNav();
    patchSyncWaiUi();
    return toggleOk && navOk;
  }
  function schedulePatchRetry() {
    if (window.__fdWaiPatchesReady) return;
    if (ensureRuntimePatches()) {
      window.__fdWaiPatchesReady = true;
      if (patchRetryTimer) clearTimeout(patchRetryTimer);
      return;
    }
    patchRetryCount += 1;
    if (patchRetryCount >= PATCH_RETRY_MAX) return;
    patchRetryTimer = setTimeout(schedulePatchRetry, 50);
  }
  function observeActiveSection() {
    if (window.__fdWaiSectionObs) return;
    var root = document.querySelector('.content') || document.getElementById('mainLayout') || document.body;
    if (!root) return;
    window.__fdWaiSectionObs = true;
    var obs = new MutationObserver(function () {
      onSectionChanged();
    });
    obs.observe(root, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'hidden']
    });
  }
  function bindNavClickClose() {
    if (window.__fdWaiNavClickBound) return;
    window.__fdWaiNavClickBound = true;
    document.addEventListener('click', function (e) {
      if (!isFiloWai() || !isPanelOpen()) return;
      var fdNav = e.target.closest('[data-fd-nav]');
      if (fdNav) {
        handleFdNavWhileWaiOpen(fdNav, e);
        return;
      }
      var navItem = e.target.closest('.nav-item[data-section-id]');
      if (navItem) {
        handleFdNavWhileWaiOpen(navItem, e);
        return;
      }
      var sectionJump = e.target.closest('[data-section-id]');
      if (sectionJump) {
        handleFdNavWhileWaiOpen(sectionJump, e);
      }
    }, true);
  }
  function initFdWai() {
    if (!isFiloWai()) return;
    document.documentElement.classList.add('fd-wai-shell');
    lastActiveSection = getActiveSectionId();
    schedulePatchRetry();
    observeActiveSection();
    bindNavClickClose();
    rationalizeAudienceCopy();
    syncWaiLayoutState();
  }
  window.fdSyncWaiLayoutState = syncWaiLayoutState;
  window.fdCloseWaiPanel = closeWaiPanel;
  window.fdNavigateFromWai = handleFdNavWhileWaiOpen;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFdWai);
  } else {
    initFdWai();
  }
  window.addEventListener('load', function () {
    if (!isFiloWai()) return;
    schedulePatchRetry();
    syncWaiLayoutState();
  });
})();
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
(function () {
  'use strict';
  var STORAGE_KEY = 'filo_nav_group';
  var PINNED_MAX_ITEMS = 2;
  function isFiloNavApp() {
    if (document.documentElement.getAttribute('data-app') === 'filodiretto') return true;
    try {
      if (window.__2WALLET_PRODUCT_LOCK__ === 'hr') return true;
    } catch (_) {}
    return false;
  }
  function hideCampaignsNav() {
    document.querySelectorAll('.nav-item[data-section-id="campaigns"]').forEach(function (el) {
      el.style.display = 'none';
      el.setAttribute('aria-hidden', 'true');
      el.classList.add('fd-nav-hidden');
    });
    var section = document.getElementById('campaigns');
    if (section) {
      section.style.display = 'none';
      section.setAttribute('aria-hidden', 'true');
    }
  }
  function applyFiloNavMask() {
    if (!isFiloNavApp()) return;
    if (typeof window.applyLegacyCampaignsUiMask === 'function') {
      window.applyLegacyCampaignsUiMask();
    }
    hideCampaignsNav();
  }
  function sectionIdFromNavItem(el) {
    if (!el) return '';
    var sid = el.getAttribute('data-section-id');
    if (sid) return sid;
    var match = (el.getAttribute('onclick') || '').match(/nav\('([^']+)'\)/);
    return match ? match[1] : '';
  }
  function sectionToGroup(sectionId) {
    if (!sectionId || sectionId === 'welcome') return 'dashboard';
    var nav = window.FD_NAV && window.FD_NAV.NAV;
    if (!nav) return null;
    for (var i = 0; i < nav.length; i++) {
      var sec = nav[i];
      for (var j = 0; j < sec.items.length; j++) {
        if (sec.items[j].id === sectionId) return sec.id;
      }
    }
    return null;
  }
  function getActiveSectionForGroups() {
    if (typeof window.getActiveSectionId === 'function') {
      var sid = window.getActiveSectionId();
      if (sid) return sid;
    }
    var active = document.querySelector('.nav-item.active');
    if (active) return sectionIdFromNavItem(active);
    return 'welcome';
  }
  function isNavItemVisible(el) {
    if (!el) return false;
    if (el.style.display === 'none') return false;
    if (el.classList.contains('fd-nav-hidden')) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    return true;
  }
  function visibleItemsCount(details) {
    var n = 0;
    details.querySelectorAll('.nav-item').forEach(function (el) {
      if (isNavItemVisible(el)) n += 1;
    });
    return n;
  }
  function syncNavGroupA11y(details) {
    var summary = details.querySelector('summary.nav-group-label');
    if (!summary) return;
    summary.setAttribute('aria-expanded', details.open ? 'true' : 'false');
  }
  function syncNavGroups(sectionId) {
    if (!isFiloNavApp()) return;
    var activeSection = sectionId || getActiveSectionForGroups();
    var activeGroup = sectionToGroup(activeSection);
    document.querySelectorAll('.nav-group[data-nav-group]').forEach(function (details) {
      var gid = details.dataset.navGroup;
      var pinned = visibleItemsCount(details) <= PINNED_MAX_ITEMS;
      details.classList.toggle('nav-group--pinned', pinned);
      if (pinned) details.setAttribute('open', '');
      var isActive = gid === activeGroup;
      details.classList.toggle('nav-group--active', isActive);
      if (isActive) details.setAttribute('open', '');
      syncNavGroupA11y(details);
    });
  }
  function restoreNavGroupPrefs() {
    if (!isFiloNavApp()) return;
    document.querySelectorAll('.nav-group[data-nav-group]').forEach(function (details) {
      if (details.classList.contains('nav-group--pinned')) return;
      var id = details.dataset.navGroup;
      try {
        var saved = localStorage.getItem(STORAGE_KEY + ':' + id);
        if (saved === '0') details.removeAttribute('open');
        else if (saved === '1') details.setAttribute('open', '');
      } catch (_) {}
    });
  }
  function bindNavGroups() {
    document.querySelectorAll('.nav-group[data-nav-group]').forEach(function (details) {
      if (details.dataset.fdNavGroupBound === '1') return;
      details.dataset.fdNavGroupBound = '1';
      details.addEventListener('toggle', function () {
        if (!isFiloNavApp()) return;
        var id = details.dataset.navGroup;
        var activeGroup = sectionToGroup(getActiveSectionForGroups());
        if (details.classList.contains('nav-group--pinned')) {
          details.setAttribute('open', '');
          return;
        }
        if (id === activeGroup && !details.open) {
          details.setAttribute('open', '');
          return;
        }
        try {
          localStorage.setItem(STORAGE_KEY + ':' + id, details.open ? '1' : '0');
        } catch (_) {}
        syncNavGroupA11y(details);
      });
    });
  }
  function fdInitNavGroups() {
    if (!isFiloNavApp()) return false;
    bindNavGroups();
    restoreNavGroupPrefs();
    syncNavGroups(getActiveSectionForGroups());
    return true;
  }
  function patchUpdateNavState() {
    if (window.__fdNavPatched || typeof window.updateNavState !== 'function') return;
    window.__fdNavPatched = true;
    var orig = window.updateNavState;
    window.updateNavState = function () {
      orig.apply(this, arguments);
      applyFiloNavMask();
      syncNavGroups(getActiveSectionForGroups());
    };
  }
  function initFdNav() {
    if (!isFiloNavApp()) return;
    patchUpdateNavState();
    applyFiloNavMask();
  }
  window.fdApplyFiloNavMask = applyFiloNavMask;
  window.fdSyncNavGroups = syncNavGroups;
  window.fdInitNavGroups = fdInitNavGroups;
  window.fdSectionToNavGroup = sectionToGroup;
  window.fdInitNav = initFdNav;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFdNav);
  } else {
    initFdNav();
  }
})();
(function () {
  'use strict';
  function isFiloHr() {
    if (document.documentElement.classList.contains('a2w-shell')) return false;
    try {
      if (window.__2WALLET_PRODUCT_LOCK__ === 'hr') return true;
    } catch (_) {}
    if (document.documentElement.getAttribute('data-app') === 'filodiretto') return true;
    return typeof window.isHrDashboard === 'function' && window.isHrDashboard();
  }
  function applyTemplatesSubtitle() {
    var section = document.getElementById('templates');
    if (!section || section.querySelector('[data-fd-templates-lead]')) return;
    if (typeof window.enhancePageHeaders === 'function') window.enhancePageHeaders();
    var lead = document.createElement('p');
    lead.className = 'page-header__desc';
    lead.setAttribute('data-fd-templates-lead', '1');
    lead.textContent = 'Crea e gestisci i layout dei pass Wallet per i tuoi dipendenti.';
    var main = section.querySelector('header.page-header .page-header__main');
    if (main) {
      main.appendChild(lead);
      return;
    }
    var h1 = section.querySelector('h1');
    if (h1) h1.insertAdjacentElement('afterend', lead);
  }
  function applyLeadsChrome() {
    if (!isFiloHr()) return;
    var add = document.getElementById('a2wContactsAddBtn');
    if (add) {
      add.textContent = '＋ Aggiungi dipendente';
      add.setAttribute('aria-label', 'Aggiungi dipendente');
    }
    var imp = document.getElementById('a2wContactsImportBtn');
    if (imp) {
      imp.textContent = 'Importa dipendenti';
      imp.setAttribute('aria-label', 'Importa dipendenti da CSV o Excel');
    }
    var pageMenu = document.getElementById('contactsPageMenuBtn');
    if (pageMenu) pageMenu.setAttribute('aria-label', 'Menu pagina Dipendenti');
    var cardTitle = document.getElementById('contactsCardATitle');
    if (cardTitle) cardTitle.textContent = 'Anagrafica dipendenti';
  }
  function patchMenuCopy() {
    if (!isFiloHr() || window.__fdHrCopyPatched) return;
    window.__fdHrCopyPatched = true;
    var orig = window.applyProductMenuCopy;
    if (typeof orig !== 'function') return;
    window.applyProductMenuCopy = function (line) {
      orig.call(this, line);
      if (line === 'hr' || isFiloHr()) applyLeadsChrome();
    };
  }
  function patchNav() {
    if (!isFiloHr()) return;
    var origNav = window.nav;
    if (typeof origNav !== 'function' || window.__fdHrCopyNav) return;
    window.__fdHrCopyNav = true;
    window.nav = function (id) {
      var r = origNav.apply(this, arguments);
      var done = function () {
        if (id === 'leads') applyLeadsChrome();
        if (id === 'templates') applyTemplatesSubtitle();
      };
      if (r && typeof r.then === 'function') return r.then(done);
      setTimeout(done, 0);
      return r;
    };
  }
  function boot() {
    if (!isFiloHr()) return;
    patchMenuCopy();
    patchNav();
    applyLeadsChrome();
    applyTemplatesSubtitle();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
(function () {
  'use strict';
  function isFilo() {
    return document.documentElement.getAttribute('data-app') === 'filodiretto';
  }
  function isHr() {
    return typeof isHrDashboard === 'function' && isHrDashboard();
  }
  function applyBrandIdentityScope() {
    if (!isFilo() || !isHr()) return;
    var page = document.querySelector('#brand-identity .a2w-bi-page');
    if (!page) return;
    var layout = page.querySelector('.a2w-bi-layout');
    if (layout) layout.classList.add('a2w-bi-layout--brand-only');
    var taglineGroup = document.getElementById('biTagline');
    if (taglineGroup && taglineGroup.closest('.form-group')) {
      taglineGroup.closest('.form-group').classList.add('a2w-bi-field--pass-only');
    }
    page.querySelectorAll('.a2w-bi-section').forEach(function (section) {
      var h2 = section.querySelector('.a2w-bi-section__head h2');
      if (h2 && /logo e immagini/i.test(h2.textContent || '')) {
        section.classList.add('a2w-bi-section--pass-assets');
      }
    });
    var subtitle = page.querySelector('.a2w-bi-subtitle');
    if (subtitle) {
      subtitle.textContent =
        'Nome, slug, lingua e contatti aziendali. Logo, strip e testi del pass si configurano in Template Pass.';
    }
    if (!page.querySelector('.fd-brand-scope-hint')) {
      var hint = document.createElement('p');
      hint.className = 'fd-brand-scope-hint';
      hint.innerHTML =
        'Le immagini e i testi del pass dipendente non si impostano qui. Vai su ' +
        '<a href="#" data-fd-nav="templates">Template Pass</a> per layout, strip, logo pass e header.';
      hint.querySelector('a')?.addEventListener('click', function (e) {
        e.preventDefault();
        if (typeof nav === 'function') nav('templates');
      });
      var header = page.querySelector('.a2w-bi-header');
      if (header && header.nextElementSibling) {
        header.parentNode.insertBefore(hint, header.nextElementSibling);
      } else if (header) {
        header.after(hint);
      }
    }
    var contactsHead = page.querySelector('.a2w-bi-section .a2w-bi-section__head p');
    page.querySelectorAll('.a2w-bi-section').forEach(function (section) {
      var h2 = section.querySelector('h2');
      if (h2 && /contatti pubblici/i.test(h2.textContent || '')) {
        var p = section.querySelector('.a2w-bi-section__head p');
        if (p) {
          p.textContent =
            'Contatti HR e aziendali usati su landing, comunicazioni e retro del pass (se il template non li sovrascrive).';
        }
      }
    });
  }
  function applyTemplateScope() {
    if (!isFilo() || !isHr()) return;
    var editor = document.getElementById('hrPassBackEditor');
    if (!editor) return;
    var modal = document.getElementById('templateModal');
    if (modal && !modal.querySelector('.fd-template-brand-contacts-note')) {
      var note = document.createElement('p');
      note.className = 'fd-template-brand-contacts-note';
      note.textContent =
        'People Operations, DPO ed emergenze si gestiscono in Identità Brand. Qui configuri solo link fisso e contenuti specifici del pass.';
      if (editor.parentNode) editor.parentNode.insertBefore(note, editor);
    }
  }
  function boot() {
    applyBrandIdentityScope();
    applyTemplateScope();
  }
  function wrapTemplateHooks() {
    var origNav = window.nav;
    if (typeof origNav === 'function' && !window.__fdBrandScopeNav) {
      window.__fdBrandScopeNav = true;
      window.nav = function fdBrandScopeNav(id) {
        var p = origNav.apply(this, arguments);
        if (p && typeof p.then === 'function') {
          return p.then(function () {
            if (id === 'brand-identity' || id === 'templates') boot();
          });
        }
        if (id === 'brand-identity' || id === 'templates') setTimeout(boot, 0);
        return p;
      };
    }
    var origOpen = window.openTemplateModal;
    if (typeof origOpen === 'function' && !window.__fdBrandScopeTpl) {
      window.__fdBrandScopeTpl = true;
      window.openTemplateModal = function () {
        var r = origOpen.apply(this, arguments);
        if (r && typeof r.then === 'function') return r.then(function () { applyTemplateScope(); });
        setTimeout(applyTemplateScope, 0);
        return r;
      };
    }
    var origEdit = window.editTemplate;
    if (typeof origEdit === 'function' && !window.__fdBrandScopeEditTpl) {
      window.__fdBrandScopeEditTpl = true;
      window.editTemplate = function () {
        var r = origEdit.apply(this, arguments);
        if (r && typeof r.then === 'function') return r.then(function () { applyTemplateScope(); });
        setTimeout(applyTemplateScope, 0);
        return r;
      };
    }
  }
  function bootAll() {
    boot();
    wrapTemplateHooks();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootAll);
  } else {
    bootAll();
  }
  window.addEventListener('load', bootAll);
})();
(function () {
  'use strict';
  function injectFiloWelcomeCriticalCss() {
    var isFilo = document.documentElement.getAttribute('data-app') === 'filodiretto';
    if (!isFilo) {
      try { isFilo = window.__2WALLET_PRODUCT_LOCK__ === 'hr'; } catch (_) {}
    }
    if (!isFilo || document.getElementById('fdHomeWelcomeCritical')) return;
    var el = document.createElement('style');
    el.id = 'fdHomeWelcomeCritical';
    el.textContent =
      "html[data-app='filodiretto'] #welcome .page-lead," +
      "html[data-app='filodiretto'] #welcome .fd-welcome-legacy{display:none!important}";
    (document.head || document.documentElement).appendChild(el);
  }
  injectFiloWelcomeCriticalCss();
  var EVENT_LABELS = {
    signup: 'Iscrizione',
    pass_created: 'Pass creato',
    pass_download: 'Download pass',
    pass_install: 'Installazione Wallet',
    points_added: 'Punti aggiunti',
    points_redeemed: 'Punti riscattati',
    push_sent: 'Push inviata',
    reward_claimed: 'Premio riscattato',
    challenge_completed: 'Challenge completata',
    tier_upgrade: 'Upgrade tier',
    email_sent: 'Email inviata',
    google_wallet_save: 'Salvataggio Google Wallet',
    samsung_wallet_save: 'Salvataggio Samsung Wallet'
  };
  function isFiloHomeApp() {
    if (document.documentElement.classList.contains('a2w-shell')) return false;
    try {
      if (window.__2WALLET_PRODUCT_LOCK__ === 'hr') return true;
    } catch (_) {}
    return document.documentElement.getAttribute('data-app') === 'filodiretto';
  }
  function esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function getApiBase() {
    if (typeof window.API === 'string' && window.API) return window.API;
    return '/api/v1';
  }
  function authHeaders() {
    if (typeof window.getAuthHeaders === 'function') return window.getAuthHeaders();
    var t = '';
    try { t = localStorage.getItem('a2w_token') || ''; } catch (_) {}
    return t ? { Authorization: 'Bearer ' + t } : {};
  }
  function isValidBrandId(value) {
    if (value == null) return false;
    var id = String(value).trim();
    return !!(id && id !== 'undefined' && id !== 'null');
  }
  function getBrandId() {
    var candidates = [];
    try {
      if (window.brandId) candidates.push(window.brandId);
    } catch (_) {}
    var sel = document.getElementById('brandSelector');
    if (sel && sel.value) candidates.push(sel.value);
    try {
      var qp = new URLSearchParams(window.location.search || '').get('brand_id');
      if (qp) candidates.push(qp);
    } catch (_) {}
    for (var i = 0; i < candidates.length; i++) {
      var id = String(candidates[i]).trim();
      if (isValidBrandId(id)) return id;
    }
    return null;
  }
  function getBrandName() {
    try {
      if (window.currentBrandName) return window.currentBrandName;
    } catch (_) {}
    var sel = document.getElementById('brandSelector');
    if (!sel || !sel.value) return '';
    return sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].textContent : '';
  }
  async function fetchJson(url) {
    if (typeof window.fetchCachedJson === 'function') {
      return window.fetchCachedJson(url, { headers: authHeaders() });
    }
    var res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) {
      var err = {};
      try { err = await res.json(); } catch (_) {}
      throw new Error(err.error || res.statusText || String(res.status));
    }
    return res.json();
  }
  function ensureMount() {
    var welcome = document.getElementById('welcome');
    if (!welcome) return null;
    welcome.classList.add('welcome--fd-home');
    var root = document.getElementById('fdHomeRoot');
    if (!root) {
      root = document.createElement('div');
      root.id = 'fdHomeRoot';
      root.className = 'fd-home-root';
      root.setAttribute('role', 'region');
      root.setAttribute('aria-label', 'Home operativa');
      var lead = welcome.querySelector('.page-lead');
      if (lead && lead.parentNode) lead.parentNode.insertBefore(root, lead.nextSibling);
      else welcome.appendChild(root);
    }
    root.hidden = false;
    return root;
  }
  function setHomeState(welcome, state) {
    if (!welcome) return;
    var next = state || 'no-brand';
    welcome.setAttribute('data-fd-home-state', next);
    var root = document.getElementById('fdHomeRoot');
    if (root) {
      root.classList.remove(
        'fd-home-root--setup',
        'fd-home-root--operational',
        'fd-home-root--no-brand',
        'fd-home-root--loading',
        'fd-home-root--error'
      );
      if (next === 'setup') root.classList.add('fd-home-root--setup');
      else if (next === 'operational') root.classList.add('fd-home-root--operational');
      else if (next === 'loading') root.classList.add('fd-home-root--loading');
      else if (next === 'error') root.classList.add('fd-home-root--error');
      else root.classList.add('fd-home-root--no-brand');
    }
  }
  function renderLoading(root) {
    var welcome = document.getElementById('welcome');
    setHomeState(welcome, 'loading');
    root.innerHTML =
      '<div class="fd-home-loading" aria-live="polite" aria-busy="true">' +
      '<p class="fd-home-empty">Caricamento dati brand…</p>' +
      '</div>';
  }
  function buildHomeContext(data) {
    var a = data.analytics || {};
    var apple = a.appleDeviceCount != null ? a.appleDeviceCount : (a.deviceCount || 0);
    var google = a.googleWalletSavedCount || 0;
    var samsung = a.samsungWalletSavedCount || 0;
    var walletInstalls = apple + google + samsung;
    return {
      hasBrandIdentity: data.hasBrandIdentity,
      templateCount: data.templateCount,
      employeeCount: data.employeeCount,
      employeesWithPass: data.employeesWithPass,
      pushCount: data.pushCount,
      walletInstalls: walletInstalls,
      totalPasses: a.totalPasses || 0,
      apple: apple,
      google: google,
      samsung: samsung
    };
  }
  function getOnboardingProgress(ctx) {
    var steps = onboardingSteps();
    var doneCount = 0;
    var nextStep = null;
    steps.forEach(function (step) {
      var done = step.done(ctx);
      if (done) doneCount += 1;
      else if (!nextStep) nextStep = step;
    });
    return {
      steps: steps,
      doneCount: doneCount,
      total: steps.length,
      nextStep: nextStep,
      isOperational: doneCount === steps.length
    };
  }
  function renderNoBrand(root) {
    setHomeState(document.getElementById('welcome'), 'no-brand');
    root.innerHTML =
      '<header class="fd-home-hero fd-home-hero--no-brand">' +
      '<p class="fd-home-hero__eyebrow">Inizio</p>' +
      '<h2 class="fd-home-hero__title">Scegli un brand per iniziare</h2>' +
      '<p class="fd-home-hero__desc">Seleziona un brand dall’header o creane uno nuovo per vedere KPI, setup e attività.</p>' +
      '</header>' +
      '<div class="fd-home-primary">' +
      '<p class="fd-home-primary__label">Azione consigliata</p>' +
      '<button type="button" class="btn" data-fd-nav="brand-identity">Crea o seleziona brand</button>' +
      '</div>';
    bindNavButtons(root);
  }
  function bindNavButtons(container) {
    container.querySelectorAll('[data-fd-nav]').forEach(function (btn) {
      if (btn.dataset.fdBound === '1') return;
      btn.dataset.fdBound = '1';
      btn.addEventListener('click', function (e) {
        var id = btn.getAttribute('data-fd-nav');
        if (document.body.classList.contains('fd-wai-open') && typeof window.fdNavigateFromWai === 'function') {
          window.fdNavigateFromWai(btn, e);
          return;
        }
        if (typeof window.nav === 'function') window.nav(id);
      });
    });
  }
  function onboardingSteps() {
    return [
      {
        id: 'identity',
        label: 'Dati azienda',
        desc: 'Nome, slug, contatti HR e DPO',
        section: 'brand-identity',
        done: function (ctx) { return !!ctx.hasBrandIdentity; }
      },
      {
        id: 'template',
        label: 'Template pass dipendente',
        desc: 'Logo, strip e testi del pass Wallet',
        section: 'templates',
        done: function (ctx) { return ctx.templateCount > 0; }
      },
      {
        id: 'employees',
        label: 'Dipendenti',
        desc: 'Importa o aggiungi anagrafica',
        section: 'leads',
        done: function (ctx) { return ctx.employeeCount > 0; }
      },
      {
        id: 'push',
        label: 'Prima notifica push',
        desc: 'Comunica con chi ha il pass in Wallet',
        section: 'push',
        done: function (ctx) { return ctx.pushCount > 0; }
      },
      {
        id: 'install',
        label: 'Pass installati in Wallet',
        desc: 'Almeno un dipendente con pass attivo su dispositivo',
        section: 'passes',
        done: function (ctx) { return ctx.walletInstalls > 0; }
      }
    ];
  }
  function renderOnboarding(ctx, options) {
    var opts = options || {};
    var progress = getOnboardingProgress(ctx);
    var steps = progress.steps;
    var doneCount = progress.doneCount;
    var items = steps.map(function (step) {
      var done = step.done(ctx);
      return (
        '<li class="fd-onboarding-item' + (done ? ' fd-onboarding-item--done' : '') + '">' +
        '<span class="fd-onboarding-item__check" aria-hidden="true">' + (done ? '✓' : '') + '</span>' +
        '<div class="fd-onboarding-item__body">' +
        '<div class="fd-onboarding-item__label">' + esc(step.label) + '</div>' +
        '<div class="fd-onboarding-item__desc">' + esc(step.desc) + '</div>' +
        '</div>' +
        (done ? '' : '<button type="button" class="fd-onboarding-item__action" data-fd-nav="' + esc(step.section) + '">Vai →</button>') +
        '</li>'
      );
    }).join('');
    var compactClass = opts.compact ? ' fd-home-card--compact' : ' fd-home-card--primary';
    var title = opts.compact ? 'Configurazione' : 'Setup guidato';
    var intro = opts.compact
      ? 'Tutti i passaggi sono completati.'
      : 'Completa questi passaggi per rendere il brand pienamente operativo.';
    return (
      '<div class="fd-home-card fd-home-onboarding' + compactClass + '">' +
      '<h2 class="fd-home-card__title">' + esc(title) + '</h2>' +
      '<p class="fd-home-progress" aria-live="polite">' + doneCount + ' di ' + steps.length + ' completati</p>' +
      '<p class="fd-home-card__intro">' + esc(intro) + '</p>' +
      '<ul class="fd-onboarding-list' + (opts.compact ? ' fd-onboarding-list--compact' : '') + '">' + items + '</ul>' +
      '</div>'
    );
  }
  function renderKpiGrid(ctx, compact) {
    var gridClass = 'fd-home-kpi-grid' + (compact ? ' fd-home-kpi-grid--compact' : ' fd-home-kpi-grid--primary');
    return (
      '<div class="' + gridClass + '">' +
      '<div class="fd-home-kpi"><div class="fd-home-kpi__label">Pass totali</div><div class="fd-home-kpi__value">' + esc(ctx.totalPasses) + '</div></div>' +
      '<div class="fd-home-kpi"><div class="fd-home-kpi__label">Install Wallet</div><div class="fd-home-kpi__value">' + esc(ctx.walletInstalls) + '</div>' +
      '<div class="fd-home-kpi__hint">Apple ' + esc(ctx.apple) + ' · Google ' + esc(ctx.google) + ' · Samsung ' + esc(ctx.samsung) + '</div></div>' +
      '<div class="fd-home-kpi"><div class="fd-home-kpi__label">Dipendenti</div><div class="fd-home-kpi__value">' + esc(ctx.employeeCount) + '</div>' +
      '<div class="fd-home-kpi__hint">Con pass: ' + esc(ctx.employeesWithPass) + '</div></div>' +
      '<div class="fd-home-kpi"><div class="fd-home-kpi__label">Push inviate</div><div class="fd-home-kpi__value">' + esc(ctx.pushCount) + '</div></div>' +
      '</div>'
    );
  }
  function renderQuickActions(primarySection, secondarySections) {
    var secondary = (secondarySections || []).map(function (id) {
      var labels = {
        leads: 'Dipendenti',
        push: 'Push',
        analytics: 'Analytics',
        templates: 'Template pass',
        passes: 'Pass emessi',
        'brand-identity': 'Dati azienda'
      };
      return '<button type="button" class="btn sec small" data-fd-nav="' + esc(id) + '">' + esc(labels[id] || id) + '</button>';
    }).join('');
    return (
      '<div class="fd-home-quick">' +
      '<p class="fd-home-quick__label">Collegamenti rapidi</p>' +
      '<div class="fd-home-quick__actions">' + secondary + '</div>' +
      '</div>'
    );
  }
  function renderPrimaryAction(progress, brandName) {
    var step = progress.nextStep;
    if (!step) {
      return (
        '<div class="fd-home-primary fd-home-primary--done">' +
        '<p class="fd-home-primary__label">Stato brand</p>' +
        '<h3 class="fd-home-primary__title">Configurazione completata</h3>' +
        '<p class="fd-home-primary__desc">' + esc(brandName) + ' è operativo. Monitora KPI e invia comunicazioni ai dipendenti.</p>' +
        '<button type="button" class="btn" data-fd-nav="push">Invia una push</button>' +
        '</div>'
      );
    }
    return (
      '<div class="fd-home-primary">' +
      '<p class="fd-home-primary__label">Prossimo passo</p>' +
      '<h3 class="fd-home-primary__title">' + esc(step.label) + '</h3>' +
      '<p class="fd-home-primary__desc">' + esc(step.desc) + '</p>' +
      '<button type="button" class="btn" data-fd-nav="' + esc(step.section) + '">Continua setup →</button>' +
      '</div>'
    );
  }
  function formatEventType(type) {
    if (!type) return 'Evento';
    return EVENT_LABELS[type] || type.replace(/_/g, ' ');
  }
  function renderActivity(events) {
    if (!events.length) {
      return (
        '<div class="fd-home-card">' +
        '<h2 class="fd-home-card__title">Ultime attività</h2>' +
        '<p class="fd-home-empty">Nessuna attività registrata. Gli eventi su pass e notifiche compariranno qui.</p>' +
        '<button type="button" class="btn sec small" style="margin-top:10px" data-fd-nav="activity-log">Apri log completo</button>' +
        '</div>'
      );
    }
    var list = events.slice(0, 5).map(function (ev) {
      var when = ev.created_at ? new Date(ev.created_at).toLocaleString('it-IT') : '—';
      var meta = '';
      if (ev.metadata && typeof ev.metadata === 'object') {
        try { meta = JSON.stringify(ev.metadata); } catch (_) { meta = ''; }
      } else if (ev.metadata) meta = String(ev.metadata);
      if (meta.length > 120) meta = meta.slice(0, 117) + '…';
      return (
        '<li class="fd-home-activity-item">' +
        '<time datetime="' + esc(ev.created_at || '') + '">' + esc(when) + '</time>' +
        '<span class="fd-act-type">' + esc(formatEventType(ev.event_type)) + '</span>' +
        '<span class="fd-act-meta">' + esc(meta || '—') + '</span>' +
        '</li>'
      );
    }).join('');
    return (
      '<div class="fd-home-card">' +
      '<h2 class="fd-home-card__title">Ultime attività</h2>' +
      '<ul class="fd-home-activity-list">' + list + '</ul>' +
      '<button type="button" class="btn sec small" style="margin-top:12px" data-fd-nav="activity-log">Vedi tutto</button>' +
      '</div>'
    );
  }
  function renderBrandHome(root, data) {
    var brandName = getBrandName() || 'Brand';
    var ctx = buildHomeContext(data);
    var progress = getOnboardingProgress(ctx);
    var welcome = document.getElementById('welcome');
    var isOperational = progress.isOperational;
    setHomeState(welcome, isOperational ? 'operational' : 'setup');
    if (isOperational) {
      root.innerHTML =
        '<header class="fd-home-hero fd-home-hero--operational">' +
        '<div class="fd-home-hero__head">' +
        '<p class="fd-home-hero__eyebrow">Brand operativo</p>' +
        '<h2 class="fd-home-hero__title">' + esc(brandName) + '</h2>' +
        '</div>' +
        '<span class="fd-home-status fd-home-status--ok">Operativo</span>' +
        '</header>' +
        renderPrimaryAction(progress, brandName) +
        renderKpiGrid(ctx, false) +
        renderQuickActions(null, ['leads', 'push', 'analytics']) +
        '<div class="fd-home-grid-2 fd-home-grid-2--operational">' +
        renderOnboarding(ctx, { compact: true }) +
        renderActivity(data.events || []) +
        '</div>';
    } else {
      root.innerHTML =
        '<header class="fd-home-hero fd-home-hero--setup">' +
        '<div class="fd-home-hero__head">' +
        '<p class="fd-home-hero__eyebrow">Configurazione in corso</p>' +
        '<h2 class="fd-home-hero__title">' + esc(brandName) + '</h2>' +
        '</div>' +
        '<span class="fd-home-status fd-home-status--setup">' + esc(progress.doneCount) + '/' + esc(progress.total) + '</span>' +
        '</header>' +
        renderPrimaryAction(progress, brandName) +
        '<div class="fd-home-layout-setup">' +
        renderOnboarding(ctx, { compact: false }) +
        '<aside class="fd-home-aside">' +
        renderKpiGrid(ctx, true) +
        renderActivity(data.events || []) +
        '</aside>' +
        '</div>' +
        renderQuickActions(null, ['brand-identity', 'templates', 'leads']);
    }
    bindNavButtons(root);
  }
  function brandHasIdentity(brand) {
    if (!brand) return false;
    var c = brand.config || {};
    var logos = c.logos || {};
    if (logos.logo || logos.wallet_icon || brand.logo_url) return true;
    if (brand.name && brand.slug) return true;
    return false;
  }
  async function loadHomeData(bid) {
    var api = getApiBase();
    var h = authHeaders();
    var results = await Promise.all([
      fetchJson(api + '/analytics/' + bid).catch(function () { return {}; }),
      (typeof window.fetchBrandById === 'function'
        ? window.fetchBrandById(bid)
        : fetchJson(api + '/brands/' + bid)).catch(function () { return null; }),
      fetchJson(api + '/templates?brand_id=' + encodeURIComponent(bid)).catch(function () { return []; }),
      fetchJson(api + '/brands/' + bid + '/employees').catch(function () { return { employees: [], total_employees: 0, with_pass: 0 }; }),
      fetchJson(api + '/push/history?brand_id=' + encodeURIComponent(bid)).catch(function () { return []; }),
      fetchJson(api + '/events/' + bid + '?limit=8').catch(function () { return []; })
    ]);
    var analytics = results[0] || {};
    var brand = results[1];
    var templates = Array.isArray(results[2]) ? results[2] : [];
    var empPayload = results[3] || {};
    var employees = empPayload.employees || [];
    var pushes = Array.isArray(results[4]) ? results[4] : [];
    var events = Array.isArray(results[5]) ? results[5] : [];
    return {
      analytics: analytics,
      hasBrandIdentity: brandHasIdentity(brand),
      templateCount: templates.length,
      employeeCount: empPayload.total_employees != null ? empPayload.total_employees : employees.length,
      employeesWithPass: empPayload.with_pass != null ? empPayload.with_pass : employees.filter(function (e) { return e.pass_id; }).length,
      pushCount: pushes.length,
      events: events,
      walletInstalls: (analytics.appleDeviceCount || analytics.deviceCount || 0) +
        (analytics.googleWalletSavedCount || 0) +
        (analytics.samsungWalletSavedCount || 0)
    };
  }
  var homeLoadInflight = null;
  async function fdLoadHome() {
    if (!isFiloHomeApp()) return;
    if (homeLoadInflight) return homeLoadInflight;
    homeLoadInflight = (async function () {
      var welcome = document.getElementById('welcome');
      var root = ensureMount();
      if (!root) return;
      var bid = getBrandId();
      if (!bid) {
        renderNoBrand(root);
        return;
      }
      renderLoading(root);
      try {
        var data = await loadHomeData(bid);
        renderBrandHome(root, data);
      } catch (e) {
        setHomeState(welcome, 'error');
        root.innerHTML =
          '<div class="fd-home-loading" aria-live="polite">' +
          '<p class="fd-home-empty">Errore caricamento home: ' + esc(e.message) + '</p>' +
          '<button type="button" class="btn sec small" style="margin-top:10px" id="fdHomeRetryBtn">Riprova</button>' +
          '</div>';
        var retry = document.getElementById('fdHomeRetryBtn');
        if (retry && retry.dataset.fdBound !== '1') {
          retry.dataset.fdBound = '1';
          retry.addEventListener('click', function () { fdLoadHome(); });
        }
      }
    })().finally(function () {
      homeLoadInflight = null;
    });
    return homeLoadInflight;
  }
  window.fdLoadHome = fdLoadHome;
  window.isFiloOperationalHome = isFiloHomeApp;
  window.fdIsFiloOperationalHome = isFiloHomeApp;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (isFiloHomeApp() && document.getElementById('welcome') && document.getElementById('welcome').classList.contains('active')) {
        fdLoadHome();
      }
    });
  }
})();
(function () {
  'use strict';
  var openMenuId = null;
  function isFiloUsersApp() {
    if (document.documentElement.classList.contains('a2w-shell')) return false;
    try {
      if (window.__2WALLET_PRODUCT_LOCK__ === 'hr') return true;
    } catch (_) {}
    return document.documentElement.getAttribute('data-app') === 'filodiretto';
  }
  function esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function getApiBase() {
    if (typeof window.API === 'string' && window.API) return window.API;
    return '/api/v1';
  }
  function authHeaders() {
    if (typeof window.getAuthHeaders === 'function') return window.getAuthHeaders();
    return {};
  }
  function toast(msg) {
    if (typeof window.toast === 'function') window.toast(msg);
  }
  function closeAllMenus() {
    document.querySelectorAll('.fd-users-kebab-menu').forEach(function (m) {
      m.hidden = true;
      m.classList.remove('fd-floating-menu-panel');
    });
    document.querySelectorAll('.fd-users-kebab').forEach(function (b) {
      b.setAttribute('aria-expanded', 'false');
    });
    openMenuId = null;
  }
  function ensureDismissBound() {
    if (document.body.dataset.fdUsersMenuBound === '1') return;
    document.body.dataset.fdUsersMenuBound = '1';
    document.addEventListener('click', closeAllMenus);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAllMenus();
    });
  }
  function copyText(text) {
    var value = String(text || '');
    if (!value) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(function () {
        toast('ID copiato');
      }).catch(function () {
        toast('Copia non riuscita');
      });
      return;
    }
    toast('Copia non supportata dal browser');
  }
  function ensureCreateUserButton() {
    var btn = document.getElementById('createUserBtn');
    if (!btn) return;
    var isAdmin = document.body.classList.contains('role-admin');
    btn.style.display = isAdmin ? '' : 'none';
    btn.classList.add('fd-btn-primary');
  }
  function ensureUsersChrome() {
    var section = document.getElementById('users');
    if (!section) return;
    if (!section.classList.contains('users--fd')) {
      section.classList.add('users--fd');
    }
    ensureCreateUserButton();
    if (section.classList.contains('fd-users-chrome-ready')) return;
    section.classList.add('fd-users-chrome-ready');
    var legacyToolbar = section.querySelector(':scope > div[style*="justify-content"]');
    if (legacyToolbar && !section.querySelector('.fd-users-toolbar')) {
      legacyToolbar.classList.add('fd-users-toolbar');
      var lead = legacyToolbar.querySelector('p');
      if (lead) lead.classList.add('fd-users-lead');
    }
    var table = document.getElementById('usersTable');
    if (table && !table.closest('.fd-users-table-wrap')) {
      var wrap = document.createElement('div');
      wrap.className = 'fd-users-table-wrap';
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
    }
    var actionsTh = table && table.querySelector('thead th:last-child');
    if (actionsTh) actionsTh.textContent = '';
    if (actionsTh) actionsTh.setAttribute('aria-label', 'Azioni');
  }
  async function loadBrandMap() {
    var map = {};
    var cache = [];
    try {
      cache = window.brandsListCache || [];
    } catch (_) {}
    cache.forEach(function (b) {
      if (b && b.id) map[String(b.id)] = b.name || b.slug || String(b.id);
    });
    var sel = document.getElementById('brandSelector');
    if (sel) {
      Array.from(sel.options || []).forEach(function (o) {
        if (!o.value) return;
        var label = String(o.textContent || '').trim();
        if (label) map[String(o.value)] = label;
      });
    }
    if (Object.keys(map).length) return map;
    try {
      var res = await fetch(getApiBase() + '/brands', { headers: authHeaders() });
      if (!res.ok) return map;
      var brands = await res.json();
      (brands || []).forEach(function (b) {
        if (b && b.id) map[String(b.id)] = b.name || b.slug || String(b.id);
      });
    } catch (_) {}
    return map;
  }
  function normalizeUserRole(role) {
    var r = String(role || 'manager').toLowerCase();
    if (r === 'viewer') return 'reporter';
    return r;
  }
  function roleLabel(role) {
    var r = normalizeUserRole(role);
    return {
      admin: 'Admin',
      manager: 'Manager',
      sender: 'Sender',
      reporter: 'Reporter',
      viewer: 'Reporter'
    }[r] || role;
  }
  function roleBadgeClass(role) {
    var r = normalizeUserRole(role);
    if (r === 'admin') return 'active';
    if (r === 'manager' || r === 'sender') return 'inactive';
    return 'inactive';
  }
  function renderBrandCell(u, brandMap) {
    if (!u.brand_id) {
      return '<td class="fd-users-brand"><span class="fd-users-brand__name">Tutti i brand</span></td>';
    }
    var id = String(u.brand_id);
    var name = brandMap[id];
    if (!name) {
      return (
        '<td class="fd-users-brand">' +
        '<span class="fd-users-brand__name fd-users-brand__name--unknown" title="ID: ' + esc(id) + '">Brand non disponibile</span>' +
        '</td>'
      );
    }
    return (
      '<td class="fd-users-brand">' +
      '<span class="fd-users-brand__name">' + esc(name) + '</span>' +
      '<span class="fd-users-brand__id-row">' +
      '<code class="fd-users-brand__id" title="' + esc(id) + '">' + esc(id.slice(0, 8)) + '…</code>' +
      '<button type="button" class="fd-users-copy" data-copy-id="' + esc(id) + '" aria-label="Copia ID brand" title="Copia ID brand">⧉</button>' +
      '</span></td>'
    );
  }
  function renderActionsCell(u, protectedAdmin) {
    var menuId = 'fd-users-menu-' + u.id;
    var items = '<button type="button" class="fd-users-kebab-item" data-action="resend" data-user-id="' + esc(u.id) + '">Reinvia mail</button>';
    if (!protectedAdmin) {
      items += '<button type="button" class="fd-users-kebab-item fd-users-kebab-item--danger" data-action="delete" data-user-id="' + esc(u.id) + '">Elimina</button>';
    }
    return (
      '<td><div class="fd-users-kebab-wrap">' +
      '<button type="button" class="fd-users-kebab" aria-label="Azioni utente" aria-haspopup="menu" aria-expanded="false" data-menu-trigger="' + esc(menuId) + '">⋮</button>' +
      '<div class="fd-users-kebab-menu" id="' + esc(menuId) + '" role="menu" hidden>' + items + '</div>' +
      '</div></td>'
    );
  }
  function bindTableInteractions(tbody) {
    tbody.querySelectorAll('.fd-users-copy').forEach(function (btn) {
      if (btn.dataset.fdBound === '1') return;
      btn.dataset.fdBound = '1';
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        copyText(btn.getAttribute('data-copy-id'));
      });
    });
    tbody.querySelectorAll('.fd-users-kebab').forEach(function (btn) {
      if (btn.dataset.fdBound === '1') return;
      btn.dataset.fdBound = '1';
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var menuId = btn.getAttribute('data-menu-trigger');
        var menu = document.getElementById(menuId);
        if (!menu) return;
        var willOpen = menu.hidden;
        closeAllMenus();
        if (willOpen) {
          btn.setAttribute('aria-expanded', 'true');
          openMenuId = menuId;
          if (typeof window.fdPositionFloatingMenu === 'function') {
            window.fdPositionFloatingMenu(btn, menu);
          } else {
            menu.hidden = false;
          }
        }
      });
    });
    tbody.querySelectorAll('.fd-users-kebab-item').forEach(function (item) {
      if (item.dataset.fdBound === '1') return;
      item.dataset.fdBound = '1';
      item.addEventListener('click', function (e) {
        e.stopPropagation();
        closeAllMenus();
        var uid = item.getAttribute('data-user-id');
        var action = item.getAttribute('data-action');
        if (action === 'resend' && typeof window.resendInvite === 'function') {
          window.resendInvite(uid);
        } else if (action === 'delete' && typeof window.deleteUser === 'function') {
          window.deleteUser(uid);
        }
      });
    });
  }
  async function fdLoadUsers() {
    if (!isFiloUsersApp()) return;
    ensureDismissBound();
    ensureUsersChrome();
    ensureCreateUserButton();
    var tbody = document.querySelector('#usersTable tbody');
    if (!tbody) return;
    if (typeof window.renderTableSkeletonRows === 'function') {
      tbody.innerHTML = window.renderTableSkeletonRows(6, 6);
    } else {
      tbody.innerHTML = '<tr><td colspan="6" style="color:var(--text2);padding:16px;">Caricamento…</td></tr>';
    }
    try {
      var res = await fetch(getApiBase() + '/users', { headers: authHeaders() });
      if (!res.ok) {
        var err = await res.json().catch(function () { return {}; });
        throw new Error(err.error || String(res.status));
      }
      var users = await res.json();
      var allowlist = typeof window.getDashboardLoginAllowlist === 'function'
        ? window.getDashboardLoginAllowlist()
        : null;
      var brandMap = await loadBrandMap();
      if (!users.length) {
        var emptyHtml = typeof window.renderEmptyState === 'function'
          ? window.renderEmptyState({
            title: 'Nessun utente',
            description: 'Crea il primo accesso alla dashboard.',
            ctaLabel: 'Nuovo utente',
            ctaOnclick: 'openCreateUserModal()',
            icon: 'users'
          })
          : '<span style="color:var(--text2)">Nessun utente</span>';
        tbody.innerHTML = '<tr><td colspan="6">' + emptyHtml + '</td></tr>';
        return;
      }
      tbody.innerHTML = users.map(function (u) {
        var protectedAdmin = allowlist && allowlist.includes(String(u.email || '').toLowerCase());
        var statusCell = protectedAdmin
          ? '<span class="fd-users-protected" title="Utente di sistema, non eliminabile">' +
            '<span class="fd-users-protected__icon" aria-hidden="true">🔒</span> Protetto</span>'
          : '<span class="badge active">Attivo</span>';
        return (
          '<tr>' +
          '<td>' + esc(u.name) + '</td>' +
          '<td>' + esc(u.email) + '</td>' +
          '<td><span class="badge fd-users-role ' + roleBadgeClass(u.role) + '">' + esc(roleLabel(u.role)) + '</span></td>' +
          renderBrandCell(u, brandMap) +
          '<td>' + statusCell + '</td>' +
          renderActionsCell(u, protectedAdmin) +
          '</tr>'
        );
      }).join('');
      bindTableInteractions(tbody);
    } catch (e) {
      toast('Errore utenti: ' + (e.message || 'caricamento fallito'));
      if (typeof window.renderTableErrorRow === 'function') {
        tbody.innerHTML = window.renderTableErrorRow(6, e.message || 'Errore caricamento utenti', 'fdLoadUsers()');
      } else {
        tbody.innerHTML = '<tr><td colspan="6" style="color:var(--red)">Errore: ' + esc(e.message) + '</td></tr>';
      }
    }
  }
  window.fdLoadUsers = fdLoadUsers;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (isFiloUsersApp()) ensureUsersChrome();
    });
  } else if (isFiloUsersApp()) {
    ensureUsersChrome();
  }
})();
(function () {
  'use strict';
  var KPI_ICONS = {
    total: '👥',
    with_employee_id: '🪪',
    with_email: '✉️',
    candidate: '📋',
    invited: '📨',
    activated: '✅',
    pass_installed: '📱'
  };
  function isFiloContactsApp() {
    if (document.documentElement.classList.contains('a2w-shell')) return false;
    try {
      if (window.__2WALLET_PRODUCT_LOCK__ === 'hr') return true;
    } catch (_) {}
    return document.documentElement.getAttribute('data-app') === 'filodiretto';
  }
  function isHrLeadsActive() {
    try {
      return !!window.leadsHrMode;
    } catch (_) {
      return false;
    }
  }
  function ensureLeadsSection() {
    var section = document.getElementById('leads');
    if (!section) return null;
    section.classList.add('leads--fd');
    return section;
  }
  function closeCardMenu() {
    var panel = document.getElementById('fdContactsCardMenuPanel');
    var trigger = document.getElementById('fdContactsCardMenuBtn');
    if (panel) panel.hidden = true;
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  }
  function ensureCardMenu() {
    var heading = document.querySelector('#contactsCardA .contacts-card__heading');
    if (!heading || document.getElementById('fdContactsCardMenu')) return;
    var wrap = document.createElement('div');
    wrap.className = 'fd-contacts-card-menu';
    wrap.id = 'fdContactsCardMenu';
    wrap.innerHTML =
      '<button type="button" class="fd-contacts-card-menu__trigger" id="fdContactsCardMenuBtn" aria-label="Azioni anagrafica" aria-haspopup="menu" aria-expanded="false">⋮</button>' +
      '<div class="fd-contacts-card-menu__panel" id="fdContactsCardMenuPanel" role="menu" hidden>' +
      '<button type="button" class="fd-contacts-card-menu__item" id="fdContactsExportBtn" role="menuitem">Esporta CSV</button>' +
      '</div>';
    heading.appendChild(wrap);
    var trigger = document.getElementById('fdContactsCardMenuBtn');
    var panel = document.getElementById('fdContactsCardMenuPanel');
    var exportItem = document.getElementById('fdContactsExportBtn');
    if (trigger && panel) {
      trigger.addEventListener('click', function (e) {
        e.stopPropagation();
        if (trigger.disabled) return;
        var open = panel.hidden;
        closeCardMenu();
        if (open) {
          panel.hidden = false;
          trigger.setAttribute('aria-expanded', 'true');
        }
      });
    }
    if (exportItem) {
      exportItem.addEventListener('click', function (e) {
        e.stopPropagation();
        closeCardMenu();
        if (exportItem.disabled) return;
        if (typeof window.exportLeadsCSV === 'function') window.exportLeadsCSV();
      });
    }
    if (document.body.dataset.fdContactsMenuBound !== '1') {
      document.body.dataset.fdContactsMenuBound = '1';
      document.addEventListener('click', closeCardMenu);
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeCardMenu();
      });
    }
  }
  function syncFiloExportMenuState() {
    if (!isFiloContactsApp() || !isHrLeadsActive()) return;
    var exportItem = document.getElementById('fdContactsExportBtn');
    var trigger = document.getElementById('fdContactsCardMenuBtn');
    if (!exportItem) return;
    var total = 0;
    var filteredLen = 0;
    try {
      total = Array.isArray(window.allLeads) ? window.allLeads.length : 0;
      if (typeof window.getFilteredLeadsByUiState === 'function') {
        filteredLen = window.getFilteredLeadsByUiState().length;
      }
    } catch (_) {}
    var disabled = total === 0 || !filteredLen;
    exportItem.disabled = disabled;
    trigger.disabled = false;
    exportItem.title = total === 0
      ? 'Nessun contatto da esportare'
      : (filteredLen ? 'Esporta contatti in CSV' : 'Nessun risultato con i filtri attivi');
  }
  function enhanceFiloKpiStrip() {
    if (!isFiloContactsApp()) return;
    var host = document.getElementById('leadsStats');
    if (!host) return;
    host.classList.add('fd-contacts-kpi');
    if (!isHrLeadsActive()) return;
    host.querySelectorAll('.contacts-kpi-strip__item').forEach(function (btn) {
      var key = btn.dataset.kpiKey;
      if (!key || btn.classList.contains('fd-contacts-kpi-item')) return;
      btn.classList.add('fd-contacts-kpi-item');
      var icon = document.createElement('span');
      icon.className = 'fd-contacts-kpi-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = KPI_ICONS[key] || '•';
      btn.insertBefore(icon, btn.firstChild);
    });
  }
  function enhanceFiloContactsToolbar() {
    if (!isFiloContactsApp() || !isHrLeadsActive()) return;
    ensureCardMenu();
    syncFiloExportMenuState();
  }
  function patchLeadsRenderers() {
    if (window.__fdContactsPatched) return;
    window.__fdContactsPatched = true;
    var origKpi = window.renderLeadsKpiStrip;
    if (typeof origKpi === 'function') {
      window.renderLeadsKpiStrip = function () {
        origKpi.apply(this, arguments);
        if (isFiloContactsApp()) enhanceFiloKpiStrip();
      };
    }
    var origToolbar = window.renderLeadsToolbar;
    if (typeof origToolbar === 'function') {
      window.renderLeadsToolbar = function () {
        origToolbar.apply(this, arguments);
        if (isFiloContactsApp()) enhanceFiloContactsToolbar();
      };
    }
    var origSyncExport = window.syncA2wLeadsExportButtonState;
    if (typeof origSyncExport === 'function') {
      window.syncA2wLeadsExportButtonState = function () {
        origSyncExport.apply(this, arguments);
        if (isFiloContactsApp()) syncFiloExportMenuState();
      };
    }
  }
  function initFdContacts() {
    if (!isFiloContactsApp()) return;
    patchLeadsRenderers();
    ensureLeadsSection();
    ensureCardMenu();
    if (isHrLeadsActive()) {
      enhanceFiloKpiStrip();
      syncFiloExportMenuState();
    }
  }
  window.fdInitContacts = initFdContacts;
  window.fdSyncContactsExport = syncFiloExportMenuState;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFdContacts);
  } else {
    initFdContacts();
  }
})();
(function () {
  'use strict';
  var selectedIds = new Set();
  var pendingDeleteAsset = null;
  function authHeaders() {
    if (typeof window.getDashboardFetchHeaders === 'function') return window.getDashboardFetchHeaders();
    if (typeof window.getAuthHeaders === 'function') return window.getAuthHeaders();
    return {};
  }
  function mediaRowsFromPayload(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.items)) return payload.items;
    if (payload && Array.isArray(payload.media)) return payload.media;
    return [];
  }
  function isValidBrandId(value) {
    if (value == null) return false;
    var id = String(value).trim();
    if (!id || id === 'undefined' || id === 'null') return false;
    return true;
  }
  function getCurrentBrandId() {
    var candidates = [];
    try {
      if (window.brandId) candidates.push(window.brandId);
    } catch (_) {}
    try {
      var sel = document.getElementById('brandSelector');
      if (sel && sel.value) candidates.push(sel.value);
    } catch (_) {}
    try {
      var qpBrandId = new URLSearchParams(window.location.search || '').get('brand_id');
      if (qpBrandId) candidates.push(qpBrandId);
    } catch (_) {}
    for (var i = 0; i < candidates.length; i++) {
      var id = String(candidates[i]).trim();
      if (isValidBrandId(id)) return id;
    }
    return '';
  }
  function syncDashboardBrandId(brandId) {
    if (!isValidBrandId(brandId)) return;
    try { window.brandId = brandId; } catch (_) {}
    if (typeof window.ensureBrandIdFromContext === 'function') {
      try { window.ensureBrandIdFromContext(); } catch (_) {}
    }
  }
  var SECTION_META = {
    logo: {
      title: 'Logo',
      hint: 'PNG trasparente, max 320×100 px — usato nel pass e in landing.',
      uploadLabel: 'Carica logo'
    },
    wallet_icon: {
      title: 'Icona notifiche Wallet',
      hint: 'Quadrata 512×512 px — compare nelle push iPhone al posto del logo orizzontale.',
      uploadLabel: 'Carica icona'
    },
    strip: {
      title: 'Strip',
      hint: '750×246 px — banner in alto sul pass; puoi avere più varianti (default, promo, evento).',
      uploadLabel: 'Carica strip'
    },
    thumbnail: {
      title: 'Thumbnail',
      hint: '90×90 px — fronte pass su layout Event Ticket.',
      uploadLabel: 'Carica thumbnail'
    },
    background: {
      title: 'Background',
      hint: '360×440 px — sfondo intero su layout Event Ticket.',
      uploadLabel: 'Carica background'
    }
  };
  function isFiloMedia() {
    if (document.documentElement.classList.contains('a2w-shell')) return false;
    try {
      if (window.__2WALLET_PRODUCT_LOCK__ === 'hr') return true;
    } catch (_) {}
    return document.documentElement.getAttribute('data-app') === 'filodiretto';
  }
  function esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function ensureUploadTypeOption() {
    var sel = document.getElementById('mediaUploadType');
    if (!sel || sel.querySelector('option[value="wallet_icon"]')) return;
    var opt = document.createElement('option');
    opt.value = 'wallet_icon';
    opt.textContent = 'Icona notifiche Wallet';
    var stripOpt = sel.querySelector('option[value="strip"]');
    if (stripOpt && stripOpt.nextSibling) sel.insertBefore(opt, stripOpt.nextSibling);
    else sel.appendChild(opt);
  }
  function openUploadForType(type) {
    if (typeof window.openMediaUpload === 'function') {
      window.openMediaUpload();
    }
    var sel = document.getElementById('mediaUploadType');
    if (sel && type) {
      sel.value = type;
      if (typeof window.onMediaUploadTypeChange === 'function') window.onMediaUploadTypeChange();
    }
  }
  window.openMediaUploadForType = openUploadForType;
  function getGlobalSearchValue() {
    var el = document.getElementById('fdMediaGlobalSearch');
    return (el && el.value ? el.value : '').trim().toLowerCase();
  }
  function applyGlobalSearchFilter() {
    var q = getGlobalSearchValue();
    document.querySelectorAll('#media-library .media-card').forEach(function (card) {
      var titleNode = card.querySelector('.media-card__title') || card.querySelector('div');
      var title = (titleNode && titleNode.textContent ? titleNode.textContent : '').trim().toLowerCase();
      card.hidden = !!q && title.indexOf(q) === -1;
    });
    document.querySelectorAll('#media-library .fd-media-section__body').forEach(function (body) {
      var cards = body.querySelectorAll('.media-card');
      var visible = Array.from(cards).some(function (c) { return !c.hidden; });
      var empty = body.querySelector('.fd-media-filter-empty');
      if (!visible && cards.length && q) {
        if (!empty) {
          empty = document.createElement('p');
          empty.className = 'fd-media-empty fd-media-filter-empty';
          body.appendChild(empty);
        }
        empty.textContent = 'Nessun asset per "' + q + '".';
      } else if (empty) {
        empty.remove();
      }
    });
  }
  function buildMediaDialogs() {
    if (document.getElementById('fdMediaSpecsDialog')) return;
    var host = document.createElement('div');
    host.innerHTML =
      '<div id="fdMediaSpecsDialog" class="fd-media-dialog" hidden>' +
      '<div class="fd-media-dialog__backdrop" data-close="specs"></div>' +
      '<div class="fd-media-dialog__panel" role="dialog" aria-modal="true" aria-labelledby="fdMediaSpecsTitle">' +
      '<h3 id="fdMediaSpecsTitle">Specifiche tecniche</h3>' +
      '<table class="fd-media-specs-table"><tbody>' +
      '<tr><th>Logo</th><td>PNG trasparente · 320×100 px · max 2MB</td></tr>' +
      '<tr><th>Icona Wallet</th><td>PNG/JPG quadrata · 512×512 px · max 2MB</td></tr>' +
      '<tr><th>Strip</th><td>PNG/JPG · 750×246 px · max 2MB</td></tr>' +
      '<tr><th>Thumbnail</th><td>PNG/JPG · 90×90 px · max 2MB</td></tr>' +
      '<tr><th>Background</th><td>PNG/JPG · 360×440 px · max 2MB</td></tr>' +
      '</tbody></table>' +
      '<div class="fd-media-dialog__actions"><button type="button" class="btn sec" data-close="specs">Chiudi</button></div>' +
      '</div></div>' +
      '<div id="fdMediaClearDialog" class="fd-media-dialog" hidden>' +
      '<div class="fd-media-dialog__backdrop" data-close="clear"></div>' +
      '<div class="fd-media-dialog__panel" role="dialog" aria-modal="true" aria-labelledby="fdMediaClearTitle">' +
      '<h3 id="fdMediaClearTitle">Svuotare la libreria?</h3>' +
      '<p>Questa azione elimina tutti gli asset del brand. Scrivi <strong>SVUOTA</strong> per confermare.</p>' +
      '<label class="form-label" for="fdMediaClearInput">Conferma</label>' +
      '<input id="fdMediaClearInput" type="text" autocomplete="off" placeholder="SVUOTA">' +
      '<div class="fd-media-dialog__actions">' +
      '<button type="button" class="btn sec" data-close="clear">Annulla</button>' +
      '<button type="button" id="fdMediaClearConfirmBtn" class="btn danger" disabled>Svuota libreria</button>' +
      '</div></div></div>';
    host.innerHTML +=
      '<div id="fdMediaAssetDeleteDialog" class="fd-media-dialog" hidden>' +
      '<div class="fd-media-dialog__backdrop" data-close="asset-delete"></div>' +
      '<div class="fd-media-dialog__panel" role="dialog" aria-modal="true" aria-labelledby="fdMediaAssetDeleteTitle">' +
      '<h3 id="fdMediaAssetDeleteTitle">Eliminare questo asset?</h3>' +
      '<p id="fdMediaAssetDeleteDesc">Questa azione non può essere annullata.</p>' +
      '<label class="form-label" for="fdMediaAssetDeleteInput">Conferma</label>' +
      '<input id="fdMediaAssetDeleteInput" type="text" autocomplete="off" placeholder="ELIMINA">' +
      '<div class="fd-media-dialog__actions">' +
      '<button type="button" class="btn sec" data-close="asset-delete">Annulla</button>' +
      '<button type="button" id="fdMediaAssetDeleteConfirmBtn" class="btn danger" disabled>Elimina asset</button>' +
      '</div></div></div>' +
      '<div id="fdMediaBulkDeleteDialog" class="fd-media-dialog" hidden>' +
      '<div class="fd-media-dialog__backdrop" data-close="bulk-delete"></div>' +
      '<div class="fd-media-dialog__panel" role="dialog" aria-modal="true" aria-labelledby="fdMediaBulkDeleteTitle">' +
      '<h3 id="fdMediaBulkDeleteTitle">Eliminare gli asset selezionati?</h3>' +
      '<p id="fdMediaBulkDeleteDesc">Conferma digitando <strong>ELIMINA</strong>.</p>' +
      '<label class="form-label" for="fdMediaBulkDeleteInput">Conferma</label>' +
      '<input id="fdMediaBulkDeleteInput" type="text" autocomplete="off" placeholder="ELIMINA">' +
      '<div class="fd-media-dialog__actions">' +
      '<button type="button" class="btn sec" data-close="bulk-delete">Annulla</button>' +
      '<button type="button" id="fdMediaBulkDeleteConfirmBtn" class="btn danger" disabled>Elimina selezionati</button>' +
      '</div></div></div>' +
      '<div id="fdMediaAriaLive" class="sr-only" aria-live="polite"></div>';
    document.body.appendChild(host);
    var clearInput = document.getElementById('fdMediaClearInput');
    var clearBtn = document.getElementById('fdMediaClearConfirmBtn');
    if (clearInput && clearBtn) {
      clearInput.addEventListener('input', function () {
        clearBtn.disabled = (clearInput.value || '').trim().toUpperCase() !== 'SVUOTA';
      });
    }
    document.querySelectorAll('.fd-media-dialog [data-close]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-close');
        var dlg = document.getElementById(key === 'specs' ? 'fdMediaSpecsDialog' : 'fdMediaClearDialog');
        if (dlg) dlg.hidden = true;
      });
    });
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        var dlg = document.getElementById('fdMediaClearDialog');
        if (dlg) dlg.hidden = true;
        if (typeof window.deleteAllMedia === 'function') window.deleteAllMedia();
      });
    }
    var assetInput = document.getElementById('fdMediaAssetDeleteInput');
    var assetBtn = document.getElementById('fdMediaAssetDeleteConfirmBtn');
    if (assetInput && assetBtn) {
      assetInput.addEventListener('input', function () {
        var expected = pendingDeleteAsset && pendingDeleteAsset.requireType ? String(pendingDeleteAsset.requireType) : 'ELIMINA';
        assetBtn.disabled = (assetInput.value || '').trim().toUpperCase() !== expected.toUpperCase();
      });
      assetBtn.addEventListener('click', function () {
        var dlg = document.getElementById('fdMediaAssetDeleteDialog');
        if (dlg) dlg.hidden = true;
        if (pendingDeleteAsset && typeof window.deleteMediaItem === 'function') {
          window.deleteMediaItem(pendingDeleteAsset.id);
        }
        pendingDeleteAsset = null;
      });
    }
    var bulkInput = document.getElementById('fdMediaBulkDeleteInput');
    var bulkBtn = document.getElementById('fdMediaBulkDeleteConfirmBtn');
    if (bulkInput && bulkBtn) {
      bulkInput.addEventListener('input', function () {
        bulkBtn.disabled = (bulkInput.value || '').trim().toUpperCase() !== 'ELIMINA';
      });
      bulkBtn.addEventListener('click', function () {
        var ids = Array.from(selectedIds);
        var dlg = document.getElementById('fdMediaBulkDeleteDialog');
        if (dlg) dlg.hidden = true;
        selectedIds.clear();
        syncBulkUi();
        ids.forEach(function (id) {
          if (typeof window.deleteMediaItem === 'function') window.deleteMediaItem(id);
        });
      });
    }
  }
  function openDialog(id) {
    var dlg = document.getElementById(id);
    if (!dlg) return;
    if (id === 'fdMediaClearDialog') {
      var input = document.getElementById('fdMediaClearInput');
      var btn = document.getElementById('fdMediaClearConfirmBtn');
      if (input) input.value = '';
      if (btn) btn.disabled = true;
    }
    if (id === 'fdMediaAssetDeleteDialog') {
      var aInput = document.getElementById('fdMediaAssetDeleteInput');
      var aBtn = document.getElementById('fdMediaAssetDeleteConfirmBtn');
      if (aInput) aInput.value = '';
      if (aBtn) aBtn.disabled = true;
    }
    if (id === 'fdMediaBulkDeleteDialog') {
      var bInput = document.getElementById('fdMediaBulkDeleteInput');
      var bBtn = document.getElementById('fdMediaBulkDeleteConfirmBtn');
      var bDesc = document.getElementById('fdMediaBulkDeleteDesc');
      if (bInput) bInput.value = '';
      if (bBtn) bBtn.disabled = true;
      if (bDesc) bDesc.innerHTML = 'Stai eliminando <strong>' + selectedIds.size + '</strong> asset. Conferma digitando <strong>ELIMINA</strong>.';
    }
    dlg.hidden = false;
  }
  window.fdMediaOpenSpecs = function () { openDialog('fdMediaSpecsDialog'); };
  window.fdMediaOpenClearDialog = function () { openDialog('fdMediaClearDialog'); };
  window.fdMediaOpenBulkDeleteDialog = function () { openDialog('fdMediaBulkDeleteDialog'); };
  window.fdMediaExportLibrary = function () {
    if (typeof window.toast === 'function') window.toast('Export libreria disponibile a breve');
  };
  function wrapSectionCard(card, type) {
    if (!card || card.dataset.fdMediaSection === '1') return;
    card.dataset.fdMediaSection = '1';
    card.dataset.mediaType = type;
    card.classList.add('fd-media-section');
    var meta = SECTION_META[type] || { title: type, hint: '', uploadLabel: 'Carica' };
    var oldTitle = card.querySelector('.sec-title');
    var oldHint = card.querySelector('p');
    var stripSearch = card.querySelector('#mediaStripSearch');
    var head = document.createElement('div');
    head.className = 'fd-media-section__head';
    head.innerHTML =
      '<div class="fd-media-section__copy">' +
      '<h2 class="fd-media-section__title">' + esc(meta.title) + '</h2>' +
      '<p class="fd-media-section__hint">' + esc(meta.hint) + '</p>' +
      '</div>' +
      '<div class="fd-media-section__actions">' +
      (stripSearch ? '' : '<button type="button" class="btn sec small fd-media-upload-type" data-upload-type="' + esc(type) + '">' + esc(meta.uploadLabel) + '</button>') +
      '</div>';
    if (stripSearch) {
      var actions = head.querySelector('.fd-media-section__actions');
      stripSearch.classList.add('fd-media-section__search');
      actions.appendChild(stripSearch);
      actions.insertAdjacentHTML(
        'beforeend',
        '<button type="button" class="btn sec small fd-media-upload-type" data-upload-type="strip">Carica strip</button>'
      );
    }
    if (oldTitle) oldTitle.remove();
    if (oldHint) oldHint.remove();
    var bodyHost = document.createElement('div');
    bodyHost.className = 'fd-media-section__body';
    while (card.firstChild) bodyHost.appendChild(card.firstChild);
    card.appendChild(head);
    card.appendChild(bodyHost);
    head.querySelectorAll('.fd-media-upload-type').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openUploadForType(btn.getAttribute('data-upload-type'));
      });
    });
  }
  function createWalletIconSection() {
    if (document.getElementById('mediaWalletIconGrid')) return null;
    var grid = document.querySelector('#media-library .fd-media-grid');
    if (!grid) return null;
    var card = document.createElement('div');
    card.className = 'card fd-media-section';
    card.dataset.mediaType = 'wallet_icon';
    card.innerHTML =
      '<div class="fd-media-section__head">' +
      '<div class="fd-media-section__copy">' +
      '<h2 class="fd-media-section__title">' + esc(SECTION_META.wallet_icon.title) + '</h2>' +
      '<p class="fd-media-section__hint">' + esc(SECTION_META.wallet_icon.hint) + '</p>' +
      '</div>' +
      '<div class="fd-media-section__actions">' +
      '<button type="button" class="btn sec small fd-media-upload-type" data-upload-type="wallet_icon">' + esc(SECTION_META.wallet_icon.uploadLabel) + '</button>' +
      '</div></div>' +
      '<div class="fd-media-section__body"><div id="mediaWalletIconGrid" class="strip-gallery"><p class="fd-media-empty">Caricamento…</p></div></div>';
    card.dataset.fdMediaSection = '1';
    var stripCard = grid.querySelector('[data-media-type="strip"]') || grid.children[1];
    if (stripCard) grid.insertBefore(card, stripCard);
    else grid.appendChild(card);
    card.querySelector('.fd-media-upload-type').addEventListener('click', function () {
      openUploadForType('wallet_icon');
    });
    return card;
  }
  function ensureMediaLayout() {
    var section = document.getElementById('media-library');
    if (!section) return;
    if (section.dataset.fdMediaLayout === '1') return;
    section.classList.add('media-library--fd-layout');
    var header = section.querySelector(':scope > div');
    if (header) {
      header.classList.add('fd-media-header');
      var h1 = header.querySelector('h1');
      var actions = header.querySelector(':scope > div');
      if (h1 && actions) {
        var copy = document.createElement('div');
        copy.className = 'fd-media-header__copy';
        copy.appendChild(h1);
        var lead = document.createElement('p');
        lead.className = 'fd-media-lead';
        lead.textContent =
          'Deposito immagini del brand e del pass. Scegli i file qui, poi assegnali in Template Pass o nelle push.';
        copy.appendChild(lead);
        header.insertBefore(copy, actions);
        actions.classList.add('fd-media-header__actions');
        actions.querySelectorAll('button[onclick*="deleteAllMedia"]').forEach(function (btn) { btn.remove(); });
        var uploadBtn = actions.querySelector('button[onclick*="openMediaUpload"]');
        if (uploadBtn) {
          uploadBtn.textContent = 'Carica file';
          uploadBtn.classList.remove('sec');
        }
        if (!actions.querySelector('#fdMediaGlobalSearch')) {
          var search = document.createElement('input');
          search.type = 'search';
          search.id = 'fdMediaGlobalSearch';
          search.className = 'fd-media-global-search';
          search.placeholder = 'Cerca asset…';
          search.setAttribute('aria-label', 'Cerca asset');
          search.addEventListener('input', applyGlobalSearchFilter);
          actions.insertBefore(search, actions.firstChild);
        }
      }
    }
    var specsCard = section.querySelector(':scope > .card');
    if (specsCard) specsCard.remove();
    var grid = section.querySelector(':scope > div[style*="grid"]');
    if (grid) {
      grid.classList.add('fd-media-grid');
      grid.style.display = '';
      grid.style.gridTemplateColumns = '';
      var cards = grid.querySelectorAll(':scope > .card');
      if (cards[0]) wrapSectionCard(cards[0], 'logo');
      if (cards[1]) wrapSectionCard(cards[1], 'strip');
      if (cards[2]) wrapSectionCard(cards[2], 'thumbnail');
      if (cards[3]) wrapSectionCard(cards[3], 'background');
    }
    createWalletIconSection();
    if (!section.querySelector('#fdMediaBulkBar')) {
      var bulk = document.createElement('div');
      bulk.id = 'fdMediaBulkBar';
      bulk.className = 'fd-media-bulk-bar';
      bulk.hidden = true;
      bulk.innerHTML =
        '<span id="fdMediaBulkCount">0 selezionati</span>' +
        '<button type="button" class="btn sec" id="fdMediaBulkClearBtn">Deseleziona</button>' +
        '<button type="button" class="btn danger" id="fdMediaBulkDeleteBtn">Elimina selezionati</button>';
      section.appendChild(bulk);
      document.getElementById('fdMediaBulkClearBtn').addEventListener('click', function () {
        selectedIds.clear();
        syncBulkUi();
        document.querySelectorAll('#media-library .media-card__check').forEach(function (c) { c.checked = false; });
      });
      document.getElementById('fdMediaBulkDeleteBtn').addEventListener('click', function () {
        window.fdMediaOpenBulkDeleteDialog();
      });
    }
    if (!section.querySelector('.fd-media-link-template')) {
      var link = document.createElement('p');
      link.className = 'fd-media-link-template';
      link.innerHTML = 'Dopo il caricamento, assegna le immagini in <a href="#" data-fd-nav="templates">Template Pass</a>.';
      link.querySelector('a').addEventListener('click', function (e) {
        e.preventDefault();
        if (typeof window.nav === 'function') window.nav('templates');
      });
      section.appendChild(link);
    }
    ensureUploadTypeOption();
    buildMediaDialogs();
    section.dataset.fdMediaLayout = '1';
  }
  function estimateDims(type) {
    if (type === 'logo') return '320×100';
    if (type === 'wallet_icon') return '512×512';
    if (type === 'strip') return '750×246';
    if (type === 'thumbnail') return '90×90';
    if (type === 'background') return '360×440';
    return '—';
  }
  function formatSize(bytes) {
    var n = Number(bytes || 0);
    if (!n) return '—';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(2) + ' MB';
  }
  function timeAgo(dateString) {
    if (!dateString) return '—';
    var d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return '—';
    var min = Math.max(1, Math.floor((Date.now() - d.getTime()) / 60000));
    if (min < 60) return min + ' min fa';
    var h = Math.floor(min / 60);
    if (h < 24) return h + ' ore fa';
    var day = Math.floor(h / 24);
    return day + ' giorni fa';
  }
  function renderAssetCard(item, type) {
    var name = item.title || item.filename || SECTION_META[type].title;
    var usedIn = Number(item.used_in_count || 0);
    var usedText = usedIn > 0 ? ('Usato in: ' + usedIn + ' elementi') : 'Usato in: non assegnato';
    var metadata = estimateDims(type) + ' · ' + formatSize(item.size_bytes) + ' · ' + timeAgo(item.created_at);
    return (
      '<article class="media-card media-card--fd" data-asset-id="' + esc(item.id) + '" data-asset-type="' + esc(type) + '" data-asset-name="' + esc(name) + '" data-used-in="' + esc(usedIn) + '">' +
      '<div class="media-card__thumb-wrap">' +
      '<label class="media-card__check-wrap"><input type="checkbox" class="media-card__check" data-action="select" aria-label="Seleziona asset"></label>' +
      '<img src="/api/v1/media/' + esc(item.id) + '/image" alt="' + esc(name) + '">' +
      '<div class="media-card__overlay">' +
      '<button type="button" class="media-card__icon-btn" data-action="preview" aria-label="Preview asset">👁</button>' +
      '<button type="button" class="media-card__icon-btn" data-action="rename" aria-label="Rinomina asset">✎</button>' +
      '<button type="button" class="media-card__icon-btn media-card__icon-btn--danger" data-action="delete" aria-label="Elimina asset">🗑</button>' +
      '</div>' +
      '</div>' +
      '<div class="media-card__title">' + esc(name) + '</div>' +
      '<div class="media-card__meta">' + esc(metadata) + '</div>' +
      '<button type="button" class="media-card__used-in" data-action="used-in">' + esc(usedText) + '</button>' +
      '</article>'
    );
  }
  function renderEmptyDropzone(type) {
    var m = SECTION_META[type];
    return (
      '<button type="button" class="fd-media-dropzone" data-upload-type="' + esc(type) + '" aria-label="Carica ' + esc(m.title) + '">' +
      '<div class="fd-media-dropzone__icon">⤴</div>' +
      '<div class="fd-media-dropzone__title">Trascina qui il tuo asset o clicca per caricare</div>' +
      '<div class="fd-media-dropzone__spec">' + esc(m.hint) + '</div>' +
      '</button>'
    );
  }
  function bindAssetCardActions(scope) {
    if (!scope) return;
    scope.querySelectorAll('.media-card--fd').forEach(function (card) {
      if (card.dataset.bound === '1') return;
      card.dataset.bound = '1';
      var id = card.getAttribute('data-asset-id');
      var type = card.getAttribute('data-asset-type');
      var name = card.getAttribute('data-asset-name') || 'Asset';
      var check = card.querySelector('.media-card__check');
      if (check) {
        check.checked = selectedIds.has(id);
        check.addEventListener('change', function () {
          if (check.checked) selectedIds.add(id);
          else selectedIds.delete(id);
          syncBulkUi();
        });
      }
      card.querySelectorAll('[data-action]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var action = btn.getAttribute('data-action');
          if (action === 'preview') {
            window.open('/api/v1/media/' + encodeURIComponent(id) + '/image', '_blank');
            return;
          }
          if (action === 'rename') {
            var next = window.prompt('Nuovo nome asset', name);
            if (!next || next.trim() === name) return;
            var brandId = getCurrentBrandId();
            fetch((window.API || '/api/v1') + '/media/' + encodeURIComponent(id), {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', ...authHeaders() },
              body: JSON.stringify({ title: next.trim(), type: type, brand_id: brandId || undefined })
            }).then(function () {
              if (typeof window.loadMediaLibrary === 'function') window.loadMediaLibrary();
            });
            return;
          }
          if (action === 'delete') {
            var usedIn = Number(card.getAttribute('data-used-in') || 0);
            pendingDeleteAsset = {
              id: id,
              requireType: usedIn > 0 ? name : 'ELIMINA'
            };
            var desc = document.getElementById('fdMediaAssetDeleteDesc');
            if (desc) {
              desc.innerHTML = usedIn > 0
                ? 'Asset usato in <strong>' + usedIn + '</strong> elementi. Digita <strong>' + esc(name) + '</strong> per confermare.'
                : 'Questa azione non può essere annullata. Digita <strong>ELIMINA</strong> per confermare.';
            }
            openDialog('fdMediaAssetDeleteDialog');
            return;
          }
          if (action === 'used-in') {
            if (typeof window.toast === 'function') window.toast('Dettaglio utilizzi in arrivo');
          }
        });
      });
    });
    scope.querySelectorAll('.fd-media-dropzone').forEach(function (btn) {
      if (btn.dataset.bound === '1') return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', function () {
        openUploadForType(btn.getAttribute('data-upload-type'));
      });
    });
  }
  function announceDnD(message) {
    var node = document.getElementById('fdMediaAriaLive');
    if (node) node.textContent = message || '';
  }
  function bindDropzoneDnD(host, type) {
    if (!host || host.dataset.dragBound === '1') return;
    host.dataset.dragBound = '1';
    ['dragenter', 'dragover'].forEach(function (evt) {
      host.addEventListener(evt, function (e) {
        e.preventDefault();
        host.classList.add('is-dragover');
        announceDnD('Rilascia per caricare');
      });
    });
    ['dragleave', 'dragend', 'drop'].forEach(function (evt) {
      host.addEventListener(evt, function () {
        host.classList.remove('is-dragover');
      });
    });
    host.addEventListener('drop', function (e) {
      e.preventDefault();
      var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file) return;
      openUploadForType(type);
      var input = document.getElementById('mediaUploadFile');
      try {
        var dt = new DataTransfer();
        dt.items.add(file);
        if (input) input.files = dt.files;
      } catch (_) {}
      announceDnD('File pronto per il caricamento');
    });
  }
  function syncBulkUi() {
    var bar = document.getElementById('fdMediaBulkBar');
    var count = document.getElementById('fdMediaBulkCount');
    var delBtn = document.getElementById('fdMediaBulkDeleteBtn');
    if (!bar || !count || !delBtn) return;
    var n = selectedIds.size;
    bar.hidden = n === 0;
    count.textContent = n + ' selezionati';
    delBtn.disabled = n === 0;
  }
  function renderSectionAssets(type, items) {
    var hostId = type === 'logo' ? 'mediaLogoBox'
      : type === 'wallet_icon' ? 'mediaWalletIconGrid'
      : type === 'strip' ? 'mediaStripGrid'
      : type === 'thumbnail' ? 'mediaThumbnailGrid'
      : 'mediaBackgroundGrid';
    var host = document.getElementById(hostId);
    if (!host) return;
    var actions = host.closest('.fd-media-section')?.querySelector('.fd-media-section__actions');
    var searchId = 'fdMediaSearch_' + type;
    var searchEl = document.getElementById(searchId);
    if (!searchEl && actions) {
      searchEl = document.createElement('input');
      searchEl.type = 'search';
      searchEl.id = searchId;
      searchEl.className = 'fd-media-section__search';
      searchEl.placeholder = 'Cerca…';
      searchEl.hidden = true;
      searchEl.addEventListener('input', function () {
        renderSectionAssets(type, items);
        applyGlobalSearchFilter();
      });
      actions.insertBefore(searchEl, actions.firstChild);
    }
    var localQ = (searchEl && !searchEl.hidden && searchEl.value ? searchEl.value : '').trim().toLowerCase();
    var list = items;
    if (localQ) {
      list = items.filter(function (it) {
        var t = (it.title || it.filename || '').toLowerCase();
        return t.indexOf(localQ) !== -1;
      });
    }
    if (searchEl) searchEl.hidden = items.length <= 6;
    if (!list.length) {
      host.innerHTML = renderEmptyDropzone(type);
      bindAssetCardActions(host);
      bindDropzoneDnD(host, type);
      return;
    }
    host.innerHTML = list.map(function (it) { return renderAssetCard(it, type); }).join('');
    bindAssetCardActions(host);
    bindDropzoneDnD(host, type);
  }
  function patchLoadMediaLibrary() {
    if (window.__fdMediaLoadPatched || typeof window.loadMediaLibrary !== 'function') return;
    window.__fdMediaLoadPatched = true;
    window.loadMediaLibrary = async function () {
      ensureMediaLayout();
      try {
        var brandId = getCurrentBrandId();
        if (!brandId) return;
        syncDashboardBrandId(brandId);
        var api = window.API || '/api/v1';
        var res = await fetch(api + '/media?brand_id=' + encodeURIComponent(brandId), {
          headers: authHeaders()
        });
        if (!res.ok) throw new Error('media fetch failed ' + res.status);
        var items = await res.json().catch(function () { return []; });
        var rows = mediaRowsFromPayload(items);
        var keep = new Set(rows.map(function (x) { return String(x.id); }));
        Array.from(selectedIds).forEach(function (id) {
          if (!keep.has(String(id))) selectedIds.delete(id);
        });
        renderSectionAssets('logo', rows.filter(function (x) { return x.type === 'logo'; }));
        renderSectionAssets('wallet_icon', rows.filter(function (x) { return x.type === 'wallet_icon'; }));
        renderSectionAssets('strip', rows.filter(function (x) { return x.type === 'strip'; }));
        renderSectionAssets('thumbnail', rows.filter(function (x) { return x.type === 'thumbnail'; }));
        renderSectionAssets('background', rows.filter(function (x) { return x.type === 'background'; }));
        applyGlobalSearchFilter();
        syncBulkUi();
      } catch (e) {
        console.error('fd-media-library load error:', e);
        document.querySelectorAll('#mediaLogoBox, #mediaWalletIconGrid, #mediaStripGrid, #mediaThumbnailGrid, #mediaBackgroundGrid').forEach(function (node) {
          if (!node) return;
          var txt = (node.textContent || '').trim();
          if (/caricamento/i.test(txt) || !txt) {
            node.innerHTML = '<p class="fd-media-empty">Errore caricamento. Riprova tra poco.</p>';
          }
        });
        if (typeof window.toast === 'function') window.toast('Media Library: errore caricamento');
      }
    };
  }
  function boot() {
    if (!isFiloMedia()) return;
    ensureUploadTypeOption();
    patchLoadMediaLibrary();
    ensureMediaLayout();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  var origNav = window.nav;
  if (typeof origNav === 'function' && !window.__fdMediaNav) {
    window.__fdMediaNav = true;
    window.nav = function (id) {
      var r = origNav.apply(this, arguments);
      var done = function () {
        if (id === 'media-library') boot();
      };
      if (r && typeof r.then === 'function') return r.then(done);
      setTimeout(done, 0);
      return r;
    };
  }
})();
(function () {
  'use strict';
  function isFiloDestructiveApp() {
    if (document.documentElement.classList.contains('a2w-shell')) return false;
    try {
      if (window.__2WALLET_PRODUCT_LOCK__ === 'hr') return true;
    } catch (_) {}
    return document.documentElement.getAttribute('data-app') === 'filodiretto';
  }
  function closeMediaMenu() {
    var panel = document.getElementById('fdMediaPageMenuPanel');
    var trigger = document.getElementById('fdMediaPageMenuBtn');
    if (panel) {
      panel.hidden = true;
      panel.classList.remove('fd-floating-menu-panel');
    }
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  }
  function ensureMediaPageMenu() {
    var section = document.getElementById('media-library');
    if (!section) return;
    section.classList.add('media-library--fd');
    var header = section.querySelector('.fd-media-header') || section.querySelector(':scope > div');
    if (!header) return;
    var actions = header.querySelector('.fd-media-header__actions') || header.querySelector(':scope > div:last-child') || header.querySelector('div');
    if (!actions) return;
    var clearBtn = actions.querySelector('button[onclick*="deleteAllMedia"]');
    if (clearBtn) clearBtn.classList.add('fd-media-clear-btn');
    var existing = document.getElementById('fdMediaPageMenu');
    if (existing) {
      if (existing.parentNode !== actions) actions.appendChild(existing);
      return;
    }
    var menu = document.createElement('div');
    menu.className = 'fd-media-page-menu';
    menu.id = 'fdMediaPageMenu';
    menu.innerHTML =
      '<button type="button" class="fd-media-page-menu__trigger" id="fdMediaPageMenuBtn" aria-label="Azioni Media Library" aria-haspopup="menu" aria-expanded="false">⋮</button>' +
      '<div class="fd-media-page-menu__panel" id="fdMediaPageMenuPanel" role="menu" hidden>' +
      '<button type="button" class="fd-media-page-menu__item" id="fdMediaExportBtn" role="menuitem">Esporta libreria (.zip)</button>' +
      '<button type="button" class="fd-media-page-menu__item" id="fdMediaSpecsBtn" role="menuitem">Specifiche tecniche</button>' +
      '<hr class="fd-media-page-menu__sep">' +
      '<button type="button" class="fd-media-page-menu__item fd-media-page-menu__item--danger" id="fdMediaClearAllBtn" role="menuitem">Svuota libreria…</button>' +
      '</div>';
    actions.appendChild(menu);
    var trigger = document.getElementById('fdMediaPageMenuBtn');
    var panel = document.getElementById('fdMediaPageMenuPanel');
    var exportItem = document.getElementById('fdMediaExportBtn');
    var specsItem = document.getElementById('fdMediaSpecsBtn');
    var item = document.getElementById('fdMediaClearAllBtn');
    if (trigger && panel) {
      trigger.addEventListener('click', function (e) {
        e.stopPropagation();
        var menuWrap = e.currentTarget && e.currentTarget.closest('.fd-media-page-menu');
        var panelLocal = menuWrap ? menuWrap.querySelector('.fd-media-page-menu__panel') : panel;
        var triggerLocal = e.currentTarget || trigger;
        var open = panelLocal ? panelLocal.hidden : true;
        closeMediaMenu();
        if (open) {
          triggerLocal.setAttribute('aria-expanded', 'true');
          if (typeof window.fdPositionFloatingMenu === 'function') {
            window.fdPositionFloatingMenu(triggerLocal, panelLocal || panel);
          } else {
            if (panelLocal) panelLocal.hidden = false;
          }
        }
      });
    }
    if (exportItem) {
      exportItem.addEventListener('click', function (e) {
        e.stopPropagation();
        closeMediaMenu();
        if (typeof window.fdMediaExportLibrary === 'function') window.fdMediaExportLibrary();
      });
    }
    if (specsItem) {
      specsItem.addEventListener('click', function (e) {
        e.stopPropagation();
        closeMediaMenu();
        if (typeof window.fdMediaOpenSpecs === 'function') window.fdMediaOpenSpecs();
      });
    }
    if (item) {
      item.addEventListener('click', function (e) {
        e.stopPropagation();
        closeMediaMenu();
        if (typeof window.fdMediaOpenClearDialog === 'function') window.fdMediaOpenClearDialog();
        else if (typeof window.deleteAllMedia === 'function') window.deleteAllMedia();
      });
    }
    if (document.body.dataset.fdMediaMenuBound !== '1') {
      document.body.dataset.fdMediaMenuBound = '1';
      document.addEventListener('click', closeMediaMenu);
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeMediaMenu();
      });
    }
  }
  function enhanceMediaDeleteButtons(root) {
    if (!root) return;
    root.querySelectorAll('button[onclick*="deleteMediaItem"]').forEach(function (btn) {
      btn.className = 'btn small sec fd-btn-danger-outline fd-media-delete-btn';
      if (!btn.textContent.trim()) btn.textContent = 'Elimina';
    });
  }
  function enhanceBrandIdentityAssetButtons() {
    document.querySelectorAll('#brand-identity .a2w-bi-asset-actions button[id*="RemoveBtn"]').forEach(function (btn) {
      btn.classList.remove('danger');
      btn.classList.add('sec', 'small', 'fd-btn-danger-outline');
    });
  }
  function enhanceMediaLibraryDom() {
    if (!isFiloDestructiveApp()) return;
    ensureMediaPageMenu();
    var section = document.getElementById('media-library');
    if (section) enhanceMediaDeleteButtons(section);
  }
  function patchRenderers() {
    if (window.__fdDestructivePatched) return;
    window.__fdDestructivePatched = true;
    var origMedia = window.loadMediaLibrary;
    if (typeof origMedia === 'function') {
      window.loadMediaLibrary = async function () {
        await origMedia.apply(this, arguments);
        if (isFiloDestructiveApp()) enhanceMediaLibraryDom();
      };
    }
    var origBiGrid = window.a2wBiRenderAssetsGrid;
    if (typeof origBiGrid === 'function') {
      window.a2wBiRenderAssetsGrid = function () {
        origBiGrid.apply(this, arguments);
        if (isFiloDestructiveApp()) enhanceBrandIdentityAssetButtons();
      };
    }
  }
  function initFdDestructive() {
    if (!isFiloDestructiveApp()) return;
    patchRenderers();
    ensureMediaPageMenu();
    enhanceMediaLibraryDom();
    enhanceBrandIdentityAssetButtons();
  }
  window.fdInitDestructive = initFdDestructive;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFdDestructive);
  } else {
    initFdDestructive();
  }
})();
(function () {
  'use strict';
  function isFiloFormDirtyApp() {
    if (document.documentElement.classList.contains('a2w-shell')) return false;
    try {
      if (window.__2WALLET_PRODUCT_LOCK__ === 'hr') return true;
    } catch (_) {}
    return document.documentElement.getAttribute('data-app') === 'filodiretto';
  }
  function isHrContext() {
    if (typeof window.isHrDashboard === 'function') return window.isHrDashboard();
    return false;
  }
  function patchBrandIdentityV2Flag() {
    if (window.__fdBiV2Patched) return;
    window.__fdBiV2Patched = true;
    var orig = window.isA2wBrandIdentityV2Enabled;
    window.isA2wBrandIdentityV2Enabled = function () {
      if (isFiloFormDirtyApp()) return true;
      if (typeof orig === 'function') return orig();
      return false;
    };
  }
  var TPL_FIELD_IDS = [
    'tplName', 'tplDescription', 'tplHeaderLabel', 'tplHeaderValue',
    'tplSecLabel', 'tplSecValue', 'tplAuxLabel', 'tplAuxValue',
    'tplLink1Label', 'tplLink1Url', 'tplLink2Label', 'tplLink2Url',
    'tplLink3Label', 'tplLink3Url', 'tplRegolamento', 'tplContatti',
    'hrFixedLinkLabel', 'hrFixedLinkUrl'
  ];
  function serializeTemplateModalState() {
    var parts = [document.getElementById('templateEditId')?.value || ''];
    TPL_FIELD_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      parts.push(el ? el.value : '');
    });
  try {
      parts.push(String(window.tplWalletIconMediaId || ''));
    } catch (_) {}
    return parts.join('\u0001');
  }
  function ensureTemplateDirtyUi() {
    var modal = document.getElementById('templateModal');
    if (!modal) return null;
    var saveBtn = modal.querySelector('button[onclick*="saveTemplate"]');
    if (!saveBtn) return null;
    if (!saveBtn.id) saveBtn.id = 'fdTplSaveBtn';
    var bar = modal.querySelector('.fd-form-dirty-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'fd-form-dirty-bar';
      var badge = document.createElement('span');
      badge.className = 'fd-form-dirty-badge';
      badge.id = 'fdTplDirtyBadge';
      badge.textContent = 'Salvato';
      bar.appendChild(badge);
      saveBtn.parentNode.insertBefore(bar, saveBtn);
      bar.appendChild(saveBtn);
    }
    return {
      saveBtn: saveBtn,
      badge: document.getElementById('fdTplDirtyBadge')
    };
  }
  function syncTemplateDirtyState() {
    if (!isFiloFormDirtyApp() || !isHrContext()) return;
    var ui = ensureTemplateDirtyUi();
    if (!ui) return;
    var dirty = serializeTemplateModalState() !== (window.__fdTplBaseline || '');
    ui.saveBtn.disabled = !dirty;
    if (!dirty) {
      ui.saveBtn.title = 'Nessuna modifica da salvare';
    } else {
      ui.saveBtn.removeAttribute('title');
    }
    if (ui.badge) {
      ui.badge.textContent = dirty ? 'Modifiche non salvate' : 'Salvato';
      ui.badge.classList.toggle('is-dirty', dirty);
    }
  }
  function resetTemplateBaseline() {
    window.__fdTplBaseline = serializeTemplateModalState();
    syncTemplateDirtyState();
  }
  function bindTemplateModalDirty() {
    var modal = document.getElementById('templateModal');
    if (!modal || modal.dataset.fdDirtyBound === '1') return;
    modal.dataset.fdDirtyBound = '1';
    modal.addEventListener('input', syncTemplateDirtyState);
    modal.addEventListener('change', syncTemplateDirtyState);
  }
  function patchTemplateFlows() {
    if (window.__fdTplDirtyPatched) return;
    window.__fdTplDirtyPatched = true;
    var origOpen = window.openTemplateModal;
    if (typeof origOpen === 'function') {
      window.openTemplateModal = async function () {
        await origOpen.apply(this, arguments);
        if (!isFiloFormDirtyApp()) return;
        bindTemplateModalDirty();
        resetTemplateBaseline();
      };
    }
    var origEdit = window.editTemplate;
    if (typeof origEdit === 'function') {
      window.editTemplate = async function () {
        await origEdit.apply(this, arguments);
        if (!isFiloFormDirtyApp()) return;
        bindTemplateModalDirty();
        resetTemplateBaseline();
      };
    }
    var origSave = window.saveTemplate;
    if (typeof origSave === 'function') {
      window.saveTemplate = async function () {
        await origSave.apply(this, arguments);
        if (!isFiloFormDirtyApp()) return;
        resetTemplateBaseline();
      };
    }
  }
  function initFdFormDirty() {
    if (!isFiloFormDirtyApp()) return;
    patchBrandIdentityV2Flag();
    patchTemplateFlows();
    bindTemplateModalDirty();
    document.getElementById('brand-identity')?.classList.add('brand-identity--fd-dirty');
  }
  window.fdInitFormDirty = initFdFormDirty;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFdFormDirty);
  } else {
    initFdFormDirty();
  }
})();
(function () {
  'use strict';
  var URL_PLACEHOLDER = 'https://www.esempio.it/pagina';
  var URL_PLACEHOLDER_OPT = 'https://www.esempio.it/pagina (opzionale)';
  var PHONE_PLACEHOLDER = '+39 02 1234 5678';
  function isFiloFormHelpApp() {
    if (document.documentElement.classList.contains('a2w-shell')) return false;
    try {
      if (window.__2WALLET_PRODUCT_LOCK__ === 'hr') return true;
    } catch (_) {}
    return document.documentElement.getAttribute('data-app') === 'filodiretto';
  }
  function fixPlaceholder(el) {
    if (!el || el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return;
    var ph = (el.getAttribute('placeholder') || '').trim();
    if (!ph) return;
    if (ph === 'https://...' || ph === 'https://... (opzionale)') {
      el.setAttribute('placeholder', ph.indexOf('opzionale') >= 0 ? URL_PLACEHOLDER_OPT : URL_PLACEHOLDER);
      return;
    }
    if (ph === '+39 ...') {
      el.setAttribute('placeholder', PHONE_PLACEHOLDER);
    }
  }
  function fixPlaceholdersIn(root) {
    if (!root) return;
    root.querySelectorAll('input[placeholder], textarea[placeholder]').forEach(fixPlaceholder);
  }
  function ensureSlugHelp() {
    var slugInput = document.getElementById('biSlug');
    if (!slugInput || document.getElementById('fdSlugHelp')) return;
    var row = slugInput.closest('.a2w-bi-slug-row');
    var host = row ? row.parentElement : slugInput.parentElement;
    if (!host) return;
    var help = document.createElement('p');
    help.id = 'fdSlugHelp';
    help.className = 'fd-slug-help fd-helper-text';
    help.textContent = 'Identificatore URL del brand (solo minuscole, numeri e trattini). Es. motor-k → landing /motor-k';
    var err = document.getElementById('biSlugError');
    if (err && err.parentElement === host) host.insertBefore(help, err);
    else host.appendChild(help);
  }
  function fixHrTemplateLabels() {
    var urlLabel = document.querySelector('label[for="hrFixedLinkUrl"]');
    if (urlLabel) urlLabel.textContent = 'URL link fisso';
    var tplUrlInputs = ['tplLink1Url', 'tplLink2Url', 'tplLink3Url', 'hrFixedLinkUrl', 'pushPassLinkUrl', 'pushBackLinkUrl', 'wzLink1Url'];
    tplUrlInputs.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) fixPlaceholder(el);
    });
  }
  function markInlineHelpers(root) {
    if (!root) return;
    root.querySelectorAll('p[style*="color:var(--text2)"], p[style*="color: var(--text2)"]').forEach(function (p) {
      if (p.classList.contains('a2w-bi-field-error')) return;
      p.classList.add('fd-helper-text');
    });
  }
  function applyFormHelpEnhancements() {
    if (!isFiloFormHelpApp()) return;
    fixPlaceholdersIn(document);
    ensureSlugHelp();
    fixHrTemplateLabels();
    markInlineHelpers(document.getElementById('brand-identity'));
    markInlineHelpers(document.getElementById('templateModal'));
    markInlineHelpers(document.getElementById('push'));
    markInlineHelpers(document.getElementById('media-library'));
    markInlineHelpers(document.getElementById('leads'));
  }
  function patchHrAddLinkRow() {
    if (window.__fdHrLinkRowPatched) return;
    window.__fdHrLinkRowPatched = true;
    var orig = window.hrAddLinkRow;
    if (typeof orig !== 'function') return;
    window.hrAddLinkRow = function (containerId, label, url) {
      orig.apply(this, arguments);
      if (!isFiloFormHelpApp()) return;
      var box = document.getElementById(containerId);
      if (!box) return;
      var row = box.querySelector('.hr-link-row:last-child');
      if (!row) return;
      var urlInput = row.querySelector('.hr-row-url');
      if (urlInput) urlInput.setAttribute('placeholder', URL_PLACEHOLDER);
    };
  }
  function patchNavRefresh() {
    if (window.__fdFormHelpNavPatched) return;
    window.__fdFormHelpNavPatched = true;
    var orig = window.nav;
    if (typeof orig !== 'function') return;
    window.nav = function (id) {
      orig.apply(this, arguments);
      if (isFiloFormHelpApp()) {
        window.setTimeout(applyFormHelpEnhancements, 0);
      }
    };
  }
  function patchLoadBrandIdentity() {
    if (window.__fdBiHelpPatched) return;
    window.__fdBiHelpPatched = true;
    var orig = window.loadBrandIdentity;
    if (typeof orig !== 'function') return;
    window.loadBrandIdentity = async function () {
      await orig.apply(this, arguments);
      if (isFiloFormHelpApp()) applyFormHelpEnhancements();
    };
  }
  function patchOpenTemplateModal() {
    if (window.__fdTplHelpPatched) return;
    window.__fdTplHelpPatched = true;
    ['openTemplateModal', 'editTemplate'].forEach(function (name) {
      var orig = window[name];
      if (typeof orig !== 'function') return;
      window[name] = async function () {
        await orig.apply(this, arguments);
        if (isFiloFormHelpApp()) applyFormHelpEnhancements();
      };
    });
  }
  function initFdFormHelp() {
    if (!isFiloFormHelpApp()) return;
    patchHrAddLinkRow();
    patchNavRefresh();
    patchLoadBrandIdentity();
    patchOpenTemplateModal();
    applyFormHelpEnhancements();
  }
  window.fdInitFormHelp = initFdFormHelp;
  window.fdApplyFormHelp = applyFormHelpEnhancements;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFdFormHelp);
  } else {
    initFdFormHelp();
  }
})();
(function () {
  'use strict';
  function isHr() {
    return document.documentElement.getAttribute('data-app') === 'filodiretto';
  }
  function wireFormLabels(root) {
    if (!root) return;
    root.querySelectorAll('.form-group').forEach(function (group) {
      var label = group.querySelector(':scope > label.form-label, :scope > .form-row > label.form-label');
      if (!label) return;
      var control = group.querySelector('input:not([type="hidden"]), select, textarea');
      if (!control) return;
      if (!control.id) {
        var base = (control.name || control.type || 'field').replace(/\W+/g, '-').slice(0, 24);
        control.id = 'fd-auto-' + base + '-' + Math.random().toString(36).slice(2, 7);
      }
      if (!label.getAttribute('for')) label.setAttribute('for', control.id);
      if (!control.getAttribute('aria-label') && label.textContent) {
        var text = label.textContent.replace(/[ⓘ*]/g, '').trim();
        if (text) control.setAttribute('aria-label', text);
      }
    });
  }
  function fixPreviewImages(root) {
    if (!root) return;
    var alts = {
      tplImgLogoPreview: 'Anteprima logo template',
      tplImgWalletIconPreview: 'Anteprima icona wallet',
      tplImgStripPreview: 'Anteprima strip template',
      tplImgThumbPreview: 'Anteprima thumbnail template',
      tplImgBgPreview: 'Anteprima sfondo template',
      bsLogoPreview: 'Anteprima logo brand',
      bsStripPreview: 'Anteprima strip brand',
      wzLogoPreview: 'Anteprima logo wizard'
    };
    Object.keys(alts).forEach(function (id) {
      var img = root.querySelector('#' + id);
      if (img && !img.hasAttribute('alt')) img.setAttribute('alt', alts[id]);
    });
    root.querySelectorAll('img:not([alt])').forEach(function (img) {
      if (img.closest('.pass-preview, .wallet-preview, [aria-hidden="true"]')) {
        img.setAttribute('alt', '');
      } else {
        img.setAttribute('alt', 'Immagine');
      }
    });
  }
  function run() {
    if (!isHr()) return;
    var main = document.getElementById('main-content') || document.body;
    wireFormLabels(main);
    fixPreviewImages(main);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
  window.fdWireFormA11y = run;
})();
(function () {
  'use strict';
  var DOC_BASE = 'https://docs.filodiretto.app/guide';
  var PRESETS = {
    templates: {
      title: 'Nessun template pass',
      description: 'Il template definisce layout, immagini e testi del pass dipendente usato in tutte le attivazioni.',
      ctaLabel: 'Crea template',
      ctaOnclick: 'openTemplateModal()',
      helpHref: DOC_BASE + '#template-pass',
      icon: 'inbox'
    },
    passes: {
      title: 'Nessun pass emesso',
      description: 'Qui trovi i pass generati dopo import anagrafica, inviti o attivazioni. Monitora installazioni e stato Wallet.',
      ctaLabel: 'Vai ai dipendenti',
      ctaOnclick: "nav('leads')",
      helpHref: DOC_BASE + '#pass-emessi',
      icon: 'inbox'
    },
    reward: {
      title: 'Nessuna campagna Reward',
      description: 'Premia i tuoi dipendenti con bonus, voucher welfare, gift card e premi a sorpresa.',
      ctaLabel: '+ Nuova Campagna',
      ctaOnclick: 'openIwModal()',
      helpHref: DOC_BASE + '#reward',
      icon: 'ticket'
    },
    challenge: {
      title: 'Nessuna challenge attiva',
      description: 'Crea sfide skill-based: quiz formativi, Memory Match, Puzzle e leaderboard a punti.',
      ctaLabel: '+ Nuova Campagna',
      ctaOnclick: 'openGamModal()',
      helpHref: DOC_BASE + '#challenge',
      icon: 'ticket'
    },
    activity: {
      title: 'Nessun evento registrato',
      description: 'Il log raccoglie download, installazioni Wallet, push e altre azioni utili per il supporto HR.',
      ctaLabel: 'Invia una push',
      ctaOnclick: "nav('push')",
      helpHref: DOC_BASE + '#log-attivita',
      icon: 'inbox'
    },
    contacts: {
      title: 'Nessun dipendente in anagrafica',
      description: 'Importa l\'elenco dipendenti o aggiungi le schede manualmente, poi invia l\'attivazione del pass.',
      ctaLabel: 'Importa da file',
      ctaOnclick: 'openEmployeeImportModal()',
      helpHref: DOC_BASE + '#dipendenti',
      icon: 'users'
    }
  };
  function isFiloEmptyApp() {
    if (document.documentElement.classList.contains('a2w-shell')) return false;
    try {
      if (window.__2WALLET_PRODUCT_LOCK__ === 'hr') return true;
    } catch (_) {}
    return document.documentElement.getAttribute('data-app') === 'filodiretto';
  }
  function esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function inferPresetKey(opts) {
    var on = String(opts.ctaOnclick || '');
    var title = String(opts.title || '').toLowerCase();
    if (on.indexOf('openTemplateModal') >= 0 || title.indexOf('template') >= 0) return 'templates';
    if (title.indexOf('pass emesso') >= 0 || title.indexOf('nessun pass') >= 0) return 'passes';
    if (on.indexOf('openIwModal') >= 0 || title.indexOf('reward') >= 0) return 'reward';
    if (on.indexOf('openGamModal') >= 0 || title.indexOf('challenge') >= 0) return 'challenge';
    if (title.indexOf('evento') >= 0 || title.indexOf('attivit') >= 0) return 'activity';
    if (
      on.indexOf('openEmployee') >= 0 ||
      title.indexOf('dipendent') >= 0 ||
      title.indexOf('contatt') >= 0 ||
      opts.icon === 'users'
    ) return 'contacts';
    return null;
  }
  function mergeEmptyOpts(opts) {
    var key = inferPresetKey(opts);
    var preset = key ? PRESETS[key] : null;
    if (!preset) return opts;
    opts = opts || {};
    return {
      icon: opts.icon || preset.icon,
      title: opts.title || preset.title,
      description: preset.description || opts.description,
      ctaLabel: opts.ctaLabel || preset.ctaLabel,
      ctaOnclick: opts.ctaOnclick || preset.ctaOnclick,
      helpHref: preset.helpHref,
      helpLabel: opts.helpLabel || 'Come funziona'
    };
  }
  function renderFiloEmptyState(opts, baseRender) {
    opts = mergeEmptyOpts(opts || {});
    var html = baseRender(opts);
    if (!opts.helpHref) return html;
    var help = '<a class="fd-empty-state__help" href="' + esc(opts.helpHref) + '" target="_blank" rel="noopener noreferrer">' +
      esc(opts.helpLabel || 'Come funziona') + '</a>';
    if (html.indexOf('fd-empty-state__actions') >= 0) return html;
    var ctaMatch = html.match(/<button[^>]*class="btn"[^>]*>[\s\S]*?<\/button>/);
    if (ctaMatch) {
      return html.replace(
        ctaMatch[0],
        '<div class="fd-empty-state__actions">' + ctaMatch[0] + help + '</div>'
      ).replace('class="empty-state"', 'class="empty-state fd-empty-state"');
    }
    return html
      .replace('class="empty-state"', 'class="empty-state fd-empty-state"')
      .replace('</div>', '<div class="fd-empty-state__actions">' + help + '</div></div>');
  }
  function patchRenderEmptyState() {
    if (window.__fdEmptyPatched || typeof window.renderEmptyState !== 'function') return;
    window.__fdEmptyPatched = true;
    var baseRender = window.renderEmptyState;
    window.renderEmptyState = function (opts) {
      if (!isFiloEmptyApp()) return baseRender(opts);
      return renderFiloEmptyState(opts, baseRender);
    };
  }
  function initFdEmptyStates() {
    if (!isFiloEmptyApp()) return;
    patchRenderEmptyState();
  }
  function fdTableEmptyState(colspan, opts) {
    opts = mergeEmptyOpts(opts || {});
    var html = typeof window.renderEmptyState === 'function'
      ? window.renderEmptyState(opts)
      : '';
    var span = Math.max(1, parseInt(colspan, 10) || 1);
    return '<tr class="table-empty-row"><td colspan="' + span + '">' + html + '</td></tr>';
  }
  window.fdTableEmptyState = fdTableEmptyState;
  window.fdInitEmptyStates = initFdEmptyStates;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFdEmptyStates);
  } else {
    initFdEmptyStates();
  }
})();
(function () {
  'use strict';
  var HR_COPY =
    'Rimuove il brand e tutti i dati collegati. Operazione irreversibile.';
  function isFiloDangerApp() {
    if (document.documentElement.classList.contains('a2w-shell')) return false;
    try {
      if (window.__2WALLET_PRODUCT_LOCK__ === 'hr') return true;
    } catch (_) {}
    return document.documentElement.getAttribute('data-app') === 'filodiretto';
  }
  function isConfirmTypingMatch(input, expected) {
    if (window.A2W && window.A2W.UI && typeof window.A2W.UI.isConfirmTypingMatch === 'function') {
      return window.A2W.UI.isConfirmTypingMatch(input, expected);
    }
    return String(input || '').trim() === String(expected || '').trim();
  }
  function ensureDangerIcon(parent, small) {
    if (!parent || parent.querySelector('.fd-danger-zone__icon')) return;
    var icon = document.createElement('span');
    icon.className = 'fd-danger-zone__icon' + (small ? ' fd-danger-zone__icon--sm' : '');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '⚠️';
    parent.insertBefore(icon, parent.firstChild);
  }
  function enhanceBrandDangerZone() {
    var zone = document.querySelector('#brand-identity .a2w-bi-danger-zone');
    if (!zone || zone.dataset.fdDangerZone === '1') return;
    zone.dataset.fdDangerZone = '1';
    zone.classList.add('fd-danger-zone');
    var title = zone.querySelector('#brandDangerTitle');
    if (title && !zone.querySelector('.fd-danger-zone__head')) {
      var head = document.createElement('div');
      head.className = 'fd-danger-zone__head';
      ensureDangerIcon(head, false);
      head.appendChild(title);
      zone.insertBefore(head, zone.firstChild);
    }
    var copy = zone.querySelector('p');
    if (copy) copy.textContent = HR_COPY;
  }
  function enhanceDeleteTrigger() {
    var host = document.getElementById('a2wBiDangerActionHost');
    if (!host) return;
    var btn = host.querySelector('button');
    if (!btn || btn.dataset.fdDangerBtn === '1') return;
    btn.dataset.fdDangerBtn = '1';
    btn.className = 'btn sec fd-btn-danger-outline';
    btn.textContent = 'Elimina brand…';
  }
  function enhanceFallbackDeleteDialog() {
    var dialog = document.getElementById('a2wDeleteBrandDialog');
    if (!dialog || dialog.dataset.fdDangerDialog === '1') return;
    dialog.dataset.fdDangerDialog = '1';
    dialog.classList.add('fd-delete-brand-dialog');
    var title = document.getElementById('a2wDeleteBrandDialogTitle');
    if (title) ensureDangerIcon(title, true);
    var input = document.getElementById('a2wDeleteBrandConfirmInput');
    if (input && !document.getElementById('a2wDeleteBrandDialogHint')) {
      var hint = document.createElement('p');
      hint.id = 'a2wDeleteBrandDialogHint';
      hint.className = 'fd-danger-zone__hint';
      hint.textContent = 'Il pulsante si attiva solo se il testo coincide esattamente con il nome del brand (senza spazi extra).';
      input.parentNode.insertBefore(hint, input.nextSibling);
      input.setAttribute('aria-describedby', 'a2wDeleteBrandDialogHint');
    }
    rebindFallbackTyping();
  }
  function rebindFallbackTyping() {
    var input = document.getElementById('a2wDeleteBrandConfirmInput');
    var confirmBtn = document.getElementById('a2wDeleteBrandConfirmBtn');
    if (!input || !confirmBtn || input.dataset.fdTypingBound === '1') return;
    var fresh = input.cloneNode(true);
    input.parentNode.replaceChild(fresh, input);
    fresh.dataset.fdTypingBound = '1';
    if (document.getElementById('a2wDeleteBrandDialogHint')) {
      fresh.setAttribute('aria-describedby', 'a2wDeleteBrandDialogHint');
    }
    fresh.addEventListener('input', function () {
      var expected = '';
      if (typeof window.a2wBiCollectFormData === 'function') {
        try {
          expected = window.a2wBiCollectFormData().name || '';
        } catch (_) {}
      }
      confirmBtn.disabled = !isConfirmTypingMatch(fresh.value, expected);
    });
  }
  function patchOpenConfirmDialog() {
    if (window.__fdDangerConfirmPatched) return;
    if (!window.A2W || !window.A2W.UI || typeof window.A2W.UI.openConfirmDialog !== 'function') return;
    window.__fdDangerConfirmPatched = true;
    var orig = window.A2W.UI.openConfirmDialog;
    window.A2W.UI.openConfirmDialog = function (opts) {
      opts = opts || {};
      var promise = orig.call(window.A2W.UI, opts);
      if (opts.requireTyping) {
        requestAnimationFrame(function () {
          var dlg = document.getElementById('a2wUiConfirmDialog');
          if (!dlg) return;
          dlg.classList.add('fd-danger-confirm');
          var titleEl = dlg.querySelector('#a2wUiConfirmTitle');
          if (titleEl) ensureDangerIcon(titleEl, true);
        });
      }
      return promise.finally(function () {
        var dlg = document.getElementById('a2wUiConfirmDialog');
        if (dlg) {
          dlg.classList.remove('fd-danger-confirm');
          var titleEl = dlg.querySelector('#a2wUiConfirmTitle');
          if (titleEl) {
            var icon = titleEl.querySelector('.fd-danger-zone__icon');
            if (icon) icon.remove();
          }
        }
      });
    };
  }
  function patchOpenDeleteDialog() {
    if (window.__fdOpenDeletePatched || typeof window.a2wBiOpenDeleteDialog !== 'function') return;
    window.__fdOpenDeletePatched = true;
    var orig = window.a2wBiOpenDeleteDialog;
    window.a2wBiOpenDeleteDialog = async function () {
      await orig.apply(this, arguments);
      enhanceFallbackDeleteDialog();
      rebindFallbackTyping();
    };
  }
  function observeDangerHost() {
    var host = document.getElementById('a2wBiDangerActionHost');
    if (!host) return;
    var obs = new MutationObserver(function () {
      enhanceDeleteTrigger();
    });
    obs.observe(host, { childList: true, subtree: true });
    enhanceDeleteTrigger();
  }
  function initFdDangerZone() {
    if (!isFiloDangerApp()) return;
    enhanceBrandDangerZone();
    enhanceFallbackDeleteDialog();
    observeDangerHost();
    patchOpenConfirmDialog();
    patchOpenDeleteDialog();
  }
  window.fdInitDangerZone = initFdDangerZone;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFdDangerZone);
  } else {
    initFdDangerZone();
  }
})();
(function (global) {
  'use strict';
  var ROLES = ['admin', 'manager', 'sender', 'reporter'];
  var SECTION_PERMS = {
    manager: {
      brand_identity: 'full', media_library: 'full', templates: 'full', passes: 'full',
      push: 'full', rewards: 'full', challenges: 'full', employees: 'full',
      audiences: 'full', analytics: 'full', activity_log: 'none', users: 'none', welcome: 'full'
    },
    sender: {
      brand_identity: 'none', media_library: 'read', templates: 'read', passes: 'read',
      push: 'full', rewards: 'read', challenges: 'read', employees: 'none',
      audiences: 'read', analytics: 'read', activity_log: 'none', users: 'none', welcome: 'read'
    },
    reporter: {
      brand_identity: 'read', media_library: 'none', templates: 'none', passes: 'read',
      push: 'none', rewards: 'none', challenges: 'none', employees: 'none',
      audiences: 'none', analytics: 'read', activity_log: 'read', users: 'none', welcome: 'read'
    }
  };
  var UI_SECTION_MAP = {
    welcome: 'welcome',
    'brand-identity': 'brand_identity',
    'media-library': 'media_library',
    templates: 'templates',
    passes: 'passes',
    push: 'push',
    'instant-win': 'rewards',
    gamification: 'challenges',
    leads: 'employees',
    audiences: 'audiences',
    analytics: 'analytics',
    'activity-log': 'activity_log',
    users: 'users'
  };
  var DEFAULT_LANDING = {
    admin: 'welcome',
    manager: 'welcome',
    sender: 'push',
    reporter: 'analytics'
  };
  function isFiloApp() {
    return document.documentElement.getAttribute('data-app') === 'filodiretto' ||
      global.__2WALLET_PRODUCT_LOCK__ === 'hr';
  }
  function normalizeRole(role) {
    var r = String(role || 'manager').toLowerCase();
    if (r === 'viewer') return 'reporter';
    if (ROLES.indexOf(r) >= 0) return r;
    return 'manager';
  }
  function getCurrentRole() {
    try {
      if (global.currentUser && global.currentUser.role) return normalizeRole(global.currentUser.role);
    } catch (_) {}
    return 'manager';
  }
  function sectionKey(sectionId) {
    return UI_SECTION_MAP[sectionId] || null;
  }
  function sectionAccess(role, section) {
    var r = normalizeRole(role);
    if (r === 'admin') return 'full';
    var map = SECTION_PERMS[r];
    if (!map) return 'none';
    return map[section] || 'none';
  }
  function canAccessSection(sectionId, role) {
    var key = sectionKey(sectionId);
    if (!key) return normalizeRole(role || getCurrentRole()) === 'admin';
    var access = sectionAccess(role || getCurrentRole(), key);
    return access === 'full' || access === 'read';
  }
  function canWriteSection(sectionId, role) {
    var key = sectionKey(sectionId);
    if (!key) return normalizeRole(role || getCurrentRole()) === 'admin';
    return sectionAccess(role || getCurrentRole(), key) === 'full';
  }
  function defaultLandingSection(role) {
    var r = normalizeRole(role || getCurrentRole());
    return DEFAULT_LANDING[r] || 'welcome';
  }
  function roleLabel(role) {
    var labels = {
      admin: 'Admin',
      manager: 'Manager',
      sender: 'Sender',
      reporter: 'Reporter',
      reporter_legacy: 'Reporter'
    };
    return labels[normalizeRole(role)] || role;
  }
  function applyBodyRoleClasses(role) {
    role = normalizeRole(role || getCurrentRole());
    var body = document.body;
    if (!body) return;
    ROLES.concat(['admin', 'viewer']).forEach(function (r) {
      body.classList.remove('role-' + r);
    });
    body.classList.remove('role-viewer');
    body.classList.add('role-' + role);
    if (role === 'reporter') body.classList.add('role-viewer');
    body.classList.toggle('role-admin', role === 'admin');
    body.classList.toggle('role-manager', role === 'manager');
    body.classList.toggle('role-sender', role === 'sender');
    body.classList.toggle('role-reporter', role === 'reporter');
  }
  function applyNavGating(role) {
    if (!isFiloApp()) return;
    role = normalizeRole(role || getCurrentRole());
    document.querySelectorAll('.nav-item[data-section-id]').forEach(function (el) {
      var sid = el.getAttribute('data-section-id');
      var perm = el.getAttribute('data-requires-perm') || sectionKey(sid);
      if (!perm) return;
      var access = sectionAccess(role, perm);
      var allowed = access === 'full' || access === 'read';
      el.style.display = allowed ? '' : 'none';
      el.setAttribute('aria-hidden', allowed ? 'false' : 'true');
      if (!allowed) el.classList.add('fd-rbac-hidden');
      else el.classList.remove('fd-rbac-hidden');
    });
    document.querySelectorAll('.nav-group[data-nav-group]').forEach(function (group) {
      var visible = 0;
      group.querySelectorAll('.nav-item[data-section-id]').forEach(function (item) {
        if (item.style.display !== 'none' && item.getAttribute('aria-hidden') !== 'true') visible += 1;
      });
      group.style.display = visible ? '' : 'none';
      group.setAttribute('aria-hidden', visible ? 'false' : 'true');
    });
  }
  function applyReadOnlyMode(activeSectionId, role) {
    if (!isFiloApp()) return;
    role = normalizeRole(role || getCurrentRole());
    var sid = activeSectionId || (typeof global.getActiveSectionId === 'function' ? global.getActiveSectionId() : '');
    var readonly = sid && !canWriteSection(sid, role);
    document.body.classList.toggle('fd-rbac-readonly', !!readonly);
    document.body.classList.toggle('role-readonly', !!readonly);
    document.querySelectorAll('[data-requires-write]').forEach(function (el) {
      var section = el.getAttribute('data-requires-write') || sid;
      var allow = canWriteSection(section, role);
      if (el.tagName === 'BUTTON' || el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
        el.disabled = !allow;
      }
      el.style.display = allow ? '' : 'none';
      el.setAttribute('aria-hidden', allow ? 'false' : 'true');
    });
  }
  function guardNav(sectionId) {
    if (!isFiloApp()) return sectionId;
    if (!sectionId || sectionId === 'welcome') {
      if (!canAccessSection('welcome')) return defaultLandingSection();
      return sectionId;
    }
    if (canAccessSection(sectionId)) return sectionId;
    if (typeof global.toast === 'function') global.toast('Accesso non consentito per il tuo ruolo');
    return defaultLandingSection();
  }
  function syncRbac(role) {
    if (!isFiloApp()) return;
    role = normalizeRole(role || getCurrentRole());
    applyBodyRoleClasses(role);
    applyNavGating(role);
    applyReadOnlyMode(null, role);
  }
  global.FdRbac = {
    ROLES: ROLES,
    normalizeRole: normalizeRole,
    getCurrentRole: getCurrentRole,
    canAccessSection: canAccessSection,
    canWriteSection: canWriteSection,
    defaultLandingSection: defaultLandingSection,
    roleLabel: roleLabel,
    guardNav: guardNav,
    syncRbac: syncRbac,
    applyNavGating: applyNavGating,
    applyReadOnlyMode: applyReadOnlyMode,
    applyBodyRoleClasses: applyBodyRoleClasses,
    UI_SECTION_MAP: UI_SECTION_MAP
  };
})(typeof window !== 'undefined' ? window : global);
(function () {
  'use strict';
  var TITLE_MAX = 50;
  var MESSAGE_MAX = 178;
  var TEST_PASS_KEY = 'fd:pushTestPassId';
  var CHANNELS = [
    { value: 'apple', label: 'iPhone (Apple Wallet)', icon: '', tip: 'Invio tramite APNs (Apple Push Notification service)' },
    { value: 'google', label: 'Android (Google Wallet)', icon: '', tip: 'Aggiornamento messaggio su Google Wallet' },
    { value: 'samsung', label: 'Samsung Wallet', icon: '', tip: 'Aggiornamento contenuto su Samsung Wallet' },
    { value: 'all', label: 'Tutti i canali', icon: '⇄', tip: 'Apple APNs + Google Wallet + Samsung Wallet' }
  ];
  function isFiloPushApp() {
    if (document.documentElement.classList.contains('a2w-shell')) return false;
    try {
      if (window.__2WALLET_PRODUCT_LOCK__ === 'hr') return true;
    } catch (_) {}
    return document.documentElement.getAttribute('data-app') === 'filodiretto';
  }
  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function getBrandLabel() {
    var sel = document.getElementById('brandSelector');
    if (sel && sel.value && sel.selectedIndex >= 0) {
      return sel.options[sel.selectedIndex].textContent || 'Brand';
    }
    return (window.currentBrandName || 'Brand');
  }
  function updateCharCount(input, counter, max) {
    if (!input || !counter) return;
    var len = (input.value || '').length;
    counter.textContent = len + '/' + max;
    counter.classList.remove('is-warn', 'is-over');
    if (len > max) counter.classList.add('is-over');
    else if (len > max * 0.9) counter.classList.add('is-warn');
  }
  function syncPreview() {
    var title = (document.getElementById('pushTitle') || {}).value || 'Titolo notifica';
    var message = (document.getElementById('pushMessage') || {}).value || 'Testo del messaggio…';
    var brand = getBrandLabel();
    document.querySelectorAll('[data-fd-push-preview-title]').forEach(function (el) {
      el.textContent = title;
    });
    document.querySelectorAll('[data-fd-push-preview-body]').forEach(function (el) {
      el.textContent = message;
    });
    document.querySelectorAll('[data-fd-push-preview-brand]').forEach(function (el) {
      el.textContent = brand;
    });
  }
  function setChannelValue(value) {
    var sel = document.getElementById('pushChannel');
    if (!sel) return;
    sel.value = value;
    document.querySelectorAll('.fd-push-channel-seg__btn').forEach(function (btn) {
      var on = btn.getAttribute('data-channel') === value;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var help = document.getElementById('fdPushChannelHelp');
    var ch = CHANNELS.find(function (c) {
      return c.value === value;
    });
    if (help && ch) help.textContent = ch.tip;
  }
  function buildPushBody(extra) {
    extra = extra || {};
    var title = document.getElementById('pushTitle').value;
    var message = document.getElementById('pushMessage').value;
    var campaignId =
      typeof window.isLegacyCampaignsUiEnabled === 'function' && window.isLegacyCampaignsUiEnabled()
        ? document.getElementById('pushCampaignTarget')?.value || null
        : null;
    var audienceId = document.getElementById('pushAudienceTarget')?.value || null;
    var channel = document.getElementById('pushChannel').value || 'apple';
    var updatePass = document.getElementById('pushUpdatePass').checked;
    var body = {
      brand_id: window.brandId,
      title: title,
      message: message,
      update_pass: updatePass,
      channel: channel
    };
    if (audienceId) body.audience_id = audienceId;
    else if (campaignId) body.campaign_id = campaignId;
    var iwId = document.getElementById('pushInstantWin').value;
    if (iwId) body.instant_win_id = iwId;
    var gamId = document.getElementById('pushGamification').value;
    if (gamId) body.gamification_id = gamId;
    if (document.getElementById('pushIncludePassLink')?.checked) {
      body.include_pass_link = true;
      body.pass_link_url = (document.getElementById('pushPassLinkUrl')?.value || '').trim();
      body.pass_link_label = (document.getElementById('pushPassLinkLabel')?.value || '').trim();
      var expLocal = document.getElementById('pushPassLinkExpires')?.value;
      if (expLocal) body.pass_link_expires_at = new Date(expLocal).toISOString();
    }
    if (updatePass && window.pushStripMediaId) body.strip_media_id = window.pushStripMediaId;
    if (extra.test_pass_id) body.test_pass_id = extra.test_pass_id;
    return body;
  }
  async function loadTestPasses() {
    var sel = document.getElementById('fdPushTestPass');
    if (!sel || !window.brandId) return;
    sel.innerHTML = '<option value="">— Caricamento… —</option>';
    try {
      var api = window.API || '/api';
      var res = await fetch(api + '/passes?brand_id=' + encodeURIComponent(window.brandId) + '&limit=200', {
        headers: typeof getAuthHeaders === 'function' ? getAuthHeaders() : {}
      });
      var rows = await res.json();
      var list = Array.isArray(rows) ? rows : rows.passes || rows.items || [];
      var withPush = list.filter(function (p) {
        return (
          p.push_token ||
          p.device_source === 'apple' ||
          p.device_source === 'google' ||
          p.device_source === 'samsung' ||
          p.google_wallet_saved ||
          p.samsung_wallet_saved ||
          p.samsung_wallet_ref_id
        );
      });
      sel.innerHTML = '<option value="">— Seleziona pass di prova —</option>';
      if (!withPush.length) {
        sel.innerHTML = '<option value="">— Nessun pass con Wallet installato —</option>';
        return;
      }
      withPush.forEach(function (p) {
        var opt = document.createElement('option');
        opt.value = p.id;
        var label = (p.member_name || p.holder_name || p.email || p.serial_number || p.id).toString();
        if (p.push_token || p.device_source === 'apple') label += ' · iPhone';
        else if (p.google_wallet_saved || p.device_source === 'google') label += ' · Google';
        else if (p.samsung_wallet_saved || p.samsung_wallet_ref_id || p.device_source === 'samsung') label += ' · Samsung';
        opt.textContent = label.slice(0, 72);
        sel.appendChild(opt);
      });
      var saved = localStorage.getItem(TEST_PASS_KEY);
      if (saved && withPush.some(function (p) {
        return String(p.id) === String(saved);
      })) {
        sel.value = saved;
      }
    } catch (e) {
      sel.innerHTML = '<option value="">— Errore caricamento —</option>';
    }
  }
  async function sendTestPush() {
    if (!window.brandId) {
      if (typeof toast === 'function') toast('Seleziona un brand');
      return;
    }
    var passId = document.getElementById('fdPushTestPass')?.value;
    if (!passId) {
      if (typeof toast === 'function') toast('Seleziona un dispositivo di prova');
      return;
    }
    var title = (document.getElementById('pushTitle')?.value || '').trim();
    var message = (document.getElementById('pushMessage')?.value || '').trim();
    if (typeof window.clearPushFieldErrors === 'function') window.clearPushFieldErrors();
    if (!title) {
      if (typeof window.setPushFieldError === 'function') {
        window.setPushFieldError('pushTitle', 'Inserisci un titolo per la notifica');
      } else if (typeof alert === 'function') alert('Compila titolo e messaggio');
      return;
    }
    if (!message) {
      if (typeof window.setPushFieldError === 'function') {
        window.setPushFieldError('pushMessage', 'Inserisci il testo del messaggio');
      } else if (typeof alert === 'function') alert('Compila titolo e messaggio');
      return;
    }
    if (title.length > TITLE_MAX || message.length > MESSAGE_MAX) {
      if (typeof alert === 'function') alert('Titolo o messaggio supera il limite consigliato per APNs');
      return;
    }
    var btn = document.getElementById('fdPushTestBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Invio prova…';
    }
    var controller = new AbortController();
    var timeoutId = setTimeout(function () {
      controller.abort();
    }, 60000);
    try {
      var body = buildPushBody({ test_pass_id: passId });
      var api = window.API || '/api';
      var res = await fetch(api + '/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(typeof getAuthHeaders === 'function' ? getAuthHeaders() : {}) },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok || data.error) {
        var errMsg = data.error || 'Invio non riuscito, riprova';
        var banner = document.getElementById('pushSendError');
        if (banner) {
          banner.textContent = errMsg;
          banner.hidden = false;
        } else if (typeof alert === 'function') alert('Errore: ' + errMsg);
        return;
      }
      localStorage.setItem(TEST_PASS_KEY, passId);
      var msg =
        typeof buildPushDeliveryMessage === 'function'
          ? buildPushDeliveryMessage(data)
          : 'Push di prova inviata';
      if (typeof toast === 'function') toast(msg);
      else if (typeof alert === 'function') alert(msg);
    } catch (e) {
      var failMsg = (e && e.name === 'AbortError')
        ? 'Invio non riuscito, riprova'
        : (e.message || 'Invio non riuscito, riprova');
      var failBanner = document.getElementById('pushSendError');
      if (failBanner) {
        failBanner.textContent = failMsg;
        failBanner.hidden = false;
      } else if (typeof alert === 'function') alert('Errore: ' + failMsg);
    } finally {
      clearTimeout(timeoutId);
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Invia di prova';
      }
    }
  }
  function wrapCharField(inputId, max) {
    var input = document.getElementById(inputId);
    if (!input || input.dataset.fdCharWrapped === '1') return;
    input.dataset.fdCharWrapped = '1';
    var group = input.closest('.form-group');
    if (!group) return;
    var label = group.querySelector('.form-label');
    if (label && !label.parentElement.classList.contains('fd-push-field-head')) {
      var head = document.createElement('div');
      head.className = 'fd-push-field-head';
      label.parentNode.insertBefore(head, label);
      head.appendChild(label);
      var count = document.createElement('span');
      count.className = 'fd-push-char-count';
      count.id = inputId === 'pushTitle' ? 'fdPushTitleCount' : 'fdPushMessageCount';
      count.textContent = '0/' + max;
      head.appendChild(count);
    }
    var counter = document.getElementById(inputId === 'pushTitle' ? 'fdPushTitleCount' : 'fdPushMessageCount');
    input.addEventListener('input', function () {
      updateCharCount(input, counter, max);
      syncPreview();
    });
    updateCharCount(input, counter, max);
  }
  function buildChannelSegmented() {
    var sel = document.getElementById('pushChannel');
    if (!sel || document.getElementById('fdPushChannelSeg')) return;
    sel.classList.add('fd-push-channel-native');
    var group = sel.closest('.form-group');
    if (!group) return;
    var seg = document.createElement('div');
    seg.id = 'fdPushChannelSeg';
    seg.className = 'fd-push-channel-seg';
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-label', 'Canale invio');
    CHANNELS.forEach(function (ch) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fd-push-channel-seg__btn';
      btn.setAttribute('data-channel', ch.value);
      btn.setAttribute('aria-pressed', sel.value === ch.value ? 'true' : 'false');
      btn.title = ch.tip;
      btn.innerHTML =
        (ch.icon ? '<span aria-hidden="true">' + ch.icon + '</span> ' : '') + esc(ch.label);
      btn.addEventListener('click', function () {
        setChannelValue(ch.value);
      });
      seg.appendChild(btn);
    });
    var help = document.createElement('p');
    help.id = 'fdPushChannelHelp';
    help.className = 'fd-push-channel-help';
    group.appendChild(seg);
    group.appendChild(help);
    setChannelValue(sel.value || 'apple');
  }
  function buildPreviewPanel() {
    if (document.getElementById('fdPushPreview')) return;
    var aside = document.createElement('aside');
    aside.id = 'fdPushPreview';
    aside.className = 'fd-push-preview';
    aside.setAttribute('aria-label', 'Anteprima notifica');
    aside.innerHTML =
      '<h2 class="fd-push-preview__title">Anteprima live</h2>' +
      '<div class="fd-push-preview__device fd-push-preview__device--ios">' +
      '<span class="fd-push-preview__device-label">iPhone · lock screen</span>' +
      '<div class="fd-push-preview__lock">' +
      '<div class="fd-push-preview__lock-app" data-fd-push-preview-brand>Brand</div>' +
      '<div class="fd-push-preview__lock-title" data-fd-push-preview-title>Titolo notifica</div>' +
      '<div class="fd-push-preview__lock-body" data-fd-push-preview-body>Testo del messaggio…</div>' +
      '</div></div>' +
      '<div class="fd-push-preview__device fd-push-preview__device--android">' +
      '<span class="fd-push-preview__device-label">Android · notifica</span>' +
      '<div class="fd-push-preview__lock">' +
      '<div class="fd-push-preview__lock-app" data-fd-push-preview-brand>Brand</div>' +
      '<div class="fd-push-preview__lock-title" data-fd-push-preview-title>Titolo notifica</div>' +
      '<div class="fd-push-preview__lock-body" data-fd-push-preview-body>Testo del messaggio…</div>' +
      '</div></div>' +
      '<div class="fd-push-preview__device fd-push-preview__device--samsung">' +
      '<span class="fd-push-preview__device-label">Samsung · notifica</span>' +
      '<div class="fd-push-preview__lock">' +
      '<div class="fd-push-preview__lock-app" data-fd-push-preview-brand>Brand</div>' +
      '<div class="fd-push-preview__lock-title" data-fd-push-preview-title>Titolo notifica</div>' +
      '<div class="fd-push-preview__lock-body" data-fd-push-preview-body>Testo del messaggio…</div>' +
      '</div></div>' +
      '<div class="fd-push-preview__pass">' +
      '<div class="fd-push-preview__pass-name" data-fd-push-preview-brand>Brand</div>' +
      '<div>Anteprima pass Wallet (contenuto aggiornato se attivo)</div>' +
      '</div>';
    return aside;
  }
  function buildTestBlock() {
    if (document.getElementById('fdPushTestBlock')) return;
    var card = document.querySelector('#pushPanel_immediate .push-card');
    if (!card) return;
    var block = document.createElement('div');
    block.id = 'fdPushTestBlock';
    block.className = 'fd-push-test';
    block.innerHTML =
      '<label class="form-label" for="fdPushTestPass">Dispositivo di prova</label>' +
      '<p class="form-hint" style="margin:0 0 8px">Invia solo al pass selezionato (utile prima della campagna massiva).</p>' +
      '<div class="fd-push-test__row">' +
      '<select id="fdPushTestPass" aria-label="Pass di prova"></select>' +
      '<button type="button" class="btn sec" id="fdPushTestBtn">Invia di prova</button>' +
      '</div>';
    var sendBtn = card.querySelector('button[onclick*="sendImmediatePush"]');
    if (sendBtn) card.insertBefore(block, sendBtn);
    else card.appendChild(block);
    document.getElementById('fdPushTestBtn').addEventListener('click', sendTestPush);
  }
  function enhanceImmediatePanel() {
    var panel = document.getElementById('pushPanel_immediate');
    if (!panel || panel.dataset.fdPushEnhanced === '1') return;
    panel.dataset.fdPushEnhanced = '1';
    panel.classList.add('fd-push-panel--enhanced');
    var card = panel.querySelector('.push-card');
    if (!card) return;
    var formCol = document.createElement('div');
    formCol.className = 'fd-push-form-col';
    formCol.appendChild(card);
    panel.insertBefore(formCol, panel.firstChild);
    var preview = buildPreviewPanel();
    if (preview) panel.appendChild(preview);
    buildChannelSegmented();
    buildTestBlock();
    wrapCharField('pushTitle', TITLE_MAX);
    wrapCharField('pushMessage', MESSAGE_MAX);
    syncPreview();
    loadTestPasses();
  }
  function enhanceIntro() {
    var push = document.getElementById('push');
    if (!push) return;
    var intro = push.querySelector('p');
    if (!intro || intro.classList.contains('fd-push-intro')) return;
    intro.classList.add('fd-push-intro');
    intro.innerHTML =
      'Invia notifiche ai dipendenti con pass in Wallet. Scegli il <strong>canale</strong>, ' +
      'controlla i limiti di caratteri e usa l’<strong>anteprima</strong> prima dell’invio massivo.';
  }
  function patchNavForPush() {
    if (window.__fdPushNavPatched || typeof window.nav !== 'function') return;
    window.__fdPushNavPatched = true;
    var orig = window.nav;
    window.nav = function (sectionId) {
      var out = orig.apply(this, arguments);
      if (sectionId === 'push' && isFiloPushApp()) {
        setTimeout(initFdPush, 80);
      }
      return out;
    };
  }
  function initFdPush() {
    if (!isFiloPushApp()) return;
    var push = document.getElementById('push');
    if (push) push.classList.add('push--fd');
    enhanceIntro();
    enhanceImmediatePanel();
    patchNavForPush();
  }
  window.fdInitPush = initFdPush;
  window.fdSendTestPush = sendTestPush;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFdPush);
  } else {
    initFdPush();
  }
})();
(function () {
  'use strict';
  var TABLE_SELECTOR = '.content .section .table:not(.import-preview-table)';
  var enhanceTimer = null;
  function isFiloTablesApp() {
    if (document.documentElement.classList.contains('a2w-shell')) return false;
    try {
      if (window.__2WALLET_PRODUCT_LOCK__ === 'hr') return true;
    } catch (_) {}
    return document.documentElement.getAttribute('data-app') === 'filodiretto';
  }
  function headerLabel(th, index, total) {
    var text = String(th && th.textContent ? th.textContent : '').replace(/\s+/g, ' ').trim();
    if (!text && index === total - 1) return 'Azioni';
    return text || ('Campo ' + (index + 1));
  }
  function applyRowLabels(table) {
    var headers = Array.prototype.slice.call(table.querySelectorAll('thead th'));
    if (!headers.length) return;
    var labels = headers.map(function (th, i) {
      return headerLabel(th, i, headers.length);
    });
    var actionsIndex = labels.length - 1;
    table.querySelectorAll('tbody tr').forEach(function (tr) {
      if (tr.classList.contains('table-skeleton-row')
        || tr.classList.contains('table-empty-row')
        || tr.classList.contains('table-error-row')) {
        tr.querySelectorAll('td').forEach(function (td) {
          td.classList.add('fd-table-card-full');
          td.removeAttribute('data-label');
        });
        return;
      }
      var cells = Array.prototype.slice.call(tr.querySelectorAll(':scope > td'));
      cells.forEach(function (td, i) {
        td.classList.remove('fd-table-card-full', 'fd-table-card-actions');
        if (td.colSpan > 1) {
          td.classList.add('fd-table-card-full');
          td.removeAttribute('data-label');
          return;
        }
        var label = labels[i] || '';
        td.setAttribute('data-label', label);
        if (i === actionsIndex || label === 'Azioni') {
          td.classList.add('fd-table-card-actions');
        }
      });
    });
  }
  function enhanceTable(table) {
    if (!table || table.closest('.modal')) return;
    table.classList.add('fd-table-cards');
    table.dataset.fdTableCards = '1';
    applyRowLabels(table);
  }
  function enhanceAllTables() {
    if (!isFiloTablesApp()) return;
    document.querySelectorAll(TABLE_SELECTOR).forEach(enhanceTable);
    document.querySelectorAll('#audiencesList .table').forEach(enhanceTable);
  }
  function scheduleEnhance() {
    if (enhanceTimer) clearTimeout(enhanceTimer);
    enhanceTimer = setTimeout(function () {
      enhanceTimer = null;
      enhanceAllTables();
    }, 40);
  }
  function bindObserver() {
    var root = document.querySelector('.content');
    if (!root || root.dataset.fdTableObserver === '1') return;
    root.dataset.fdTableObserver = '1';
    var observer = new MutationObserver(scheduleEnhance);
    observer.observe(root, { childList: true, subtree: true });
  }
  function patchNav() {
    if (!isFiloTablesApp() || window.__fdTableNavPatched) return;
    if (typeof window.nav !== 'function') return;
    window.__fdTableNavPatched = true;
    var orig = window.nav;
    window.nav = function (id) {
      var out = orig.apply(this, arguments);
      scheduleEnhance();
      return out;
    };
  }
  function initFdResponsiveTables() {
    if (!isFiloTablesApp()) return;
    enhanceAllTables();
    bindObserver();
    patchNav();
    window.addEventListener('resize', scheduleEnhance);
  }
  window.fdEnhanceResponsiveTables = enhanceAllTables;
  window.fdHeaderLabelForTable = headerLabel;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFdResponsiveTables);
  } else {
    initFdResponsiveTables();
  }
})();