// Nudj MVP v2.1
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const { getDb } = require('./db');
const apiRoutes = require('./api/routes');
const debugSignRoutes = require('./api/debug-sign');

// Load certificates: prefer FILE-BASED certs (from repo), fallback to env vars
function loadCerts() {
  const certDir = path.join(__dirname, '..', 'certs');
  if (!fs.existsSync(certDir)) fs.mkdirSync(certDir, { recursive: true });

  const certFile = path.join(certDir, 'signerCert.pem');
  const keyFile = path.join(certDir, 'signerKey.pem');
  const wwdrFile = path.join(certDir, 'wwdr.pem');

  if (fs.existsSync(certFile) && fs.existsSync(keyFile)) {
    console.log('\u2713 Certificates loaded from files (repo)');
  } else if (process.env.SIGNER_CERT_BASE64) {
    fs.writeFileSync(certFile, Buffer.from(process.env.SIGNER_CERT_BASE64, 'base64'));
    fs.writeFileSync(keyFile, Buffer.from(process.env.SIGNER_KEY_BASE64, 'base64'));
    if (process.env.WWDR_CERT_BASE64) {
      fs.writeFileSync(wwdrFile, Buffer.from(process.env.WWDR_CERT_BASE64, 'base64'));
    }
    console.log('\u2713 Certificates loaded from environment variables');
  } else {
    console.warn('\u26A0\uFE0F No certificates found \u2014 mock signing mode');
  }
}

loadCerts();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Trust reverse proxy (Railway, Heroku, etc.) for correct req.protocol
app.set('trust proxy', true);

// Middleware
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// API routes
app.use('/api/v1', apiRoutes);
app.use('/debug', debugSignRoutes);

// Landing page (static files)
app.use('/landing', express.static(path.join(__dirname, 'landing')));
app.use('/dashboard', express.static(path.join(__dirname, 'dashboard')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root redirect
app.get('/', (req, res) => {
  res.redirect('/dashboard/');
});

// Initialize database and start server
getDb().then(db => {
  app.locals.db = db;
  app.listen(PORT, () => {
    console.log('\n\uD83D\uDE80 Nudj MVP server running on port ' + PORT);
    console.log('  Health: http://localhost:' + PORT + '/health');
    console.log('  API:    http://localhost:' + PORT + '/api/v1');
    console.log('  Debug:  http://localhost:' + PORT + '/debug/sign-test');
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
