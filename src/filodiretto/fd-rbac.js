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

  var WRITE_FORM_SECTIONS = { 'brand-identity': true };

  var FORM_FIELD_QUERY = 'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), select, textarea';

  var WRITE_ACTION_SELECTORS = [
    '[data-rbac-write]',
    '[data-requires-write]',
    '[data-fd-danger-btn]',
    '.fd-rbac-write',
    '.btn:not(.sec):not([data-allow-readonly])',
    '.btn.danger',
    '.btn.sec.danger',
    '.btn.sec.fd-rbac-write',
    '.a2w-bi-link-btn',
    '.a2w-ui-btn-destructive',
    '.fd-btn-danger-outline',
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

  var READONLY_SAFE_PATTERNS = /download|export|csv|close|annulla|cancel|deseleziona|copy|anteprima|preview|viewpass|dettaglio|precedente|successiva|pushtab|switchaudience|switchpush|mpfilter|useaudienceinpush|exportaudience|closemodal|closeaudience|closeiwmodal|closegammodal|gotostep|wzgo|loadactivitylog|loadpasses|exportanalytics|viewpassdetail|setanalytics/i;

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

  function getAllowlistEmails() {
    try {
      var raw = global.__2WALLET_LOGIN_ALLOWLIST__;
      if (!raw || !String(raw).trim()) {
        if (global.__2WALLET_PRODUCT_LOCK__ === 'hr') return ['admin@nudj.studio'];
        return [];
      }
      return String(raw).split(',').map(function (e) { return e.trim().toLowerCase(); }).filter(Boolean);
    } catch (_) {
      return [];
    }
  }

  function isAllowlistOperator(email) {
    if (!email) return false;
    var list = getAllowlistEmails();
    return list.indexOf(String(email).trim().toLowerCase()) >= 0;
  }

  function getCurrentRole() {
    try {
      if (global.currentUser) {
        if (isAllowlistOperator(global.currentUser.email)) return 'admin';
        if (global.currentUser.role) return normalizeRole(global.currentUser.role);
      }
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
    var r = getCurrentRole();
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

  function isReadControl(el) {
    if (!el) return false;
    if (el.getAttribute('data-allow-readonly') === 'true') return true;
    if (el.getAttribute('data-rbac-read') === 'true') return true;
    if (el.closest('[data-rbac-read-scope], .fd-rbac-read-scope, .fd-activity-log-toolbar, .analytics-toolbar, .analytics-actions')) return true;
    if (el.id === 'brandSelector' || el.id === 'passFilterCampaign' || el.id === 'passSearchInput') return true;
    if (el.classList.contains('pass-id-copy') || el.classList.contains('fd-activity-id-copy')) return true;
    if (el.classList.contains('analytics-chip')) return true;
    var type = String(el.type || '').toLowerCase();
    if (type === 'search') return true;
    var onclick = el.getAttribute('onclick') || '';
    if (/loadpasses|loadactivitylog|exportanalytics|viewpassdetail|onanalytics/i.test(onclick)) return true;
    return false;
  }

  function isExplicitWriteControl(el) {
    if (!el) return false;
    if (el.closest('#a2wBiDangerActionHost, .a2w-bi-danger-zone, .fd-danger-zone')) return true;
    if (el.getAttribute('data-fd-danger-btn')) return true;
    if (el.classList.contains('fd-btn-danger-outline')) return true;
    if (el.classList.contains('a2w-ui-btn-destructive')) return true;
    if (el.classList.contains('fd-rbac-write')) return true;
    if (el.hasAttribute('data-rbac-write')) return true;
    if (el.hasAttribute('data-requires-write')) return true;
    if (el.closest('.card-actions')) return true;
    return false;
  }

  function isReadonlySafeAction(el) {
    if (isExplicitWriteControl(el)) return false;
    if (el.getAttribute('data-allow-readonly') === 'true') return true;
    if (el.classList.contains('pass-action-btn--view')) return true;
    if (el.classList.contains('pass-id-copy')) return true;
    if (el.classList.contains('modal-close')) return true;
    if (el.getAttribute('type') === 'search' || el.getAttribute('role') === 'tab') return true;
    var onclick = el.getAttribute('onclick') || '';
    if (READONLY_SAFE_PATTERNS.test(onclick)) return true;
    if (el.classList.contains('sec') && !el.classList.contains('danger') && !el.classList.contains('fd-rbac-write') && !el.hasAttribute('data-requires-write')) {
      if (/download|export|csv|push|goprev|gonext|switch|filter|clearselection|deseleziona|cancel|annulla|close|chiudi/i.test(onclick)) return true;
      var label = (el.textContent || '').trim().toLowerCase();
      if (/^(annulla|chiudi|cancel|indietro|close)$/.test(label)) return true;
    }
    return false;
  }

  function shouldSkipFormFieldLock(el) {
    if (!el) return true;
    if (el.id === 'brandSelector') return true;
    if (el.getAttribute('data-allow-readonly') === 'true') return true;
    if (el.getAttribute('data-fd-rbac-field-exempt') === 'true') return true;
    if (el.closest('#loginGate, .sidebar, .topbar, .user-menu')) return true;
    return false;
  }

  function shouldLockFormField(el, sectionId, readonly) {
    if (!readonly || !el) return false;
    if (isReadControl(el)) return false;
    if (shouldSkipFormFieldLock(el)) return false;
    if (el.hasAttribute('data-rbac-write')) return true;
    if (el.closest('[data-rbac-write-form]')) return true;
    return !!WRITE_FORM_SECTIONS[sectionId];
  }

  function unlockFormField(el) {
    if (!el || el.getAttribute('data-fd-rbac-locked') !== '1') return;
    var wasDisabled = el.getAttribute('data-fd-rbac-was-disabled') === '1';
    el.removeAttribute('data-fd-rbac-locked');
    el.removeAttribute('data-fd-rbac-was-disabled');
    el.classList.remove('fd-rbac-field-locked');
    el.readOnly = false;
    el.disabled = wasDisabled;
  }

  function lockSectionFormFields(sectionEl, sectionId, readonly) {
    if (!sectionEl) return;
    sectionEl.querySelectorAll(FORM_FIELD_QUERY).forEach(function (el) {
      if (!shouldLockFormField(el, sectionId, readonly)) {
        if (!readonly) unlockFormField(el);
        return;
      }
      if (readonly) {
        if (el.getAttribute('data-fd-rbac-locked') === '1') return;
        el.setAttribute('data-fd-rbac-locked', '1');
        el.setAttribute('data-fd-rbac-was-disabled', el.disabled ? '1' : '0');
        el.classList.add('fd-rbac-field-locked');
        if (el.tagName === 'SELECT') {
          el.disabled = true;
        } else if (el.tagName === 'TEXTAREA') {
          el.readOnly = true;
          el.disabled = true;
        } else if (el.tagName === 'INPUT') {
          el.readOnly = true;
        }
      } else {
        unlockFormField(el);
      }
    });
  }

  function suppressBrandIdentityDirtyState() {
    try {
      if (global.brandIdentityState) global.brandIdentityState.dirty = false;
    } catch (_) {}
    var bar = document.getElementById('fdBiStickyBar');
    if (bar) bar.hidden = true;
    if (typeof global.a2wBiUpdateSaveStateBadge === 'function') {
      global.a2wBiUpdateSaveStateBadge('Salvato', '');
    }
  }

  function isActiveSectionReadOnly() {
    return document.body && document.body.classList.contains('fd-rbac-readonly');
  }

  function patchBrandIdentityDirtyFlows() {
    if (global.__fdRbacBiDirtyPatched) return;
    global.__fdRbacBiDirtyPatched = true;

    if (typeof global.a2wBiSyncDirtyState === 'function') {
      var origSync = global.a2wBiSyncDirtyState;
      global.a2wBiSyncDirtyState = function () {
        if (isActiveSectionReadOnly()) {
          suppressBrandIdentityDirtyState();
          return;
        }
        return origSync.apply(this, arguments);
      };
    }

    var origBindGuards = global.a2wBiBindGuards;
    if (typeof origBindGuards === 'function') {
      global.a2wBiBindGuards = function () {
        origBindGuards.apply(this, arguments);
        if (global.__fdRbacNavInnerPatched) return;
        global.__fdRbacNavInnerPatched = true;
        var navFn = global.nav;
        if (typeof navFn !== 'function') return;
        global.nav = async function fdRbacReadonlyNav(id) {
          if (isActiveSectionReadOnly()) suppressBrandIdentityDirtyState();
          return navFn.apply(this, arguments);
        };
      };
    }

    window.addEventListener('beforeunload', function () {
      if (isActiveSectionReadOnly() && global.brandIdentityState) {
        global.brandIdentityState.dirty = false;
      }
    }, true);
  }

  function restoreWriteElement(el) {
    if (!el || el.getAttribute('data-fd-rbac-gated') !== '1') return;
    el.removeAttribute('data-fd-rbac-gated');
    el.classList.remove('fd-rbac-neutralized');
    el.removeAttribute('disabled');
    el.removeAttribute('aria-disabled');
    el.removeAttribute('tabindex');
    el.style.removeProperty('display');
    el.style.removeProperty('pointer-events');
    el.style.removeProperty('visibility');
    el.setAttribute('aria-hidden', 'false');
  }

  function neutralizeWriteElement(el, sectionId, role) {
    if (isReadonlySafeAction(el)) {
      restoreWriteElement(el);
      el.classList.remove('fd-rbac-gated');
      return;
    }
    var allow = canWriteSection(sectionId, role);
    el.classList.toggle('fd-rbac-gated', !allow);
    if (allow) {
      restoreWriteElement(el);
      return;
    }
    if (!el.getAttribute('data-rbac-write')) {
      el.setAttribute('data-rbac-write', resolveWriteSection(el, sectionId) || sectionId || 'true');
    }
    el.setAttribute('data-fd-rbac-gated', '1');
    el.classList.add('fd-rbac-neutralized');
    if (el.tagName === 'BUTTON' || el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
      el.disabled = true;
      el.setAttribute('aria-disabled', 'true');
    }
    el.style.setProperty('display', 'none', 'important');
    el.style.setProperty('pointer-events', 'none', 'important');
    el.style.setProperty('visibility', 'hidden', 'important');
    el.setAttribute('tabindex', '-1');
    el.setAttribute('aria-hidden', 'true');
  }

  function gateWriteElement(el, sectionId, role) {
    neutralizeWriteElement(el, sectionId, role);
  }

  function markSectionReadScopes(sectionEl) {
    if (!sectionEl) return;
    sectionEl.querySelectorAll('.analytics-toolbar, .analytics-actions, .fd-activity-log-toolbar').forEach(function (el) {
      el.classList.add('fd-rbac-read-scope');
      el.setAttribute('data-rbac-read-scope', 'true');
    });
    ['passFilterCampaign', 'passSearchInput', 'analyticsTrendRange', 'analyticsDateFrom', 'analyticsDateTo'].forEach(function (id) {
      var el = sectionEl.querySelector('#' + id);
      if (el) el.setAttribute('data-rbac-read', 'true');
    });
  }

  function patchSaveBlockers() {
    if (global.__fdRbacSaveBlocked) return;
    global.__fdRbacSaveBlocked = true;

    if (typeof global.saveBrandIdentity === 'function') {
      var origSaveBi = global.saveBrandIdentity;
      global.saveBrandIdentity = async function () {
        if (isActiveSectionReadOnly()) return;
        return origSaveBi.apply(this, arguments);
      };
    }

    document.addEventListener('keydown', function (e) {
      if (!isActiveSectionReadOnly()) return;
      if ((e.ctrlKey || e.metaKey) && String(e.key || '').toLowerCase() === 's') {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);

    document.addEventListener('submit', function (e) {
      if (!isActiveSectionReadOnly()) return;
      e.preventDefault();
      e.stopPropagation();
    }, true);
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

  function observeSectionFields(sectionEl, sectionId) {
    if (!sectionEl || sectionEl.dataset.fdRbacFieldObs === '1') return;
    sectionEl.dataset.fdRbacFieldObs = '1';
    var obs = new MutationObserver(function () {
      var readonly = !canWriteSection(sectionId, getCurrentRole());
      if (readonly) {
        lockSectionFormFields(sectionEl, sectionId, true);
        markSectionReadScopes(sectionEl);
        scanWriteTargets(sectionEl, sectionId, getCurrentRole());
      }
    });
    obs.observe(sectionEl, { childList: true, subtree: true, attributes: false });
  }

  function scanSectionWriteActions(sectionId, role) {
    if (!isFiloApp() || !sectionId) return;
    var sectionEl = document.getElementById(sectionId);
    if (!sectionEl) return;
    var readonly = !canWriteSection(sectionId, role);
    sectionEl.classList.toggle('fd-rbac-section-readonly', readonly);
    ensureReadOnlyBanner(sectionEl, readonly);
    markSectionReadScopes(sectionEl);
    lockSectionFormFields(sectionEl, sectionId, readonly);
    observeSectionFields(sectionEl, sectionId);
    scanWriteTargets(sectionEl, sectionId, role);
    if (readonly && sectionId === 'brand-identity') suppressBrandIdentityDirtyState();
  }

  function scanLinkedModals(sectionId, role) {
    var readonly = !canWriteSection(sectionId, role);
    document.querySelectorAll('[data-rbac-section="' + sectionId + '"]').forEach(function (modal) {
      if (modal.id === sectionId) return;
      lockSectionFormFields(modal, sectionId, readonly);
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
    role = getCurrentRole();
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
    role = getCurrentRole();
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
    role = getCurrentRole();
    applyBodyRoleClasses(role);
    applyNavGating(role);
    applyReadOnlyMode(null, role);
  }

  function initFdRbac() {
    if (!isFiloApp()) return;
    patchBrandIdentityDirtyFlows();
    patchSaveBlockers();
    syncRbac(getCurrentRole());
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
    isActiveSectionReadOnly: isActiveSectionReadOnly,
    UI_SECTION_MAP: UI_SECTION_MAP
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFdRbac);
  } else {
    initFdRbac();
  }
})(typeof window !== 'undefined' ? window : global);
