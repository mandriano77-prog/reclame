/**
 * FD — FiloDiretto profile section (read-only account info + change password).
 */
(function () {
  'use strict';

  function isFiloProfileApp() {
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
      reporter: 'Reporter'
    }[r] || role;
  }

  function resolveBrandLabel(user, brandMap) {
    if (!user) return '—';
    var role = normalizeUserRole(user.role);
    if (role === 'admin' || user.brand_id == null || user.brand_id === '') {
      return 'Tutti i brand';
    }
    var bid = String(user.brand_id);
    if (brandMap && brandMap[bid]) return brandMap[bid];
    var sel = document.getElementById('brandSelector');
    if (sel) {
      var opt = Array.from(sel.options || []).find(function (o) { return String(o.value) === bid; });
      if (opt && opt.textContent) return String(opt.textContent).trim();
    }
    return bid.substring(0, 8) + '…';
  }

  async function loadBrandMap() {
    var map = {};
    try {
      if (window.brandsListCache && window.brandsListCache.length) {
        window.brandsListCache.forEach(function (b) {
          if (b && b.id) map[String(b.id)] = b.name || b.slug || String(b.id);
        });
      }
    } catch (_) {}
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

  async function fetchCurrentUser() {
    try {
      var res = await fetch(getApiBase() + '/auth/me', { headers: authHeaders() });
      if (!res.ok) return window.currentUser || null;
      var data = await res.json();
      if (data && data.user) {
        if (typeof window.setCurrentUser === 'function') window.setCurrentUser(data.user);
        return data.user;
      }
    } catch (_) {}
    return window.currentUser || null;
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value || '—';
  }

  function ensureProfileChrome() {
    var section = document.getElementById('profile');
    if (!section) return;
    section.classList.add('profile--fd');
  }

  function wirePasswordForm() {
    if (document.body.dataset.fdProfilePasswordBound === '1') return;
    document.body.dataset.fdProfilePasswordBound = '1';
    var btn = document.getElementById('fdProfilePasswordBtn');
    if (!btn) return;
    btn.addEventListener('click', submitProfilePasswordChange);
  }

  function clearPasswordMessages() {
    var err = document.getElementById('fdProfilePasswordError');
    var ok = document.getElementById('fdProfilePasswordSuccess');
    if (err) { err.style.display = 'none'; err.textContent = ''; }
    if (ok) { ok.style.display = 'none'; ok.textContent = ''; }
  }

  async function submitProfilePasswordChange() {
    clearPasswordMessages();
    var currentEl = document.getElementById('fdProfileCurrentPassword');
    var nextEl = document.getElementById('fdProfileNewPassword');
    var confirmEl = document.getElementById('fdProfileConfirmPassword');
    var errEl = document.getElementById('fdProfilePasswordError');
    var okEl = document.getElementById('fdProfilePasswordSuccess');
    var btn = document.getElementById('fdProfilePasswordBtn');
    var current = currentEl ? currentEl.value : '';
    var next = nextEl ? nextEl.value : '';
    var confirm = confirmEl ? confirmEl.value : '';

    if (!current || !next) {
      if (errEl) {
        errEl.textContent = 'Inserisci la password attuale e quella nuova.';
        errEl.style.display = 'block';
      }
      return;
    }
    if (next.length < 8) {
      if (errEl) {
        errEl.textContent = 'La nuova password deve avere almeno 8 caratteri.';
        errEl.style.display = 'block';
      }
      return;
    }
    if (next !== confirm) {
      if (errEl) {
        errEl.textContent = 'La conferma non coincide con la nuova password.';
        errEl.style.display = 'block';
      }
      return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Salvataggio…'; }
    try {
      var res = await fetch(getApiBase() + '/auth/change-password', {
        method: 'PUT',
        headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
        body: JSON.stringify({ current_password: current, new_password: next })
      });
      var data = {};
      try { data = await res.json(); } catch (_) {}
      if (!res.ok) {
        if (errEl) {
          errEl.textContent = data.error || 'Aggiornamento non riuscito';
          errEl.style.display = 'block';
        }
        return;
      }
      if (currentEl) currentEl.value = '';
      if (nextEl) nextEl.value = '';
      if (confirmEl) confirmEl.value = '';
      if (okEl) {
        okEl.textContent = 'Password aggiornata.';
        okEl.style.display = 'block';
      }
      toast('Password aggiornata');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Aggiorna password'; }
    }
  }

  async function fdLoadProfile() {
    if (!isFiloProfileApp()) return;
    ensureProfileChrome();
    wirePasswordForm();
    clearPasswordMessages();

    var user = await fetchCurrentUser();
    if (!user) return;

    var brandMap = await loadBrandMap();
    var name = String(user.name || '').trim() || '—';
    var email = String(user.email || '').trim() || '—';
    var role = roleLabel(user.role);

    setText('fdProfileName', name);
    setText('fdProfileEmail', email);
    setText('fdProfileBrand', resolveBrandLabel(user, brandMap));

    var roleEl = document.getElementById('fdProfileRole');
    if (roleEl) {
      roleEl.innerHTML = '<span class="fd-profile-role">' + esc(role) + '</span>';
    }
  }

  window.fdLoadProfile = fdLoadProfile;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (isFiloProfileApp()) ensureProfileChrome();
    });
  } else if (isFiloProfileApp()) {
    ensureProfileChrome();
  }
})();
