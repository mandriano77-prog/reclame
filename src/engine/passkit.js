const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const archiver = require('archiver');
const forge = require('node-forge');
const { Transform } = require('stream');

/**
 * Generate SVG path for a letter using geometric shapes (no font dependency).
 * Returns SVG elements string for the given letter, sized to fit within (w, h).
 */
function letterToSvgPaths(letter, x, y, w, h, fillColor) {
  const l = letter.toUpperCase();
  const t = Math.max(1, Math.round(w * 0.18)); // stroke thickness

  // Each letter is drawn with rect elements only
  switch (l) {
    case 'A': return `
      <rect x="${x}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x}" y="${y}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x}" y="${y + Math.round(h*0.45)}" width="${w}" height="${t}" fill="${fillColor}"/>`;
    case 'B': return `
      <rect x="${x}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x}" y="${y}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x}" y="${y+h-t}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x}" y="${y + Math.round(h*0.45)}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y}" width="${t}" height="${Math.round(h*0.5)}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y + Math.round(h*0.45)}" width="${t}" height="${Math.round(h*0.55)}" fill="${fillColor}"/>`;
    case 'C': return `
      <rect x="${x}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x}" y="${y}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x}" y="${y+h-t}" width="${w}" height="${t}" fill="${fillColor}"/>`;
    case 'D': return `
      <rect x="${x}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x}" y="${y}" width="${Math.round(w*0.7)}" height="${t}" fill="${fillColor}"/>
      <rect x="${x}" y="${y+h-t}" width="${Math.round(w*0.7)}" height="${t}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y+t}" width="${t}" height="${h-t*2}" fill="${fillColor}"/>`;
    case 'E': return `
      <rect x="${x}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x}" y="${y}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x}" y="${y+h-t}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x}" y="${y + Math.round(h*0.45)}" width="${Math.round(w*0.7)}" height="${t}" fill="${fillColor}"/>`;
    case 'F': return `
      <rect x="${x}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x}" y="${y}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x}" y="${y + Math.round(h*0.45)}" width="${Math.round(w*0.7)}" height="${t}" fill="${fillColor}"/>`;
    case 'G': return `
      <rect x="${x}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x}" y="${y}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x}" y="${y+h-t}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y + Math.round(h*0.45)}" width="${t}" height="${Math.round(h*0.55)}" fill="${fillColor}"/>
      <rect x="${x + Math.round(w*0.5)}" y="${y + Math.round(h*0.45)}" width="${Math.round(w*0.5)}" height="${t}" fill="${fillColor}"/>`;
    case 'H': return `
      <rect x="${x}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x}" y="${y + Math.round(h*0.45)}" width="${w}" height="${t}" fill="${fillColor}"/>`;
    case 'I': return `
      <rect x="${x}" y="${y}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x}" y="${y+h-t}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x + Math.round(w*0.5) - Math.round(t*0.5)}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>`;
    case 'J': return `
      <rect x="${x}" y="${y}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x}" y="${y+h-t}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x}" y="${y + Math.round(h*0.6)}" width="${t}" height="${Math.round(h*0.4)}" fill="${fillColor}"/>`;
    case 'K': return `
      <rect x="${x}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y}" width="${t}" height="${Math.round(h*0.5)}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y + Math.round(h*0.45)}" width="${t}" height="${Math.round(h*0.55)}" fill="${fillColor}"/>
      <rect x="${x+t}" y="${y + Math.round(h*0.4)}" width="${w-t*2}" height="${t}" fill="${fillColor}"/>`;
    case 'L': return `
      <rect x="${x}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x}" y="${y+h-t}" width="${w}" height="${t}" fill="${fillColor}"/>`;
    case 'M': return `
      <rect x="${x}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x}" y="${y}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x + Math.round(w*0.5) - Math.round(t*0.5)}" y="${y}" width="${t}" height="${Math.round(h*0.5)}" fill="${fillColor}"/>`;
    case 'N': return `
      <rect x="${x}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x}" y="${y}" width="${w}" height="${t}" fill="${fillColor}"/>`;
    case 'O': return `
      <rect x="${x}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x}" y="${y}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x}" y="${y+h-t}" width="${w}" height="${t}" fill="${fillColor}"/>`;
    case 'P': return `
      <rect x="${x}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x}" y="${y}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x}" y="${y + Math.round(h*0.45)}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y}" width="${t}" height="${Math.round(h*0.5)}" fill="${fillColor}"/>`;
    case 'Q': return `
      <rect x="${x}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x}" y="${y}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x}" y="${y+h-t}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x + Math.round(w*0.6)}" y="${y + Math.round(h*0.6)}" width="${t}" height="${Math.round(h*0.4)}" fill="${fillColor}"/>`;
    case 'R': return `
      <rect x="${x}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x}" y="${y}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x}" y="${y + Math.round(h*0.45)}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y}" width="${t}" height="${Math.round(h*0.5)}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y + Math.round(h*0.45)}" width="${t}" height="${Math.round(h*0.55)}" fill="${fillColor}"/>`;
    case 'S': return `
      <rect x="${x}" y="${y}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x}" y="${y}" width="${t}" height="${Math.round(h*0.5)}" fill="${fillColor}"/>
      <rect x="${x}" y="${y + Math.round(h*0.45)}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y + Math.round(h*0.45)}" width="${t}" height="${Math.round(h*0.55)}" fill="${fillColor}"/>
      <rect x="${x}" y="${y+h-t}" width="${w}" height="${t}" fill="${fillColor}"/>`;
    case 'T': return `
      <rect x="${x}" y="${y}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x + Math.round(w*0.5) - Math.round(t*0.5)}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>`;
    case 'U': return `
      <rect x="${x}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x}" y="${y+h-t}" width="${w}" height="${t}" fill="${fillColor}"/>`;
    case 'V': return `
      <rect x="${x}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x + Math.round(w*0.5) - Math.round(t*0.5)}" y="${y+h-t}" width="${t}" height="${t}" fill="${fillColor}"/>`;
    case 'W': return `
      <rect x="${x}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y}" width="${t}" height="${h}" fill="${fillColor}"/>
      <rect x="${x}" y="${y+h-t}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x + Math.round(w*0.5) - Math.round(t*0.5)}" y="${y + Math.round(h*0.5)}" width="${t}" height="${Math.round(h*0.5)}" fill="${fillColor}"/>`;
    case 'X': return `
      <rect x="${x}" y="${y}" width="${t}" height="${Math.round(h*0.45)}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y}" width="${t}" height="${Math.round(h*0.45)}" fill="${fillColor}"/>
      <rect x="${x}" y="${y + Math.round(h*0.4)}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x}" y="${y + Math.round(h*0.5)}" width="${t}" height="${Math.round(h*0.5)}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y + Math.round(h*0.5)}" width="${t}" height="${Math.round(h*0.5)}" fill="${fillColor}"/>`;
    case 'Y': return `
      <rect x="${x}" y="${y}" width="${t}" height="${Math.round(h*0.5)}" fill="${fillColor}"/>
      <rect x="${x+w-t}" y="${y}" width="${t}" height="${Math.round(h*0.5)}" fill="${fillColor}"/>
      <rect x="${x}" y="${y + Math.round(h*0.45)}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x + Math.round(w*0.5) - Math.round(t*0.5)}" y="${y + Math.round(h*0.45)}" width="${t}" height="${Math.round(h*0.55)}" fill="${fillColor}"/>`;
    case 'Z': return `
      <rect x="${x}" y="${y}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x}" y="${y+h-t}" width="${w}" height="${t}" fill="${fillColor}"/>
      <rect x="${x}" y="${y + Math.round(h*0.4)}" width="${w}" height="${t}" fill="${fillColor}"/>`;
    default: // fallback: simple block
      return `<rect x="${x+Math.round(w*0.2)}" y="${y+Math.round(h*0.2)}" width="${Math.round(w*0.6)}" height="${Math.round(h*0.6)}" rx="${Math.round(w*0.1)}" fill="${fillColor}" opacity="0.6"/>`;
  }
}

/**
 * Parse hex color string to {r, g, b} object
 * Supports #RGB, #RRGGBB, and rgb(r,g,b) formats
 */
function parseColor(color) {
  // Handle rgb(r,g,b) format
  const rgbMatch = color.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (rgbMatch) {
    return { r: parseInt(rgbMatch[1]), g: parseInt(rgbMatch[2]), b: parseInt(rgbMatch[3]) };
  }
  // Handle hex format
  let hex = color.replace('#', '');
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  return {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16)
  };
}

/**
 * Generate the pass.json content for Apple Wallet
 */
function generatePassJson(template, instance, brand, options = {}) {
  const {
    baseUrl = 'http://localhost:3000',
    passTypeIdentifier = process.env.PASS_TYPE_IDENTIFIER || `pass.com.nudj.${brand.slug}`,
    teamIdentifier = process.env.TEAM_IDENTIFIER || 'XXXXXXXXXX'
  } = options;

  // Read colors from brand.config first, then template.style, then defaults
  const brandConfig = brand.config || {};
  const fgHex = brandConfig.foregroundColor || null;
  const foregroundColor = fgHex ? `rgb(${parseColor(fgHex).r}, ${parseColor(fgHex).g}, ${parseColor(fgHex).b})` : (template.style?.foregroundColor || 'rgb(255, 255, 255)');
  const bgHex = brandConfig.backgroundColor || null;
  const backgroundColor = bgHex ? `rgb(${parseColor(bgHex).r}, ${parseColor(bgHex).g}, ${parseColor(bgHex).b})` : (template.style?.backgroundColor || 'rgb(13, 11, 26)');
  const lblHex = brandConfig.labelColor || null;
  const labelColor = lblHex ? `rgb(${parseColor(lblHex).r}, ${parseColor(lblHex).g}, ${parseColor(lblHex).b})` : (template.style?.labelColor || 'rgb(184, 196, 216)');

  // Build field arrays based on template
  const headerFields = [];
  const primaryFields = [];
  const secondaryFields = [];
  const auxiliaryFields = [];
  const backFields = [];

  if (template.fields && Array.isArray(template.fields)) {
    template.fields.forEach((field, index) => {
      const fieldObj = {
        key: field.key,
        label: (field.label || field.key).toUpperCase(),
        value: instance.field_values?.[field.key] || field.value || ''
      };

      if (field.dateStyle) {
        fieldObj.dateStyle = field.dateStyle;
      }

      if (field.type) {
        // Explicit type placement
        switch (field.type) {
          case 'header': headerFields.push(fieldObj); break;
          case 'primary': primaryFields.push(fieldObj); break;
          case 'secondary': secondaryFields.push(fieldObj); break;
          case 'auxiliary': auxiliaryFields.push(fieldObj); break;
          case 'back': backFields.push(fieldObj); break;
        }
      } else {
        // Auto-distribute: first field = header (top-right), second = primary (center),
        // next 2 = secondary, rest = auxiliary
        if (index === 0) headerFields.push(fieldObj);
        else if (index === 1) primaryFields.push(fieldObj);
        else if (index <= 3) secondaryFields.push(fieldObj);
        else auxiliaryFields.push(fieldObj);
      }
    });
  }

  // Push announcement — when brand sends a manual push with pass update
  if (brandConfig.pushAnnouncement && brandConfig.pushAnnouncement.message) {
    // FRONT: short announcement visible immediately when pass is opened
    // Truncate to ~40 chars for clean display on auxiliaryFields
    const shortMsg = brandConfig.pushAnnouncement.message.length > 40
      ? brandConfig.pushAnnouncement.message.substring(0, 37) + '...'
      : brandConfig.pushAnnouncement.message;
    auxiliaryFields.push({
      key: 'announcement',
      label: '📢 ' + (brandConfig.pushAnnouncement.title || 'NOVITÀ'),
      value: shortMsg
    });

    // BACK: full message with details
    backFields.unshift({
      key: 'announcement_full',
      label: brandConfig.pushAnnouncement.title || 'NOVITÀ',
      value: brandConfig.pushAnnouncement.message
    });
    if (brandConfig.pushAnnouncement.date) {
      backFields.splice(1, 0, {
        key: 'announcement_date',
        label: 'ULTIMO AGGIORNAMENTO',
        value: brandConfig.pushAnnouncement.date
      });
    }
  }

  // Determine the pass structure type
  const passStructure = {};
  const structureKey = template.pass_type || 'generic';

  if (headerFields.length > 0) {
    passStructure.headerFields = headerFields;
  }
  if (primaryFields.length > 0) {
    passStructure.primaryFields = primaryFields;
  }
  if (secondaryFields.length > 0) {
    passStructure.secondaryFields = secondaryFields;
  }
  if (auxiliaryFields.length > 0) {
    passStructure.auxiliaryFields = auxiliaryFields;
  }
  if (backFields.length > 0) {
    passStructure.backFields = backFields;
  }

  // If no fields defined, add a simple placeholder
  if (Object.keys(passStructure).length === 0) {
    passStructure.primaryFields = [
      {
        key: 'offer',
        label: 'OFFERTA',
        value: brand.name
      }
    ];
  }

  const passJson = {
    formatVersion: 1,
    passTypeIdentifier,
    serialNumber: instance.serial_number,
    teamIdentifier,
    organizationName: brand.name,
    description: template.name,
    foregroundColor,
    backgroundColor,
    labelColor,
    // logoText omitted — brand identity comes from the logo image only
    authenticationToken: instance.auth_token,
    webServiceURL: `${baseUrl}/api`,
    [structureKey]: passStructure,
    barcode: {
      format: 'PKBarcodeFormatQR',
      message: `${baseUrl}/pass/${instance.id}`,
      messageEncoding: 'iso-8859-1'
    },
    barcodes: [
      {
        format: 'PKBarcodeFormatQR',
        message: `${baseUrl}/pass/${instance.id}`,
        messageEncoding: 'iso-8859-1'
      }
    ]
  };

  // Geofencing locations — triggers lock screen notification when nearby
  if (brandConfig.locations && Array.isArray(brandConfig.locations) && brandConfig.locations.length > 0) {
    passJson.locations = brandConfig.locations.map(loc => {
      const entry = {
        latitude: parseFloat(loc.latitude),
        longitude: parseFloat(loc.longitude)
      };
      if (loc.relevantText) entry.relevantText = loc.relevantText;
      if (loc.altitude) entry.altitude = parseFloat(loc.altitude);
      return entry;
    });
  }

  // Relevant date — triggers lock screen notification at this time
  if (brandConfig.relevantDate) {
    passJson.relevantDate = brandConfig.relevantDate;
  }

  // Max distance for geofencing — 500m default
  passJson.maxDistance = parseInt(brandConfig.maxDistance) || 500;

  return passJson;
}

/**
 * Generate icon PNG files with brand initial (geometric paths, no font needed)
 */
async function generateIcon(brandName, bgColor = '#0D0B1A', fgColor = '#FFFFFF') {
  const initial = brandName.charAt(0).toUpperCase();
  const bg = parseColor(bgColor);

  // 29x29 icon — letter drawn with geometric rects
  const letter29 = letterToSvgPaths(initial, 7, 6, 15, 17, fgColor);
  const icon29 = await sharp(Buffer.from(
    `<svg width="29" height="29" xmlns="http://www.w3.org/2000/svg">
      <rect width="29" height="29" fill="${bgColor}"/>${letter29}
    </svg>`
  )).png().toBuffer();

  // 58x58 icon (2x)
  const letter58 = letterToSvgPaths(initial, 14, 12, 30, 34, fgColor);
  const icon58 = await sharp(Buffer.from(
    `<svg width="58" height="58" xmlns="http://www.w3.org/2000/svg">
      <rect width="58" height="58" fill="${bgColor}"/>${letter58}
    </svg>`
  )).png().toBuffer();

  return { icon: icon29, icon2x: icon58 };
}

/**
 * Generate logo PNG files — shows brand initial in a rounded badge.
 * The full brand name is displayed via logoText in pass.json.
 * Uses geometric SVG paths — NO font/text dependency.
 */
async function generateLogo(brandName, bgColor = '#0D0B1A', fgColor = '#FFFFFF') {
  const initial = brandName.charAt(0).toUpperCase();

  // 160x50 logo — initial letter in a rounded rect badge
  const letter160 = letterToSvgPaths(initial, 62, 10, 20, 30, fgColor);
  const logo160 = await sharp(Buffer.from(
    `<svg width="160" height="50" xmlns="http://www.w3.org/2000/svg">
      <rect width="160" height="50" fill="${bgColor}"/>
      <rect x="52" y="3" width="44" height="44" rx="10" fill="${fgColor}" opacity="0.15"/>${letter160}
    </svg>`
  )).png().toBuffer();

  // 320x100 logo (2x)
  const letter320 = letterToSvgPaths(initial, 124, 20, 40, 60, fgColor);
  const logo320 = await sharp(Buffer.from(
    `<svg width="320" height="100" xmlns="http://www.w3.org/2000/svg">
      <rect width="320" height="100" fill="${bgColor}"/>
      <rect x="104" y="6" width="88" height="88" rx="20" fill="${fgColor}" opacity="0.15"/>${letter320}
    </svg>`
  )).png().toBuffer();

  return { logo: logo160, logo2x: logo320 };
}

/**
 * Generate strip image (for coupon/storeCard) — geometric initial, no font
 */
async function generateStrip(brandName, bgColor = '#0D0B1A', fgColor = '#FFFFFF') {
  const initial = brandName.charAt(0).toUpperCase();

  // 375x123 strip — large initial centered
  const letter375 = letterToSvgPaths(initial, 162, 22, 50, 80, fgColor);
  const strip375 = await sharp(Buffer.from(
    `<svg width="375" height="123" xmlns="http://www.w3.org/2000/svg">
      <rect width="375" height="123" fill="${bgColor}"/>
      <rect x="147" y="12" width="80" height="100" rx="16" fill="${fgColor}" opacity="0.1"/>${letter375}
    </svg>`
  )).png().toBuffer();

  // 750x246 strip (2x)
  const letter750 = letterToSvgPaths(initial, 325, 43, 100, 160, fgColor);
  const strip750 = await sharp(Buffer.from(
    `<svg width="750" height="246" xmlns="http://www.w3.org/2000/svg">
      <rect width="750" height="246" fill="${bgColor}"/>
      <rect x="295" y="23" width="160" height="200" rx="32" fill="${fgColor}" opacity="0.1"/>${letter750}
    </svg>`
  )).png().toBuffer();

  return { strip: strip375, strip2x: strip750 };
}

/**
 * Generate manifest.json with SHA1 hashes
 */
function generateManifest(files) {
  const manifest = {};

  Object.entries(files).forEach(([filename, buffer]) => {
    const sha1 = crypto.createHash('sha1');
    sha1.update(buffer);
    manifest[filename] = sha1.digest('hex');
  });

  return JSON.stringify(manifest);
}

/**
 * Sign the manifest using PKCS7 (mock mode if no certificates)
 */
function signManifest(manifestJson, certPath, keyPath, wwdrPath) {
  // Check if certificate files exist
  const hasCerts = fs.existsSync(certPath) && fs.existsSync(keyPath);

  if (!hasCerts) {
    console.warn('⚠️ MOCK MODE: pass not signed (install Apple certificate to enable)');
    // Return a fake signature
    return Buffer.from('UNSIGNED_MOCK_SIGNATURE');
  }

  try {
    // Read certificate and key
    const certPem = fs.readFileSync(certPath, 'utf8');
    const keyPem = fs.readFileSync(keyPath, 'utf8');
    let wwdrPem = null;

    if (wwdrPath && fs.existsSync(wwdrPath)) {
      wwdrPem = fs.readFileSync(wwdrPath, 'utf8');
    }

    // Convert PEM to forge objects
    const cert = forge.pki.certificateFromPem(certPem);
    const privateKey = forge.pki.privateKeyFromPem(keyPem);

    // Create PKCS7 signed data
    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(manifestJson, 'utf8');

    // Add signers
    p7.addCertificate(cert);
    if (wwdrPem) {
      const wwdrCert = forge.pki.certificateFromPem(wwdrPem);
      p7.addCertificate(wwdrCert);
    }

    // Sign
    p7.addSigner({
      key: privateKey,
      certificate: cert,
      digestAlgorithm: forge.pki.oids.sha256,
      authenticatedAttributes: [
        {
          type: forge.pki.oids.contentType,
          value: forge.pki.oids.data
        },
        {
          type: forge.pki.oids.messageDigest
        },
        {
          type: forge.pki.oids.signingTime,
          value: new Date()
        }
      ]
    });

    // Get DER encoded signature
    const signature = forge.asn1.toDer(p7.toAsn1()).bytes();
    return Buffer.from(signature, 'binary');
  } catch (error) {
    console.warn('⚠️ MOCK MODE: pass not signed (certificate error):', error.message);
    return Buffer.from('UNSIGNED_MOCK_SIGNATURE');
  }
}

/**
 * Create the complete .pkpass file
 */
async function createPkpass(template, instance, brand, options = {}) {
  const {
    baseUrl = 'http://localhost:3000',
    certPath = path.join(__dirname, '../../certs/signerCert.pem'),
    keyPath = path.join(__dirname, '../../certs/signerKey.pem'),
    wwdrPath = path.join(__dirname, '../../certs/wwdr.pem')
  } = options;

  // Generate pass.json
  const passJson = generatePassJson(template, instance, brand, { baseUrl });

  // Generate images - use brand.config colors first, then template.style, then defaults
  const brandCfg = brand.config || {};
  const bgColor = brandCfg.backgroundColor || template.style?.backgroundColor || '#0D0B1A';
  const fgColor = brandCfg.foregroundColor || template.style?.foregroundColor || '#FFFFFF';

  let iconBuffers, logoBuffers;

  // Check if brand has custom logo images (base64 in config)
  if (brand.config?.logos) {
    const brandLogos = brand.config.logos;
    iconBuffers = {
      icon: brandLogos['icon'] ? Buffer.from(brandLogos['icon'], 'base64') : null,
      icon2x: brandLogos['icon@2x'] ? Buffer.from(brandLogos['icon@2x'], 'base64') : null
    };
    logoBuffers = {
      logo: brandLogos['logo'] ? Buffer.from(brandLogos['logo'], 'base64') : null,
      logo2x: brandLogos['logo@2x'] ? Buffer.from(brandLogos['logo@2x'], 'base64') : null
    };
    console.log('✓ Using custom brand logos');
  }

  // Fall back to generated images if no custom logos
  if (!iconBuffers?.icon) {
    const icons = await generateIcon(brand.name, bgColor, fgColor);
    iconBuffers = icons;
  }
  if (!logoBuffers?.logo) {
    const logos = await generateLogo(brand.name, bgColor, fgColor);
    logoBuffers = logos;
  }

  const strips = await generateStrip(brand.name, bgColor, fgColor);

  // Build file map
  const files = {
    'pass.json': Buffer.from(JSON.stringify(passJson, null, 2)),
    'icon.png': iconBuffers.icon,
    'icon@2x.png': iconBuffers.icon2x || iconBuffers.icon,
    'logo.png': logoBuffers.logo,
    'logo@2x.png': logoBuffers.logo2x || logoBuffers.logo
  };

  // Add strip images for coupon/storeCard
  if (template.pass_type === 'coupon' || template.pass_type === 'storeCard') {
    files['strip.png'] = strips.strip;
    files['strip@2x.png'] = strips.strip2x;
  }

  // Generate manifest
  const manifestJson = generateManifest(files);
  const manifestBuffer = Buffer.from(manifestJson);
  files['manifest.json'] = manifestBuffer;

  // Sign manifest
  const signature = signManifest(manifestJson, certPath, keyPath, wwdrPath);
  files['signature'] = signature;

  // Create ZIP archive
  return new Promise((resolve, reject) => {
    const buffers = [];
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('data', (chunk) => {
      buffers.push(chunk);
    });

    archive.on('end', () => {
      resolve(Buffer.concat(buffers));
    });

    archive.on('error', (err) => {
      reject(err);
    });

    // Add files to archive
    Object.entries(files).forEach(([filename, buffer]) => {
      archive.append(buffer, { name: filename });
    });

    archive.finalize();
  });
}

/**
 * Generate default images for a brand (unused in createPkpass but available)
 */
async function generateDefaultImages(brandName, primaryColor = '#0D0B1A') {
  const fgColor = '#FFFFFF';
  const icons = await generateIcon(brandName, primaryColor, fgColor);
  const logos = await generateLogo(brandName, primaryColor, fgColor);
  const strips = await generateStrip(brandName, primaryColor, fgColor);

  return {
    icons,
    logos,
    strips
  };
}

module.exports = {
  generatePassJson,
  generateIcon,
  generateLogo,
  generateStrip,
  generateManifest,
  signManifest,
  createPkpass,
  generateDefaultImages
};
