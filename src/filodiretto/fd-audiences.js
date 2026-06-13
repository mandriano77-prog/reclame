/**
 * FD — Audience: fix tab Comportamento layout, KPI grid consistency.
 */
(function () {
  'use strict';

  function isFilo() {
    return document.documentElement.getAttribute('data-app') === 'filodiretto';
  }

  function escHtml(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function statCard(num, label) {
    return (
      '<div class="stat-card">' +
      '<div class="stat-num">' + escHtml(num) + '</div>' +
      '<div class="stat-label">' + escHtml(label) + '</div>' +
      '</div>'
    );
  }

  function renderBehaviorStatsHtml(b, f, days) {
    return (
      '<div class="fd-aud-behavior-metrics">' +
      '<header class="fd-aud-behavior-head">' +
      '<p class="fd-aud-behavior-head__label">Eventi (' + escHtml(days) + ' gg)</p>' +
      '<p class="fd-aud-behavior-head__value">' + escHtml(b.total_events ?? 0) + '</p>' +
      '</header>' +
      '<div class="stats-grid fd-aud-behavior-grid">' +
      statCard(b.unique_holders_active ?? 0, 'Possessori attivi') +
      statCard(f.opened ?? 0, 'Aperture pass') +
      statCard(f.link_clicks ?? 0, 'Clic link retro') +
      statCard(f.unique_clickers ?? 0, 'Utenti unici clic') +
      '</div></div>'
    );
  }

  function renderLinkFunnels(funnels) {
    if (!funnels.length) {
      return '<span>Nessun clic per link nel periodo. Rigenera i pass per attivare il tracking.</span>';
    }
    return funnels.map(function (item) {
      return (
        '<div class="fd-aud-funnel-row" style="margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--border);">' +
        '<strong>' + escHtml(item.target_label || item.target_key) + '</strong> ' +
        '<span style="color:var(--text2);font-size:11px;">(' + escHtml(item.target_key) + ')</span>' +
        '<div class="fd-aud-funnel-grid">' +
        '<div><strong>' + escHtml(item.pass_holders) + '</strong><span>Pass</span></div>' +
        '<div><strong>' + escHtml(item.installed) + '</strong><span>Install.</span></div>' +
        '<div><strong>' + escHtml(item.opened) + '</strong><span>Aperti</span></div>' +
        '<div><strong>' + escHtml(item.unique_clickers) + '</strong><span>Clic unici</span></div>' +
        '<div><strong>' + escHtml(item.ctr_from_opened_pct) + '%</strong><span>CTR/Aperti</span></div>' +
        '</div></div>'
      );
    }).join('');
  }

  async function loadAudienceBehaviorFixed() {
    var brandId = typeof window.ensureBrandIdFromContext === 'function'
      ? window.ensureBrandIdFromContext()
      : window.brandId;
    if (!brandId) return;

    var statsHost = document.getElementById('audienceBehaviorStats');
    if (!statsHost) return;
    statsHost.classList.remove('stats-grid');
    statsHost.classList.add('fd-aud-behavior-stats-host');

    try {
      var days = document.getElementById('audBehaviorDays')?.value || 30;
      var api = typeof window.API === 'string' && window.API ? window.API : '/api/v1';
      var headers = typeof window.getAuthHeaders === 'function' ? window.getAuthHeaders() : {};
      var res = await fetch(api + '/brands/' + encodeURIComponent(brandId) + '/audiences/insights?days=' + encodeURIComponent(days), {
        headers: headers
      });
      var data = res.ok ? await res.json() : {};
      var b = data.behavior || {};
      var f = b.funnel || {};

      statsHost.innerHTML = renderBehaviorStatsHtml(b, f, days);

      var funnelsEl = document.getElementById('audienceLinkFunnels');
      if (funnelsEl) funnelsEl.innerHTML = renderLinkFunnels(b.link_funnels || []);

      var links = b.top_link_clicks || [];
      var linksEl = document.getElementById('audienceTopLinks');
      if (linksEl) {
        linksEl.innerHTML = links.length
          ? links.map(function (l) {
            return (
              '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);">' +
              '<span>' + escHtml(l.target_label || l.target_key || 'Link') +
              ' <span style="color:var(--text2);font-size:11px;">' + escHtml((l.target_url || '').slice(0, 40)) + '</span></span>' +
              '<strong>' + escHtml(l.clicks) + '</strong></div>'
            );
          }).join('')
          : '<span>Nessun clic registrato ancora. I nuovi pass tracciano i link del retro.</span>';
      }

      var evRes = await fetch(api + '/brands/' + encodeURIComponent(brandId) + '/holder-events?limit=40', {
        headers: headers
      });
      var events = evRes.ok ? await evRes.json() : [];
      var eventsEl = document.getElementById('audienceRecentEvents');
      if (eventsEl) {
        eventsEl.innerHTML = events.length
          ? events.map(function (e) {
            return (
              '<div style="padding:6px 0;border-bottom:1px solid var(--border);">' +
              '<span style="color:var(--teal);">' + escHtml(e.event_action) + '</span>' +
              (e.target_label ? ' · ' + escHtml(e.target_label) : '') +
              '<span style="float:right;color:var(--text2);">' +
              (e.created_at ? new Date(e.created_at).toLocaleString('it-IT') : '') +
              '</span></div>'
            );
          }).join('')
          : 'Nessun evento';
      }
    } catch (e) {
      console.error('[fd-audiences] loadAudienceBehavior', e);
      statsHost.innerHTML =
        '<p style="color:var(--text2);margin:0;">Metriche comportamento non disponibili al momento.</p>';
    }
  }

  function enhanceBehaviorPanel() {
    var panel = document.getElementById('audPanel_behavior');
    if (!panel || panel.dataset.fdAudEnhanced === '1') return;
    panel.dataset.fdAudEnhanced = '1';

    var toolbarRow = panel.querySelector('div[style*="justify-content:flex-end"]');
    if (toolbarRow && !panel.querySelector('.fd-aud-behavior-toolbar')) {
      toolbarRow.className = 'fd-aud-behavior-toolbar';
      var select = toolbarRow.querySelector('#audBehaviorDays');
      var exportBtn = toolbarRow.querySelector('button');
      toolbarRow.innerHTML = '';
      var actions = document.createElement('div');
      actions.className = 'fd-aud-behavior-toolbar__actions';
      if (select) actions.appendChild(select);
      if (exportBtn) actions.appendChild(exportBtn);
      toolbarRow.appendChild(actions);
    }

    var statsHost = document.getElementById('audienceBehaviorStats');
    if (statsHost) {
      statsHost.classList.remove('stats-grid');
      statsHost.classList.add('fd-aud-behavior-stats-host');
    }
  }

  function patchAudienceLoaders() {
    if (window.__fdAudiencesPatched) return;
    window.__fdAudiencesPatched = true;
    window.loadAudienceBehavior = loadAudienceBehaviorFixed;
  }

  function patchNav() {
    if (window.__fdAudiencesNavPatched || typeof window.nav !== 'function') return;
    window.__fdAudiencesNavPatched = true;
    var orig = window.nav;
    window.nav = function (sectionId) {
      var out = orig.apply(this, arguments);
      if (sectionId === 'audiences') {
        setTimeout(function () {
          enhanceBehaviorPanel();
          if (document.getElementById('audPanel_behavior')?.style.display !== 'none') {
            loadAudienceBehaviorFixed();
          }
        }, 80);
      }
      return out;
    };
  }

  function init() {
    if (!isFilo()) return;
    var section = document.getElementById('audiences');
    if (section) section.classList.add('audiences--fd');
    patchAudienceLoaders();
    patchNav();
    enhanceBehaviorPanel();
  }

  window.fdInitAudiences = init;
  window.fdLoadAudienceBehavior = loadAudienceBehaviorFixed;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
