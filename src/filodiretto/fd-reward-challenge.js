/**
 * FD — Reward & Challenge (FASE 4): DS layout, KPI grid, table UX, tooltip colonne.
 */
(function () {
  'use strict';

  function isFilo() {
    if (document.documentElement.classList.contains('a2w-shell')) return false;
    try {
      if (window.__2WALLET_PRODUCT_LOCK__ === 'hr') return true;
    } catch (_) {}
    return document.documentElement.getAttribute('data-app') === 'filodiretto';
  }

  function setStatsCompact(gridId, totalCampaigns) {
    var grid = document.getElementById(gridId);
    if (!grid) return;
    grid.classList.toggle('stats-grid--compact', totalCampaigns === 0);
  }

  function tableHasDataRows(tableId) {
    var tbody = document.querySelector('#' + tableId + ' tbody');
    return !!(tbody && tbody.querySelector('tr td:not([colspan])'));
  }

  function syncEngagementTableHead(tableId) {
    if (!isFilo()) return;
    var table = document.getElementById(tableId);
    if (!table) return;
    var thead = table.querySelector('thead');
    if (!thead) return;
    var emptyHost = tableId === 'gamTable' ? document.getElementById('gamEmptyHost') : null;
    var emptyHostVisible = !!(emptyHost && !emptyHost.hidden && emptyHost.innerHTML.trim());
    var tableHidden = table.hidden === true;
    var hasData = !emptyHostVisible && !tableHidden && tableHasDataRows(tableId);
    thead.hidden = !hasData;
    table.classList.toggle('fd-table--empty', !hasData);
    if (emptyHostVisible) table.hidden = true;
  }

  function challengeStatusMeta(status) {
    var key = String(status || '').toLowerCase();
    var map = {
      active: { label: 'Attiva', cls: 'fd-challenge-status--active' },
      draft: { label: 'Bozza', cls: 'fd-challenge-status--draft' },
      paused: { label: 'In pausa', cls: 'fd-challenge-status--paused' },
      ended: { label: 'Terminata', cls: 'fd-challenge-status--ended' },
      inactive: { label: 'Inattiva', cls: 'fd-challenge-status--inactive' }
    };
    return map[key] || { label: status || '—', cls: 'fd-challenge-status--neutral' };
  }

  function enhanceChallengeStatusBadges(scope) {
    var root = scope || document.getElementById('gamification');
    if (!root) return;
    root.querySelectorAll('#gamTable tbody tr').forEach(function (row) {
      var badge = row.querySelector('td .badge');
      if (!badge || badge.dataset.fdStatusLocalized === '1') return;
      var raw = (badge.textContent || '').trim();
      var meta = challengeStatusMeta(raw);
      badge.dataset.fdStatusLocalized = '1';
      badge.textContent = meta.label;
      badge.classList.remove('active', 'inactive');
      badge.classList.add('fd-challenge-status', meta.cls);
    });
  }

  function formatRedemptionRate(stats) {
    if (!stats) return '—';
    var plays = Number(stats.total_plays) || 0;
    if (plays <= 0) return '—';
    if (stats.win_rate == null || stats.win_rate === '') return '—';
    var rate = Number(stats.win_rate);
    if (!Number.isFinite(rate)) return '—';
    return rate.toFixed(1) + '%';
  }

  function applyRewardStats(stats) {
    var el = document.getElementById('iwStatRate');
    if (!el) return;
    el.textContent = formatRedemptionRate(stats);
  }

  var thHelpTipNode = null;
  var thHelpTipAnchor = null;

  function hideThHelpTip() {
    if (!thHelpTipNode) return;
    thHelpTipNode.hidden = true;
    thHelpTipNode.setAttribute('aria-hidden', 'true');
    thHelpTipAnchor = null;
  }

  function ensureThHelpTip() {
    if (thHelpTipNode) return thHelpTipNode;
    thHelpTipNode = document.createElement('div');
    thHelpTipNode.id = 'fdThHelpTip';
    thHelpTipNode.className = 'fd-th-help-tip';
    thHelpTipNode.setAttribute('role', 'tooltip');
    thHelpTipNode.hidden = true;
    thHelpTipNode.setAttribute('aria-hidden', 'true');
    document.body.appendChild(thHelpTipNode);
    document.addEventListener('scroll', hideThHelpTip, true);
    window.addEventListener('resize', hideThHelpTip);
    return thHelpTipNode;
  }

  function positionThHelpTip(anchor, text) {
    var tip = ensureThHelpTip();
    tip.textContent = text;
    tip.hidden = false;
    tip.setAttribute('aria-hidden', 'false');
    thHelpTipAnchor = anchor;

    var collision = 12;
    var gap = 8;
    var rect = anchor.getBoundingClientRect();
    tip.style.transform = 'none';
    var width = tip.offsetWidth || 240;
    var height = tip.offsetHeight || 80;

    var top = rect.bottom + gap;
    var left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(collision, Math.min(left, window.innerWidth - width - collision));

    if (top + height > window.innerHeight - collision) {
      top = Math.max(collision, rect.top - height - gap);
      tip.classList.add('fd-th-help-tip--above');
    } else {
      tip.classList.remove('fd-th-help-tip--above');
    }

    if (left + width > window.innerWidth - collision) {
      left = Math.max(collision, window.innerWidth - width - collision);
    }

    tip.style.position = 'fixed';
    tip.style.top = top + 'px';
    tip.style.left = left + 'px';
    tip.style.zIndex = '9300';
  }

  function bindThHelpTooltips() {
    document.querySelectorAll('#iwTable th .fd-th-help, #gamTable th .fd-th-help').forEach(function (hint) {
      if (hint.dataset.fdTipBound === '1') return;
      hint.dataset.fdTipBound = '1';
      var th = hint.closest('th');
      if (!th) return;
      var tipText = th.getAttribute('aria-label') || th.getAttribute('title') || '';
      th.removeAttribute('title');
      hint.setAttribute('tabindex', '0');
      hint.setAttribute('role', 'button');
      hint.setAttribute('aria-label', tipText);

      function show() {
        if (!tipText) return;
        positionThHelpTip(hint, tipText);
      }

      hint.addEventListener('mouseenter', show);
      hint.addEventListener('focus', show);
      hint.addEventListener('mouseleave', hideThHelpTip);
      hint.addEventListener('blur', hideThHelpTip);
      hint.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (thHelpTipAnchor === hint && thHelpTipNode && !thHelpTipNode.hidden) hideThHelpTip();
        else show();
      });
    });
  }

  function updateIwStatsCompact() {
    setStatsCompact('iwStats', tableHasDataRows('iwTable') ? 1 : 0);
  }

  function updateGamStatsCompact() {
    setStatsCompact('gamStats', tableHasDataRows('gamTable') ? 1 : 0);
  }

  function addThHelp(th, tip) {
    if (!th || th.querySelector('.fd-th-help')) return;
    th.setAttribute('aria-label', (th.textContent || '').trim() + '. ' + tip);
    var hint = document.createElement('span');
    hint.className = 'fd-th-help';
    hint.setAttribute('aria-hidden', 'true');
    hint.textContent = '?';
    th.appendChild(hint);
  }

  function enhanceTableHeaders() {
    var iwHead = document.querySelector('#iwTable thead tr');
    if (iwHead) {
      var iwThs = iwHead.querySelectorAll('th');
      if (iwThs[3]) {
        addThHelp(
          iwThs[3],
          'Percentuale di probabilità che un dipendente vinca il premio a ogni tentativo.'
        );
      }
    }
    var gamHead = document.querySelector('#gamTable thead tr');
    if (gamHead) {
      var gamThs = gamHead.querySelectorAll('th');
      var podioTip =
        'Soglia podio: premio assegnato se la sfida viene completata entro il tempo indicato (secondi).';
      if (gamThs[2]) addThHelp(gamThs[2], 'Premio oro. ' + podioTip);
      if (gamThs[3]) addThHelp(gamThs[3], 'Premio argento. ' + podioTip);
      if (gamThs[4]) addThHelp(gamThs[4], 'Premio bronzo. ' + podioTip);
    }
  }

  function enhanceStatsGrid(gridId) {
    var grid = document.getElementById(gridId);
    if (!grid || grid.dataset.fdDsStats === '1') return;
    grid.dataset.fdDsStats = '1';
    grid.classList.add('fd-stat-grid', 'fd-reward-stat-grid');
    grid.querySelectorAll('.stat-card').forEach(function (card) {
      card.classList.add('fd-stat-card');
      var label = card.querySelector('.stat-label');
      if (label) label.classList.add('fd-stat-card__label');
      var value = card.querySelector('.stat-value');
      if (value) value.classList.add('fd-stat-card__value');
    });
  }

  function enhanceRewardSectionDesign() {
    var section = document.getElementById('instant-win');
    if (!section || section.dataset.fdDsSection === '1') return;
    section.dataset.fdDsSection = '1';
    section.classList.add('instant-win--fd-ds');

    var title = section.querySelector('h1.page-title, h1.sec-title');
    var blurb = section.querySelector('#iwPageBlurb, :scope > p');
    if (title && !title.closest('.fd-page-header')) {
      var header = document.createElement('header');
      header.className = 'fd-page-header fd-reward-header';
      var copy = document.createElement('div');
      copy.className = 'fd-page-header__copy';
      copy.appendChild(title);
      title.classList.add('fd-page-header__title');
      if (blurb) {
        blurb.classList.add('fd-page-header__lead', 'fd-reward-lead');
        blurb.style.color = '';
        blurb.style.fontSize = '';
        blurb.style.marginBottom = '';
        copy.appendChild(blurb);
      }
      header.appendChild(copy);
      section.insertBefore(header, section.firstChild);
    }

    enhanceStatsGrid('iwStats');

    var toolbar = section.querySelector(':scope > div[style*="justify-content"]');
    var listTitle = toolbar?.querySelector('.sec-title');
    var createBtn = section.querySelector('[onclick*="openIwModal"]');
    if (toolbar && listTitle && !toolbar.classList.contains('fd-toolbar')) {
      toolbar.classList.add('fd-toolbar', 'fd-reward-toolbar');
      toolbar.style.display = '';
      toolbar.style.justifyContent = '';
      toolbar.style.alignItems = '';
      toolbar.style.marginBottom = '';
      listTitle.classList.add('fd-reward-list-title');
      if (createBtn) {
        createBtn.classList.add('fd-btn', 'fd-btn--primary');
      }
    }

    wrapRewardTable();
    enhanceRewardModal();
  }

  function wrapRewardTable() {
    var table = document.getElementById('iwTable');
    if (!table || table.closest('.fd-table-wrap, .fd-reward-table-wrap')) return;
    var wrap = document.createElement('div');
    wrap.className = 'fd-table-wrap fd-reward-table-wrap';
    table.parentNode.insertBefore(wrap, table);
    wrap.appendChild(table);
    table.classList.add('fd-table');
  }

  function enhanceRewardModal() {
    var modal = document.getElementById('iwModal');
    if (!modal || modal.dataset.fdDsModal === '1') return;
    modal.dataset.fdDsModal = '1';
    if (!modal.classList.contains('modal')) modal.classList.add('modal');
    var panel = modal.querySelector('.modal-content');
    if (panel) panel.classList.add('fd-card', 'fd-reward-modal');
    modal.querySelectorAll('[onclick*="closeIwModal"]').forEach(function (btn) {
      btn.classList.add('fd-btn', 'fd-btn--ghost', 'fd-btn--sm');
      btn.classList.remove('sec');
    });
    modal.querySelectorAll('[onclick*="saveIwCampaign"]').forEach(function (btn) {
      btn.classList.add('fd-btn', 'fd-btn--primary', 'fd-reward-modal-save');
    });
  }

  function renderRewardTableSkeleton() {
    return (
      '<tr class="table-skeleton-row" aria-hidden="true">' +
      '<td colspan="8">' +
      '<div class="fd-reward-table-skeleton fd-loading-region" aria-busy="true" aria-live="polite">' +
      '<span class="fd-skeleton" style="display:block;width:100%;height:160px;border-radius:12px"></span>' +
      '</div></td></tr>'
    );
  }

  function showRewardLoadingState() {
    var tbody = document.querySelector('#iwTable tbody');
    if (tbody) tbody.innerHTML = renderRewardTableSkeleton();
    var section = document.getElementById('instant-win');
    if (section) section.classList.add('fd-reward--loading');
  }

  function clearRewardLoadingState() {
    var section = document.getElementById('instant-win');
    if (section) section.classList.remove('fd-reward--loading');
  }

  function enhanceRewardRowActions() {
    document.querySelectorAll('#iwTable tbody tr').forEach(function (tr) {
      if (tr.classList.contains('table-skeleton-row') || tr.classList.contains('table-empty-row')) return;
      var actions = tr.querySelector('td:last-child');
      if (!actions || actions.dataset.fdDsActions === '1') return;
      var modBtn = actions.querySelector('[onclick*="editIwCampaign"]');
      var delBtn = actions.querySelector('[onclick*="deleteIwCampaign"]');
      if (!modBtn || !delBtn) return;
      actions.dataset.fdDsActions = '1';
      actions.classList.add('fd-reward-row-actions');
      modBtn.classList.add('fd-btn', 'fd-btn--primary', 'fd-btn--sm');
      delBtn.classList.add('fd-btn', 'fd-btn--ghost', 'fd-btn--sm', 'fd-reward-row-delete');
      modBtn.classList.remove('sec');
      delBtn.classList.remove('sec');
      modBtn.style.fontSize = '';
      modBtn.style.padding = '';
      delBtn.style.fontSize = '';
      delBtn.style.padding = '';
      delBtn.style.color = '';
    });
  }

  function enhanceRewardDom() {
    enhanceRewardSectionDesign();
    enhanceStatsGrid('iwStats');
    wrapRewardTable();
    var table = document.getElementById('iwTable');
    if (table) table.classList.add('fd-table');
    enhanceRewardRowActions();
    enhanceTableHeaders();
    bindThHelpTooltips();
    updateIwStatsCompact();
    syncEngagementTableHead('iwTable');
    if (typeof window.fdEnhanceResponsiveTables === 'function') {
      window.fdEnhanceResponsiveTables();
    }
  }

  function enhanceChallengeSectionDesign() {
    var section = document.getElementById('gamification');
    if (!section || section.dataset.fdDsSection === '1') return;
    section.dataset.fdDsSection = '1';
    section.classList.add('gamification--fd-ds');

    var title = section.querySelector('h1.page-title, h1.sec-title');
    var blurb = section.querySelector('#gamPageBlurb, :scope > p');
    if (title && !title.closest('.fd-page-header')) {
      var header = document.createElement('header');
      header.className = 'fd-page-header fd-challenge-header';
      var copy = document.createElement('div');
      copy.className = 'fd-page-header__copy';
      copy.appendChild(title);
      title.classList.add('fd-page-header__title');
      if (blurb) {
        blurb.classList.add('fd-page-header__lead', 'fd-challenge-lead');
        blurb.style.color = '';
        blurb.style.fontSize = '';
        blurb.style.marginBottom = '';
        copy.appendChild(blurb);
      }
      header.appendChild(copy);
      section.insertBefore(header, section.firstChild);
    }

    enhanceStatsGrid('gamStats');

    var toolbar = section.querySelector(':scope > div[style*="justify-content"]');
    var listTitle = toolbar?.querySelector('.sec-title');
    var createBtn = section.querySelector('[onclick*="openGamModal"]');
    if (toolbar && listTitle && !toolbar.classList.contains('fd-toolbar')) {
      toolbar.classList.add('fd-toolbar', 'fd-challenge-toolbar');
      toolbar.style.display = '';
      toolbar.style.justifyContent = '';
      toolbar.style.alignItems = '';
      toolbar.style.marginBottom = '';
      listTitle.classList.add('fd-challenge-list-title');
      if (createBtn) {
        createBtn.classList.add('fd-btn', 'fd-btn--primary');
      }
    }

    wrapChallengeTable();
    enhanceChallengeModal();
  }

  function wrapChallengeTable() {
    var table = document.getElementById('gamTable');
    if (!table || table.closest('.fd-table-wrap, .fd-challenge-table-wrap')) return;
    var wrap = document.createElement('div');
    wrap.className = 'fd-table-wrap fd-challenge-table-wrap';
    table.parentNode.insertBefore(wrap, table);
    wrap.appendChild(table);
    table.classList.add('fd-table');
  }

  function enhanceChallengeModal() {
    var modal = document.getElementById('gamModal');
    if (!modal || modal.dataset.fdDsModal === '1') return;
    modal.dataset.fdDsModal = '1';
    if (!modal.classList.contains('modal')) modal.classList.add('modal');
    var panel = modal.querySelector('.modal-content');
    if (panel) panel.classList.add('fd-card', 'fd-challenge-modal');
    modal.querySelectorAll('[onclick*="closeGamModal"]').forEach(function (btn) {
      btn.classList.add('fd-btn', 'fd-btn--ghost', 'fd-btn--sm');
      btn.classList.remove('sec');
    });
    modal.querySelectorAll('[onclick*="saveGamCampaign"]').forEach(function (btn) {
      btn.classList.add('fd-btn', 'fd-btn--primary', 'fd-challenge-modal-save');
    });
  }

  function renderChallengeTableSkeleton() {
    return (
      '<tr class="table-skeleton-row" aria-hidden="true">' +
      '<td colspan="8">' +
      '<div class="fd-challenge-table-skeleton fd-loading-region" aria-busy="true" aria-live="polite">' +
      '<span class="fd-skeleton" style="display:block;width:100%;height:160px;border-radius:12px"></span>' +
      '</div></td></tr>'
    );
  }

  function showChallengeLoadingState() {
    var tbody = document.querySelector('#gamTable tbody');
    if (tbody) tbody.innerHTML = renderChallengeTableSkeleton();
    var section = document.getElementById('gamification');
    if (section) section.classList.add('fd-challenge--loading');
  }

  function clearChallengeLoadingState() {
    var section = document.getElementById('gamification');
    if (section) section.classList.remove('fd-challenge--loading');
  }

  function enhanceChallengeRowActions() {
    document.querySelectorAll('#gamTable tbody tr').forEach(function (tr) {
      if (tr.classList.contains('table-skeleton-row') || tr.classList.contains('table-empty-row')) return;
      var actions = tr.querySelector('td:last-child');
      if (!actions || actions.dataset.fdDsActions === '1') return;
      var modBtn = actions.querySelector('[onclick*="editGamCampaign"]');
      var delBtn = actions.querySelector('[onclick*="deleteGamCampaign"]');
      if (!modBtn || !delBtn) return;
      actions.dataset.fdDsActions = '1';
      actions.classList.add('fd-challenge-row-actions');
      modBtn.classList.add('fd-btn', 'fd-btn--primary', 'fd-btn--sm');
      delBtn.classList.add('fd-btn', 'fd-btn--ghost', 'fd-btn--sm', 'fd-challenge-row-delete');
      modBtn.classList.remove('sec');
      delBtn.classList.remove('sec');
      modBtn.style.fontSize = '';
      modBtn.style.padding = '';
      delBtn.style.fontSize = '';
      delBtn.style.padding = '';
      delBtn.style.color = '';
    });
  }

  function enhanceChallengeDom() {
    enhanceChallengeSectionDesign();
    enhanceStatsGrid('gamStats');
    wrapChallengeTable();
    var table = document.getElementById('gamTable');
    if (table) table.classList.add('fd-table');
    enhanceChallengeRowActions();
    enhanceTableHeaders();
    bindThHelpTooltips();
    enhanceChallengeStatusBadges();
    updateGamStatsCompact();
    syncEngagementTableHead('gamTable');
    if (typeof window.fdEnhanceResponsiveTables === 'function') {
      window.fdEnhanceResponsiveTables();
    }
  }

  function patchLoaders() {
    if (window.__fdRcPatched) return;
    window.__fdRcPatched = true;

    if (typeof window.loadInstantWin === 'function') {
      var origIw = window.loadInstantWin;
      window.loadInstantWin = async function () {
        if (isFilo() && window.brandId) showRewardLoadingState();
        try {
          await origIw.apply(this, arguments);
        } finally {
          clearRewardLoadingState();
        }
        if (isFilo()) {
          var plays = parseInt((document.getElementById('iwStatPlays') || {}).textContent, 10);
          if (!Number.isFinite(plays) || plays <= 0) {
            applyRewardStats(null);
          }
          enhanceRewardDom();
        } else {
          updateIwStatsCompact();
        }
        syncEngagementTableHead('iwTable');
      };
    }
    if (typeof window.loadGamification === 'function') {
      var origGam = window.loadGamification;
      window.loadGamification = async function () {
        if (isFilo() && window.brandId) showChallengeLoadingState();
        try {
          await origGam.apply(this, arguments);
        } finally {
          clearChallengeLoadingState();
        }
        if (isFilo()) enhanceChallengeDom();
        else updateGamStatsCompact();
        syncEngagementTableHead('gamTable');
      };
    }
  }

  function patchNav() {
    if (window.__fdRcNavPatched || typeof window.nav !== 'function') return;
    window.__fdRcNavPatched = true;
    var orig = window.nav;
    window.nav = function (sectionId) {
      var out = orig.apply(this, arguments);
      if (sectionId === 'instant-win' || sectionId === 'gamification') {
        setTimeout(function () {
          if (sectionId === 'instant-win' && isFilo()) {
            enhanceRewardSectionDesign();
            enhanceRewardDom();
          } else if (sectionId === 'gamification' && isFilo()) {
            enhanceChallengeSectionDesign();
            enhanceChallengeDom();
          } else {
            enhanceTableHeaders();
            bindThHelpTooltips();
            if (sectionId === 'instant-win') {
              updateIwStatsCompact();
              syncEngagementTableHead('iwTable');
            } else {
              updateGamStatsCompact();
              syncEngagementTableHead('gamTable');
            }
          }
        }, 120);
      }
      return out;
    };
  }

  function init() {
    if (!isFilo()) return;
    patchLoaders();
    patchNav();
    enhanceRewardSectionDesign();
    enhanceRewardDom();
    enhanceChallengeSectionDesign();
    enhanceChallengeDom();
    enhanceTableHeaders();
    updateGamStatsCompact();
  }

  window.fdInitRewardChallenge = init;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
