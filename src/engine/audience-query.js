/**
 * Safe audience query DSL — W.AI outputs JSON specs; we validate and execute (no raw SQL).
 */
const {
  normalizeRules,
  hasActiveRules,
  buildAudienceFilter,
  sanitizeBehavior,
  ALLOWED_EVENT_ACTIONS
} = require('./audiences');

function validateAudienceQuerySpec(spec) {
  if (!spec || typeof spec !== 'object') {
    throw new Error('Query spec non valida');
  }
  const rules = normalizeRules(spec.rules || spec.filters || {});
  const behavior = sanitizeBehavior(spec.behavior || spec.behavioral);
  if (!hasActiveRules({ ...rules, behavior })) {
    throw new Error('Specifica almeno un filtro demografico o comportamentale');
  }
  return {
    rules: { ...rules, behavior: behavior || undefined },
    behavior,
    description: String(spec.description || spec.summary || '').slice(0, 500)
  };
}

async function executeAudienceQuery(brandId, spec, { limit = 50, offset = 0 } = {}) {
  const { pool } = require('../db');
  const validated = validateAudienceQuerySpec(spec);
  const { whereExtra, params } = buildAudienceFilter(validated.rules);

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS count FROM pass_instances p WHERE p.brand_id = $1${whereExtra}`,
    [brandId, ...params]
  );

  const { listAudienceMembers } = require('./audiences');
  const members =
    limit > 0 ? await listAudienceMembers(brandId, validated.rules, { limit, offset }) : [];

  return {
    count: countResult.rows[0].count,
    members,
    rules: validated.rules,
    behavior: validated.behavior,
    description: validated.description
  };
}

function mergeSpecToAudienceRules(spec) {
  const validated = validateAudienceQuerySpec(spec);
  return validated.rules;
}

module.exports = {
  ALLOWED_EVENT_ACTIONS,
  validateAudienceQuerySpec,
  executeAudienceQuery,
  mergeSpecToAudienceRules
};
