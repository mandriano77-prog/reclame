const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const { getDb } = require('./db');
const apiRoutes = require('./api/routes');

// Load certificates from env vars (base64) or fallback to files
function loadCerts() {
  const certDir = path.join(__dirname, '..', 'certs');
  if (!fs.existsSync(certDir)) fs.mkdirSync(certDir, { recursive: true });

  if (process.env.SIGNER_CERT_BASE64) {
    fs.writeFileSync(path.join(certDir, 'signerCert.pem'), Buffer.from(process.env.SIGNER_CERT_BASE64, 'base64'));
    fs.writeFileSync(path.join(certDir, 'signerKey.pem'), Buffer.from(process.env.SIGNER_KEY_BASE64, 'base64'));
    fs.writeFileSync(path.join(certDir, 'wwdr.pem'), Buffer.from(process.env.WWDR_CERT_BASE64, 'base64'));
    console.log('✓ Certificates loaded from environment');
  } else if (fs.existsSync(path.join(certDir, 'signerCert.pem'))) {
    console.log('✓ Certificates loaded from files');
  } else {
    console.warn('⚠️ No certificates found — mock signing mode');
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use('/dashboard', express.static(path.join(__dirname, 'dashboard')));
app.use('/landing', express.static(path.join(__dirname, 'landing')));

// Ensure database is initialized
(async () => {
  try {
    await getDb();
    console.log('✓ Database initialized');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }
})();

// API routes
app.use('/api/v1', apiRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root redirect
app.get('/', (req, res) => {
  res.redirect('/dashboard/');
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n╔═══════════════════════════════════════╗`);
  console.log(`║  Nudj MVP Server Started              ║`);
  console.log(`╠═══════════════════════════════════════╣`);
  console.log(`║  Server: http://localhost:${PORT}${' '.repeat(PORT.toString().length > 4 ? 0 : 4 - PORT.toString().length)}║`);
  console.log(`║  API:    http://localhost:${PORT}/api/v1${'  '.repeat(PORT.toString().length > 4 ? 0 : 1)} ║`);
  console.log(`║  Dashboard: http://localhost:${PORT}/dashboard/ ║`);
  console.log(`╚═══════════════════════════════════════╝\n`);
});

module.exports = app;
