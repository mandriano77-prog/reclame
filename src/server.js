// Nudj MVP v2.1
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const { getDb } = require('./db');
const apiRoutes = require('./api/routes');
const debugSignRoutes = require('./api/debug-sign');
const { startScheduler } = require('./engine/scheduler');
const { runPlaytomicCron } = require('./engine/playtomic');
const { runStripPromoCheck } = require('./engine/strip-promo');
const { startRecapCrons } = require('./engine/email-recap');
const { startDecayCron } = require('./engine/points-decay');

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

// Force HTTPS in production (Railway terminates SSL at proxy)
app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] === 'http' && process.env.NODE_ENV !== 'development') {
    return res.redirect(301, 'https://' + req.headers.host + req.url);
  }
  next();
});

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

// Scratch card page — /scratch/:campaignId?m=memberId
app.get('/scratch/:campaignId', (req, res) => {
  res.sendFile(path.join(__dirname, 'scratch', 'index.html'));
});

// Health check + version
const BUILD_VERSION = '2.1.0-' + Date.now();
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: BUILD_VERSION, timestamp: new Date().toISOString() });
});

// Root redirect
app.get('/', (req, res) => {
  res.redirect('/dashboard/');
});

// Privacy policy page
app.get('/privacy/:slugOrId', (req, res) => {
  res.sendFile(path.join(__dirname, 'privacy', 'index.html'));
});

// Short URL: /:slug serves the landing page for that brand
// Must be AFTER all other routes to avoid conflicts
app.get('/:slug', (req, res, next) => {
  const slug = req.params.slug;
  // Skip if it looks like a file or known route
  if (slug.includes('.') || ['api', 'dashboard', 'landing', 'debug', 'health', 'privacy', 'scratch'].includes(slug)) {
    return next();
  }
  // Serve the landing page — it will detect the slug from the URL
  res.sendFile(path.join(__dirname, 'landing', 'index.html'));
});

// Initialize database and start server
getDb().then(db => {
  app.locals.db = db;
  app.listen(PORT, () => {
    console.log('\n\uD83D\uDE80 Nudj MVP server running on port ' + PORT);
    console.log('  Health: http://localhost:' + PORT + '/health');
    console.log('  API:    http://localhost:' + PORT + '/api/v1');
    console.log('  Debug:  http://localhost:' + PORT + '/debug/sign-test');

    // Start push notification scheduler
    const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : `http://localhost:${PORT}`;
    startScheduler(baseUrl);

    // Playtomic sync cron — daily at 10:00 AM (reads previous day's completed bookings)
    // Uses 7-day window so missed days are auto-recovered
    function schedulePlaytomicDaily() {
      const now = new Date();
      const next10am = new Date(now);
      next10am.setHours(10, 0, 0, 0);
      // If 10:00 already passed today, schedule for tomorrow
      if (now >= next10am) next10am.setDate(next10am.getDate() + 1);
      const msUntil = next10am.getTime() - now.getTime();
      console.log(`🎾 Playtomic sync scheduled at 10:00 AM (in ${Math.round(msUntil / 60000)} min)`);
      setTimeout(() => {
        runPlaytomicCron();
        // After first run, repeat every 24h
        setInterval(() => runPlaytomicCron(), 24 * 60 * 60 * 1000);
      }, msUntil);
    }
    schedulePlaytomicDaily();

    // Strip Promo cron — check every hour for active/expired promos
    console.log('🎨 Strip Promo scheduler started (every 60 min)');
    setInterval(() => runStripPromoCheck(), 60 * 60 * 1000);
    // Run once at startup (after 30 sec delay to let DB finish migrations)
    setTimeout(() => runStripPromoCheck(), 30 * 1000);

    // Email recap cron — weekly (Mon 9:00) and monthly (1st 9:00)
    startRecapCrons();

    // Points decay cron — 1st of every month at 3:00 AM
    startDecayCron();
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
