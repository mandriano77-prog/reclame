const express = require('express');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

const router = express.Router();

function cleanPem(pem) {
  const lines = pem.split('\n');
  const cleaned = [];
  let inBlock = false;
  for (const line of lines) {
    if (line.startsWith('-----BEGIN')) { inBlock = true; cleaned.push(line); continue; }
    if (line.startsWith('-----END')) { cleaned.push(line); inBlock = false; continue; }
    if (inBlock && !line.startsWith('Bag Attributes') && !line.match(/^\s*(friendlyName|localKeyID|subject|issuer|Key Fingerprint)/) && !line.match(/^\s+[0-9A-Fa-f]{2}\s/) && line.trim() !== '') {
      cleaned.push(line);
    }
  }
  return cleaned.join('\n');
}

router.get('/sign-test', (req, res) => {
  try {
    const certDir = path.join(__dirname, '../../certs');
    const certPath = path.join(certDir, 'signerCert.pem');
    const keyPath = path.join(certDir, 'signerKey.pem');
    const wwdrPath = path.join(certDir, 'wwdr.pem');

    const certExists = fs.existsSync(certPath);
    const keyExists = fs.existsSync(keyPath);
    const wwdrExists = fs.existsSync(wwdrPath);

    const certRaw = certExists ? fs.readFileSync(certPath, 'utf8') : '';
    const keyRaw = keyExists ? fs.readFileSync(keyPath, 'utf8') : '';
    const certClean = cleanPem(certRaw);
    const keyClean = cleanPem(keyRaw);

    const certB64 = certClean.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
    const keyB64 = keyClean.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');

    const result = {
      certExists, keyExists, wwdrExists,
      certSizeRaw: certRaw.length,
      certSizeClean: certClean.length,
      keySizeClean: keyClean.length,
      certB64Start: certB64.substring(0, 44),
      certB64End: certB64.substring(certB64.length - 44),
      keyB64Start: keyB64.substring(0, 44),
      keyB64End: keyB64.substring(keyB64.length - 44),
      certSHA256: crypto.createHash('sha256').update(certB64).digest('hex').substring(0, 16),
      keySHA256: crypto.createHash('sha256').update(keyB64).digest('hex').substring(0, 16),
      opensslVersion: '',
      certModulusMD5: '',
      keyModulusMD5: '',
      modulusMatch: false,
      expectedModulusMD5: 'e0c3301091ade69ed2d20b8bdddeb000',
      cmsResult: '',
      smimeResult: ''
    };

    try { result.opensslVersion = execSync('openssl version').toString().trim(); } catch(e) { result.opensslVersion = e.message; }

    const tmpDir = '/tmp/debug-sign-' + Date.now();
    fs.mkdirSync(tmpDir, { recursive: true });
    const cPath = path.join(tmpDir, 'cert.pem');
    const kPath = path.join(tmpDir, 'key.pem');
    const wPath = path.join(tmpDir, 'wwdr.pem');
    const mPath = path.join(tmpDir, 'manifest.json');

    fs.writeFileSync(cPath, certClean, 'utf8');
    fs.writeFileSync(kPath, keyClean, { mode: 0o600 });
    if (wwdrExists) fs.writeFileSync(wPath, cleanPem(fs.readFileSync(wwdrPath, 'utf8')), 'utf8');
    fs.writeFileSync(mPath, JSON.stringify({ test: 'hello' }));

    // MODULUS HASH - key diagnostic
    try {
      const certMod = execSync('openssl x509 -in ' + cPath + ' -noout -modulus 2>&1').toString().trim();
      result.certModulusMD5 = crypto.createHash('md5').update(certMod).digest('hex');
    } catch(e) { result.certModulusMD5 = 'ERROR: ' + e.message.substring(0, 200); }

    try {
      const keyMod = execSync('openssl rsa -in ' + kPath + ' -noout -modulus 2>&1').toString().trim();
      result.keyModulusMD5 = crypto.createHash('md5').update(keyMod).digest('hex');
    } catch(e) { result.keyModulusMD5 = 'ERROR: ' + e.message.substring(0, 200); }

    result.modulusMatch = (result.certModulusMD5 === result.keyModulusMD5 && !result.certModulusMD5.startsWith('ERROR'));

    // CMS signing test
    try {
      const wwdrFlag = wwdrExists ? ' -certfile ' + wPath : '';
      execSync('openssl cms -sign -binary -in ' + mPath + ' -signer ' + cPath + ' -inkey ' + kPath + wwdrFlag + ' -outform DER -out ' + tmpDir + '/sig.der 2>&1');
      const sigSize = fs.statSync(tmpDir + '/sig.der').size;
      result.cmsResult = 'OK (' + sigSize + ' bytes)';
    } catch(e) { result.cmsResult = 'FAIL: ' + (e.stdout ? e.stdout.toString().substring(0, 300) : e.message.substring(0, 300)); }

    // SMIME signing test
    try {
      const wwdrFlag = wwdrExists ? ' -certfile ' + wPath : '';
      execSync('openssl smime -sign -binary -in ' + mPath + ' -signer ' + cPath + ' -inkey ' + kPath + wwdrFlag + ' -outform DER -out ' + tmpDir + '/sig2.der 2>&1');
      const sigSize = fs.statSync(tmpDir + '/sig2.der').size;
      result.smimeResult = 'OK (' + sigSize + ' bytes)';
    } catch(e) { result.smimeResult = 'FAIL: ' + (e.stdout ? e.stdout.toString().substring(0, 300) : e.message.substring(0, 300)); }

    // Cleanup
    try { execSync('rm -rf ' + tmpDir); } catch(e) {}

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
