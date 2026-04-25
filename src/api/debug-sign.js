const express = require('express');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const router = express.Router();

function cleanPem(pemString) {
  const matches = pemString.match(/-----BEGIN [^-]+-----[\s\S]+?-----END [^-]+-----/g);
  return matches ? matches.join('\n') : pemString;
}

router.get('/sign-test', (req, res) => {
  const certPath = path.join(__dirname, '../../certs/signerCert.pem');
  const keyPath = path.join(__dirname, '../../certs/signerKey.pem');
  const wwdrPath = path.join(__dirname, '../../certs/wwdr.pem');

  const result = {
    certExists: fs.existsSync(certPath),
    keyExists: fs.existsSync(keyPath),
    wwdrExists: fs.existsSync(wwdrPath),
    certSizeRaw: fs.existsSync(certPath) ? fs.statSync(certPath).size : 0,
    opensslVersion: '',
    methods: {}
  };

  try {
    result.opensslVersion = execSync('openssl version', { encoding: 'utf8' }).trim();
  } catch (e) {
    result.opensslVersion = 'NOT FOUND: ' + e.message;
  }

  if (!result.certExists || !result.keyExists) {
    return res.json(result);
  }

  // Clean PEMs
  const cleanCert = cleanPem(fs.readFileSync(certPath, 'utf8'));
  const cleanKey = cleanPem(fs.readFileSync(keyPath, 'utf8'));
  const cleanWwdr = fs.existsSync(wwdrPath) ? cleanPem(fs.readFileSync(wwdrPath, 'utf8')) : null;

  result.certSizeClean = cleanCert.length;
  result.keySizeClean = cleanKey.length;

  const manifest = '{"test.txt":"da39a3ee5e6b4b0d3255bfef95601890afd80709"}';
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'signtest-'));
  const mPath = path.join(tmpDir, 'manifest.json');
  const cPath = path.join(tmpDir, 'cert.pem');
  const kPath = path.join(tmpDir, 'key.pem');
  const wPath = path.join(tmpDir, 'wwdr.pem');
  const sPath = path.join(tmpDir, 'sig.der');

  fs.writeFileSync(mPath, manifest, 'utf8');
  fs.writeFileSync(cPath, cleanCert, 'utf8');
  fs.writeFileSync(kPath, cleanKey, 'utf8');
  if (cleanWwdr) fs.writeFileSync(wPath, cleanWwdr, 'utf8');

  // Test 1: openssl cms
  try {
    let cmd = 'openssl cms -sign -binary -in "' + mPath + '" -out "' + sPath + '" -outform DER -signer "' + cPath + '" -inkey "' + kPath + '"';
    if (cleanWwdr) cmd += ' -certfile "' + wPath + '"';
    execSync(cmd, { stdio: 'pipe', timeout: 15000 });
    const sig = fs.existsSync(sPath) ? fs.readFileSync(sPath) : null;
    result.methods.cms = { ok: !!sig, size: sig ? sig.length : 0 };
    if (fs.existsSync(sPath)) fs.unlinkSync(sPath);
  } catch (e) {
    result.methods.cms = { ok: false, error: e.stderr ? e.stderr.toString().trim() : e.message };
  }

  // Test 2: openssl smime
  try {
    let cmd = 'openssl smime -sign -binary -in "' + mPath + '" -out "' + sPath + '" -outform DER -signer "' + cPath + '" -inkey "' + kPath + '" -passin pass:';
    if (cleanWwdr) cmd += ' -certfile "' + wPath + '"';
    execSync(cmd, { stdio: 'pipe', timeout: 15000 });
    const sig = fs.existsSync(sPath) ? fs.readFileSync(sPath) : null;
    result.methods.smime = { ok: !!sig, size: sig ? sig.length : 0 };
    if (fs.existsSync(sPath)) fs.unlinkSync(sPath);
  } catch (e) {
    result.methods.smime = { ok: false, error: e.stderr ? e.stderr.toString().trim() : e.message };
  }

  // Cleanup
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}

  res.json(result);
});

module.exports = router;
