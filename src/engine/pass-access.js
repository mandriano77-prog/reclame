/**
 * Pass access badge — unique scannable code per holder (door readers, matricola).
 * Apple Wallet barcode: prefer Code128 numeric for generic USB/RS485 readers.
 */

const VALID_BARCODE_FORMATS = new Set([
  'PKBarcodeFormatCode128',
  'PKBarcodeFormatQR',
  'PKBarcodeFormatPDF417',
  'PKBarcodeFormatAztec'
]);

function parseFieldValues(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return { ...raw };
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/** @returns {string} digits/alphanumeric payload safe for Code128 */
function normalizeBarcodeMessage(value) {
  const s = String(value == null ? '' : value).trim();
  if (!s) return '';
  // Door readers: prefer compact numeric when possible
  const digitsOnly = s.replace(/\D/g, '');
  if (digitsOnly.length >= 8 && digitsOnly.length <= 20) return digitsOnly;
  return s.replace(/[^\x20-\x7E]/g, '').slice(0, 48);
}

function extractNumericFromSerial(serial) {
  const m = String(serial || '').match(/^(\d{10,16})/);
  return m ? m[1] : null;
}

function generateAccessCode() {
  return String(Date.now());
}

/**
 * Ensure each pass has a stable access_code in field_values (persisted at create).
 * @param {object} fieldValues
 * @param {{ serial_number?: string }} [opts]
 */
function ensurePassAccessCode(fieldValues = {}, opts = {}) {
  const fv = { ...(fieldValues || {}) };
  const existing = fv.access_code || fv.matricola || fv.badge_id;
  if (existing) {
    const normalized = normalizeBarcodeMessage(existing) || String(existing).trim();
    if (!fv.access_code) fv.access_code = normalized;
    return fv;
  }
  const fromSerial = extractNumericFromSerial(opts.serial_number);
  if (fromSerial) {
    fv.access_code = fromSerial;
    return fv;
  }
  fv.access_code = generateAccessCode();
  return fv;
}

/**
 * Resolve barcode payload + format for pass.json.
 * @param {{ serial_number?: string, field_values?: object|string }} instance
 * @param {object} brandConfig
 */
function resolvePassBarcode(instance, brandConfig = {}) {
  const cfg = brandConfig.barcode || {};
  const fv = parseFieldValues(instance.field_values);

  let message = '';
  if (cfg.message) {
    message = String(cfg.message)
      .replace(/\{\{access_code\}\}/g, fv.access_code || fv.matricola || fv.badge_id || '')
      .replace(/\{\{serial\}\}/g, instance.serial_number || '')
      .replace(/\{\{matricola\}\}/g, fv.matricola || fv.badge_id || fv.access_code || '');
  }

  if (!message) {
    message =
      normalizeBarcodeMessage(fv.access_code) ||
      normalizeBarcodeMessage(fv.matricola) ||
      normalizeBarcodeMessage(fv.badge_id) ||
      extractNumericFromSerial(instance.serial_number) ||
      normalizeBarcodeMessage(instance.serial_number);
  }

  const formatRaw = cfg.format || process.env.PASS_BARCODE_FORMAT || 'PKBarcodeFormatCode128';
  const format = VALID_BARCODE_FORMATS.has(formatRaw) ? formatRaw : 'PKBarcodeFormatCode128';

  const altTemplate = cfg.altText || 'Matricola {{code}}';
  const altText = altTemplate.replace(/\{\{code\}\}/g, message).slice(0, 64);

  return {
    message,
    format,
    messageEncoding: cfg.messageEncoding || 'iso-8859-1',
    altText
  };
}

module.exports = {
  VALID_BARCODE_FORMATS,
  ensurePassAccessCode,
  resolvePassBarcode,
  generateAccessCode,
  normalizeBarcodeMessage
};
