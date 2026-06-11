/**
 * FD-08 — FiloDiretto empty states: CTA + «Come funziona» (docs placeholder).
 */
(function () {
  'use strict';

  var DOC_BASE = 'https://docs.filodiretto.app/guide';

  var PRESETS = {
    templates: {
      title: 'Nessun template pass',
      description: 'Il template definisce layout, immagini e testi del pass dipendente usato in tutte le attivazioni.',
      ctaLabel: 'Crea template',
      ctaOnclick: 'openTemplateModal()',
      helpHref: DOC_BASE + '#template-pass',
      icon: 'inbox'
    },
    passes: {
      title: 'Nessun pass emesso',
      description: 'Qui trovi i pass generati dopo import anagrafica, inviti o attivazioni. Monitora installazioni e stato Wallet.',
      ctaLabel: 'Vai ai dipendenti',
      ctaOnclick: "nav('leads')",
      helpHref: DOC_BASE + '#pass-emessi',
      icon: 'inbox'
    },
    reward: {
      title: 'Nessuna campagna Reward',
      description: 'Premia i tuoi dipendenti con bonus, voucher welfare, gift card e premi a sorpresa.',
      ctaLabel: '+ Nuova Campagna',
      ctaOnclick: 'openIwModal()',
      helpHref: DOC_BASE + '#reward',
      icon: 'ticket'
    },
    challenge: {
      title: 'Nessuna challenge attiva',
      description: 'Crea sfide skill-based: quiz formativi, Memory Match, Puzzle e leaderboard a punti.',
      ctaLabel: '+ Nuova Campagna',
      ctaOnclick: 'openGamModal()',
      helpHref: DOC_BASE + '#challenge',
      icon: 'ticket'
    },
    activity: {
      title: 'Nessun evento registrato',
      description: 'Il log raccoglie download, installazioni Wallet, push e altre azioni utili per il supporto HR.',
      ctaLabel: 'Invia una push',
      ctaOnclick: "nav('push')",
      helpHref: DOC_BASE + '#log-attivita',
      icon: 'inbox'
    },
    contacts: {
      title: 'Nessun dipendente in anagrafica',
      description: 'Importa l\'elenco dipendenti o aggiungi le schede manualmente, poi invia l\'attivazione del pass.',
      ctaLabel: 'Importa da file',
      ctaOnclick: 'openEmployeeImportModal()',
      helpHref: DOC_BASE + '#dipendenti',
      icon: 'users'
    }
  };

  function isFiloEmptyApp() {
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

  function inferPresetKey(opts) {
    var on = String(opts.ctaOnclick || '');
    var title = String(opts.title || '').toLowerCase();
    if (on.indexOf('openTemplateModal') >= 0 || title.indexOf('template') >= 0) return 'templates';
    if (title.indexOf('pass emesso') >= 0 || title.indexOf('nessun pass') >= 0) return 'passes';
    if (on.indexOf('openIwModal') >= 0 || title.indexOf('reward') >= 0) return 'reward';
    if (on.indexOf('openGamModal') >= 0 || title.indexOf('challenge') >= 0) return 'challenge';
    if (title.indexOf('evento') >= 0 || title.indexOf('attivit') >= 0) return 'activity';
    if (
      on.indexOf('openEmployee') >= 0 ||
      title.indexOf('dipendent') >= 0 ||
      title.indexOf('contatt') >= 0 ||
      opts.icon === 'users'
    ) return 'contacts';
    return null;
  }

  function mergeEmptyOpts(opts) {
    var key = inferPresetKey(opts);
    var preset = key ? PRESETS[key] : null;
    if (!preset) return opts;
    opts = opts || {};
    return {
      icon: opts.icon || preset.icon,
      title: opts.title || preset.title,
      description: preset.description || opts.description,
      ctaLabel: opts.ctaLabel || preset.ctaLabel,
      ctaOnclick: opts.ctaOnclick || preset.ctaOnclick,
      helpHref: preset.helpHref,
      helpLabel: opts.helpLabel || 'Come funziona'
    };
  }

  function renderFiloEmptyState(opts, baseRender) {
    opts = mergeEmptyOpts(opts || {});
    var html = baseRender(opts);
    if (!opts.helpHref) return html;

    var help = '<a class="fd-empty-state__help" href="' + esc(opts.helpHref) + '" target="_blank" rel="noopener noreferrer">' +
      esc(opts.helpLabel || 'Come funziona') + '</a>';

    if (html.indexOf('fd-empty-state__actions') >= 0) return html;

    var ctaMatch = html.match(/<button[^>]*class="btn"[^>]*>[\s\S]*?<\/button>/);
    if (ctaMatch) {
      return html.replace(
        ctaMatch[0],
        '<div class="fd-empty-state__actions">' + ctaMatch[0] + help + '</div>'
      ).replace('class="empty-state"', 'class="empty-state fd-empty-state"');
    }

    return html
      .replace('class="empty-state"', 'class="empty-state fd-empty-state"')
      .replace('</div>', '<div class="fd-empty-state__actions">' + help + '</div></div>');
  }

  function patchRenderEmptyState() {
    if (window.__fdEmptyPatched || typeof window.renderEmptyState !== 'function') return;
    window.__fdEmptyPatched = true;
    var baseRender = window.renderEmptyState;
    window.renderEmptyState = function (opts) {
      if (!isFiloEmptyApp()) return baseRender(opts);
      return renderFiloEmptyState(opts, baseRender);
    };
  }

  function initFdEmptyStates() {
    if (!isFiloEmptyApp()) return;
    patchRenderEmptyState();
  }

  /** Table tbody row with Filo-enriched empty state (preset by key or inferred from opts). */
  function fdTableEmptyState(colspan, opts) {
    opts = mergeEmptyOpts(opts || {});
    var html = typeof window.renderEmptyState === 'function'
      ? window.renderEmptyState(opts)
      : '';
    var span = Math.max(1, parseInt(colspan, 10) || 1);
    return '<tr class="table-empty-row"><td colspan="' + span + '">' + html + '</td></tr>';
  }

  window.fdTableEmptyState = fdTableEmptyState;
  window.fdInitEmptyStates = initFdEmptyStates;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFdEmptyStates);
  } else {
    initFdEmptyStates();
  }
})();
