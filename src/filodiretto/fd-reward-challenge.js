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

  function updateIwStatsCompact() {
    setStatsCompact('iwStats', tableHasDataRows('iwTable') ? 1 : 0);
  }

  function updateGamStatsCompact() {
    setStatsCompact('gamStats', tableHasDataRows('gamTable') ? 1 : 0);
  }

  function addThHelp(th, tip) {
    if (!th || th.querySelector('.fd-th-help')) return;
    th.setAttribute('title', tip);
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
    modal.classList.add('fd-reward-modal-overlay');
    var panel = modal.querySelector(':scope > div');
    if (panel) panel.classList.add('fd-card', 'fd-reward-modal');
    modal.querySelectorAll('[onclick*="closeIwModal"]').forEach(function (btn) {
      btn.classList.add('fd-btn', 'fd-btn--ghost', 'fd-btn--sm');
      btn.classList.remove('sec');
    });
    modal.querySelectorAll('[onclick*="saveIwCampaign"]').forEach(function (btn) {
      btn.classList.add('fd-btn', 'fd-btn--primary', 'fd-reward-modal-save');
      btn.style.width = '';
      btn.style.marginTop = '';
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
    updateIwStatsCompact();
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
    modal.classList.add('fd-challenge-modal-overlay');
    var panel = modal.querySelector(':scope > div');
    if (panel) panel.classList.add('fd-card', 'fd-challenge-modal');
    modal.querySelectorAll('[onclick*="closeGamModal"]').forEach(function (btn) {
      btn.classList.add('fd-btn', 'fd-btn--ghost', 'fd-btn--sm');
      btn.classList.remove('sec');
    });
    modal.querySelectorAll('[onclick*="saveGamCampaign"]').forEach(function (btn) {
      btn.classList.add('fd-btn', 'fd-btn--primary', 'fd-challenge-modal-save');
      btn.style.width = '';
      btn.style.marginTop = '';
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
    updateGamStatsCompact();
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
        if (isFilo()) enhanceRewardDom();
        else updateIwStatsCompact();
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
            if (sectionId === 'instant-win') updateIwStatsCompact();
            else updateGamStatsCompact();
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
