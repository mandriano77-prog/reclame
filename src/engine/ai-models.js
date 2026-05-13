const DEFAULT_WAI_QUERY_MODEL = 'claude-sonnet-4-6';
const DEFAULT_WAI_ACTION_MODEL = 'claude-opus-4-7';

const QUERY_PROMPT_RE = /\b(quanti|quante|quanto|come siamo|andati|metriche|performance|analytics|storico|mostra|dimmi|raccontami|ultim[oi]\s+\d+\s*(gg|giorni|settimane)|cerca|trova|membri|pass attivi|installati|aiuto|help|cosa puoi|cosa sai)\b/i;
const ACTION_PROMPT_RE = /\b(crea|programma|schedula|pianifica|manda|invia|imposta|aggiungi|importa|cambia|strip|reward|campagna|notifica|push|ruota|premio|geofenc)\b/i;

function readEnvTrim(name) {
  const value = process.env[name];
  return value == null ? '' : String(value).trim();
}

function getWaiRoutingMode() {
  const mode = readEnvTrim('WAI_MODEL_ROUTING').toLowerCase();
  if (mode === 'opus' || mode === 'sonnet' || mode === 'auto') return mode;
  return 'auto';
}

function getWaiQueryModel() {
  return readEnvTrim('WAI_MODEL_QUERY') || DEFAULT_WAI_QUERY_MODEL;
}

function getWaiActionModel() {
  return readEnvTrim('WAI_MODEL_ACTION') || readEnvTrim('ANTHROPIC_MODEL') || DEFAULT_WAI_ACTION_MODEL;
}

function getWaiFixedModel() {
  return readEnvTrim('ANTHROPIC_MODEL');
}

function pickWaiModel(prompt) {
  const fixed = getWaiFixedModel();
  if (fixed) {
    return { model: fixed, tier: 'fixed', routing: 'fixed' };
  }

  const routing = getWaiRoutingMode();
  const queryModel = getWaiQueryModel();
  const actionModel = getWaiActionModel();

  if (routing === 'opus') {
    return { model: actionModel, tier: 'action', routing };
  }
  if (routing === 'sonnet') {
    return { model: queryModel, tier: 'query', routing };
  }

  const text = String(prompt || '').trim();
  const looksLikeQuery = QUERY_PROMPT_RE.test(text);
  const looksLikeAction = ACTION_PROMPT_RE.test(text);

  if (looksLikeAction && !looksLikeQuery) {
    return { model: actionModel, tier: 'action', routing };
  }
  if (looksLikeQuery && !looksLikeAction) {
    return { model: queryModel, tier: 'query', routing };
  }
  if (text.length > 220) {
    return { model: actionModel, tier: 'action', routing };
  }

  return { model: actionModel, tier: 'action', routing };
}

function formatModelLabel(model) {
  const id = String(model || '').trim();
  if (!id) return 'Claude';
  const match = id.match(/claude-([a-z]+)-(\d+)-(\d+)/i);
  if (!match) return id;
  const family = match[1].charAt(0).toUpperCase() + match[1].slice(1);
  return `Claude ${family} ${match[2]}.${match[3]}`;
}

module.exports = {
  DEFAULT_WAI_QUERY_MODEL,
  DEFAULT_WAI_ACTION_MODEL,
  getWaiRoutingMode,
  getWaiQueryModel,
  getWaiActionModel,
  pickWaiModel,
  formatModelLabel
};
