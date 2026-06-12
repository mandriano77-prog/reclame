/**
 * FD — Reward & Challenge: KPI compatte, tooltip colonne tabella.
 */
(function () {
  'use strict';

  function isFilo() {
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

  function patchLoaders() {
    if (window.__fdRcPatched) return;
    window.__fdRcPatched = true;

    if (typeof window.loadInstantWin === 'function') {
      var origIw = window.loadInstantWin;
      window.loadInstantWin = async function () {
        await origIw.apply(this, arguments);
        updateIwStatsCompact();
      };
    }
    if (typeof window.loadGamification === 'function') {
      var origGam = window.loadGamification;
      window.loadGamification = async function () {
        await origGam.apply(this, arguments);
        updateGamStatsCompact();
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
          enhanceTableHeaders();
          if (sectionId === 'instant-win') updateIwStatsCompact();
          else updateGamStatsCompact();
        }, 120);
      }
      return out;
    };
  }

  function init() {
    if (!isFilo()) return;
    patchLoaders();
    patchNav();
    enhanceTableHeaders();
    updateIwStatsCompact();
    updateGamStatsCompact();
  }

  window.fdInitRewardChallenge = init;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
