const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const archiver = require('archiver');
const forge = require('node-forge');
const { execSync } = require('child_process');
const os = require('os');
const { Transform } = require('stream');

/**
 * Generate the pass.json content for Apple Wallet
 */
function generatePassJson(template, instance, brand, options = {}) {
  const {
    baseUrl = process.env.BASE_URL || 'http://localhost:3000',
    passTypeIdentifier = process.env.PASS_TYPE_IDENTIFIER || 'pass.com.nudj',
    teamIdentifier = process.env.TEAM_IDENTIFIER || '9Y847NT854'
  } = options;

  const foregroundColor = template.style?.foregroundColor || 'rgb(255, 255, 255)';
  const backgroundColor = template.style?.backgroundColor || 'rgb(13, 11, 26)';
  const labelColor = template.style?.labelColor || 'rgb(0, 212, 170)';

  // Build field arrays based on template
  const headerFields = [];
  const primaryFields = [];
  const secondaryFields = [];
  const auxiliaryFields = [];
  const backFields = [];

  if (template.fields && Array.isArray(template.fields)) {
    template.fields.forEach(field => {
      const fieldObj = {
        key: field.key,
        label: field.label || field.key,
        value: instance.field_values?.[field.key] || field.value || ''
      };

      if (field.dateStyle) {
        fieldObj.dateStyle = field.dateStyle;
      }

      switch (field.type) {
        case 'header':
          headerFields.push(fieldObj);
          break;
        case 'primary':
          primaryFields.push(fieldObj);
          break;
        case 'secondary':
          secondaryFields.push(fieldObj);
          break;
        case 'auxiliary':
          auxiliaryFields.push(fieldObj);
          break;
        case 'back':
          backFields.push(fieldObj);
          break;
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
    logoText: brand.name,
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

  // Create a 29x29 icon with the initial
  const icon29 = await sharp({
    create: {
      width: 29,
      height: 29,
      channels: 4,
      background: { r: 13, g: 11, b: 26, alpha: 1 }
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
      background: { r: 13, g: 11, b: 26, alpha: 1 }
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
  // 160x50 logo
  const logo160 = await sharp({
    create: {
      width: 160,
      height: 50,
      channels: 4,
      background: { r: 13, g: 11, b: 26, alpha: 1 }
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
      background: { r: 13, g: 11, b: 26, alpha: 1 }
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
  // 375x123 strip
  const strip375 = await sharp({
    create: {
      width: 375,
      height: 123,
      channels: 4,
      background: { r: 13, g: 11, b: 26, alpha: 1 }
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
      background: { r: 13, g: 11, b: 26, alpha: 1 }
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
 * Strip Bag Attributes and other non-PEM content from certificate/key files.
 * Keychain exports include metadata that can confuse some parsers.
 */
function cleanPem(pemString) {
  const matches = pemString.match(/-----BEGIN [^-]+-----[\s\S]+?-----END [^-]+-----/g);
  return matches ? matches.join('\n') : pemString;
}

/**
 * Sign the manifest with cascading methods:
 * 1. openssl cms  (modern, works on OpenSSL 3.x)
 * 2. openssl smime (legacy fallback)
 * 3. node-forge   (pure JS, last resort)
 */
function signManifest(manifestJson, certPath, keyPath, wwdrPath) {
  const hasCerts = fs.existsSync(certPath) && fs.existsSync(keyPath);

  if (!hasCerts) {
    console.warn('â ï¸ MOCK MODE: pass not signed (install Apple certificate to enable)');
    return Buffer.from('UNSIGNED_MOCK_SIGNATURE');
  }

  // --- Method 1: openssl cms (preferred on OpenSSL 3.x) ---
  try {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkpass-'));
    const mPath = path.join(tmpDir, 'manifest.json');
    const sPath = path.join(tmpDir, 'signature.der');
    fs.writeFileSync(mPath, manifestJson, 'utf8');

    let cmd = `openssl cms -sign -binary -in "${mPath}" -out "${sPath}" -outform DER -signer "${certPath}" -inkey "${keyPath}"`;
    if (wwdrPath && fs.existsSync(wwdrPath)) {
      cmd += ` -certfile "${wwdrPath}"`;
    }

    execSync(cmd, { stdio: 'pipe', timeout: 15000 });

    if (fs.existsSync(sPath)) {
      const sig = fs.readFileSync(sPath);
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
      console.log(`â Pass signed with openssl cms (${sig.length} bytes)`);
      return sig;
    }
  } catch (e) {
    console.warn('openssl cms failed:', e.stderr ? e.stderr.toString().trim() : e.message);
  }

  // --- Method 2: openssl smime (legacy) ---
  try {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkpass-'));
    const mPath = path.join(tmpDir, 'manifest.json');
    const sPath = path.join(tmpDir, 'signature.der');
    fs.writeFileSync(mPath, manifestJson, 'utf8');

    let cmd = `openssl smime -sign -binary -in "${mPath}" -out "${sPath}" -outform DER -signer "${certPath}" -inkey "${keyPath}" -passin pass:`;
    if (wwdrPath && fs.existsSync(wwdrPath)) {
      cmd += ` -certfile "${wwdrPath}"`;
    }

    execSync(cmd, { stdio: 'pipe', timeout: 15000 });

    if (fs.existsSync(sPath)) {
      const sig = fs.readFileSync(sPath);
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
      console.log(`â Pass signed with openssl smime (${sig.length} bytes)`);
      return sig;
    }
  } catch (e) {
    console.warn('openssl smime failed:', e.stderr ? e.stderr.toString().trim() : e.message);
  }

  // --- Method 3: node-forge pure JavaScript ---
  try {
    const certPem = cleanPem(fs.readFileSync(certPath, 'utf8'));
    const keyPem = cleanPem(fs.readFileSync(keyPath, 'utf8'));
    const signerCert = forge.pki.certificateFromPem(certPem);
    const signerKey = forge.pki.privateKeyFromPem(keyPem);

    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(manifestJson, 'utf8');
    p7.addCertificate(signerCert);

    if (wwdrPath && fs.existsSync(wwdrPath)) {
      const wwdrPem = cleanPem(fs.readFileSync(wwdrPath, 'utf8'));
      const wwdrCert = forge.pki.certificateFromPem(wwdrPem);
      p7.addCertificate(wwdrCert);
    }

    p7.addSigner({
      key: signerKey,
      certificate: signerCert,
      digestAlgorithm: forge.pki.oids.sha256,
      authenticatedAttributes: [
        { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
        { type: forge.pki.oids.messageDigest },
        { type: forge.pki.oids.signingTime, value: new Date() }
      ]
    });

    p7.sign({ detached: true });
    const asn1 = p7.toAsn1();
    const der = forge.asn1.toDer(asn1);
    const signature = Buffer.from(der.getBytes(), 'binary');

    console.log(`â Pass signed with node-forge (${signature.length} bytes)`);
    return signature;
  } catch (error) {
    console.error('All signing methods failed. Last error:', error.message);
    console.warn('â ï¸ MOCK MODE: pass not signed (signing error)');
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

  // Generate images
  const bgColor = template.style?.backgroundColor || '#0D0B1A';
  const fgColor = template.style?.foregroundColor || '#FFFFFF';

  const icons = await generateIcon(brand.name, bgColor, fgColor);
  const logos = await generateLogo(brand.name, bgColor, fgColor);
  const strips = await generateStrip(brand.name, bgColor, fgColor);

  // Build file map
  const files = {
    'pass.json': Buffer.from(JSON.stringify(passJson, null, 2)),
    'icon.png': icons.icon,
    'icon@2x.png': icons.icon2x,
    'logo.png': logos.logo,
    'logo@2x.png': logos.logo2x
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

  // Create ZIP archive (STORED, no compression - required by Apple Wallet)
  return new Promise((resolve, reject) => {
    const buffers = [];
    const archive = archiver('zip', { store: true });

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
