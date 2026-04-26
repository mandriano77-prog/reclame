const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const archiver = require('archiver');
const forge = require('node-forge');
const { Transform } = require('stream');

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
        // Auto-distribute: first field = header, second = primary, rest = secondary/auxiliary
        if (index === 0) headerFields.push(fieldObj);
        else if (index === 1) primaryFields.push(fieldObj);
        else if (index <= 3) secondaryFields.push(fieldObj);
        else auxiliaryFields.push(fieldObj);
      }
    });
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
    logoText: brand.config?.logoText || brand.name,
    authenticationToken: instance.auth_token,
    webServiceURL: `${baseUrl}/api/v1`,
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

  return passJson;
}

/**
 * Generate icon PNG files with brand initial
 */
async function generateIcon(brandName, bgColor = '#0D0B1A', fgColor = '#FFFFFF') {
  const initial = brandName.charAt(0).toUpperCase();
  const bg = parseColor(bgColor);

  // Create a 29x29 icon with the initial
  const icon29 = await sharp({
    create: {
      width: 29,
      height: 29,
      channels: 4,
      background: { r: bg.r, g: bg.g, b: bg.b, alpha: 1 }
    }
  })
    .composite([
      {
        input: Buffer.from(
          `<svg width="29" height="29" xmlns="http://www.w3.org/2000/svg">
            <rect width="29" height="29" fill="${bgColor}"/>
            <text x="14.5" y="20" font-family="Helvetica" font-size="18" font-weight="bold" fill="${fgColor}" text-anchor="middle">${initial}</text>
          </svg>`
        ),
        top: 0,
        left: 0
      }
    ])
    .png()
    .toBuffer();

  // Create a 58x58 icon (2x density)
  const icon58 = await sharp({
    create: {
      width: 58,
      height: 58,
      channels: 4,
      background: { r: bg.r, g: bg.g, b: bg.b, alpha: 1 }
    }
  })
    .composite([
      {
        input: Buffer.from(
          `<svg width="58" height="58" xmlns="http://www.w3.org/2000/svg">
            <rect width="58" height="58" fill="${bgColor}"/>
            <text x="29" y="42" font-family="Helvetica" font-size="36" font-weight="bold" fill="${fgColor}" text-anchor="middle">${initial}</text>
          </svg>`
        ),
        top: 0,
        left: 0
      }
    ])
    .png()
    .toBuffer();

  return { icon: icon29, icon2x: icon58 };
}

/**
 * Generate logo PNG files
 */
async function generateLogo(brandName, bgColor = '#0D0B1A', fgColor = '#FFFFFF') {
  const bg = parseColor(bgColor);

  // 160x50 logo
  const logo160 = await sharp({
    create: {
      width: 160,
      height: 50,
      channels: 4,
      background: { r: bg.r, g: bg.g, b: bg.b, alpha: 1 }
    }
  })
    .composite([
      {
        input: Buffer.from(
          `<svg width="160" height="50" xmlns="http://www.w3.org/2000/svg">
            <rect width="160" height="50" fill="${bgColor}"/>
            <text x="80" y="35" font-family="Helvetica" font-size="24" font-weight="bold" fill="${fgColor}" text-anchor="middle">${brandName}</text>
          </svg>`
        ),
        top: 0,
        left: 0
      }
    ])
    .png()
    .toBuffer();

  // 320x100 logo (2x)
  const logo320 = await sharp({
    create: {
      width: 320,
      height: 100,
      channels: 4,
      background: { r: bg.r, g: bg.g, b: bg.b, alpha: 1 }
    }
  })
    .composite([
      {
        input: Buffer.from(
          `<svg width="320" height="100" xmlns="http://www.w3.org/2000/svg">
            <rect width="320" height="100" fill="${bgColor}"/>
            <text x="160" y="70" font-family="Helvetica" font-size="48" font-weight="bold" fill="${fgColor}" text-anchor="middle">${brandName}</text>
          </svg>`
        ),
        top: 0,
        left: 0
      }
    ])
    .png()
    .toBuffer();

  return { logo: logo160, logo2x: logo320 };
}

/**
 * Generate strip image (for coupon/storeCard)
 */
async function generateStrip(brandName, bgColor = '#0D0B1A', fgColor = '#FFFFFF') {
  const bg = parseColor(bgColor);

  // 375x123 strip
  const strip375 = await sharp({
    create: {
      width: 375,
      height: 123,
      channels: 4,
      background: { r: bg.r, g: bg.g, b: bg.b, alpha: 1 }
    }
  })
    .composite([
      {
        input: Buffer.from(
          `<svg width="375" height="123" xmlns="http://www.w3.org/2000/svg">
            <rect width="375" height="123" fill="${bgColor}"/>
            <text x="187.5" y="75" font-family="Helvetica" font-size="32" font-weight="bold" fill="${fgColor}" text-anchor="middle">${brandName}</text>
          </svg>`
        ),
        top: 0,
        left: 0
      }
    ])
    .png()
    .toBuffer();

  // 750x246 strip (2x)
  const strip750 = await sharp({
    create: {
      width: 750,
      height: 246,
      channels: 4,
      background: { r: bg.r, g: bg.g, b: bg.b, alpha: 1 }
    }
  })
    .composite([
      {
        input: Buffer.from(
          `<svg width="750" height="246" xmlns="http://www.w3.org/2000/svg">
            <rect width="750" height="246" fill="${bgColor}"/>
            <text x="375" y="150" font-family="Helvetica" font-size="64" font-weight="bold" fill="${fgColor}" text-anchor="middle">${brandName}</text>
          </svg>`
        ),
        top: 0,
        left: 0
      }
    ])
    .png()
    .toBuffer();

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
