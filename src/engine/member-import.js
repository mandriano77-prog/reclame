/**
 * Smart employee / member import — CSV & Excel with column auto-mapping.
 */

const XLSX = require('xlsx');
const { randomUUID } = require('crypto');

const IMPORT_FIELDS = [
  { key: 'first_name', label: 'Nome', required: false },
  { key: 'last_name', label: 'Cognome', required: false },
  { key: 'full_name', label: 'Nome completo', required: false },
  { key: 'email', label: 'Email', required: false },
  { key: 'employee_id', label: 'Matricola', required: true },
  { key: 'department', label: 'Reparto', required: false },
  { key: 'office_location', label: 'Sede', required: false },
  { key: 'hire_date', label: 'Data assunzione', required: false },
  { key: 'manager_name', label: 'Manager', required: false },
  { key: 'manager_email', label: 'Email manager', required: false },
  { key: 'phone', label: 'Telefono', required: false }
];

const CSV_TEMPLATE_HEADER =
  'matricola,nome,cognome,email,reparto,sede,data_assunzione,manager_email';

const FIELD_ALIASES = {
  first_name: ['nome', 'name', 'first name', 'first_name', 'prenome', 'nominativo', 'dipendente'],
  last_name: ['cognome', 'surname', 'last name', 'last_name', 'cogn'],
  full_name: ['nome completo', 'full name', 'full_name', 'nominativo completo', 'dipendente', 'risorsa'],
  email: ['email', 'e mail', 'e-mail', 'mail', 'posta elettronica', 'indirizzo email'],
  employee_id: [
    'matricola', 'matricola dipendente', 'badge', 'badge id', 'id dipendente', 'codice',
    'codice dipendente', 'employee id', 'employee_id', 'numero matricola', 'id', 'cod'
  ],
  department: ['reparto', 'department', 'dipartimento', 'divisione', 'team', 'ufficio org'],
  office_location: ['sede', 'location', 'office', 'office location', 'citta', 'site', 'stabilimento', 'filiale'],
  hire_date: ['data assunzione', 'assunzione', 'hire date', 'hire_date', 'ingresso', 'data ingresso'],
  manager_name: ['manager', 'responsabile', 'capo', 'manager name', 'manager_name', 'supervisor'],
  manager_email: ['email manager', 'manager email', 'manager_email', 'mail manager'],
  phone: ['telefono', 'phone', 'cellulare', 'mobile', 'tel']
};

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function scoreHeaderMatch(headerNorm, alias) {
  if (!headerNorm || !alias) return 0;
  if (headerNorm === alias) return 100;
  if (headerNorm.startsWith(alias + ' ') || headerNorm.endsWith(' ' + alias)) return 85;
  if (headerNorm.includes(alias)) return 70;
  const aliasWords = alias.split(' ').filter(Boolean);
  if (aliasWords.length > 1 && aliasWords.every((w) => headerNorm.includes(w))) return 75;
  return 0;
}

function suggestColumnMapping(headers) {
  const mapping = {};
  const used = new Set();

  for (const field of IMPORT_FIELDS.map((f) => f.key)) {
    let bestIdx = -1;
    let bestScore = 0;
    headers.forEach((raw, idx) => {
      if (used.has(idx)) return;
      const norm = normalizeHeader(raw);
      if (!norm) return;
      for (const alias of FIELD_ALIASES[field] || []) {
        const score = scoreHeaderMatch(norm, alias);
        if (score > bestScore) {
          bestScore = score;
          bestIdx = idx;
        }
      }
    });
    if (bestIdx >= 0 && bestScore >= 65) {
      mapping[field] = bestIdx;
      used.add(bestIdx);
    }
  }

  return mapping;
}

function headersIncludeMatricola(headers, mapping = null) {
  if (mapping && mapping.employee_id != null) return true;
  return headers.some((h) => {
    const norm = normalizeHeader(h);
    return FIELD_ALIASES.employee_id.some((alias) => scoreHeaderMatch(norm, alias) >= 65);
  });
}

function detectDelimiter(line) {
  const semicolons = (line.match(/;/g) || []).length;
  const commas = (line.match(/,/g) || []).length;
  const tabs = (line.match(/\t/g) || []).length;
  if (tabs >= semicolons && tabs >= commas && tabs > 0) return '\t';
  if (semicolons > commas) return ';';
  return ',';
}

function parseCsvLine(line, delimiter) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && ch === delimiter) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function parseCsvText(text) {
  const raw = String(text || '').replace(/^\uFEFF/, '').trim();
  if (!raw) return { headers: [], rows: [] };
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return { headers: [], rows: [] };
  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter);
  const rows = lines.slice(1).map((line) => parseCsvLine(line, delimiter));
  return { headers, rows };
}

function parseWorkbookBuffer(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };
  const sheet = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
  if (!matrix.length) return { headers: [], rows: [] };
  const headers = (matrix[0] || []).map((c) => String(c ?? '').trim());
  const rows = matrix.slice(1).filter((row) => row.some((c) => String(c ?? '').trim() !== ''))
    .map((row) => headers.map((_, i) => String(row[i] ?? '').trim()));
  return { headers, rows };
}

function parseImportFile({ file_base64, filename, csv_text }) {
  if (csv_text) return parseCsvText(csv_text);
  if (!file_base64) throw new Error('file_base64 o csv_text richiesto');
  const buf = Buffer.from(file_base64, 'base64');
  const name = String(filename || '').toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.ods')) {
    return parseWorkbookBuffer(buf);
  }
  return parseCsvText(buf.toString('utf8'));
}

function cellValue(row, colIdx) {
  if (colIdx == null || colIdx < 0) return '';
  return String(row[colIdx] ?? '').trim();
}

function splitFullName(full) {
  const t = String(full || '').trim();
  if (!t) return { first_name: '', last_name: '' };
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { first_name: parts[0], last_name: '' };
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') };
}

function parseHireDate(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dmy = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
  if (dmy) {
    let y = parseInt(dmy[3], 10);
    if (y < 100) y += 2000;
    const m = dmy[2].padStart(2, '0');
    const d = dmy[1].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

function mapRowToEmployee(row, mapping) {
  const get = (key) => cellValue(row, mapping[key]);

  let first_name = get('first_name');
  let last_name = get('last_name');
  const full = get('full_name');
  if ((!first_name && !last_name) && full) {
    const split = splitFullName(full);
    first_name = split.first_name;
    last_name = split.last_name;
  }

  const employee_id = get('employee_id') || null;

  return {
    first_name: first_name || null,
    last_name: last_name || null,
    email: get('email') || null,
    employee_id: employee_id ? String(employee_id).trim() : null,
    department: get('department') || null,
    office_location: get('office_location') || null,
    hire_date: parseHireDate(get('hire_date')),
    manager_name: get('manager_name') || null,
    manager_email: get('manager_email') || null,
    phone: get('phone') || null
  };
}

function isValidEmail(email) {
  const s = String(email || '').trim();
  if (!s) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function rowDisplayName(emp) {
  const name = [emp.first_name, emp.last_name].filter(Boolean).join(' ').trim();
  return name || emp.email || 'Riga senza nome';
}

function validateImportRow(emp, { seenInFile = null, existingEmployeeId = false } = {}) {
  const matricula = String(emp?.employee_id || '').trim();
  if (!matricula) {
    return { valid: false, reason: 'Matricola mancante' };
  }
  if (seenInFile) {
    const key = matricula.toLowerCase();
    if (seenInFile.has(key)) {
      return { valid: false, reason: `Matricola #${matricula} duplicata nel file` };
    }
  }
  if (existingEmployeeId) {
    return { valid: false, reason: `Matricola #${matricula} già presente` };
  }
  if (emp.email && !isValidEmail(emp.email)) {
    return { valid: false, reason: 'Email non valida' };
  }
  if (seenInFile) seenInFile.add(matricula.toLowerCase());
  return { valid: true, reason: null };
}

function rowIsValid(emp) {
  return validateImportRow(emp).valid;
}

function buildImportPreview({ headers, rows, mapping }) {
  const effectiveMapping = mapping && Object.keys(mapping).length ? mapping : suggestColumnMapping(headers);
  const seenInFile = new Set();
  const rejected = [];

  rows.forEach((row, idx) => {
    const mapped = mapRowToEmployee(row, effectiveMapping);
    const v = validateImportRow(mapped, { seenInFile });
    if (!v.valid) {
      rejected.push({
        row: idx + 2,
        name: rowDisplayName(mapped),
        reason: v.reason,
        mapped
      });
    }
  });

  const preview_rows = rows.slice(0, 25).map((row, idx) => {
    const mapped = mapRowToEmployee(row, effectiveMapping);
    return {
      row_index: idx,
      row_number: idx + 2,
      mapped,
      valid: rowIsValid(mapped),
      raw: row
    };
  });

  const valid_count = rows.length - rejected.length;
  const invalid_count = rejected.length;

  const unmapped_headers = headers
    .map((h, i) => ({ header: h, index: i }))
    .filter(({ index }) => !Object.values(effectiveMapping).includes(index));

  return {
    headers,
    field_options: IMPORT_FIELDS,
    suggested_mapping: suggestColumnMapping(headers),
    mapping: effectiveMapping,
    preview_rows,
    total_rows: rows.length,
    valid_count,
    invalid_count,
    rejected_count: invalid_count,
    rejected,
    matricola_header_ok: headersIncludeMatricola(headers, effectiveMapping),
    matricola_mapped: effectiveMapping.employee_id != null
  };
}

function previewImport({ file_base64, filename, csv_text, mapping }) {
  const { headers, rows } = parseImportFile({ file_base64, filename, csv_text });
  if (!headers.length) throw new Error('File vuoto o senza intestazioni');
  return buildImportPreview({ headers, rows, mapping });
}

function newImportBatchId() {
  const day = new Date().toISOString().slice(0, 10);
  return `import-${day}-${randomUUID().slice(0, 8)}`;
}

/**
 * Evaluate all rows for import; optional async checkExisting(employee_id) → member row | null.
 */
async function evaluateImportRows({ headers, rows, mapping, checkExisting = null, allowExisting = false }) {
  const effectiveMapping = mapping && Object.keys(mapping).length ? mapping : suggestColumnMapping(headers);
  const seenInFile = new Set();
  const employees = [];
  const rejected = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const mapped = mapRowToEmployee(row, effectiveMapping);
    const v = validateImportRow(mapped, { seenInFile });
    let reason = v.valid ? null : v.reason;

    if (!reason && checkExisting) {
      const existing = await checkExisting(mapped.employee_id);
      if (existing && !allowExisting) {
        reason = `Matricola #${mapped.employee_id} duplicata`;
      }
    }

    if (reason) {
      rejected.push({
        row: i + 2,
        name: rowDisplayName(mapped),
        reason,
        raw: row,
        mapped
      });
    } else {
      employees.push(mapped);
    }
  }

  return { employees, rejected, mapping: effectiveMapping };
}

function rejectedRowsToCsv(rejected) {
  const header = 'riga,nome,motivo';
  const lines = rejected.map((r) => {
    const cols = [
      r.row,
      rowDisplayName(r.mapped || {}),
      r.reason
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
    return cols.join(',');
  });
  return [header, ...lines].join('\n');
}

function employeesToFieldValues(emp) {
  const fv = {};
  if (emp.first_name) fv.nome = emp.first_name;
  if (emp.last_name) fv.cognome = emp.last_name;
  if (emp.employee_id) fv.matricola = emp.employee_id;
  if (emp.department) {
    fv.reparto = emp.department;
    fv.department = emp.department;
  }
  if (emp.office_location) {
    fv.sede = emp.office_location;
    fv.office_location = emp.office_location;
  }
  if (emp.email) fv.email = emp.email;
  if (emp.phone) fv.telefono = emp.phone;
  if (emp.manager_name) fv.manager_name = emp.manager_name;
  if (emp.manager_email) fv.manager_email = emp.manager_email;
  if (emp.hire_date) fv.hire_date = emp.hire_date;
  return fv;
}

module.exports = {
  IMPORT_FIELDS,
  CSV_TEMPLATE_HEADER,
  parseImportFile,
  suggestColumnMapping,
  headersIncludeMatricola,
  mapRowToEmployee,
  rowIsValid,
  validateImportRow,
  buildImportPreview,
  previewImport,
  evaluateImportRows,
  newImportBatchId,
  rejectedRowsToCsv,
  employeesToFieldValues,
  rowDisplayName
};
