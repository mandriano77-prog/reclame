/**
 * Instant Win dashboard — A2W shell layout (PageHeader, StatCards, table, EmptyState).
 */
(function (global) {
  'use strict';

  const A2W = global.A2W = global.A2W || {};
  A2W.instantWin = A2W.instantWin || {};

  const DICE_ICON = '<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.25" fill="currentColor" stroke="none"/><circle cx="16" cy="8" r="1.25" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none"/><circle cx="8" cy="16" r="1.25" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="1.25" fill="currentColor" stroke="none"/></svg>';

  const GAME_META = {
    scratch: {
      label: 'Scratch Card',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="6" width="16" height="12" rx="2"/><path d="M8 10h8M8 14h5"/></svg>'
    },
    wheel: {
      label: 'Spin the Wheel',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><path d="M12 4v8l5 3"/></svg>'
    },
    slots: {
      label: 'Slot Machine',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 9v6M12 9v6M16 9v6"/></svg>'
    }
  };

  const STATUS_META = {
    active: { label: 'Attiva', className: 'a2w-badge--active' },
    paused: { label: 'Pausa', className: 'a2w-badge--paused' },
    ended: { label: 'Conclusa', className: 'a2w-badge--ended' },
    draft: { label: 'Bozza', className: 'a2w-badge--draft' }
  };

  function ui() {
    return A2W.UI || {};
  }

  function isA2wInstantWinActive() {
    return typeof global.isA2wDeploy === 'function' && global.isA2wDeploy()
      && document.documentElement.classList.contains('a2w-shell');
  }

  function formatWinRate(stats) {
    if (typeof global.formatIwWinRateDisplay === 'function') {
      return global.formatIwWinRateDisplay(stats);
    }
    const plays = Number(stats && stats.total_plays) || 0;
    if (plays <= 0) return '—';
    const rate = stats && stats.win_rate;
    if (rate === null || rate === undefined || rate === '') return '—';
    const n = parseFloat(rate);
    if (!Number.isFinite(n)) return '—';
    return String(rate).includes('%') ? String(rate) : (n + '%');
  }

  function escText(s) {
    if (typeof global.esc === 'function') return global.esc(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function ensureInstantWinPageLayout() {
    if (A2W.instantWin.layoutReady) return;
    const section = document.getElementById('instant-win');
    if (!section) return;

    section.classList.add('a2w-iw-section');

    const UI = ui();
    const headerMount = document.getElementById('a2wIwPageHeader');
    if (headerMount && UI.createPageHeader && headerMount.dataset.mounted !== '1') {
      const primary = document.createElement('button');
      primary.type = 'button';
      primary.className = 'btn a2w-btn-primary';
      primary.textContent = 'Nuova campagna';
      primary.addEventListener('click', function () {
        if (typeof global.openIwModal === 'function') global.openIwModal();
      });

      const header = UI.createPageHeader({
        title: 'Instant Win',
        description: 'Campagne di gioco a premio immediato: scratch card, spin the wheel, slot machine.',
        actions: primary
      });
      headerMount.innerHTML = '';
      headerMount.appendChild(header);
      headerMount.hidden = false;
      headerMount.dataset.mounted = '1';
    }

    let statsHost = document.getElementById('a2wIwStatsHost');
    if (!statsHost) {
      statsHost = document.createElement('div');
      statsHost.id = 'a2wIwStatsHost';
      const legacyStats = document.getElementById('iwStats');
      if (legacyStats && legacyStats.parentNode) {
        legacyStats.parentNode.insertBefore(statsHost, legacyStats);
      } else {
        section.insertBefore(statsHost, section.querySelector('#a2wIwEmptyHost'));
      }
    }

    A2W.instantWin.layoutReady = true;
  }

  function renderIwStats(stats) {
    const host = document.getElementById('a2wIwStatsHost');
    const UI = ui();
    if (!host || !UI.createStatCard) return;
    host.innerHTML = '';
    const s = stats || {};
    [
      { label: 'Campagne attive', value: s.active_campaigns ?? 0 },
      { label: 'Giocate totali', value: s.total_plays ?? 0 },
      { label: 'Vincite', value: s.total_wins ?? 0 },
      { label: 'Win Rate', value: formatWinRate(s) }
    ].forEach(function (card) {
      host.appendChild(UI.createStatCard({ label: card.label, value: card.value }));
    });
  }

  function renderIwEmptyState() {
    const host = document.getElementById('a2wIwEmptyHost');
    const tableBlock = document.getElementById('a2wIwTableBlock');
    const UI = ui();
    if (!host) return;

    host.innerHTML = '';
    host.hidden = false;
    if (tableBlock) tableBlock.classList.add('a2w-iw-table-block--hidden');

    if (UI.createEmptyState) {
      host.appendChild(UI.createEmptyState({
        icon: DICE_ICON,
        title: 'Nessuna campagna Instant Win',
        description: 'Crea la prima campagna per coinvolgere i possessori del pass con giochi a premio immediato.',
        primaryAction: {
          label: 'Crea la prima campagna',
          onClick: function () {
            if (typeof global.openIwModal === 'function') global.openIwModal();
          }
        },
        tertiaryAction: {
          label: 'Vedi esempi',
          onClick: function () {
            if (typeof global.showIwExamples === 'function') global.showIwExamples();
          }
        }
      }));
    }
  }

  function hideIwEmptyState() {
    const host = document.getElementById('a2wIwEmptyHost');
    const tableBlock = document.getElementById('a2wIwTableBlock');
    if (host) {
      host.innerHTML = '';
      host.hidden = true;
    }
    if (tableBlock) tableBlock.classList.remove('a2w-iw-table-block--hidden');
  }

  function renderPlaysCell(c) {
    const plays = Number(c.total_plays) || 0;
    const cap = Number(c.total_budget) || 0;
    const label = cap > 0 ? (plays + '/' + cap) : String(plays);
    if (cap <= 0) {
      return '<div class="a2w-iw-plays"><span class="a2w-iw-plays__label">' + plays + '</span></div>';
    }
    const pct = Math.min(100, Math.round((plays / cap) * 100));
    return (
      '<div class="a2w-iw-plays">' +
      '<span class="a2w-iw-plays__label">' + escText(label) + '</span>' +
      '<div class="a2w-iw-plays__bar" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100">' +
      '<div style="width:' + pct + '%"></div></div></div>'
    );
  }

  function statusBadgeHtml(status) {
    const meta = STATUS_META[status] || { label: status || '—', className: 'a2w-badge--draft' };
    return '<span class="a2w-badge ' + meta.className + '">' + escText(meta.label) + '</span>';
  }

  function gameCellHtml(gameType) {
    const meta = GAME_META[gameType] || { label: gameType || '—', icon: GAME_META.scratch.icon };
    return (
      '<div class="a2w-iw-game-cell">' +
      '<span class="a2w-iw-game-icon">' + meta.icon + '</span>' +
      '<span class="a2w-iw-game-label">' + escText(meta.label) + '</span></div>'
    );
  }

  function createIwRowActionMenu(c) {
    const UI = ui();
    if (!UI.createActionMenu) return null;
    const items = [];

    if (c.status === 'active' || c.status === 'paused') {
      items.push({
        label: c.status === 'active' ? 'Pausa' : 'Riprendi',
        onClick: function () {
          if (typeof global.pauseIwCampaign === 'function') {
            global.pauseIwCampaign(c.id, c.status);
          }
        }
      });
    }

    items.push({
      label: 'Duplica',
      icon: A2W.icons && A2W.icons.copy,
      onClick: function () {
        if (typeof global.duplicateIwCampaign === 'function') global.duplicateIwCampaign(c.id);
      }
    });

    items.push({
      label: 'Esporta vincitori',
      icon: A2W.icons && A2W.icons.download,
      onClick: function () {
        if (typeof global.exportIwWinners === 'function') global.exportIwWinners(c.id);
      }
    });

    items.push({
      label: 'Elimina',
      icon: A2W.icons && A2W.icons.delete,
      destructive: true,
      onClick: function () {
        if (typeof global.deleteIwCampaign === 'function') global.deleteIwCampaign(c.id);
      }
    });

    return UI.createActionMenu({ label: 'Azioni campagna ' + (c.name || ''), items: items });
  }

  function renderIwTable(campaigns) {
    const tbody = document.querySelector('#iwTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    campaigns.forEach(function (c) {
      const tr = document.createElement('tr');
      const probPct = Math.round((Number(c.win_probability) || 0) * 100);

      const nameTd = document.createElement('td');
      nameTd.innerHTML = '<strong>' + escText(c.name) + '</strong>';

      const typeTd = document.createElement('td');
      typeTd.innerHTML = gameCellHtml(c.game_type);

      const prizeTd = document.createElement('td');
      prizeTd.textContent = c.prize_name || '—';

      const probTd = document.createElement('td');
      probTd.innerHTML = '<span class="a2w-iw-prob-badge">' + probPct + '%</span>';

      const playsTd = document.createElement('td');
      playsTd.innerHTML = renderPlaysCell(c);

      const winsTd = document.createElement('td');
      winsTd.className = 'a2w-num';
      winsTd.textContent = String(c.total_wins || 0);

      const statusTd = document.createElement('td');
      statusTd.className = 'a2w-col-status';
      statusTd.innerHTML = statusBadgeHtml(c.status);

      const actionsTd = document.createElement('td');
      actionsTd.className = 'a2w-iw-actions-cell';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn a2w-btn-secondary a2w-iw-edit-btn';
      editBtn.textContent = 'Modifica';
      editBtn.addEventListener('click', function () {
        if (typeof global.editIwCampaign === 'function') global.editIwCampaign(c.id);
      });

      actionsTd.appendChild(editBtn);
      const menu = createIwRowActionMenu(c);
      if (menu) actionsTd.appendChild(menu);

      [nameTd, typeTd, prizeTd, probTd, playsTd, winsTd, statusTd, actionsTd].forEach(function (td) {
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  async function a2wLoadInstantWinPage() {
    if (!isA2wInstantWinActive() || typeof global.brandId === 'undefined' || !global.brandId) return;
    ensureInstantWinPageLayout();

    const API = global.API;
    const headers = typeof global.getAuthHeaders === 'function' ? global.getAuthHeaders() : {};

    try {
      const [statsRes, listRes] = await Promise.all([
        fetch(API + '/instant-win/stats?brand_id=' + global.brandId, { headers: headers }),
        fetch(API + '/instant-win?brand_id=' + global.brandId, { headers: headers })
      ]);

      let stats = {};
      if (statsRes.ok) stats = await statsRes.json();
      renderIwStats(stats);

      if (!listRes.ok) {
        renderIwEmptyState();
        return;
      }

      const campaigns = await listRes.json();
      if (!campaigns.length) {
        renderIwEmptyState();
        return;
      }

      hideIwEmptyState();
      renderIwTable(campaigns);
    } catch (err) {
      console.error('a2wLoadInstantWinPage error:', err);
      const tbody = document.querySelector('#iwTable tbody');
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text2)">Errore caricamento</td></tr>';
      }
      hideIwEmptyState();
    }
  }

  global.isA2wInstantWinActive = isA2wInstantWinActive;
  global.a2wLoadInstantWinPage = a2wLoadInstantWinPage;
  A2W.a2wLoadInstantWinPage = a2wLoadInstantWinPage;
})(typeof window !== 'undefined' ? window : global);
