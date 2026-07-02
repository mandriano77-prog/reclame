/**
 * Filo Diretto — HR pass back fields (backward-compatible re-exports).
 */

const {
  buildBackSections,
  sectionsToAppleBackFields,
  resolveMemberProfile,
  resolveVariableLink,
  escapeHtml,
  escapePassLinkHref
} = require('./employee-pass');
const { isHrPassBrand } = require('./pass-product-line');

function buildHrBackFields(ctx) {
  return sectionsToAppleBackFields(buildBackSections(ctx));
}

function resolveEmployeeIdForBarcode(memberRow, instance) {
  const profile = resolveMemberProfile(memberRow, instance);
  return profile.employee_id || profile.id || instance?.id || '';
}

module.exports = {
  escapeHtml,
  escapePassLinkHref,
  isHrPassBrand,
  resolveMemberProfile,
  resolveVariableLink,
  buildHrBackFields,
  resolveEmployeeIdForBarcode
};
