/**
 * FD-03 — FiloDiretto users table (brand names, copy ID, kebab actions, protected badge).
 */
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
