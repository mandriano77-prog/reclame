/**
 * FiloDiretto / Ads2Wallet dashboard RBAC — server-side source of truth.
 * Roles: admin | manager | sender | reporter (viewer → reporter legacy alias).
 */
'use strict';

const ROLES = Object.freeze(['admin', 'manager', 'sender', 'reporter']);

const SECTION_PERMS = Object.freeze({
  manager: {
    brand_identity: 'full',
    media_library: 'full',
    templates: 'full',
    passes: 'full',
    push: 'full',
    rewards: 'full',
    challenges: 'full',
    employees: 'full',
    audiences: 'full',
    analytics: 'full',
    activity_log: 'none',
    users: 'none',
    welcome: 'full',
  },
  sender: {
    brand_identity: 'none',
    media_library: 'read',
    templates: 'read',
    passes: 'read',
    push: 'full',
    rewards: 'read',
    challenges: 'read',
    employees: 'none',
    audiences: 'read',
    analytics: 'read',
    activity_log: 'none',
    users: 'none',
    welcome: 'read',
  },
  reporter: {
    brand_identity: 'read',
    media_library: 'none',
    templates: 'none',
    passes: 'read',
    push: 'none',
    rewards: 'none',
    challenges: 'none',
    employees: 'none',
    audiences: 'none',
    analytics: 'read',
    activity_log: 'read',
    users: 'none',
    welcome: 'read',
  },
});

/** UI section id → RBAC section key */
const UI_SECTION_MAP = Object.freeze({
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
  users: 'users',
  campaigns: 'push',
});

const DEFAULT_LANDING = Object.freeze({
  admin: 'welcome',
  manager: 'welcome',
  sender: 'push',
  reporter: 'analytics',
});

function normalizeRole(role) {
  const r = String(role || 'manager').toLowerCase();
  if (r === 'viewer') return 'reporter';
  if (ROLES.includes(r)) return r;
  return 'manager';
}

function isValidRole(role) {
  return ROLES.includes(normalizeRole(role));
}

function sectionAccess(role, section) {
  const r = normalizeRole(role);
  if (r === 'admin') return 'full';
  const map = SECTION_PERMS[r];
  if (!map) return 'none';
  return map[section] || 'none';
}

function canRead(role, section) {
  const access = sectionAccess(role, section);
  return access === 'full' || access === 'read';
}

function canWrite(role, section) {
  return sectionAccess(role, section) === 'full';
}

function uiSectionKey(sectionId) {
  return UI_SECTION_MAP[sectionId] || null;
}

function canAccessUiSection(role, sectionId) {
  const key = uiSectionKey(sectionId);
  if (!key) return normalizeRole(role) === 'admin';
  return canRead(role, key);
}

function canWriteUiSection(role, sectionId) {
  const key = uiSectionKey(sectionId);
  if (!key) return normalizeRole(role) === 'admin';
  return canWrite(role, key);
}

function defaultLandingSection(role) {
  const r = normalizeRole(role);
  return DEFAULT_LANDING[r] || 'welcome';
}

function userMayAccessBrand(user, brandId) {
  if (!user) return false;
  if (normalizeRole(user.role) === 'admin') return true;
  const bid = brandId !== undefined && brandId !== null && String(brandId).length ? String(brandId) : '';
  const assigned =
    user.brand_id !== undefined && user.brand_id !== null && String(user.brand_id).length
      ? String(user.brand_id)
      : '';
  return bid !== '' && assigned !== '' && bid === assigned;
}

/** Classify authenticated API routes; null = no RBAC section gate (brand checks may still apply). */
function classifyApiRoute(method, path) {
  const m = String(method || 'GET').toUpperCase();
  const p = String(path || '').split('?')[0];
  const write = m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS';

  if (p === '/auth/me' || p === '/auth/change-password') return null;
  if (p === '/brands' && m === 'GET') return null;
  if (p === '/geocode/search' || p === '/geocode/reverse') return { section: 'push', write: false };

  if (/^\/users(?:\/|$)/.test(p)) return { section: 'users', write };

  if (/^\/events\//.test(p)) return { section: 'activity_log', write: false };

  if (/^\/analytics\//.test(p)) return { section: 'analytics', write: false };

  if (/^\/push(?:\/|$)/.test(p)) return { section: 'push', write };
  if (/^\/brands\/[^/]+\/geofencing$/.test(p)) return { section: 'push', write };
  if (/^\/brands\/[^/]+\/push-assistant\//.test(p)) return { section: 'push', write: !write ? false : write };

  if (/^\/templates(?:\/|$)/.test(p)) return { section: 'templates', write };
  if (/^\/passes(?:\/|$)/.test(p) && !/\/download$/.test(p)) return { section: 'passes', write };

  if (/^\/instant-win(?:\/|$)/.test(p)) return { section: 'rewards', write };
  if (/^\/gamification\//.test(p)) return { section: 'challenges', write };

  if (/^\/media(?:\/|$)/.test(p)) return { section: 'media_library', write };
  if (/^\/brands\/[^/]+\/strip-promos/.test(p) || /^\/strip-promos(?:\/|$)/.test(p)) {
    return { section: 'media_library', write };
  }

  if (
    /^\/brands\/[^/]+\/(employees|leads|members|activation)/.test(p) ||
    /^\/members(?:\/|$)/.test(p)
  ) {
    return { section: 'employees', write };
  }

  if (/^\/audiences(?:\/|$)/.test(p) || /^\/brands\/[^/]+\/audiences/.test(p)) {
    return { section: 'audiences', write };
  }
  if (/^\/brands\/[^/]+\/holder-events/.test(p)) return { section: 'audiences', write: false };

  if (/^\/brands\/[^/]+\/(logo|strip|landing-bg|wallet-icon|ai-strip|ai-copy|ai-creative)/.test(p)) {
    return { section: 'brand_identity', write };
  }
  if (m === 'GET' && /^\/brands\/[^/]+$/.test(p)) return { section: 'brand_identity', write: false };
  if (/^\/brands\/[^/]+$/.test(p) && m !== 'GET') return { section: 'brand_identity', write: true };
  if (p === '/brands' && m === 'POST') return { section: 'brand_identity', write: true };

  if (/^\/campaigns(?:\/|$)/.test(p)) return { section: 'push', write };

  return null;
}

function enforceApiPermission(user, method, path) {
  if (!user) return { ok: false, status: 401, error: 'Non autenticato' };
  const rule = classifyApiRoute(method, path);
  if (!rule) return { ok: true };
  const role = normalizeRole(user.role);
  if (rule.write) {
    if (!canWrite(role, rule.section)) {
      return { ok: false, status: 403, error: 'Permessi insufficienti per questa operazione' };
    }
  } else if (!canRead(role, rule.section)) {
    return { ok: false, status: 403, error: 'Accesso non consentito per questo ruolo' };
  }
  return { ok: true };
}

function rbacApiMiddleware(req, res, next) {
  if (!req.user) return next();
  const result = enforceApiPermission(req.user, req.method, req.path);
  if (!result.ok) return res.status(result.status).json({ error: result.error });
  return next();
}

module.exports = {
  ROLES,
  normalizeRole,
  isValidRole,
  sectionAccess,
  canRead,
  canWrite,
  uiSectionKey,
  canAccessUiSection,
  canWriteUiSection,
  defaultLandingSection,
  userMayAccessBrand,
  classifyApiRoute,
  enforceApiPermission,
  rbacApiMiddleware,
  UI_SECTION_MAP,
};
