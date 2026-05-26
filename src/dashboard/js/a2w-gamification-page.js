/**
 * Ads2Wallet — Gamification page (design system alignment).
 * Active only when isA2wDeploy() + a2w-shell (FiloDiretto unchanged).
 */
(function () {
  'use strict';

  const A2W = window.A2W = window.A2W || {};
  A2W.gamification = A2W.gamification || {
    cache: [],
    search: '',
    statusFilter: '',
    gameTypeFilter: '',
    layoutReady: false,
    stats: null
  };

  const GOLD_TOOLTIP =
    'Numero totale di premi assegnati nella fascia oro (miglior tempo di completamento).';

  const STATUS_LABELS = {
    draft: 'Bozza',
    active: 'Attiva',
    paused: 'In pausa',
    ended: 'Terminata'
  };

  const GAME_LABELS = {
    quiz: 'Quiz',
    memory: 'Memory Match',
    puzzle: 'Puzzle'
  };

  const GAME_TYPE_ICONS = {
    quiz:
      '<svg class="a2w-gam-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-.7.5-1.2 1.2-1.2 2.2"/><path d="M12 17h.01"/></svg>',
    memory:
      '<svg class="a2w-gam-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="7" height="9" rx="1.5"/><rect x="14" y="4" width="7" height="9" rx="1.5"/><rect x="3" y="15" width="7" height="5" rx="1.5"/><rect x="14" y="15" width="7" height="5" rx="1.5"/></svg>',
    puzzle:
      '<svg class="a2w-gam-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4h2a2 2 0 0 1 2 2 2 2 0 0 0 4 0 2 2 0 0 1 2-2h2v2a2 2 0 0 1-2 2 2 2 0 0 0 0 4 2 2 0 0 1 2 2v2h-2a2 2 0 0 1-2-2 2 2 0 0 0-4 0 2 2 0 0 1-2 2H8v-2a2 2 0 0 1 2-2 2 2 0 0 0 0-4 2 2 0 0 1-2-2V4z"/></svg>'
  };

  function isA2wGamificationActive() {
    return typeof isA2wDeploy === 'function' && isA2wDeploy()
      && document.documentElement.classList.contains('a2w-shell');
  }

  function escHtml(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
  }

  function gamTableBody() {
    const table = document.getElementById('gamTable');
    return table ? table.querySelector('tbody') : null;
  }

  function filteredCampaigns() {
    const q = (A2W.gamification.search || '').trim().toLowerCase();
    const status = A2W.gamification.statusFilter || '';
    const gameType = A2W.gamification.gameTypeFilter || '';
    return (A2W.gamification.cache || []).filter((c) => {
      if (status && c.status !== status) return false;
      if (gameType && c.game_type !== gameType) return false;
      if (!q) return true;
      return String(c.name || '').toLowerCase().includes(q);
    });
  }

  function showGamTableSkeleton() {
    const tbody = gamTableBody();
    if (!tbody) return;
    let rows = '';
    for (let i = 0; i < 4; i++) {
      rows += '<tr class="a2w-gam-skeleton-row">';
      for (let c = 0; c < 8; c++) {
        rows += '<td><span class="a2w-skeleton-line"></span></td>';
      }
      rows += '</tr>';
    }
    tbody.innerHTML = rows;
  }

  function renderGameTypeCell(gameType) {
    const icon = GAME_TYPE_ICONS[gameType] || '';
    const label = GAME_LABELS[gameType] || gameType || '—';
    return (
      '<span class="a2w-gam-type-cell">' +
      icon +
      '<span class="a2w-gam-type-label">' + escHtml(label) + '</span></span>'
    );
  }

  function statusBadgeClass(status) {
    if (status === 'active') return 'active';
    if (status === 'draft') return 'inactive';
    return 'inactive';
  }

  function createGamActionMenu(c) {
    const UI = A2W.UI;
    if (!UI || typeof UI.createActionMenu !== 'function') return null;
    const items = [
      {
        label: 'Modifica',
        icon: A2W.icons && A2W.icons.edit,
        onClick: function () {
          if (typeof editGamCampaign === 'function') editGamCampaign(c.id);
        }
      },
      {
        label: 'Duplica',
        icon: A2W.icons && A2W.icons.copy,
        onClick: function () {
          a2wDuplicateGamCampaign(c.id);
        }
      },
      {
        label: 'Vedi classifica',
        icon: A2W.icons && A2W.icons.tag,
        onClick: function () {
          a2wShowGamLeaderboard(c.id, c.name);
        }
      },
      {
        label: 'Esporta risultati',
        icon: A2W.icons && A2W.icons.download,
        onClick: function () {
          a2wExportGamResults(c.id, c.name);
        }
      },
      {
        label: 'Elimina',
        icon: A2W.icons && A2W.icons.delete,
        destructive: true,
        onClick: function () {
          if (typeof deleteGamCampaign === 'function') deleteGamCampaign(c.id);
        }
      }
    ];
    return UI.createActionMenu({ label: 'Azioni campagna ' + (c.name || ''), items: items });
  }

  function renderGamEmptyState() {
    const tbody = gamTableBody();
    const UI = A2W.UI;
    if (!tbody) return;
    tbody.innerHTML = '';
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 8;
    td.className = 'a2w-gam-table-empty-cell';

    if (UI && typeof UI.createEmptyState === 'function') {
      td.appendChild(UI.createEmptyState({
        title: 'Nessuna campagna gamification',
        description: 'Creane una per quiz, memory o puzzle.',
        primaryAction: {
          label: 'Nuova campagna',
          onClick: function () {
            if (typeof openGamModal === 'function') openGamModal();
          }
        }
      }));
    } else if (typeof renderEmptyState === 'function') {
      td.innerHTML = renderEmptyState({
        title: 'Nessuna campagna gamification',
        description: 'Creane una per quiz, memory o puzzle.',
        ctaLabel: 'Nuova campagna',
        ctaOnclick: 'openGamModal()',
        icon: 'ticket'
      });
    } else {
      td.textContent = 'Nessuna campagna';
    }

    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  function renderGamFilterEmptyState() {
    const tbody = gamTableBody();
    if (!tbody) return;
    tbody.innerHTML = '';
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 8;
    td.className = 'a2w-gam-table-empty-cell';
    td.innerHTML = [
      '<div class="a2w-gam-filter-empty" role="status">',
      '  <p>Nessun risultato</p>',
      '  <button type="button" class="btn sec small" id="a2wGamClearFilters">Resetta filtri</button>',
      '</div>'
    ].join('');
    tr.appendChild(td);
    tbody.appendChild(tr);
    document.getElementById('a2wGamClearFilters')?.addEventListener('click', resetGamFilters);
  }

  function resetGamFilters() {
    A2W.gamification.search = '';
    A2W.gamification.statusFilter = '';
    A2W.gamification.gameTypeFilter = '';
    syncGamToolbarControls();
    renderGamTable();
  }

  function renderGamTable() {
    const tbody = gamTableBody();
    if (!tbody) return;
    const total = (A2W.gamification.cache || []).length;
    const items = filteredCampaigns();

    if (!total) {
      renderGamEmptyState();
      return;
    }

    if (!items.length) {
      renderGamFilterEmptyState();
      return;
    }

    tbody.innerHTML = '';
    items.forEach((c) => {
      const tr = document.createElement('tr');
      tr.dataset.campaignId = c.id;
      tr.innerHTML = [
        '<td><strong>' + escHtml(c.name) + '</strong></td>',
        '<td>' + renderGameTypeCell(c.game_type) + '</td>',
        '<td class="a2w-gam-prize a2w-gam-prize--gold">' + escHtml(c.gold_prize) +
          ' <span class="a2w-gam-prize-threshold">(&lt;' + escHtml(c.gold_threshold_secs) + 's)</span></td>',
        '<td class="a2w-gam-prize a2w-gam-prize--silver">' + escHtml(c.silver_prize) +
          ' <span class="a2w-gam-prize-threshold">(&lt;' + escHtml(c.silver_threshold_secs) + 's)</span></td>',
        '<td class="a2w-gam-prize a2w-gam-prize--bronze">' + escHtml(c.bronze_prize) +
          ' <span class="a2w-gam-prize-threshold">(&lt;' + escHtml(c.bronze_threshold_secs) + 's)</span></td>',
        '<td>' + (c.total_plays || 0) + '</td>',
        '<td><span class="badge ' + statusBadgeClass(c.status) + '">' +
          escHtml(STATUS_LABELS[c.status] || c.status) + '</span></td>',
        '<td class="a2w-gam-row-actions"></td>'
      ].join('');
      const menu = createGamActionMenu(c);
      if (menu) tr.querySelector('.a2w-gam-row-actions').appendChild(menu);
      tbody.appendChild(tr);
    });
  }

  function updateGamKpis(stats) {
    const host = document.getElementById('gamStats');
    if (!host || !A2W.UI || typeof A2W.UI.createStatCard !== 'function') {
      if (document.getElementById('gamStatCampaigns')) {
        document.getElementById('gamStatCampaigns').textContent = stats.active_campaigns ?? 0;
      }
      if (document.getElementById('gamStatPlays')) {
        document.getElementById('gamStatPlays').textContent = stats.total_plays ?? 0;
      }
      if (document.getElementById('gamStatGold')) {
        document.getElementById('gamStatGold').textContent = stats.total_gold ?? 0;
      }
      return;
    }

    if (!host.dataset.a2wKpiBuilt) {
      host.innerHTML = '';
      host.classList.add('a2w-gam-kpis');
      host.appendChild(A2W.UI.createStatCard({
        label: 'Campagne attive',
        value: stats.active_campaigns ?? 0
      }));
      host.appendChild(A2W.UI.createStatCard({
        label: 'Giocate totali',
        value: stats.total_plays ?? 0
      }));
      const goldCard = A2W.UI.createStatCard({
        label: 'Premi Oro',
        value: stats.total_gold ?? 0,
        tooltip: GOLD_TOOLTIP
      });
      goldCard.setAttribute('title', GOLD_TOOLTIP);
      const goldLabel = goldCard.querySelector('.a2w-ui-stat-card__label');
      if (goldLabel && !goldLabel.querySelector('.a2w-gam-kpi-help')) {
        const help = document.createElement('span');
        help.className = 'a2w-gam-kpi-help';
        help.setAttribute('title', GOLD_TOOLTIP);
        help.setAttribute('aria-label', GOLD_TOOLTIP);
        help.textContent = '?';
        goldLabel.appendChild(help);
      }
      host.appendChild(goldCard);
      host.dataset.a2wKpiBuilt = '1';
      return;
    }

    const cards = host.querySelectorAll('.a2w-ui-stat-card__value');
    if (cards[0]) cards[0].textContent = String(stats.active_campaigns ?? 0);
    if (cards[1]) cards[1].textContent = String(stats.total_plays ?? 0);
    if (cards[2]) cards[2].textContent = String(stats.total_gold ?? 0);
  }

  function syncGamToolbarControls() {
    const search = document.getElementById('a2wGamSearch');
    const status = document.getElementById('a2wGamStatusFilter');
    const gameType = document.getElementById('a2wGamGameTypeFilter');
    if (search) search.value = A2W.gamification.search || '';
    if (status) status.value = A2W.gamification.statusFilter || '';
    if (gameType) gameType.value = A2W.gamification.gameTypeFilter || '';
  }

  function buildGamToolbar() {
    const UI = A2W.UI;
    if (!UI || typeof UI.createToolbar !== 'function') return null;

    const search = document.createElement('input');
    search.type = 'search';
    search.id = 'a2wGamSearch';
    search.className = 'a2w-gam-search a2w-ui-toolbar__search';
    search.placeholder = 'Cerca campagna…';
    search.autocomplete = 'off';
    search.addEventListener('input', function () {
      A2W.gamification.search = search.value;
      renderGamTable();
    });

    const status = document.createElement('select');
    status.id = 'a2wGamStatusFilter';
    status.className = 'a2w-gam-filter-select';
    [
      { value: '', label: 'Tutti gli stati' },
      { value: 'draft', label: 'Bozza' },
      { value: 'active', label: 'Attiva' },
      { value: 'paused', label: 'In pausa' },
      { value: 'ended', label: 'Terminata' }
    ].forEach((opt) => {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      status.appendChild(o);
    });
    status.addEventListener('change', function () {
      A2W.gamification.statusFilter = status.value;
      renderGamTable();
    });

    const gameType = document.createElement('select');
    gameType.id = 'a2wGamGameTypeFilter';
    gameType.className = 'a2w-gam-filter-select';
    [
      { value: '', label: 'Tutti i giochi' },
      { value: 'quiz', label: 'Quiz' },
      { value: 'memory', label: 'Memory Match' },
      { value: 'puzzle', label: 'Puzzle' }
    ].forEach((opt) => {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      gameType.appendChild(o);
    });
    gameType.addEventListener('change', function () {
      A2W.gamification.gameTypeFilter = gameType.value;
      renderGamTable();
    });

    return UI.createToolbar({ left: [search, status, gameType] });
  }

  function a2wEnhanceGamificationPage() {
    const section = document.getElementById('gamification');
    if (!section || A2W.gamification.layoutReady) return;

    section.classList.add('a2w-gamification-section');

    const legacyChrome = section.querySelector('.a2w-gam-legacy-chrome');
    if (legacyChrome) legacyChrome.hidden = true;

    const UI = A2W.UI;
    const headerMount = document.getElementById('a2wGamPageHeader');
    if (headerMount && UI && typeof UI.createPageHeader === 'function' && headerMount.dataset.mounted !== '1') {
      const primary = document.createElement('button');
      primary.type = 'button';
      primary.className = 'btn a2w-btn-primary';
      primary.textContent = '+ Nuova Campagna';
      primary.addEventListener('click', function () {
        if (typeof openGamModal === 'function') openGamModal();
      });
      const header = UI.createPageHeader({
        title: 'Gamification',
        description: 'Crea campagne di gioco skill-based: Quiz, Memory Match, Puzzle. Premi a fasce in base al tempo di completamento.',
        actions: primary
      });
      headerMount.innerHTML = '';
      headerMount.appendChild(header);
      headerMount.hidden = false;
      headerMount.dataset.mounted = '1';
    }

    const toolbarHost = document.getElementById('a2wGamToolbarHost');
    if (toolbarHost && toolbarHost.dataset.mounted !== '1') {
      const toolbar = buildGamToolbar();
      if (toolbar) toolbarHost.appendChild(toolbar);
      toolbarHost.dataset.mounted = '1';
    }

    const stats = document.getElementById('gamStats');
    if (stats) stats.classList.add('a2w-gam-kpis-host');

    const table = document.getElementById('gamTable');
    if (table) table.classList.add('a2w-gam-table');

    if (stats && stats.dataset.a2wKpiBuilt !== '1') {
      updateGamKpis({ active_campaigns: 0, total_plays: 0, total_gold: 0 });
    }

    A2W.gamification.layoutReady = true;
    syncGamToolbarControls();
  }

  async function a2wDuplicateGamCampaign(id) {
    try {
      const res = await fetch(API + '/gamification/campaign/' + encodeURIComponent(id), {
        headers: typeof getAuthHeaders === 'function' ? getAuthHeaders() : {}
      });
      const c = await res.json();
      if (!res.ok) throw new Error(c.error || 'Campagna non trovata');
      const payload = {
        brand_id: brandId,
        name: (c.name || 'Campagna') + ' (copia)',
        game_type: c.game_type,
        gold_threshold_secs: c.gold_threshold_secs,
        silver_threshold_secs: c.silver_threshold_secs,
        bronze_threshold_secs: c.bronze_threshold_secs,
        gold_prize: c.gold_prize,
        silver_prize: c.silver_prize,
        bronze_prize: c.bronze_prize,
        max_plays_per_user: c.max_plays_per_user,
        status: 'draft',
        start_date: c.start_date,
        end_date: c.end_date,
        push_message: c.push_message
      };
      const createRes = await fetch(API + '/gamification/campaigns', {
        method: 'POST',
        headers: {
          ...(typeof getAuthHeaders === 'function' ? getAuthHeaders() : {}),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const created = await createRes.json();
      if (!createRes.ok) throw new Error(created.error || 'Duplicazione non riuscita');
      if (typeof loadGamification === 'function') loadGamification();
      if (typeof toast === 'function') toast('Campagna duplicata');
    } catch (err) {
      if (typeof toast === 'function') toast('Errore: ' + (err.message || 'duplicazione'));
    }
  }

  function ensureGamLeaderboardModal() {
    let modal = document.getElementById('a2wGamLeaderboardModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'a2wGamLeaderboardModal';
    modal.className = 'a2w-gam-leaderboard-modal';
    modal.hidden = true;
    modal.innerHTML = [
      '<div class="a2w-gam-leaderboard-modal__backdrop" data-a2w-gam-lb-close></div>',
      '<div class="a2w-gam-leaderboard-modal__panel" role="dialog" aria-labelledby="a2wGamLbTitle">',
      '  <div class="a2w-gam-leaderboard-modal__head">',
      '    <h2 id="a2wGamLbTitle" class="block-title">Classifica</h2>',
      '    <button type="button" class="btn sec small" data-a2w-gam-lb-close aria-label="Chiudi">✕</button>',
      '  </div>',
      '  <div class="a2w-gam-leaderboard-modal__body" id="a2wGamLbBody"></div>',
      '</div>'
    ].join('');
    document.body.appendChild(modal);
    modal.querySelectorAll('[data-a2w-gam-lb-close]').forEach((el) => {
      el.addEventListener('click', () => { modal.hidden = true; });
    });
    return modal;
  }

  async function a2wShowGamLeaderboard(campaignId, campaignName) {
    const modal = ensureGamLeaderboardModal();
    const body = document.getElementById('a2wGamLbBody');
    const title = document.getElementById('a2wGamLbTitle');
    if (title) title.textContent = 'Classifica — ' + (campaignName || 'Campagna');
    if (body) body.innerHTML = '<p style="color:var(--text2)">Caricamento…</p>';
    modal.hidden = false;

    try {
      const res = await fetch(API + '/gamification/plays/' + encodeURIComponent(campaignId) + '?limit=200', {
        headers: typeof getAuthHeaders === 'function' ? getAuthHeaders() : {}
      });
      const plays = res.ok ? await res.json() : [];
      if (!Array.isArray(plays) || !plays.length) {
        body.innerHTML = '<p class="a2w-gam-lb-empty">Nessuna giocata registrata.</p>';
        return;
      }
      const sorted = plays.slice().sort((a, b) => {
        const ta = parseFloat(a.completion_time_secs) || 9999;
        const tb = parseFloat(b.completion_time_secs) || 9999;
        return ta - tb;
      });
      const tierLabels = { gold: 'Oro', silver: 'Argento', bronze: 'Bronzo', none: '—' };
      body.innerHTML = [
        '<table class="table a2w-gam-lb-table"><thead><tr>',
        '<th>#</th><th>Giocatore</th><th>Tempo</th><th>Fascia</th><th>Data</th>',
        '</tr></thead><tbody>',
        sorted.map((p, i) => {
          const name = [p.player_first_name, p.player_last_name].filter(Boolean).join(' ')
            || p.player_email || p.serial_number || '—';
          const when = p.played_at
            ? new Date(p.played_at).toLocaleString('it-IT')
            : '—';
          return '<tr><td>' + (i + 1) + '</td><td>' + escHtml(name) + '</td><td>' +
            escHtml(p.completion_time_secs) + 's</td><td>' +
            escHtml(tierLabels[p.tier] || p.tier) + '</td><td>' + escHtml(when) + '</td></tr>';
        }).join(''),
        '</tbody></table>'
      ].join('');
    } catch (err) {
      body.innerHTML = '<p class="a2w-gam-lb-empty">Errore caricamento classifica.</p>';
    }
  }

  async function a2wExportGamResults(campaignId, campaignName) {
    try {
      const res = await fetch(API + '/gamification/plays/' + encodeURIComponent(campaignId) + '?limit=5000', {
        headers: typeof getAuthHeaders === 'function' ? getAuthHeaders() : {}
      });
      const plays = res.ok ? await res.json() : [];
      if (!Array.isArray(plays) || !plays.length) {
        if (typeof toast === 'function') toast('Nessun risultato da esportare');
        return;
      }
      const header = ['rank', 'player', 'email', 'time_secs', 'tier', 'prize', 'played_at'];
      const rows = plays.map((p, i) => {
        const player = [p.player_first_name, p.player_last_name].filter(Boolean).join(' ');
        return [
          i + 1,
          player,
          p.player_email || '',
          p.completion_time_secs,
          p.tier,
          p.prize_name || '',
          p.played_at || ''
        ].map((v) => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',');
      });
      const csv = [header.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = ((campaignName || 'gamification') + '-risultati').replace(/[^\w\-]+/g, '_') + '.csv';
      a.click();
      URL.revokeObjectURL(url);
      if (typeof toast === 'function') toast('Export completato');
    } catch (err) {
      if (typeof toast === 'function') toast('Export non riuscito');
    }
  }

  async function a2wLoadGamificationPage() {
    if (!isA2wGamificationActive() || !brandId) return false;
    a2wEnhanceGamificationPage();
    showGamTableSkeleton();

    try {
      const headers = typeof getAuthHeaders === 'function' ? getAuthHeaders() : {};
      const [statsRes, campaignsRes] = await Promise.all([
        fetch(API + '/gamification/stats/' + brandId, { headers: headers }),
        fetch(API + '/gamification/campaigns/' + brandId, { headers: headers })
      ]);
      const stats = statsRes.ok
        ? await statsRes.json()
        : { active_campaigns: 0, total_plays: 0, total_gold: 0 };
      const campaigns = campaignsRes.ok ? await campaignsRes.json() : [];

      A2W.gamification.stats = stats;
      A2W.gamification.cache = Array.isArray(campaigns) ? campaigns : [];
      updateGamKpis(stats);
      renderGamTable();
      return true;
    } catch (err) {
      console.error('a2wLoadGamificationPage error:', err);
      const tbody = gamTableBody();
      if (tbody && A2W.UI && typeof A2W.UI.createErrorState === 'function') {
        tbody.innerHTML = '';
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 8;
        td.className = 'a2w-gam-table-empty-cell';
        td.appendChild(A2W.UI.createErrorState({
          title: 'Errore caricamento',
          message: err.message || 'Riprova tra qualche secondo.',
          onRetry: function () { a2wLoadGamificationPage(); }
        }));
        tr.appendChild(td);
        tbody.appendChild(tr);
      } else if (tbody) {
        tbody.innerHTML = '<tr><td colspan="8" style="color:var(--text2);text-align:center;">Errore caricamento</td></tr>';
      }
      return true;
    }
  }

  function initA2wGamificationPage() {
    if (typeof isA2wDeploy !== 'function' || !isA2wDeploy()) return;
    if (typeof loadGamification !== 'function') {
      window.setTimeout(initA2wGamificationPage, 250);
      return;
    }
    if (A2W.gamification.hooked) return;
    A2W.gamification.hooked = true;

    A2W.icons = A2W.icons || {};
    A2W.icons.edit = A2W.icons.edit || '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';

    const original = loadGamification;
    window.loadGamification = async function a2wLoadGamificationWrapped() {
      if (isA2wGamificationActive()) {
        const handled = await a2wLoadGamificationPage();
        if (handled) return;
      }
      return original.apply(this, arguments);
    };

    if (isA2wGamificationActive()) a2wEnhanceGamificationPage();
  }

  A2W.a2wEnhanceGamificationPage = a2wEnhanceGamificationPage;
  A2W.a2wLoadGamificationPage = a2wLoadGamificationPage;
  A2W.initA2wGamificationPage = initA2wGamificationPage;
  A2W.resetGamFilters = resetGamFilters;
  window.initA2wGamificationPage = initA2wGamificationPage;
  window.a2wEnhanceGamificationPage = a2wEnhanceGamificationPage;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initA2wGamificationPage);
  } else {
    initA2wGamificationPage();
  }
})();
