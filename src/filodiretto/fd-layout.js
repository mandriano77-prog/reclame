/**
 * Filo HR — sidebar open/close (desktop collapse + mobile sheet) + floating dropdown positioning.
 */
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
