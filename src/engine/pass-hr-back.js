/**
 * Filo Diretto — HR pass back fields (backward-compatible re-exports).
 */

const {
  buildBackSections,
  sectionsToAppleBackFields,
  resolveMemberProfile,
  resolveVariableLink,
  escapeHtml,
  isHrEmployeePass
} = require('./employee-pass');

function isHrPassBrand(brand) {
  return isHrEmployeePass(brand);
}

function buildHrBackFields(ctx) {
  return sectionsToAppleBackFields(buildBackSections(ctx));
}

function resolveEmployeeIdForBarcode(memberRow, instance) {
  const profile = resolveMemberProfile(memberRow, instance);
  return profile.employee_id || profile.id || instance?.id || '';
}

module.exports = {
  escapeHtml,
  isHrPassBrand,
  resolveMemberProfile,
  resolveVariableLink,
  buildHrBackFields,
  resolveEmployeeIdForBarcode
};
