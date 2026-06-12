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

  var WRITE_ACTION_SELECTORS = [
    '[data-requires-write]',
    '.fd-rbac-write',
    '.btn:not(.sec):not([data-allow-readonly])',
    '.btn.danger',
    '.btn.sec.danger',
    '.btn.sec.fd-rbac-write',
    '.a2w-bi-link-btn',
    '.a2w-bi-danger-zone button',
    '#a2wBiDangerActionHost button',
    '.card-actions .btn',
    '.pass-action-btn--danger',
    '.pass-bulk-bar .btn.danger',
    '.import-wizard__cta',
    '.empty-state__cta',
    'button[onclick*="delete"]',
    'button[onclick*="Delete"]',
    'button[onclick*="save"]',
    'button[onclick*="Save"]',
    'button[onclick*="openTemplateModal"]',
    'button[onclick*="openAudienceEditor"]',
    'button[onclick*="openMediaUpload"]',
    'button[onclick*="deleteAllMedia"]',
    'button[onclick*="editTemplate"]',
    'button[onclick*="editAudience"]',
    'button[onclick*="deleteAudience"]',
    'button[onclick*="deleteMedia"]',
    'button[onclick*="saveBrandIdentity"]',
    'button[onclick*="deletePass"]',
    'button[onclick*="openIwModal"]',
    'button[onclick*="editIwCampaign"]',
    'button[onclick*="deleteIwCampaign"]',
    'button[onclick*="openGamModal"]',
    'button[onclick*="editGamCampaign"]',
    'button[onclick*="deleteGamCampaign"]'
  ].join(',');

  var READONLY_SAFE_PATTERNS = /download|export|csv|close|annulla|cancel|deseleziona|copy|anteprima|preview|viewpass|dettaglio|precedente|successiva|pushtab|switchaudience|switchpush|mpfilter|useaudienceinpush|exportaudience|closemodal|closeaudience|closeiwmodal|closegammodal|gotostep|wzgo/i;

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

  function resolveWriteSection(el, sectionId) {
    var explicit = el.getAttribute('data-requires-write');
    if (explicit) {
      return UI_SECTION_MAP[explicit] ? explicit : explicit;
    }
    var host = el.closest('[data-rbac-section]');
    if (host) return host.getAttribute('data-rbac-section');
    return sectionId;
  }

  function isReadonlySafeAction(el) {
    if (el.getAttribute('data-allow-readonly') === 'true') return true;
    if (el.classList.contains('pass-action-btn--view')) return true;
    if (el.classList.contains('pass-id-copy')) return true;
    if (el.classList.contains('modal-close')) return true;
    if (el.getAttribute('type') === 'search' || el.getAttribute('role') === 'tab') return true;
    var onclick = el.getAttribute('onclick') || '';
    if (READONLY_SAFE_PATTERNS.test(onclick)) return true;
    if (el.classList.contains('sec') && !el.classList.contains('danger') && !el.classList.contains('fd-rbac-write') && !el.hasAttribute('data-requires-write')) {
      if (/download|export|csv|push|goprev|gonext|switch|filter|clearselection|deseleziona/i.test(onclick)) return true;
      if (!/delete|save|edit|open|upload|create|elimina|modifica|nuov|carica|svuota|salva/i.test(onclick)) return true;
    }
    return false;
  }

  function gateWriteElement(el, sectionId, role) {
    if (isReadonlySafeAction(el)) {
      el.classList.remove('fd-rbac-gated');
      el.removeAttribute('disabled');
      el.style.removeProperty('display');
      el.setAttribute('aria-hidden', 'false');
      return;
    }
    var allow = canWriteSection(sectionId, role);
    el.classList.toggle('fd-rbac-gated', !allow);
    if (el.tagName === 'BUTTON' || el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
      if (!allow) el.setAttribute('disabled', 'disabled');
      else el.removeAttribute('disabled');
    }
    if (!allow) {
      el.style.setProperty('display', 'none', 'important');
      el.setAttribute('aria-hidden', 'true');
    } else {
      el.style.removeProperty('display');
      el.setAttribute('aria-hidden', 'false');
    }
  }

  function ensureReadOnlyBanner(sectionEl, show) {
    var banner = sectionEl.querySelector(':scope > .fd-rbac-readonly-banner, :scope > div > .fd-rbac-readonly-banner');
    if (!banner) banner = sectionEl.querySelector('.fd-rbac-readonly-banner');
    if (show) {
      if (!banner) {
        banner = document.createElement('div');
        banner.className = 'fd-rbac-readonly-banner';
        banner.setAttribute('role', 'status');
        banner.textContent = 'Sola lettura — il tuo ruolo consente solo consultazione in questa sezione.';
        var header = sectionEl.querySelector('.a2w-bi-header, .page-title, .sec-title');
        if (header && header.parentElement) {
          header.parentElement.insertAdjacentElement('afterend', banner);
        } else {
          sectionEl.insertBefore(banner, sectionEl.firstChild);
        }
      }
      banner.hidden = false;
    } else if (banner) {
      banner.hidden = true;
    }
  }

  function shouldSkipWriteScan(el) {
    return !!(el.closest('#loginGate') || el.closest('.sidebar') || el.closest('.topbar') || el.closest('.user-menu'));
  }

  function scanWriteTargets(root, sectionId, role) {
    if (!root) return;
    root.querySelectorAll(WRITE_ACTION_SELECTORS).forEach(function (el) {
      if (shouldSkipWriteScan(el)) return;
      var sid = resolveWriteSection(el, sectionId);
      gateWriteElement(el, sid, role);
    });
    root.querySelectorAll('button[onclick*="deleteMediaItem"]').forEach(function (el) {
      if (shouldSkipWriteScan(el)) return;
      gateWriteElement(el, resolveWriteSection(el, sectionId), role);
    });
  }

  function scanSectionWriteActions(sectionId, role) {
    if (!isFiloApp() || !sectionId) return;
    var sectionEl = document.getElementById(sectionId);
    if (!sectionEl) return;
    var readonly = !canWriteSection(sectionId, role);
    sectionEl.classList.toggle('fd-rbac-section-readonly', readonly);
    ensureReadOnlyBanner(sectionEl, readonly);
    scanWriteTargets(sectionEl, sectionId, role);
  }

  function scanLinkedModals(sectionId, role) {
    document.querySelectorAll('[data-rbac-section="' + sectionId + '"]').forEach(function (modal) {
      if (modal.id === sectionId) return;
      scanWriteTargets(modal, sectionId, role);
    });
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
    var sid = activeSectionId ||
      (typeof global.getActiveSectionId === 'function' ? global.getActiveSectionId() : '');
    var readonly = sid && !canWriteSection(sid, role);
    document.body.classList.toggle('fd-rbac-readonly', !!readonly);
    document.body.classList.toggle('role-readonly', !!readonly);

    document.querySelectorAll('[data-requires-write]').forEach(function (el) {
      var section = el.getAttribute('data-requires-write') || sid;
      gateWriteElement(el, section, role);
    });

    if (sid) {
      scanSectionWriteActions(sid, role);
      scanLinkedModals(sid, role);
    }
  }

  function hookSectionRender(sectionId) {
    if (!isFiloApp()) return;
    applyReadOnlyMode(sectionId, getCurrentRole());
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

  global.fdRbacHook = hookSectionRender;

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
    hookSectionRender: hookSectionRender,
    UI_SECTION_MAP: UI_SECTION_MAP
  };
})(typeof window !== 'undefined' ? window : global);
