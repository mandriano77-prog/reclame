/**
 * Unified employee_pass data model + cross-wallet serializers (Apple / Google / Samsung).
 * Single source for Filo Diretto HR pass content parity.
 */

const HR_BG_DEFAULT = '#8B5CF6';
const HR_LABEL_DEFAULT = '#A78BFA';
const HR_FG_DEFAULT = '#FFFFFF';

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseFieldValues(instance) {
  const raw = instance?.field_values;
  if (!raw) return {};
  if (typeof raw === 'object') return { ...raw };
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function resolveMemberProfile(memberRow, instance) {
  if (memberRow) {
    const first = memberRow.first_name || '';
    const last = memberRow.last_name || '';
    const fullName = [first, last].filter(Boolean).join(' ').trim() || memberRow.full_name || null;
    return {
      id: memberRow.id,
      full_name: fullName,
      employee_id: memberRow.employee_id || null,
      department: memberRow.department || null,
      office_location: memberRow.office_location || null,
      hire_date: memberRow.hire_date || null,
      manager_name: memberRow.manager_name || null,
      manager_email: memberRow.manager_email || null
    };
  }
  const fv = parseFieldValues(instance);
  const fullName = [fv.nome || fv.name, fv.cognome || fv.surname].filter(Boolean).join(' ').trim()
    || fv.display_name || fv.full_name
    || [fv.first_name, fv.last_name].filter(Boolean).join(' ').trim() || null;
  return {
    id: instance?.id || null,
    full_name: fullName || null,
    employee_id: fv.matricola || fv.badge_id || fv.employee_id || null,
    department: fv.department || fv.reparto || null,
    office_location: fv.office_location || fv.sede || null,
    hire_date: fv.hire_date || null,
    manager_name: fv.manager_name || null,
    manager_email: fv.manager_email || null
  };
}

function resolveVariableLink(instance, template, brandConfig = {}) {
  const now = new Date();
  if (instance?.dynamic_link_url) {
    const exp = instance.dynamic_link_expires_at ? new Date(instance.dynamic_link_expires_at) : null;
    if (!exp || exp > now) {
      return { label: instance.dynamic_link_label || 'AZIONE RICHIESTA', url: instance.dynamic_link_url };
    }
  }
  if (template?.back_fixed_link_url) {
    return { label: template.back_fixed_link_label || 'LINK UTILE', url: template.back_fixed_link_url };
  }
  const pushOut = brandConfig.pushLinkOut;
  if (pushOut?.url) return { label: pushOut.label || 'Scopri di più', url: pushOut.url };
  return null;
}

function parseJsonArray(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseColor(color) {
  const rgbMatch = String(color || '').match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (rgbMatch) {
    return { r: parseInt(rgbMatch[1], 10), g: parseInt(rgbMatch[2], 10), b: parseInt(rgbMatch[3], 10) };
  }
  let hex = String(color || '').replace('#', '');
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  return {
    r: parseInt(hex.substring(0, 2), 16) || 0,
    g: parseInt(hex.substring(2, 4), 16) || 0,
    b: parseInt(hex.substring(4, 6), 16) || 0
  };
}

function colorToRgbString(color) {
  if (!color) return null;
  if (String(color).trim().toLowerCase().startsWith('rgb')) return String(color).trim();
  const c = parseColor(color);
  return `rgb(${c.r}, ${c.g}, ${c.b})`;
}

function rgbToHex(color) {
  if (!color) return HR_BG_DEFAULT;
  if (String(color).startsWith('#')) return String(color);
  const c = parseColor(color);
  return `#${[c.r, c.g, c.b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

function isLegacyGreenPassAccent(color) {
  if (!color) return false;
  const normalized = String(color).trim().toLowerCase().replace(/\s/g, '');
  const legacy = [
    '#00d4aa', '#00d4a9', '#3cdfff', '#d4e600',
    'rgb(0,212,170)', 'rgb(0,212,169)', 'rgb(60,223,255)', 'rgb(212,230,0)'
  ];
  if (legacy.includes(normalized)) return true;
  const c = parseColor(color);
  if (c.g > 150 && c.r < 100 && c.b >= 100 && c.b <= 220) return true;
  if (c.r > 180 && c.g > 200 && c.b < 100) return true;
  return false;
}

function resolveEmployeePassColors(template, brandConfig) {
  const line = String(brandConfig?.product_line || '').toLowerCase();
  const fgHex = brandConfig?.foregroundColor || null;
  const defaultForeground = template?.style?.foregroundColor || HR_FG_DEFAULT;
  let foregroundColor = fgHex && !isLegacyGreenPassAccent(fgHex)
    ? colorToRgbString(fgHex)
    : (isLegacyGreenPassAccent(defaultForeground) ? HR_FG_DEFAULT : colorToRgbString(defaultForeground) || HR_FG_DEFAULT);
  if (line === 'hr') foregroundColor = colorToRgbString(HR_FG_DEFAULT);

  const bgHex = brandConfig?.backgroundColor || template?.style?.backgroundColor || null;
  const backgroundColor = bgHex
    ? colorToRgbString(bgHex)
    : (line === 'hr' ? colorToRgbString(HR_BG_DEFAULT) : 'rgb(13, 11, 26)');

  const lblHex = brandConfig?.labelColor || template?.style?.labelColor || null;
  let labelColor = foregroundColor;
  if (line === 'hr') {
    labelColor = colorToRgbString(
      lblHex && !isLegacyGreenPassAccent(lblHex) ? lblHex : HR_LABEL_DEFAULT
    );
  } else if (lblHex && !isLegacyGreenPassAccent(lblHex)) {
    labelColor = colorToRgbString(lblHex);
  }

  return {
    foregroundColor,
    backgroundColor,
    labelColor,
    hexBackgroundColor: rgbToHex(backgroundColor)
  };
}

function makeHrLinkField(key, label, url) {
  const safeLabel = escapeHtml(label);
  const safeUrl = escapeHtml(url);
  const displayHost = url.replace(/^https?:\/\//i, '');
  return {
    key,
    label: String(label || '').toUpperCase().slice(0, 64),
    value: url,
    attributedValue: `<a href="${safeUrl}">${safeLabel || escapeHtml(displayHost)}</a>`
  };
}

function buildBackSections({ brand, template, instance, member, brandConfig = {} }) {
  const profile = resolveMemberProfile(member, instance);
  const sections = [];

  const dynamicLink = resolveVariableLink(instance, template, brandConfig);
  if (dynamicLink?.url) {
    sections.push({
      kind: 'link',
      key: 'link_dynamic',
      label: dynamicLink.label,
      url: dynamicLink.url
    });
  }

  if (profile.full_name) {
    sections.push({ kind: 'text', key: 'name', label: 'DIPENDENTE', body: profile.full_name });
  }
  if (profile.employee_id) {
    sections.push({ kind: 'text', key: 'matricola', label: 'MATRICOLA', body: `#${profile.employee_id}` });
  }
  if (profile.department) {
    sections.push({ kind: 'text', key: 'reparto', label: 'REPARTO', body: profile.department });
  }
  if (profile.office_location) {
    sections.push({ kind: 'text', key: 'sede', label: 'SEDE', body: profile.office_location });
  }

  const activatedAt = instance?.activated_at || instance?.created_at;
  if (activatedAt) {
    sections.push({
      kind: 'text',
      key: 'active',
      label: 'ATTIVO DA',
      body: new Date(activatedAt).toLocaleDateString('it-IT', { year: 'numeric', month: 'long', day: 'numeric' })
    });
  }

  if (profile.manager_name) {
    const mgr = profile.manager_email
      ? `${profile.manager_name} · ${profile.manager_email}`
      : profile.manager_name;
    sections.push({ kind: 'text', key: 'manager', label: 'MANAGER DIRETTO', body: mgr });
  }

  if (brand?.hr_email) sections.push({ kind: 'text', key: 'hr_email', label: 'PEOPLE OPERATIONS', body: brand.hr_email });
  if (brand?.hr_phone) sections.push({ kind: 'text', key: 'hr_phone', label: 'TELEFONO HR', body: brand.hr_phone });
  if (brand?.dpo_email) sections.push({ kind: 'text', key: 'dpo', label: 'PRIVACY / DPO', body: brand.dpo_email });
  if (brand?.emergency_phone) sections.push({ kind: 'text', key: 'emergency', label: 'EMERGENZE', body: brand.emergency_phone });

  parseJsonArray(brand?.back_resources).slice(0, 5).forEach((r, i) => {
    if (r?.label && r?.url) sections.push({ kind: 'link', key: `resource_${i}`, label: r.label, url: r.url });
  });

  parseJsonArray(brand?.back_documents).slice(0, 5).forEach((d, i) => {
    if (d?.label && d?.url) sections.push({ kind: 'link', key: `doc_${i}`, label: d.label, url: d.url, doc: true });
  });

  return sections;
}

function walletImageUrls({ apiBase, brand, template }) {
  if (!apiBase) return {};
  const tplId = template?.id;
  const slug = brand?.slug;
  const urls = {};
  if (slug) urls.logo = `${apiBase}/brands/by-slug/${encodeURIComponent(slug)}/logo`;
  if (slug) urls.stripBrand = `${apiBase}/brands/by-slug/${encodeURIComponent(slug)}/strip`;
  if (tplId) {
    urls.stripTemplate = `${apiBase}/templates/${tplId}/wallet-image/strip`;
    urls.thumbnail = `${apiBase}/templates/${tplId}/wallet-image/thumbnail`;
    urls.background = `${apiBase}/templates/${tplId}/wallet-image/background`;
  }
  const tplImages = template?.style?.images || {};
  urls.strip = tplImages.strip && tplId ? urls.stripTemplate : urls.stripBrand;
  return urls;
}

/**
 * Build unified employee_pass from DB rows.
 */
function buildEmployeePass({ brand, template, instance, member, brandConfig, apiBase }) {
  const cfg = brandConfig || brand?.config || {};
  const profile = resolveMemberProfile(member, instance);
  const tplFields = template?.fields || {};
  const colors = resolveEmployeePassColors(template, cfg);
  const images = walletImageUrls({ apiBase, brand, template });
  const tplImages = template?.style?.images || {};

  const primary = profile.full_name
    ? { key: 'employee_name', label: '', value: profile.full_name }
    : null;

  const secondary = [];
  if (profile.employee_id) {
    secondary.push({ key: 'matricola', label: 'MATRICOLA', value: `#${profile.employee_id}` });
  }
  if (profile.office_location) {
    secondary.push({ key: 'sede', label: 'SEDE', value: profile.office_location });
  }
  if (profile.department) {
    secondary.push({ key: 'reparto', label: 'REPARTO', value: profile.department });
  }

  const header = [];
  const auxiliary = [];
  if (tplFields.headerFields) {
    tplFields.headerFields.forEach((f) => {
      if (f.label || f.value) header.push({ key: f.key || 'header_info', label: (f.label || '').toUpperCase(), value: f.value || '' });
    });
  }
  if (tplFields.secondaryFields) {
    tplFields.secondaryFields.forEach((f) => {
      if (f.label || f.value) {
        secondary.push({ key: f.key || 'sec_info', label: (f.label || '').toUpperCase(), value: f.value || '' });
      }
    });
  }
  if (tplFields.auxiliaryFields) {
    tplFields.auxiliaryFields.forEach((f) => {
      if (f.label || f.value) auxiliary.push({ key: f.key || 'aux_info', label: (f.label || '').toUpperCase(), value: f.value || '' });
    });
  }

  const backSections = buildBackSections({ brand, template, instance, member, brandConfig: cfg });

  const barcodeValue = instance?.serial_number || '';
  const employeeId = profile.employee_id || profile.id || instance?.id || '';
  const barcodeAlt = `${profile.full_name || 'Membro'} · #${employeeId}`.slice(0, 64);

  return {
    member_id: member?.id || instance?.member_id || null,
    brand_id: brand?.id || null,
    pass_instance_id: instance?.id || null,
    serial_number: instance?.serial_number || null,
    brandName: brand?.name || '',
    logoText: brand?.name || '',
    programName: (template?.name || brand?.name || '').slice(0, 64),
    templateName: template?.name || '',
    passType: template?.pass_type || 'storeCard',
    profile,
    colors,
    images,
    hasTemplateImages: {
      strip: !!tplImages.strip,
      thumbnail: !!tplImages.thumbnail,
      background: !!tplImages.background,
      logo: !!tplImages.logo
    },
    front: { primary, secondary, header, auxiliary },
    backSections,
    barcode: { value: barcodeValue, altText: barcodeAlt }
  };
}

function sectionsToAppleBackFields(sections) {
  return sections.map((s) => {
    if (s.kind === 'link') {
      if (s.doc) {
        const safeUrl = escapeHtml(s.url);
        return {
          key: s.key,
          label: String(s.label).toUpperCase().slice(0, 64),
          value: s.url,
          attributedValue: `<a href="${safeUrl}">Apri documento</a>`
        };
      }
      return makeHrLinkField(s.key, s.label, s.url);
    }
    return { key: s.key, label: s.label, value: s.body };
  });
}

/** Apple Wallet — pass.json storeCard/eventTicket slice */
function toApplePass(employeePass) {
  const passStructure = {};
  if (employeePass.front.header?.length) passStructure.headerFields = employeePass.front.header;
  if (employeePass.front.primary) passStructure.primaryFields = [employeePass.front.primary];
  if (employeePass.front.secondary?.length) passStructure.secondaryFields = employeePass.front.secondary;
  if (employeePass.front.auxiliary?.length) passStructure.auxiliaryFields = employeePass.front.auxiliary;
  if (employeePass.backSections?.length) {
    passStructure.backFields = sectionsToAppleBackFields(employeePass.backSections);
  }

  return {
    logoText: employeePass.logoText,
    organizationName: employeePass.brandName,
    description: employeePass.templateName,
    foregroundColor: employeePass.colors.foregroundColor,
    backgroundColor: employeePass.colors.backgroundColor,
    labelColor: employeePass.colors.labelColor,
    passStructure,
    barcode: {
      format: 'PKBarcodeFormatQR',
      message: employeePass.barcode.value,
      messageEncoding: 'iso-8859-1',
      altText: employeePass.barcode.altText
    }
  };
}

function googleImageRef(uri, description) {
  if (!uri) return null;
  return {
    sourceUri: { uri },
    contentDescription: { defaultValue: { language: 'it', value: description || '' } }
  };
}

/** Google Wallet — generic/loyalty class + object fragments */
function toGooglePass(employeePass, { passKind = 'generic' } = {}) {
  const textModulesData = [];
  const linksModuleData = { uris: [] };

  employeePass.backSections.forEach((s, idx) => {
    if (s.kind === 'link') {
      linksModuleData.uris.push({
        id: s.key || `link_${idx}`,
        uri: s.url,
        description: s.label
      });
    } else if (s.body) {
      textModulesData.push({
        id: s.key || `text_${idx}`,
        header: s.label,
        body: String(s.body).slice(0, 500)
      });
    }
  });

  const classPatch = {};
  const logoUri = employeePass.images.logo;
  const stripUri = employeePass.images.strip;
  const thumbUri = employeePass.images.thumbnail;

  if (passKind === 'loyalty') {
    if (logoUri) classPatch.programLogo = googleImageRef(logoUri, employeePass.brandName);
  } else {
    if (logoUri) classPatch.logo = googleImageRef(logoUri, employeePass.brandName);
    if (stripUri) classPatch.heroImage = googleImageRef(stripUri, 'Strip');
  }

  classPatch.hexBackgroundColor = employeePass.colors.hexBackgroundColor;
  classPatch.programName = employeePass.programName;

  const objectPatch = {
    hexBackgroundColor: employeePass.colors.hexBackgroundColor,
    barcode: {
      type: 'QR_CODE',
      value: employeePass.barcode.value,
      alternateText: employeePass.barcode.altText
    },
    textModulesData,
    linksModuleData
  };

  if (passKind === 'loyalty') {
    objectPatch.accountName = (employeePass.profile.full_name || 'Membro').slice(0, 64);
  } else {
    objectPatch.cardTitle = { defaultValue: { language: 'it', value: employeePass.brandName } };
    objectPatch.subheader = { defaultValue: { language: 'it', value: 'Dipendente' } };
    objectPatch.header = { defaultValue: { language: 'it', value: employeePass.profile.full_name || 'Membro' } };
    if (thumbUri && employeePass.hasTemplateImages.thumbnail) {
      objectPatch.mainImage = googleImageRef(thumbUri, 'Thumbnail');
    }
    employeePass.front.secondary.slice(0, 3).forEach((f, i) => {
      objectPatch.textModulesData.unshift({
        id: `front_sec_${i}`,
        header: f.label,
        body: f.value
      });
    });
  }

  return { classPatch, objectPatch };
}

/** Samsung Wallet — loyalty card attributes (no dedicated thumbnail slot) */
function toSamsungPass(employeePass) {
  const contents = [];
  employeePass.backSections.forEach((s) => {
    if (s.kind === 'link') {
      contents.push({ title: s.label, content: s.url });
    } else if (s.body) {
      contents.push({ title: s.label, content: s.body });
    }
  });

  const links = employeePass.backSections
    .filter((s) => s.kind === 'link')
    .map((s) => ({ name: s.label, url: s.url }));

  const secondaryLine = employeePass.front.secondary
    .map((f) => f.value)
    .filter(Boolean)
    .join(' · ');

  return {
    title: (employeePass.profile.full_name || employeePass.brandName).slice(0, 64),
    cardSubTitle: secondaryLine.slice(0, 120) || employeePass.brandName.slice(0, 32),
    providerName: employeePass.brandName.slice(0, 32),
    logoImage: employeePass.images.logo,
    bannerImage: employeePass.images.strip,
    bgColor: employeePass.colors.hexBackgroundColor,
    noticeDesc: contents.length
      ? `<p>${contents.map((c) => `${escapeHtml(c.title)}: ${escapeHtml(c.content)}`).join('<br>')}</p>`
      : `<p>${escapeHtml(employeePass.templateName)}</p>`,
    links,
    barcode: {
      type: 'qr',
      value: employeePass.barcode.value
    }
  };
}

function isHrEmployeePass(brand) {
  const line = String(brand?.config?.product_line || process.env.DASHBOARD_PRODUCT_LINE || '').toLowerCase();
  return line === 'hr';
}

module.exports = {
  buildEmployeePass,
  toApplePass,
  toGooglePass,
  toSamsungPass,
  isHrEmployeePass,
  resolveEmployeePassColors,
  walletImageUrls,
  buildBackSections,
  sectionsToAppleBackFields,
  resolveMemberProfile,
  resolveVariableLink,
  escapeHtml
};
