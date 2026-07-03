/**
 * Reclame — behavioral audience presets (first-party, no PII).
 */
const PRESETS = Object.freeze({
  clicked_no_redeem: {
    key: 'clicked_no_redeem',
    label: 'Clic link, mai riscattato',
    description: 'Ha cliccato il link out ma non ha usato il coupon in cassa',
    rules: {
      behavior: { did_action: 'link_click', never_did_action: 'coupon_redeemed', since_days: 90 }
    }
  },
  redeemed: {
    key: 'redeemed',
    label: 'Ha riscattato in cassa',
    description: 'Coupon CPA verificato almeno una volta',
    rules: {
      behavior: { did_action: 'coupon_redeemed', since_days: 180 }
    }
  },
  high_intent: {
    key: 'high_intent',
    label: 'Alto intento (clic recenti)',
    description: 'Ha cliccato il link out negli ultimi 14 giorni',
    rules: {
      behavior: { did_action: 'link_click', since_days: 14, min_count: 1 }
    }
  },
  passive_holders: {
    key: 'passive_holders',
    label: 'Possessori passivi',
    description: 'Installato ma mai cliccato link',
    rules: {
      behavior: { did_action: 'installed', never_did_action: 'link_click', since_days: 60 }
    }
  }
});

function listAudiencePresets() {
  return Object.values(PRESETS);
}

function getAudiencePreset(key) {
  return PRESETS[String(key || '')] || null;
}

module.exports = {
  PRESETS,
  listAudiencePresets,
  getAudiencePreset
};
