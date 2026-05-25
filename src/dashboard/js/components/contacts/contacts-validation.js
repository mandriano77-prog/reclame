(function () {
  'use strict';

  const SLUG_RE = /^[a-z0-9-]{3,40}$/;

  function validateSlug(value) {
    const slug = String(value || '').trim().toLowerCase();
    if (!slug) return { valid: false, error: null, slug: '' };
    if (!SLUG_RE.test(slug)) {
      return {
        valid: false,
        error: 'Solo lettere minuscole, numeri e trattini. Min 3 caratteri.',
        slug
      };
    }
    return { valid: true, error: null, slug };
  }

  function validateDomain(value) {
    const domain = String(value || '').trim().toLowerCase().replace(/^@+/, '');
    if (!domain) return { valid: false, error: null, domain: '' };
    const re = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
    if (!re.test(domain)) {
      return { valid: false, error: 'Dominio non valido', domain };
    }
    return { valid: true, error: null, domain };
  }

  function shouldShowJoinCard(mode) {
    return mode === 'public_join' || mode === 'hybrid';
  }

  const validators = {
    validateSlug,
    validateDomain,
    shouldShowJoinCard,
    SLUG_RE
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = validators;
  }
  if (typeof window !== 'undefined') {
    window.ContactsValidation = validators;
  }
})();
