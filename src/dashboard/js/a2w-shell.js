/**
 * Ads2Wallet shell — JS injection for dark deploy only (studio.ads2wallet.com).
 * Filodiretto (data-shell=light) is never touched.
 */
(function () {
  'use strict';

  const A2W = window.A2W = window.A2W || {};
  const A2W_SIDEBAR_COLLAPSED_KEY = 'a2w:sidebar:collapsed';
  const A2W_SIDEBAR_MOBILE_BREAKPOINT = '(max-width: 1023px)';
  const A2W_ICON_STROKE = 'currentColor';

  function isA2wDeploy() {
    if (typeof isFiloShell === 'function' && isFiloShell()) return false;
    try {
      const locked = typeof getLockedProductLine === 'function' ? getLockedProductLine() : null;
      if (locked) return locked === 'ads';
    } catch (_) {}
    const h = (window.location.hostname || '').toLowerCase();
    if (h.includes('ads2wallet')) return true;
    const pl = typeof getDashboardProductLine === 'function' ? getDashboardProductLine() : null;
    return pl === 'ads';
  }

  function isA2wActive() {
    return isA2wDeploy() && document.documentElement.classList.contains('a2w-shell');
  }

  if (!isA2wDeploy()) return;
  console.debug('[A2W] shell loaded — FiloDiretto safe mode: ON');

  A2W.icons = A2W.icons || {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="' + A2W_ICON_STROKE + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.8 12 3l9 7.8"/><path d="M5 9.8V21h14V9.8"/></svg>',
    brand: '<svg viewBox="0 0 24 24" fill="none" stroke="' + A2W_ICON_STROKE + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16v12H4z"/><path d="M4 10h16"/><path d="M8 14h3"/></svg>',
    media: '<svg viewBox="0 0 24 24" fill="none" stroke="' + A2W_ICON_STROKE + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5.5-5.5L7 19"/></svg>',
    templates: '<svg viewBox="0 0 24 24" fill="none" stroke="' + A2W_ICON_STROKE + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v14H4z"/><path d="M4 9h16"/><path d="M8 13h3"/><path d="M8 17h8"/></svg>',
    pass: '<svg viewBox="0 0 24 24" fill="none" stroke="' + A2W_ICON_STROKE + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/></svg>',
    campaigns: '<svg viewBox="0 0 24 24" fill="none" stroke="' + A2W_ICON_STROKE + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v14H4z"/><path d="M8 12h8"/><path d="M8 9h8"/><path d="M8 15h4"/></svg>',
    push: '<svg viewBox="0 0 24 24" fill="none" stroke="' + A2W_ICON_STROKE + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>',
    instantWin: '<svg viewBox="0 0 24 24" fill="none" stroke="' + A2W_ICON_STROKE + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v4"/><path d="m4.93 4.93 2.83 2.83"/><path d="M2 12h4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M12 18v4"/><path d="m16.24 16.24 2.83 2.83"/><path d="M18 12h4"/><path d="m16.24 7.76 2.83-2.83"/><circle cx="12" cy="12" r="3"/></svg>',
    gamification: '<svg viewBox="0 0 24 24" fill="none" stroke="' + A2W_ICON_STROKE + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4h12v4a6 6 0 0 1-6 6 6 6 0 0 1-6-6Z"/><path d="M8 20h8"/><path d="M12 14v6"/><path d="M6 6H4a2 2 0 0 0 0 4h2"/><path d="M18 6h2a2 2 0 0 1 0 4h-2"/></svg>',
    contacts: '<svg viewBox="0 0 24 24" fill="none" stroke="' + A2W_ICON_STROKE + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/></svg>',
    audience: '<svg viewBox="0 0 24 24" fill="none" stroke="' + A2W_ICON_STROKE + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    analytics: '<svg viewBox="0 0 24 24" fill="none" stroke="' + A2W_ICON_STROKE + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="m7 14 3-3 3 2 4-5"/></svg>',
    logs: '<svg viewBox="0 0 24 24" fill="none" stroke="' + A2W_ICON_STROKE + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h5"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="' + A2W_ICON_STROKE + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="3.5"/><path d="M20 8v6"/><path d="M23 11h-6"/></svg>',
    collapse: '<svg viewBox="0 0 24 24" fill="none" stroke="' + A2W_ICON_STROKE + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>'
  };

  function a2wReadSidebarCollapsedPref() {
    try {
      return localStorage.getItem(A2W_SIDEBAR_COLLAPSED_KEY) === '1';
    } catch (_) {
      return false;
    }
  }

  function a2wWriteSidebarCollapsedPref(collapsed) {
    try {
      localStorage.setItem(A2W_SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch (_) {}
  }

  function a2wIsSidebarMobileMode() {
    try {
      return window.matchMedia(A2W_SIDEBAR_MOBILE_BREAKPOINT).matches;
    } catch (_) {
      return false;
    }
  }

  function a2wSidebarState() {
    A2W.sidebar = A2W.sidebar || {};
    return A2W.sidebar;
  }

  function a2wDispatchSidebarEvent(eventName, detail) {
    document.dispatchEvent(new CustomEvent(eventName, { detail: detail || {} }));
  }

  function a2wGetActiveBrandLabel() {
    const select = document.getElementById('brandSelector');
    if (!select) return '';
    const option = select.options[select.selectedIndex];
    if (!option) return '';
    return String(option.textContent || '').trim();
  }

  function a2wGetBrandInitials(label) {
    if (!label) return 'A2';
    const parts = label.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return label.slice(0, 2).toUpperCase();
  }

  function a2wEnsureSidebarWorkspaceSwitcher() {
    const sidebar = document.querySelector('.layout .sidebar');
    const picker = document.querySelector('.a2w-brand-picker');
    if (!sidebar || !picker) return;

    let shell = document.getElementById('a2wSidebarWorkspace');
    if (!shell) {
      shell = document.createElement('div');
      shell.id = 'a2wSidebarWorkspace';
      shell.className = 'a2w-sidebar-workspace';
      shell.setAttribute('data-a2w-component', 'workspace-switcher');
      shell.innerHTML = [
        '<span class="a2w-sidebar-workspace__label">Workspace</span>',
        '<div class="a2w-sidebar-workspace__row">',
        '  <button type="button" id="a2wWorkspaceBrandTile" class="a2w-workspace-brand-tile" aria-label="Brand attivo" title=""></button>',
        '</div>'
      ].join('');
      const anchor = sidebar.querySelector('.logo');
      if (anchor && anchor.nextSibling) sidebar.insertBefore(shell, anchor.nextSibling);
      else sidebar.appendChild(shell);
    }

    const row = shell.querySelector('.a2w-sidebar-workspace__row');
    if (row && picker.parentNode !== row) row.appendChild(picker);

    const tile = document.getElementById('a2wWorkspaceBrandTile');
    const brandName = a2wGetActiveBrandLabel() || (document.getElementById('breadcrumbBrand')?.textContent || '').trim();
    if (tile) {
      tile.textContent = a2wGetBrandInitials(brandName);
      tile.title = brandName || 'Seleziona brand';
      tile.setAttribute('data-a2w-tooltip-label', brandName || 'Seleziona brand');
      tile.onclick = function () {
        const select = document.getElementById('brandSelector');
        if (select) select.focus();
      };
    }
  }

  function a2wEnsureSidebarToggleButton() {
    const footer = document.querySelector('.layout .sidebar .sidebar-footer');
    if (!footer || document.getElementById('a2wSidebarToggleBtn')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'a2wSidebarToggleBtn';
    btn.className = 'a2w-sidebar-toggle-btn';
    btn.setAttribute('data-a2w-component', 'sidebar-toggle');
    btn.setAttribute('aria-label', 'Comprimi sidebar');
    btn.setAttribute('data-a2w-tooltip-label', 'Comprimi sidebar');
    btn.innerHTML = A2W.icons.collapse + '<span class="a2w-sidebar-toggle-btn__label">Comprimi</span>';
    btn.addEventListener('click', a2wHandleSidebarToggleClick, { capture: false });
    footer.appendChild(btn);
  }

  function a2wApplySidebarCollapsedState(requestedCollapsed) {
    const root = document.documentElement;
    const mobile = a2wIsSidebarMobileMode();
    const collapsed = !mobile && !!requestedCollapsed;
    root.classList.toggle('a2w-sidebar-collapsed', collapsed);
    const btn = document.getElementById('a2wSidebarToggleBtn');
    if (btn) {
      const tooltipLabel = collapsed ? 'Espandi sidebar' : 'Comprimi sidebar';
      btn.setAttribute('aria-label', tooltipLabel);
      btn.setAttribute('data-a2w-tooltip-label', tooltipLabel);
      const label = btn.querySelector('.a2w-sidebar-toggle-btn__label');
      if (label) label.textContent = collapsed ? 'Espandi' : 'Comprimi';
    }
    a2wDispatchSidebarEvent('a2w:sidebar:state', { collapsed: collapsed, mobile: mobile });
  }

  function a2wHandleSidebarToggleClick() {
    const current = document.documentElement.classList.contains('a2w-sidebar-collapsed');
    const next = !current;
    a2wWriteSidebarCollapsedPref(next);
    a2wApplySidebarCollapsedState(next);
    a2wDispatchSidebarEvent('a2w:sidebar:toggle', { collapsed: next });
  }

  function a2wHandleSidebarViewportChange() {
    a2wApplySidebarCollapsedState(a2wReadSidebarCollapsedPref());
  }

  function a2wEnsureSidebarIcons() {
    const iconMap = {
      welcome: 'home',
      'brand-identity': 'brand',
      'media-library': 'media',
      templates: 'templates',
      passes: 'pass',
      campaigns: 'campaigns',
      push: 'push',
      'instant-win': 'instantWin',
      gamification: 'gamification',
      leads: 'contacts',
      audiences: 'audience',
      analytics: 'analytics',
      'activity-log': 'logs',
      users: 'users'
    };

    document.querySelectorAll('.sidebar .nav-item').forEach((item) => {
      const sectionId = item.dataset.sectionId || (item.id === 'navItemWelcome' ? 'welcome' : '');
      const defaultText = String(item.getAttribute('data-menu-default') || '').toLowerCase();
      const currentText = String(item.textContent || '').toLowerCase();
      const iconKey = iconMap[sectionId]
        || (/contatti/.test(defaultText) || /contatti/.test(currentText) ? 'contacts' : '')
        || (/audience/.test(defaultText) || /audience/.test(currentText) ? 'audience' : '');
      const iconSvg = iconKey ? A2W.icons[iconKey] : '';

      const textNodes = [...item.childNodes]
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => String(n.textContent || '').trim())
        .filter(Boolean);
      const existingLabel = String(item.querySelector('.a2w-nav-label')?.textContent || '').trim();
      const resolvedLabel = existingLabel || textNodes.join(' ') || String(item.textContent || '').trim();

      const preservedChildren = [...item.children].filter((el) => !el.classList.contains('a2w-nav-icon') && !el.classList.contains('a2w-nav-label'));
      item.textContent = '';

      if (iconSvg) {
        const icon = document.createElement('span');
        icon.className = 'a2w-nav-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.innerHTML = iconSvg;
        item.appendChild(icon);
      }

      const label = document.createElement('span');
      label.className = 'a2w-nav-label';
      label.textContent = resolvedLabel;
      item.appendChild(label);
      preservedChildren.forEach((child) => item.appendChild(child));

      const labelText = String(label.textContent || '').trim();
      if (labelText) item.setAttribute('data-a2w-tooltip-label', labelText);
    });
  }

  function a2wEnsureTooltipNode() {
    const state = a2wSidebarState();
    if (state.tooltipNode) return state.tooltipNode;
    const node = document.createElement('div');
    node.id = 'a2wSidebarTooltip';
    node.className = 'a2w-tooltip';
    node.setAttribute('data-a2w-component', 'tooltip');
    node.setAttribute('role', 'tooltip');
    node.setAttribute('aria-hidden', 'true');
    document.body.appendChild(node);
    state.tooltipNode = node;
    return node;
  }

  function a2wHideTooltip() {
    const node = a2wSidebarState().tooltipNode || document.getElementById('a2wSidebarTooltip');
    if (!node) return;
    node.textContent = '';
    node.setAttribute('data-visible', 'false');
    node.setAttribute('aria-hidden', 'true');
  }

  function a2wShowTooltip(target) {
    if (!target || !document.documentElement.classList.contains('a2w-sidebar-collapsed')) return;
    const label = target.getAttribute('data-a2w-tooltip-label');
    if (!label) return;
    const node = a2wEnsureTooltipNode();
    node.textContent = label;
    node.setAttribute('data-visible', 'true');
    node.setAttribute('aria-hidden', 'false');
    const rect = target.getBoundingClientRect();
    node.style.left = `${Math.round(rect.right + 10)}px`;
    node.style.top = `${Math.round(rect.top + (rect.height / 2) - 16)}px`;
    a2wDispatchSidebarEvent('a2w:tooltip:show', { label: label });
  }

  function a2wHandleTooltipMouseIn(event) {
    const target = event.target.closest('.sidebar .nav-item, #a2wWorkspaceBrandTile, #a2wSidebarToggleBtn');
    if (!target) return;
    a2wShowTooltip(target);
  }

  function a2wHandleTooltipMouseOut(event) {
    const target = event.target.closest('.sidebar .nav-item, #a2wWorkspaceBrandTile, #a2wSidebarToggleBtn');
    if (!target) return;
    a2wHideTooltip();
  }

  function a2wHandleTooltipFocusIn(event) {
    const target = event.target.closest('.sidebar .nav-item, #a2wWorkspaceBrandTile, #a2wSidebarToggleBtn');
    if (!target) return;
    a2wShowTooltip(target);
  }

  function a2wHandleTooltipFocusOut(event) {
    const target = event.target.closest('.sidebar .nav-item, #a2wWorkspaceBrandTile, #a2wSidebarToggleBtn');
    if (!target) return;
    a2wHideTooltip();
  }

  function a2wRefreshSidebarChrome() {
    a2wEnsureSidebarWorkspaceSwitcher();
    a2wEnsureSidebarIcons();
  }

  function initA2WSidebarSyncHooks() {
    const state = a2wSidebarState();
    if (state.syncHooksBound) return;
    state.syncHooksBound = true;

    const wrapMenuCopy = () => {
      if (typeof applyProductMenuCopy !== 'function') return false;
      if (applyProductMenuCopy.__a2wSidebarWrapped === '1') return true;
      const original = applyProductMenuCopy;
      const wrapped = function a2wApplyProductMenuCopyWrapped() {
        const result = original.apply(this, arguments);
        a2wRefreshSidebarChrome();
        return result;
      };
      wrapped.__a2wSidebarWrapped = '1';
      window.applyProductMenuCopy = wrapped;
      return true;
    };

    if (!wrapMenuCopy()) {
      // Some deploys initialize i18n copy after shell boot.
      window.setTimeout(() => {
        if (wrapMenuCopy()) a2wRefreshSidebarChrome();
      }, 200);
    }
  }

  function initA2WSidebarChrome() {
    a2wRefreshSidebarChrome();
    a2wEnsureSidebarToggleButton();
    a2wApplySidebarCollapsedState(a2wReadSidebarCollapsedPref());
    initA2WSidebarSyncHooks();
    const state = a2wSidebarState();
    if (!state.bound) {
      state.bound = true;
      document.addEventListener('mouseover', a2wHandleTooltipMouseIn, { capture: false });
      document.addEventListener('mouseout', a2wHandleTooltipMouseOut, { capture: false });
      document.addEventListener('focusin', a2wHandleTooltipFocusIn, { capture: false });
      document.addEventListener('focusout', a2wHandleTooltipFocusOut, { capture: false });
      window.addEventListener('resize', a2wHandleSidebarViewportChange, { passive: true });
    }
  }

  function a2wMediaState() {
    A2W.media = A2W.media || {};
    return A2W.media;
  }

  function a2wMediaSpecsMap() {
    return {
      logo: 'PNG trasparente, max 320x100 px. Un logo chiaro migliora leggibilita nel pass.',
      strip: 'PNG/JPG 750x246 px. Usa immagini promozionali con testo minimo e focus visuale.',
      thumbnail: 'PNG/JPG 90x90 px. Usato nel fronte Event Ticket come miniatura.',
      background: 'PNG/JPG 360x440 px. Sfondo intero su Event Ticket, preferire contrasto alto.'
    };
  }

  function a2wMediaSection() {
    return document.getElementById('media-library');
  }

  function a2wMediaFindCardByHostId(hostId) {
    const host = document.getElementById(hostId);
    return host ? host.closest('.card') : null;
  }

  function a2wEnsureMediaPageMenu(section) {
    if (!section) return;
    const head = section.querySelector(':scope > div');
    if (!head) return;
    const actions = head.querySelector('div');
    if (!actions) return;
    actions.classList.add('a2w-media-page-actions');

    const uploadBtn = actions.querySelector('button[onclick*="openMediaUpload"]');
    const deleteBtn = actions.querySelector('button[onclick*="deleteAllMedia"]');
    if (uploadBtn) uploadBtn.classList.add('a2w-media-upload-btn');

    let menuWrap = actions.querySelector('.a2w-media-page-menu');
    if (!menuWrap) {
      menuWrap = document.createElement('div');
      menuWrap.className = 'a2w-media-page-menu';
      menuWrap.setAttribute('data-a2w-component', 'media-page-menu');
      menuWrap.innerHTML = [
        '<button type="button" class="a2w-icon-btn a2w-media-kebab-btn" aria-label="Azioni media library" data-a2w-tooltip-label="Azioni pagina">⋯</button>',
        '<div class="a2w-media-kebab-menu" hidden>',
        '  <button type="button" class="a2w-media-kebab-item a2w-media-kebab-item--danger">Svuota tutto</button>',
        '</div>'
      ].join('');
      actions.appendChild(menuWrap);
    }

    if (deleteBtn) deleteBtn.style.display = 'none';

    const trigger = menuWrap.querySelector('.a2w-media-kebab-btn');
    const panel = menuWrap.querySelector('.a2w-media-kebab-menu');
    const clearItem = menuWrap.querySelector('.a2w-media-kebab-item--danger');
    if (!trigger || !panel || !clearItem) return;

    if (!trigger.dataset.a2wBound) {
      trigger.dataset.a2wBound = '1';
      trigger.addEventListener('click', function a2wMediaMenuToggle(e) {
        e.stopPropagation();
        const open = panel.hidden;
        panel.hidden = !open;
        trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
      }, { capture: false });
    }

    if (!clearItem.dataset.a2wBound) {
      clearItem.dataset.a2wBound = '1';
      clearItem.addEventListener('click', function a2wMediaClearAll() {
        panel.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
        if (typeof deleteAllMedia === 'function') deleteAllMedia();
      }, { capture: false });
    }

    const state = a2wMediaState();
    if (!state.menuCloseBound) {
      state.menuCloseBound = true;
      document.addEventListener('click', function a2wMediaMenuDocClick() {
        const p = document.querySelector('.a2w-media-kebab-menu');
        const t = document.querySelector('.a2w-media-kebab-btn');
        if (p) p.hidden = true;
        if (t) t.setAttribute('aria-expanded', 'false');
      }, { capture: false });
    }
  }

  function a2wEnsureMediaSpecButton(card, bucketKey) {
    if (!card) return;
    const title = card.querySelector('.sec-title');
    if (!title || card.querySelector('.a2w-media-spec-btn')) return;
    const head = document.createElement('div');
    head.className = 'a2w-media-bucket-head';
    title.parentNode.insertBefore(head, title);
    head.appendChild(title);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'a2w-icon-btn a2w-media-spec-btn';
    btn.setAttribute('data-a2w-component', 'media-spec-tooltip');
    btn.setAttribute('aria-label', 'Specifiche ' + bucketKey);
    btn.setAttribute('data-a2w-tooltip-label', 'Specifiche');
    const tip = a2wMediaSpecsMap()[bucketKey] || '';
    btn.title = tip;
    btn.textContent = 'ⓘ';
    head.appendChild(btn);
  }

  function a2wMediaDropzoneMarkup(bucketKey) {
    return [
      '<div class="a2w-media-dropzone" data-a2w-component="dropzone" data-a2w-media-type="' + bucketKey + '" tabindex="0" role="button">',
      '  <div class="a2w-media-dropzone__title">Trascina o clicca per caricare</div>',
      '  <div class="a2w-media-dropzone__hint">' + bucketKey.toUpperCase() + '</div>',
      '</div>'
    ].join('');
  }

  async function a2wUploadDroppedMedia(file, bucketKey) {
    if (!file || !window.brandId) return;
    try {
      const b64 = await fileToBase64(file);
      const campaignId = bucketKey === 'strip'
        ? (document.getElementById('mediaFilterCampaignId')?.value || null)
        : null;
      await fetch(`${API}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id: brandId,
          campaign_id: campaignId,
          type: bucketKey,
          title: file.name,
          image_base64: b64
        })
      });
      toast('Media caricato');
      if (typeof loadMediaLibrary === 'function') loadMediaLibrary();
      a2wDispatchSidebarEvent('a2w:media:drop', { type: bucketKey });
    } catch (err) {
      toast('Errore upload: ' + err.message);
    }
  }

  function a2wBindDropzone(dropzone) {
    if (!dropzone || dropzone.dataset.a2wBound) return;
    dropzone.dataset.a2wBound = '1';
    const bucketKey = dropzone.getAttribute('data-a2w-media-type');

    dropzone.addEventListener('click', function a2wDropzoneClick() {
      if (typeof openMediaUpload === 'function') {
        openMediaUpload(bucketKey === 'strip' ? (document.getElementById('mediaFilterCampaignId')?.value || '') : '');
      }
    }, { capture: false });

    dropzone.addEventListener('dragover', function a2wDropzoneDragOver(e) {
      e.preventDefault();
      dropzone.classList.add('a2w-media-dropzone--dragover');
    }, { capture: false });

    dropzone.addEventListener('dragleave', function a2wDropzoneDragLeave() {
      dropzone.classList.remove('a2w-media-dropzone--dragover');
    }, { capture: false });

    dropzone.addEventListener('drop', function a2wDropzoneDrop(e) {
      e.preventDefault();
      dropzone.classList.remove('a2w-media-dropzone--dragover');
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      a2wUploadDroppedMedia(file, bucketKey);
    }, { capture: false });
  }

  function a2wEnsureMediaDropzones(section) {
    if (!section) return;
    const buckets = [
      { key: 'logo', hostId: 'mediaLogoBox', cardId: 'a2wMediaLogoCard' },
      { key: 'strip', hostId: 'mediaStripGrid', cardId: 'a2wMediaStripCard' },
      { key: 'thumbnail', hostId: 'mediaThumbnailGrid', cardId: 'a2wMediaThumbCard' },
      { key: 'background', hostId: 'mediaBackgroundGrid', cardId: 'a2wMediaBackgroundCard' }
    ];

    buckets.forEach((bucket) => {
      const card = a2wMediaFindCardByHostId(bucket.hostId);
      if (!card) return;
      card.id = bucket.cardId;
      card.classList.add('a2w-media-bucket');
      card.setAttribute('data-a2w-bucket', bucket.key);
      a2wEnsureMediaSpecButton(card, bucket.key);

      const host = document.getElementById(bucket.hostId);
      if (!host) return;
      let dropzone = card.querySelector('.a2w-media-dropzone');
      if (!dropzone) {
        const wrap = document.createElement('div');
        wrap.innerHTML = a2wMediaDropzoneMarkup(bucket.key);
        dropzone = wrap.firstChild;
        host.parentNode.insertBefore(dropzone, host);
      }
      a2wBindDropzone(dropzone);
    });
  }

  function a2wMediaSkeletonMarkup(kind) {
    const count = kind === 'logo' ? 1 : 3;
    let out = '';
    for (let i = 0; i < count; i++) {
      out += [
        '<div class="a2w-skeleton a2w-skeleton-card">',
        '  <div class="a2w-skeleton a2w-skeleton-media"></div>',
        '  <div class="a2w-skeleton a2w-skeleton-line"></div>',
        '</div>'
      ].join('');
    }
    return '<div class="a2w-skeleton-grid">' + out + '</div>';
  }

  function a2wReplaceLoadingWithSkeleton(hostId, kind) {
    const host = document.getElementById(hostId);
    if (!host) return;
    const txt = String(host.textContent || '').trim().toLowerCase();
    if (!txt.includes('caricamento')) return;
    host.innerHTML = a2wMediaSkeletonMarkup(kind);
  }

  function a2wEnhanceStripBadges() {
    const grid = document.getElementById('mediaStripGrid');
    if (!grid) return;
    grid.querySelectorAll('.media-card').forEach((card) => {
      card.classList.add('a2w-media-item');
      const rows = card.querySelectorAll('div');
      const label = rows[1];
      if (!label) return;
      const raw = String(label.textContent || '').trim();
      label.classList.add('a2w-media-campaign-badge');
      if (!raw || /nessuna campagna/i.test(raw)) {
        label.textContent = 'Non assegnata';
        label.classList.add('a2w-badge-muted');
        label.classList.remove('a2w-badge-info');
      } else {
        label.textContent = 'Campagna: ' + raw;
        label.classList.add('a2w-badge-info');
        label.classList.remove('a2w-badge-muted');
      }
    });
  }

  function a2wEnhanceMediaCards() {
    ['mediaLogoBox', 'mediaStripGrid', 'mediaThumbnailGrid', 'mediaBackgroundGrid'].forEach((id) => {
      const host = document.getElementById(id);
      if (!host) return;
      host.classList.add('a2w-media-host');
      host.querySelectorAll('.media-card').forEach((card) => {
        card.classList.add('a2w-media-item');
        if (card.querySelector('.a2w-media-item-actions')) return;
        const actions = document.createElement('div');
        actions.className = 'a2w-media-item-actions';
        actions.innerHTML = [
          '<button type="button" class="a2w-media-item-action" data-a2w-action="rename">Rinomina</button>',
          '<button type="button" class="a2w-media-item-action" data-a2w-action="replace">Sostituisci</button>',
          '<button type="button" class="a2w-media-item-action a2w-media-item-action--danger" data-a2w-action="delete">Elimina</button>'
        ].join('');
        card.appendChild(actions);
      });
    });
  }

  function a2wBindMediaItemActions(section) {
    if (!section || section.dataset.a2wMediaActionsBound === '1') return;
    section.dataset.a2wMediaActionsBound = '1';
    section.addEventListener('click', function a2wMediaCardActionClick(e) {
      const btn = e.target.closest('.a2w-media-item-action');
      if (!btn) return;
      const card = btn.closest('.media-card');
      if (!card) return;
      const deleteBtn = card.querySelector('button[onclick*="deleteMediaItem"]');
      const action = btn.getAttribute('data-a2w-action');
      if (action === 'delete' && deleteBtn) {
        deleteBtn.click();
        return;
      }
      if (action === 'replace') {
        if (typeof openMediaUpload === 'function') openMediaUpload(document.getElementById('mediaFilterCampaignId')?.value || '');
        return;
      }
      toast('Rinomina media: in arrivo');
    }, { capture: false });
  }

  function a2wNormalizeStripFilters() {
    const search = document.getElementById('mediaStripSearch');
    const select = document.getElementById('mediaFilterCampaignId');
    const check = document.getElementById('mediaOnlySelectedCampaign');
    if (search) search.classList.add('a2w-media-strip-search');
    if (select) select.classList.add('a2w-media-strip-select');
    if (check) check.closest('label')?.classList.add('a2w-media-strip-check');
  }

  function a2wEnhanceMediaLibraryDom() {
    const section = a2wMediaSection();
    if (!section) return;
    section.setAttribute('data-a2w-component', 'media-library');
    a2wEnsureMediaPageMenu(section);
    const specsCard = [...section.querySelectorAll('.card')].find((card) =>
      /Specifiche tecniche consigliate/i.test(card.textContent || '')
    );
    if (specsCard) specsCard.style.display = 'none';
    a2wEnsureMediaDropzones(section);
    a2wReplaceLoadingWithSkeleton('mediaLogoBox', 'logo');
    a2wReplaceLoadingWithSkeleton('mediaStripGrid', 'strip');
    a2wReplaceLoadingWithSkeleton('mediaThumbnailGrid', 'thumb');
    a2wReplaceLoadingWithSkeleton('mediaBackgroundGrid', 'bg');
    a2wEnhanceMediaCards();
    a2wEnhanceStripBadges();
    a2wNormalizeStripFilters();
    a2wBindMediaItemActions(section);
  }

  function initA2WMediaLibraryEnhancer() {
    const state = a2wMediaState();
    if (state.hooked) return;
    if (typeof loadMediaLibrary !== 'function') {
      if (!state.waitTimer) {
        state.waitTimer = window.setTimeout(function a2wWaitMediaHook() {
          state.waitTimer = null;
          initA2WMediaLibraryEnhancer();
        }, 250);
      }
      return;
    }
    state.hooked = true;
    const original = loadMediaLibrary;
    window.loadMediaLibrary = async function a2wLoadMediaLibraryWrapped() {
      const result = await original.apply(this, arguments);
      a2wEnhanceMediaLibraryDom();
      a2wDispatchSidebarEvent('a2w:media:render', {});
      return result;
    };
    a2wEnhanceMediaLibraryDom();
  }

  A2W.icons.qr = A2W.icons.qr || '<svg viewBox="0 0 24 24" fill="none" stroke="' + A2W_ICON_STROKE + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h6v6H4z"/><path d="M14 4h6v6h-6z"/><path d="M4 14h6v6H4z"/><path d="M14 14h2"/><path d="M18 14h2"/><path d="M14 18h2"/><path d="M18 18h2"/></svg>';
  A2W.icons.external = A2W.icons.external || '<svg viewBox="0 0 24 24" fill="none" stroke="' + A2W_ICON_STROKE + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6"/><path d="M10 14 20 4"/><path d="M20 14v6H4V4h6"/></svg>';
  A2W.icons.link = A2W.icons.link || '<svg viewBox="0 0 24 24" fill="none" stroke="' + A2W_ICON_STROKE + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11.2 4.73"/><path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 1 0 7.07 7.07L12.8 19.27"/></svg>';
  A2W.icons.kebab = A2W.icons.kebab || '<svg viewBox="0 0 24 24" fill="none" stroke="' + A2W_ICON_STROKE + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>';
  A2W.icons.pause = A2W.icons.pause || '<svg viewBox="0 0 24 24" fill="none" stroke="' + A2W_ICON_STROKE + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 5v14"/><path d="M16 5v14"/></svg>';
  A2W.icons.play = A2W.icons.play || '<svg viewBox="0 0 24 24" fill="none" stroke="' + A2W_ICON_STROKE + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 4 12 8-12 8V4z"/></svg>';
  A2W.icons.copy = A2W.icons.copy || '<svg viewBox="0 0 24 24" fill="none" stroke="' + A2W_ICON_STROKE + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  A2W.icons.delete = A2W.icons.delete || '<svg viewBox="0 0 24 24" fill="none" stroke="' + A2W_ICON_STROKE + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';
  A2W.icons.download = A2W.icons.download || '<svg viewBox="0 0 24 24" fill="none" stroke="' + A2W_ICON_STROKE + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v10"/><path d="m8 10 4 4 4-4"/><path d="M4 20h16"/></svg>';
  A2W.icons.install = A2W.icons.install || '<svg viewBox="0 0 24 24" fill="none" stroke="' + A2W_ICON_STROKE + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 13 3 3 7-8"/><rect x="3" y="4" width="18" height="16" rx="2"/></svg>';
  A2W.icons.tag = A2W.icons.tag || '<svg viewBox="0 0 24 24" fill="none" stroke="' + A2W_ICON_STROKE + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10 10 20 2 12V4h8z"/><circle cx="7.5" cy="7.5" r="1"/></svg>';

  function a2wActionState() {
    A2W.actions = A2W.actions || {};
    return A2W.actions;
  }

  function a2wExtractEntityIdFromButton(btn) {
    if (!btn) return '';
    const onclick = String(btn.getAttribute('onclick') || '');
    const match = onclick.match(/'([^']+)'/);
    return match ? match[1] : '';
  }

  function a2wCreateIconButton(label, iconSvg, className) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = className || 'a2w-icon-btn';
    btn.setAttribute('aria-label', label);
    btn.setAttribute('data-a2w-tooltip-label', label);
    btn.innerHTML = iconSvg;
    return btn;
  }

  async function a2wDuplicateCampaignFromId(campaignId) {
    if (!campaignId) return;
    const source = (Array.isArray(window.campaignsCache) ? window.campaignsCache : []).find((c) => c.id === campaignId);
    if (!source) {
      toast('Campagna non trovata');
      return;
    }
    if (typeof openCampaignModal === 'function') openCampaignModal();
    const setVal = function (id, value) {
      const el = document.getElementById(id);
      if (el) el.value = value || '';
    };
    setVal('campaignEditId', '');
    setVal('campName', (source.name || '') + ' (copia)');
    setVal('campDesc', source.description || '');
    setVal('campUtmSource', source.utm_source || '');
    setVal('campUtmMedium', source.utm_medium || '');
    setVal('campUtmCampaign', source.utm_campaign || '');
    setVal('campUtmContent', source.utm_content || '');
    setVal('campUtmTerm', source.utm_term || '');
    setVal('campStart', source.start_date ? source.start_date.substring(0, 10) : '');
    setVal('campEnd', source.end_date ? source.end_date.substring(0, 10) : '');
    if (source.template_id) setVal('campTemplate', source.template_id);
    const title = document.getElementById('campaignModalTitle');
    if (title) title.textContent = 'Duplica Campagna';
    toast('Campagna duplicata in bozza');
  }

  async function a2wDuplicateTemplateFromId(templateId) {
    if (!templateId || typeof editTemplate !== 'function') return;
    await editTemplate(templateId);
    const editId = document.getElementById('templateEditId');
    if (editId) editId.value = '';
    const nameInput = document.getElementById('tplName');
    if (nameInput && !/\(copia\)$/i.test(nameInput.value || '')) nameInput.value = (nameInput.value || '') + ' (copia)';
    const title = document.getElementById('templateModalTitle');
    if (title) title.textContent = 'Duplica Template';
    toast('Template duplicato in bozza');
  }

  function a2wEnhanceCampaignMetaChips(card) {
    const meta = card.querySelector('.card-meta');
    if (!meta || meta.dataset.a2wEnhanced === '1') return;
    const raw = String(meta.textContent || '').trim();
    if (!raw) return;
    const segments = raw.split('·').map((s) => s.trim()).filter(Boolean);
    if (!segments.length) return;
    const chips = [];
    segments.forEach((segment) => {
      let icon = A2W.icons.tag;
      let label = segment;
      const dl = segment.match(/^(\d+)\s+download$/i);
      const ins = segment.match(/^(\d+)\s+install$/i);
      const src = segment.match(/^src=(.+)$/i);
      const med = segment.match(/^med=(.+)$/i);
      if (dl) {
        icon = A2W.icons.download;
        label = 'download ' + dl[1];
      } else if (ins) {
        icon = A2W.icons.install;
        label = 'install ' + ins[1];
      } else if (src) {
        icon = A2W.icons.tag;
        label = 'src ' + src[1];
      } else if (med) {
        icon = A2W.icons.tag;
        label = 'med ' + med[1];
      }
      chips.push('<span class="a2w-chip" data-a2w-component="chip"><span class="a2w-chip__icon">' + icon + '</span><span class="a2w-chip__label">' + label + '</span></span>');
    });
    meta.classList.add('a2w-chip-row');
    meta.dataset.a2wEnhanced = '1';
    meta.innerHTML = chips.join('');
  }

  function a2wEnsureActionMenusDocumentClose() {
    const state = a2wActionState();
    if (state.docBound) return;
    state.docBound = true;
    document.addEventListener('click', function a2wActionMenuDocClick() {
      document.querySelectorAll('.a2w-row-kebab-menu').forEach((menu) => { menu.hidden = true; });
      document.querySelectorAll('.a2w-row-kebab-trigger').forEach((btn) => { btn.setAttribute('aria-expanded', 'false'); });
    }, { capture: false });
  }

  function a2wEnhanceCampaignCardActions(card) {
    const actions = card.querySelector('.card-actions');
    if (!actions || actions.dataset.a2wEnhanced === '1') return;
    const buttons = [...actions.querySelectorAll('button')];
    const editBtn = buttons.find((b) => String(b.getAttribute('onclick') || '').includes('editCampaign('));
    const qrBtn = buttons.find((b) => String(b.getAttribute('onclick') || '').includes('showCampaignQR('));
    const landingBtn = buttons.find((b) => String(b.getAttribute('onclick') || '').includes('openCampaignLandingTab('));
    const linkBtn = buttons.find((b) => String(b.getAttribute('onclick') || '').includes('copyCampaignDirect('));
    const toggleBtn = buttons.find((b) => String(b.getAttribute('onclick') || '').includes('toggleCampaign('));
    const deleteBtn = buttons.find((b) => String(b.getAttribute('onclick') || '').includes('deleteCampaign('));
    if (!editBtn) return;

    actions.dataset.a2wEnhanced = '1';
    actions.classList.add('a2w-row-actions');
    actions.setAttribute('data-a2w-component', 'campaign-actions');

    editBtn.className = 'btn a2w-btn-primary a2w-row-primary-btn';
    editBtn.textContent = 'Modifica';

    const iconGroup = document.createElement('div');
    iconGroup.className = 'a2w-row-icon-group';
    iconGroup.setAttribute('data-a2w-component', 'icon-group');
    actions.insertBefore(iconGroup, editBtn.nextSibling);

    const moveIconAction = function (sourceBtn, label, icon) {
      if (!sourceBtn) return;
      sourceBtn.className = 'a2w-icon-btn a2w-row-icon-btn';
      sourceBtn.setAttribute('aria-label', label);
      sourceBtn.setAttribute('data-a2w-tooltip-label', label);
      sourceBtn.innerHTML = icon;
      iconGroup.appendChild(sourceBtn);
    };
    moveIconAction(qrBtn, 'QR', A2W.icons.qr);
    moveIconAction(landingBtn, 'Landing', A2W.icons.external);
    moveIconAction(linkBtn, 'Link diretto', A2W.icons.link);

    const kebabWrap = document.createElement('div');
    kebabWrap.className = 'a2w-row-kebab-wrap';
    kebabWrap.setAttribute('data-a2w-component', 'row-kebab');
    const kebabBtn = a2wCreateIconButton('Altre azioni campagna', A2W.icons.kebab, 'a2w-icon-btn a2w-row-kebab-trigger');
    kebabBtn.setAttribute('aria-expanded', 'false');
    kebabWrap.appendChild(kebabBtn);
    const menu = document.createElement('div');
    menu.className = 'a2w-row-kebab-menu';
    menu.hidden = true;
    const campaignId = a2wExtractEntityIdFromButton(editBtn) || a2wExtractEntityIdFromButton(qrBtn);
    const toggleLabel = toggleBtn ? String(toggleBtn.textContent || '').trim() : '';
    const toggleIcon = /pausa/i.test(toggleLabel) ? A2W.icons.pause : A2W.icons.play;
    const toggleText = toggleLabel || 'Pausa/Riprendi';
    menu.innerHTML = [
      '<button type="button" class="a2w-row-kebab-item" data-a2w-item="toggle"><span class="a2w-row-kebab-icon">' + toggleIcon + '</span><span>' + toggleText + '</span></button>',
      '<button type="button" class="a2w-row-kebab-item" data-a2w-item="duplicate"><span class="a2w-row-kebab-icon">' + A2W.icons.copy + '</span><span>Duplica</span></button>',
      '<button type="button" class="a2w-row-kebab-item a2w-row-kebab-item--danger" data-a2w-item="delete"><span class="a2w-row-kebab-icon">' + A2W.icons.delete + '</span><span>Elimina</span></button>'
    ].join('');
    kebabWrap.appendChild(menu);
    actions.appendChild(kebabWrap);

    kebabBtn.addEventListener('click', function a2wCampaignMenuToggle(e) {
      e.stopPropagation();
      const open = menu.hidden;
      document.querySelectorAll('.a2w-row-kebab-menu').forEach((m) => { m.hidden = true; });
      document.querySelectorAll('.a2w-row-kebab-trigger').forEach((b) => { b.setAttribute('aria-expanded', 'false'); });
      menu.hidden = !open;
      kebabBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }, { capture: false });

    menu.querySelector('[data-a2w-item="toggle"]')?.addEventListener('click', function a2wCampaignToggleClick() {
      menu.hidden = true;
      kebabBtn.setAttribute('aria-expanded', 'false');
      if (toggleBtn) toggleBtn.click();
    }, { capture: false });

    menu.querySelector('[data-a2w-item="duplicate"]')?.addEventListener('click', function a2wCampaignDupClick() {
      menu.hidden = true;
      kebabBtn.setAttribute('aria-expanded', 'false');
      a2wDuplicateCampaignFromId(campaignId);
    }, { capture: false });

    menu.querySelector('[data-a2w-item="delete"]')?.addEventListener('click', function a2wCampaignDeleteClick() {
      menu.hidden = true;
      kebabBtn.setAttribute('aria-expanded', 'false');
      if (deleteBtn) deleteBtn.click();
    }, { capture: false });

    if (toggleBtn) toggleBtn.style.display = 'none';
    if (deleteBtn) deleteBtn.style.display = 'none';
  }

  function a2wEnhanceTemplateCardActions(card) {
    const actions = card.querySelector('.card-actions');
    if (!actions || actions.dataset.a2wEnhanced === '1') return;
    const buttons = [...actions.querySelectorAll('button')];
    const editBtn = buttons.find((b) => String(b.getAttribute('onclick') || '').includes('editTemplate('));
    const deleteBtn = buttons.find((b) => String(b.getAttribute('onclick') || '').includes('deleteTemplate('));
    if (!editBtn) return;

    actions.dataset.a2wEnhanced = '1';
    actions.classList.add('a2w-row-actions');
    actions.setAttribute('data-a2w-component', 'template-actions');
    editBtn.className = 'btn a2w-btn-primary a2w-row-primary-btn';
    editBtn.textContent = 'Modifica';

    const kebabWrap = document.createElement('div');
    kebabWrap.className = 'a2w-row-kebab-wrap';
    kebabWrap.setAttribute('data-a2w-component', 'row-kebab');
    const kebabBtn = a2wCreateIconButton('Altre azioni template', A2W.icons.kebab, 'a2w-icon-btn a2w-row-kebab-trigger');
    kebabBtn.setAttribute('aria-expanded', 'false');
    kebabWrap.appendChild(kebabBtn);
    const menu = document.createElement('div');
    menu.className = 'a2w-row-kebab-menu';
    menu.hidden = true;
    const templateId = a2wExtractEntityIdFromButton(editBtn);
    menu.innerHTML = [
      '<button type="button" class="a2w-row-kebab-item" data-a2w-item="duplicate"><span class="a2w-row-kebab-icon">' + A2W.icons.copy + '</span><span>Duplica</span></button>',
      '<button type="button" class="a2w-row-kebab-item a2w-row-kebab-item--danger" data-a2w-item="delete"><span class="a2w-row-kebab-icon">' + A2W.icons.delete + '</span><span>Elimina</span></button>'
    ].join('');
    kebabWrap.appendChild(menu);
    actions.appendChild(kebabWrap);

    kebabBtn.addEventListener('click', function a2wTemplateMenuToggle(e) {
      e.stopPropagation();
      const open = menu.hidden;
      document.querySelectorAll('.a2w-row-kebab-menu').forEach((m) => { m.hidden = true; });
      document.querySelectorAll('.a2w-row-kebab-trigger').forEach((b) => { b.setAttribute('aria-expanded', 'false'); });
      menu.hidden = !open;
      kebabBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }, { capture: false });

    menu.querySelector('[data-a2w-item="duplicate"]')?.addEventListener('click', function a2wTemplateDupClick() {
      menu.hidden = true;
      kebabBtn.setAttribute('aria-expanded', 'false');
      a2wDuplicateTemplateFromId(templateId);
    }, { capture: false });

    menu.querySelector('[data-a2w-item="delete"]')?.addEventListener('click', function a2wTemplateDeleteClick() {
      menu.hidden = true;
      kebabBtn.setAttribute('aria-expanded', 'false');
      if (deleteBtn) deleteBtn.click();
    }, { capture: false });

    if (deleteBtn) deleteBtn.style.display = 'none';
  }

  function a2wEnhanceCampaignActionGrouping() {
    document.querySelectorAll('#campaignsList .card').forEach((card) => {
      a2wEnhanceCampaignCardActions(card);
      a2wEnhanceCampaignMetaChips(card);
    });
  }

  function a2wEnhanceTemplateActionGrouping() {
    document.querySelectorAll('#templatesList .card').forEach((card) => {
      a2wEnhanceTemplateCardActions(card);
    });
  }

  function initA2WActionGroupingEnhancer() {
    const state = a2wActionState();
    if (state.hooked) return;
    if (typeof loadCampaigns !== 'function' || typeof loadTemplates !== 'function') {
      if (!state.waitTimer) {
        state.waitTimer = window.setTimeout(function a2wWaitActionHook() {
          state.waitTimer = null;
          initA2WActionGroupingEnhancer();
        }, 250);
      }
      return;
    }
    state.hooked = true;
    a2wEnsureActionMenusDocumentClose();

    const originalCampaigns = loadCampaigns;
    window.loadCampaigns = async function a2wLoadCampaignsWrapped() {
      const result = await originalCampaigns.apply(this, arguments);
      a2wEnhanceCampaignActionGrouping();
      a2wDispatchSidebarEvent('a2w:actions:campaigns', {});
      return result;
    };

    const originalTemplates = loadTemplates;
    window.loadTemplates = async function a2wLoadTemplatesWrapped() {
      const result = await originalTemplates.apply(this, arguments);
      a2wEnhanceTemplateActionGrouping();
      a2wDispatchSidebarEvent('a2w:actions:templates', {});
      return result;
    };

    a2wEnhanceCampaignActionGrouping();
    a2wEnhanceTemplateActionGrouping();
  }

  // UX-AUDIT[a2w]: activate ads shell chrome once per session
  function initA2wShell() {
    if (!isA2wDeploy()) return;
    const root = document.documentElement;
    root.classList.add('a2w-shell');
    const line = typeof getDashboardProductLine === 'function' ? getDashboardProductLine() : 'ads';
    root.setAttribute('data-product-line', line);
    initA2wUserMenuChrome();
    initA2WSidebarChrome();
    initA2WMediaLibraryEnhancer();
    initA2WActionGroupingEnhancer();
    ensureA2wLeadsLayout();
    syncA2wHeaderChrome();
    syncA2wWaiPadding();
    a2wDispatchSidebarEvent('a2w:shell:ready', { line: line });
  }

  function ensureA2wLeadsLayout() {
    const stats = document.getElementById('leadsStats');
    if (stats) stats.classList.add('a2w-stats-grid');
  }

  function initA2wUserMenuChrome() {
    const meta = document.querySelector('.user-menu-meta');
    if (!meta || meta.querySelector('.a2w-user-divider')) return;
    const role = document.getElementById('dashboardUserRole');
    if (!role) return;
    const divider = document.createElement('span');
    divider.className = 'a2w-user-divider';
    divider.setAttribute('aria-hidden', 'true');
    meta.insertBefore(divider, role);
    role.classList.add('a2w-admin-badge');
  }

  // UX-AUDIT[a2w]: breadcrumb brand text-only (no low-contrast logo in header)
  function syncA2wHeaderChrome() {
    if (!document.documentElement.classList.contains('a2w-shell')) return;
    const brandSpan = document.getElementById('breadcrumbBrand');
    if (!brandSpan) return;

    let wrap = brandSpan.closest('.a2w-breadcrumb-brand-wrap');
    if (!wrap) {
      wrap = document.createElement('span');
      wrap.className = 'a2w-breadcrumb-brand-wrap';
      brandSpan.parentNode.insertBefore(wrap, brandSpan);
      wrap.appendChild(brandSpan);
    }
    wrap.classList.add('a2w-breadcrumb-brand-wrap--text-only');
    wrap.querySelectorAll('#a2wBreadcrumbLogo, #a2wBreadcrumbLogoFallback').forEach((el) => el.remove());
    a2wEnsureSidebarWorkspaceSwitcher();
  }

  function syncA2wWaiPadding() {
    const btn = document.getElementById('waiBtn');
    const visible = btn && btn.style.display !== 'none' && getComputedStyle(btn).display !== 'none';
    document.documentElement.classList.toggle('a2w-wai-visible', !!visible);
  }

  // UX-AUDIT[a2w]: inject Analytics layout (DOM only on ads shell)
  function ensureA2wAnalyticsLayout() {
    const section = document.getElementById('analytics');
    if (!section || section.dataset.a2wLayout === '1') return;
    section.dataset.a2wLayout = '1';
    section.classList.add('a2w-analytics-page');

    const h1 = section.querySelector('h1.page-title');
    if (h1) {
      const header = document.createElement('header');
      header.className = 'a2w-page-header';
      header.innerHTML = [
        '<div class="a2w-page-header__main">',
        '  <ol class="a2w-page-breadcrumb" aria-label="Percorso pagina"><li>Dashboard</li><li aria-current="page">Analytics</li></ol>',
        '  <h1 class="a2w-page-header__title">Analytics</h1>',
        '  <p class="a2w-page-header__desc">KPI pass, trend download/install e performance campagne.</p>',
        '</div>',
        '<div class="a2w-page-header__actions">',
        '  <button type="button" class="btn small sec" id="a2wExportReportBtn" aria-label="Esporta report trend in PNG">Esporta report</button>',
        '</div>'
      ].join('');
      h1.replaceWith(header);
      const exportBtn = document.getElementById('a2wExportReportBtn');
      if (exportBtn) {
        exportBtn.addEventListener('click', () => {
          if (typeof exportAnalyticsChart === 'function') exportAnalyticsChart('trend', 'png');
        });
      }
    }

    const stats = document.getElementById('analyticsStats');
    if (stats) stats.classList.add('a2w-stats-grid');

    const chartsRow = section.querySelector('.form-row');
    if (chartsRow) chartsRow.classList.add('a2w-charts-grid');

    const trendCard = section.querySelector('.a2w-charts-grid .card');
    const actions = trendCard && trendCard.querySelector('.analytics-actions');
    if (actions && !actions.dataset.a2wSplit) {
      actions.dataset.a2wSplit = '1';
      actions.classList.add('a2w-trend-toolbar');

      const rangeSel = document.getElementById('analyticsTrendRange');
      const fromEl = document.getElementById('analyticsDateFrom');
      const toEl = document.getElementById('analyticsDateTo');
      const bothBtn = document.getElementById('analyticsMetricBothBtn');
      const dlBtn = document.getElementById('analyticsMetricDownloadBtn');
      const inBtn = document.getElementById('analyticsMetricInstallBtn');
      const exportBtns = [...actions.querySelectorAll('button')].filter((b) => {
        const oc = b.getAttribute('onclick') || '';
        return oc.includes('exportAnalyticsChart');
      });

      actions.textContent = '';

      const datesWrap = document.createElement('div');
      datesWrap.className = 'a2w-date-range';
      const periodLabel = document.createElement('span');
      periodLabel.className = 'a2w-field-label';
      periodLabel.textContent = 'Periodo';
      datesWrap.appendChild(periodLabel);

      const periodRow = document.createElement('div');
      periodRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;';
      if (rangeSel) periodRow.appendChild(rangeSel);

      const fromWrap = document.createElement('div');
      fromWrap.className = 'a2w-date-field';
      const fromLbl = document.createElement('label');
      fromLbl.className = 'a2w-field-label';
      fromLbl.htmlFor = 'analyticsDateFrom';
      fromLbl.textContent = 'Da';
      fromWrap.append(fromLbl, fromEl);

      const toWrap = document.createElement('div');
      toWrap.className = 'a2w-date-field';
      const toLbl = document.createElement('label');
      toLbl.className = 'a2w-field-label';
      toLbl.htmlFor = 'analyticsDateTo';
      toLbl.textContent = 'A';
      toWrap.append(toLbl, toEl);

      periodRow.append(fromWrap, toWrap);
      datesWrap.appendChild(periodRow);

      const controlsRow = document.createElement('div');
      controlsRow.className = 'a2w-trend-controls-row';

      const metricGroup = document.createElement('div');
      metricGroup.className = 'a2w-control-group';
      const metricLabel = document.createElement('span');
      metricLabel.className = 'a2w-control-label';
      metricLabel.textContent = 'Metrica';
      const segmented = document.createElement('div');
      segmented.className = 'a2w-segmented';
      segmented.setAttribute('role', 'group');
      segmented.setAttribute('aria-label', 'Metrica trend');
      [bothBtn, dlBtn, inBtn].forEach((btn) => { if (btn) segmented.appendChild(btn); });
      metricGroup.append(metricLabel, segmented);

      const exportGroup = document.createElement('div');
      exportGroup.className = 'a2w-control-group a2w-export-group';
      const exportLabel = document.createElement('span');
      exportLabel.className = 'a2w-control-label';
      exportLabel.textContent = 'Esporta come';
      const exportRow = document.createElement('div');
      exportRow.className = 'a2w-export-buttons';
      exportBtns.forEach((btn) => exportRow.appendChild(btn));
      exportGroup.append(exportLabel, exportRow);

      controlsRow.append(metricGroup, exportGroup);
      actions.append(datesWrap, controlsRow);
    }

    section.querySelectorAll(':scope > .card').forEach((card) => {
      if (card.querySelector('#analyticsTopCampaigns')) {
        card.classList.add('a2w-top-campaigns-card');
      }
    });

    const perfTitle = [...section.querySelectorAll('.sec-title')].find((el) => el.textContent.includes('Performance'));
    if (perfTitle) perfTitle.classList.add('a2w-section-heading');

    const table = document.getElementById('campaignAnalyticsTable');
    if (table && !table.closest('.a2w-table-wrap')) {
      const wrap = document.createElement('div');
      wrap.className = 'a2w-table-wrap';
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
      table.classList.add('a2w-campaign-table');
      const ths = table.querySelectorAll('thead th');
      if (ths[1]) ths[1].classList.add('a2w-num');
      if (ths[2]) ths[2].classList.add('a2w-num');
      if (ths[3]) ths[3].classList.add('a2w-num');
      if (ths[5]) ths[5].classList.add('a2w-col-status');
    }
  }

  function renderA2wAnalyticsStats(analytics, campaigns, allPasses) {
    const el = document.getElementById('analyticsStats');
    if (!el) return;

    const totalDL = campaigns.reduce((s, c) => s + (c.total_downloads || 0), 0);
    const totalIN = campaigns.reduce((s, c) => s + (c.total_installs || 0), 0);
    const desktopDownloads = allPasses.filter((p) => {
      const ua = String(p.user_agent || '').toLowerCase();
      if (!ua) return false;
      return !/(iphone|ipad|ipod|android)/i.test(ua);
    }).length;

    const appleDv = analytics.appleDeviceCount ?? analytics.deviceCount ?? 0;
    const gwSaved = analytics.googleWalletSavedCount ?? 0;
    const swSaved = analytics.samsungWalletSavedCount ?? 0;
    const activeCampaigns = campaigns.filter((c) => c.active).length;
    const pausedCampaigns = campaigns.length - activeCampaigns;

    const gwHint = `<div class="a2w-stat-meta">Android: pass con salvataggio confermato</div>`;
    const swHint = `<div class="a2w-stat-meta">Confermati tramite Samsung Wallet</div>`;
    const appleHint = `<div class="a2w-stat-meta">iPhone/iPad distinti con pass in Wallet</div>`;

  el.innerHTML = `
      <div class="stat-card"><div class="stat-label">Pass totali</div><div class="stat-value">${analytics.totalPasses || 0}</div></div>
      <div class="stat-card"><div class="stat-label">Download totali</div><div class="stat-value">${totalDL}</div></div>
      <div class="stat-card"><div class="stat-label">Install totali</div><div class="stat-value">${totalIN}</div></div>
      <div class="stat-card">
        <div class="stat-label">Download da desktop
          <button type="button" class="a2w-info-tip" aria-label="Info download desktop" title="Separati dai KPI wallet confermati">ℹ</button>
        </div>
        <div class="stat-value">${desktopDownloads}</div>
      </div>
      <div class="stat-card"><div class="stat-label">Apple · dispositivi PassKit</div><div class="stat-value">${appleDv}</div>${appleHint}</div>
      <div class="stat-card"><div class="stat-label">Google Wallet · pass salvati</div><div class="stat-value">${gwSaved}</div>${gwHint}</div>
      <div class="stat-card"><div class="stat-label">Samsung Wallet · pass salvati</div><div class="stat-value">${swSaved}</div>${swHint}</div>
      <div class="stat-card">
        <div class="stat-label">Campagne</div>
        <div class="stat-value">${campaigns.length}</div>
        <div class="a2w-stat-meta">${activeCampaigns} attiv${activeCampaigns === 1 ? 'a' : 'e'} · ${pausedCampaigns} in pausa</div>
      </div>
    `;
  }

  function renderA2wTrendChart(passes) {
    const el = document.getElementById('analyticsTrendChart');
    if (!el || typeof formatLocalYMD !== 'function') return;

    const from = typeof analyticsDateFrom !== 'undefined' && analyticsDateFrom ? analyticsDateFrom : null;
    const to = typeof analyticsDateTo !== 'undefined' && analyticsDateTo ? analyticsDateTo : null;
    let dayKeys;
    if (from && to && typeof listDaysBetween === 'function') {
      dayKeys = listDaysBetween(from, to);
    } else if (typeof getAnalyticsDateRange === 'function') {
      const range = getAnalyticsDateRange();
      dayKeys = listDaysBetween(range.from, range.to);
    } else {
      dayKeys = [];
    }

    const labels = dayKeys.map((k) => new Date(`${k}T00:00:00`).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }));
    const downloads = [];
    const installs = [];
    const byDay = new Map(dayKeys.map((k) => [k, { dl: 0, in: 0 }]));
    for (const p of passes) {
      if (p.created_at) {
        const k = formatLocalYMD(p.created_at);
        if (k && byDay.has(k)) byDay.get(k).dl += 1;
      }
      if (p.install_date) {
        const k = formatLocalYMD(p.install_date);
        if (k && byDay.has(k)) byDay.get(k).in += 1;
      }
    }
    for (const key of dayKeys) {
      downloads.push(byDay.get(key).dl);
      installs.push(byDay.get(key).in);
    }

    const metric = typeof analyticsTrendMetric !== 'undefined' ? analyticsTrendMetric : 'both';
    const activeDownload = metric === 'both' || metric === 'download';
    const activeInstall = metric === 'both' || metric === 'install';
    const activeValues = [];
    if (activeDownload) activeValues.push(...downloads);
    if (activeInstall) activeValues.push(...installs);
    const maxVal = Math.max(1, ...activeValues);

    const width = 900;
    const height = 280;
    const left = 40;
    const bottom = 36;
    const top = 20;
    const right = 16;
    const plotW = width - left - right;
    const plotH = height - bottom - top;
    const step = dayKeys.length > 1 ? plotW / (dayKeys.length - 1) : plotW;
    const point = (idx, val) => `${(left + idx * step).toFixed(2)},${(top + (plotH - (val / maxVal) * plotH)).toFixed(2)}`;
    const dlPath = downloads.map((v, i) => `${i === 0 ? 'M' : 'L'} ${point(i, v)}`).join(' ');
    const inPath = installs.map((v, i) => `${i === 0 ? 'M' : 'L'} ${point(i, v)}`).join(' ');
    const tickEvery = dayKeys.length > 14 ? 3 : 2;
    const xTicks = labels.filter((_, i) => i % tickEvery === 0).map((l, i) => {
      const idx = i * tickEvery;
      const x = left + idx * step;
      return `<text x="${x.toFixed(2)}" y="${height - 8}" font-size="11" fill="rgba(255,255,255,0.5)" text-anchor="middle">${l}</text>`;
    }).join('');
    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((fr) => {
      const y = top + plotH - (plotH * fr);
      const value = Math.round(maxVal * fr);
      return `
        <line x1="${left}" y1="${y.toFixed(2)}" x2="${(left + plotW).toFixed(2)}" y2="${y.toFixed(2)}" stroke="rgba(255,255,255,0.08)" stroke-dasharray="3 3"></line>
        <text x="${(left - 8)}" y="${(y + 4).toFixed(2)}" font-size="11" fill="rgba(255,255,255,0.5)" text-anchor="end">${value}</text>
      `;
    }).join('');

    const accentData = getComputedStyle(document.documentElement).getPropertyValue('--a2w-accent-data').trim() || '#3FE0C8';
    el.innerHTML = `
      <svg id="analyticsTrendSvg" viewBox="0 0 ${width} ${height}" width="100%" height="280" role="img" aria-label="Trend download e install">
        <defs>
          <linearGradient id="trendDlGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="${accentData}"></stop>
            <stop offset="100%" stop-color="${accentData}"></stop>
          </linearGradient>
          <linearGradient id="trendInGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#60a5fa"></stop>
            <stop offset="100%" stop-color="#3b82f6"></stop>
          </linearGradient>
        </defs>
        <rect x="${left}" y="${top}" rx="12" ry="12" width="${plotW}" height="${plotH}" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.08)"></rect>
        ${yTicks}
        ${activeDownload ? `<path d="${dlPath}" fill="none" stroke="url(#trendDlGrad)" stroke-width="3" stroke-linecap="round"></path>` : ''}
        ${activeInstall ? `<path d="${inPath}" fill="none" stroke="url(#trendInGrad)" stroke-width="3" stroke-linecap="round"></path>` : ''}
        ${xTicks}
      </svg>
      <div style="display:flex;gap:16px;font-size:12px;color:rgba(255,255,255,0.6);margin-top:8px;padding-bottom:4px;">
        ${activeDownload ? `<span style="display:inline-flex;align-items:center;gap:6px;"><span style="width:10px;height:10px;background:${accentData};border-radius:50%;display:inline-block;"></span>Download</span>` : ''}
        ${activeInstall ? '<span style="display:inline-flex;align-items:center;gap:6px;"><span style="width:10px;height:10px;background:#3b82f6;border-radius:50%;display:inline-block;"></span>Install</span>' : ''}
      </div>
    `;
    if (typeof updateAnalyticsMetricButtons === 'function') updateAnalyticsMetricButtons();
  }

  function renderA2wWalletSplit(passes) {
    const el = document.getElementById('analyticsWalletSplit');
    if (!el) return;

    const installedList = passes.filter((p) => !!(p.device_id || (typeof passGoogleSaved === 'function' && passGoogleSaved(p)) || (typeof passSamsungSaved === 'function' && passSamsungSaved(p))));
    const totalInstalled = installedList.length;

    if (!totalInstalled) {
      el.innerHTML = '<div class="a2w-wallet-empty">Nessuna installazione ancora</div>';
      return;
    }

    let samsung = 0;
    let google = 0;
    let apple = 0;
    let other = 0;
    for (const p of installedList) {
      const k = typeof walletSplitPrimaryKind === 'function' ? walletSplitPrimaryKind(p) : 'other';
      if (k === 'samsung') samsung++;
      else if (k === 'google') google++;
      else if (k === 'apple') apple++;
      else other++;
    }
    const total = Math.max(1, apple + google + samsung + other);
    const seg = (v) => ((v / total) * 100).toFixed(1);
    const fmtCount = (n, pct) => (n === 0 ? 'Nessuna installazione ancora' : `<strong style="color:var(--text)">${n}</strong> (${pct}%)`);

    el.innerHTML = `
      <div style="display:flex;height:16px;border-radius:999px;overflow:hidden;border:1px solid var(--border);background:var(--bg3);">
        <div style="width:${seg(apple)}%;background:linear-gradient(90deg,#86efac,#22c55e);" title="Apple ${apple}"></div>
        <div style="width:${seg(google)}%;background:linear-gradient(90deg,#60a5fa,#2563eb);" title="Google ${google}"></div>
        <div style="width:${seg(samsung)}%;background:linear-gradient(90deg,#93c5fd,#1428a0);" title="Samsung ${samsung}"></div>
        <div style="width:${seg(other)}%;background:linear-gradient(90deg,#c4b5fd,#8b5cf6);" title="Altro ${other}"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr;gap:8px;margin-top:12px;font-size:12px;color:var(--text2);padding-bottom:8px;">
        <div><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#22c55e;margin-right:6px;"></span>Apple Wallet: ${fmtCount(apple, seg(apple))}</div>
        <div><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#2563eb;margin-right:6px;"></span>Google Wallet: ${fmtCount(google, seg(google))}</div>
        <div><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#1428a0;margin-right:6px;"></span>Samsung Wallet: ${fmtCount(samsung, seg(samsung))}</div>
        <div><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#8b5cf6;margin-right:6px;"></span>Altro: ${fmtCount(other, seg(other))}</div>
        <div style="margin-top:4px;">Installati totali: <strong style="color:var(--text)">${totalInstalled}</strong></div>
      </div>
    `;
  }

  function renderA2wTopCampaigns(campaigns) {
    const el = document.getElementById('analyticsTopCampaigns');
    const card = el && el.closest('.a2w-top-campaigns-card');
    if (!el) return;

    if (!campaigns.length) {
      if (card) card.classList.remove('a2w-top-campaigns--single');
      el.innerHTML = '<p style="color:var(--text2);font-size:13px;">Nessuna campagna disponibile.</p>';
      return;
    }

    const ranked = [...campaigns]
      .map((c) => ({
        ...c,
        conv: c.total_downloads > 0 ? (c.total_installs / c.total_downloads) * 100 : 0
      }))
      .sort((a, b) => (b.conv - a.conv) || ((b.total_installs || 0) - (a.total_installs || 0)))
      .slice(0, 5);

    if (card) card.classList.toggle('a2w-top-campaigns--single', ranked.length <= 1);

    const maxConv = Math.max(1, ...ranked.map((r) => r.conv));
    const accentData = getComputedStyle(document.documentElement).getPropertyValue('--a2w-accent-data').trim() || '#3FE0C8';
    el.innerHTML = `<div class="a2w-top-campaigns-inner">${ranked.map((r, idx) => {
      const w = ((r.conv / maxConv) * 100).toFixed(1);
      const rowColor = idx === 0 ? accentData : idx === 1 ? '#3b82f6' : idx === 2 ? '#10b981' : '#a78bfa';
      return `
        <div style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;margin-bottom:4px;">
            <span style="color:var(--text);font-weight:600;">${typeof esc === 'function' ? esc(r.name) : r.name}</span>
            <span style="color:var(--text2);">${r.conv.toFixed(1)}% · ${r.total_installs || 0}/${r.total_downloads || 0}</span>
          </div>
          <div style="height:11px;border-radius:999px;background:var(--bg3);border:1px solid var(--border);overflow:hidden;">
            <div style="height:100%;width:${w}%;background:linear-gradient(90deg,${rowColor},#6ee7b7);"></div>
          </div>
        </div>
      `;
    }).join('')}</div>`;
  }

  function renderA2wCampaignTable(campaigns) {
    const tbody = document.querySelector('#campaignAnalyticsTable tbody');
    if (!tbody) return;
    if (!campaigns.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text2)">Nessuna campagna</td></tr>';
      return;
    }
    tbody.innerHTML = campaigns.map((c) => {
      const conv = c.total_downloads > 0 ? ((c.total_installs / c.total_downloads) * 100).toFixed(1) : '0';
      const name = typeof esc === 'function' ? esc(c.name) : c.name;
      const utm = typeof esc === 'function' ? esc(c.utm_source || '-') : (c.utm_source || '-');
      const badge = c.active
        ? '<span class="a2w-badge a2w-badge--active">Attiva</span>'
        : '<span class="a2w-badge a2w-badge--paused">Pausa</span>';
      return `<tr>
        <td>${name}</td>
        <td class="a2w-num">${c.total_downloads || 0}</td>
        <td class="a2w-num">${c.total_installs || 0}</td>
        <td class="a2w-num">${conv}%</td>
        <td>${utm}</td>
        <td class="a2w-col-status">${badge}</td>
      </tr>`;
    }).join('');
  }

  async function a2wLoadAnalytics() {
    if (!isA2wDeploy()) return;
    if (typeof brandId === 'undefined' || !brandId) return;
    ensureA2wAnalyticsLayout();

    const [analytics, campaigns, passes] = await Promise.all([
      fetchCachedJson(`${API}/analytics/${brandId}`, { headers: { ...getAuthHeaders() } }),
      fetchCachedJson(`${API}/campaigns?brand_id=${brandId}`, { headers: { ...getAuthHeaders() } }),
      fetchCachedJson(`${API}/passes?brand_id=${brandId}&limit=600`, { headers: { ...getAuthHeaders() } })
    ]);

    const allPasses = Array.isArray(passes) ? passes : [];
    renderA2wAnalyticsStats(analytics, campaigns, allPasses);
    if (typeof syncAnalyticsRangeControls === 'function') syncAnalyticsRangeControls();
    renderA2wTrendChart(allPasses);
    renderA2wWalletSplit(allPasses);
    renderA2wTopCampaigns(campaigns);
    renderA2wCampaignTable(campaigns);
  }

  A2W.ensureA2wLeadsLayout = ensureA2wLeadsLayout;
  A2W.initA2wShell = initA2wShell;
  A2W.initA2WSidebarChrome = initA2WSidebarChrome;
  A2W.syncA2wHeaderChrome = syncA2wHeaderChrome;
  A2W.syncA2wWaiPadding = syncA2wWaiPadding;
  A2W.isA2wDeploy = isA2wDeploy;
  A2W.isA2wActive = isA2wActive;
  A2W.a2wLoadAnalytics = a2wLoadAnalytics;

  window.ensureA2wLeadsLayout = ensureA2wLeadsLayout;
  window.initA2wShell = initA2wShell;
  window.syncA2wHeaderChrome = syncA2wHeaderChrome;
  window.syncA2wWaiPadding = syncA2wWaiPadding;
  window.isA2wDeploy = isA2wDeploy;
  window.isA2wActive = isA2wActive;
  window.a2wLoadAnalytics = a2wLoadAnalytics;
})();
