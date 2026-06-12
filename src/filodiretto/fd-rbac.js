/**
 * FiloDiretto — client RBAC (derived from session user.role, mirrors server matrix).
 */
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
