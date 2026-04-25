const express = require('express');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const router = express.Router();

router.get('/sign-test', (req, res) => {
  const certPath = path.join(__dirname, '../../certs/signerCert.pem');
  const keyPath = path.join(__dirname, '../../certs/signerKey.pem');
  const wwdrPath = path.join(__dirname, '../../certs/wwdr.pem');

  const result = {
    certExists: fs.existsSync(certPath),
    keyExists: fs.existsSync(keyPath),
    wwdrExists: fs.existsSync(wwdrPath),
    certSize: 0,
    keySize: 0,
    tmpDir: os.tmpdir(),
    opensslVersion: '',
    certSubject: '',
    keyCheck: '',
    signResult: '',
    signError: ''
  };

  try { result.opensslVersion = execSync('openssl version', {encoding:'utf8'}).trim(); } catch(e) { result.opensslVersion = e.message; }
  try { result.certSize = fs.statSync(certPath).size; } catch(e) {}
  try { result.keySize = fs.statSync(keyPath).size; } catch(e) {}

  // Check cert
  try {
    result.certSubject = execSync('openssl x509 -in "' + certPath + '" -noout -subject 2>&1', {encoding:'utf8'}).trim();
  } catch(e) { result.certSubject = 'ERR:' + e.stderr; }

  // Check key
  try {
    result.keyCheck = execSync('openssl rsa -in "' + keyPath + '" -check -noout 2>&1', {encoding:'utf8'}).trim();
  } catch(e) { result.keyCheck = 'ERR:' + e.stderr; }

  // Try actual signing
  try {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st-'));
    const mf = path.join(tmp, 'm.json');
    const sf = path.join(tmp, 's.der');
    const cc = path.join(tmp, 'c.pem');
    const ck = path.join(tmp, 'k.pem');

    fs.writeFileSync(mf, '{"t":"d"}');

    // cleanPem
    function cleanPem(s) {
      const m = s.match(/-----BEGIN [^-]+-----[\s\S]+?-----END [^-]+-----/g);
      return m ? m.join('\n') : s;
    }

    fs.writeFileSync(cc, cleanPem(fs.readFileSync(certPath, 'utf8')));
    fs.writeFileSync(ck, cleanPem(fs.readFileSync(keyPath, 'utf8')));

    let cmd = 'openssl smime -sign -binary -in "' + mf + '" -out "' + sf + '" -outform DER -signer "' + cc + '" -inkey "' + ck + '"';

    if (fs.existsSync(wwdrPath)) {
      const cw = path.join(tmp, 'w.pem');
      fs.writeFileSync(cw, cleanPem(fs.readFileSync(wwdrPath, 'utf8')));
      cmd += ' -certfile "' + cw + '"';
    }

    result.signCmd = cmd;
    const out = execSync(cmd + ' 2>&1', {encoding:'utf8'});
    const sigSize = fs.statSync(sf).size;
    result.signResult = 'OK: ' + sigSize + ' bytes';

    // Also check cleaned cert content
    result.cleanCertStart = fs.readFileSync(cc, 'utf8').substring(0, 60);
    result.cleanKeyStart = fs.readFileSync(ck, 'utf8').substring(0, 60);

    fs.rmSync(tmp, {recursive: true});
  } catch(e) {
    result.signError = e.message + ' | stderr: ' + (e.stderr || 'none');
  }

  res.json(result);
});

module.exports = router;
