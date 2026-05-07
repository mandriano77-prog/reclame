// Ads2Wallet MVP v1.0
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const { getDb } = require('./db');
const apiRoutes = require('./api/routes');
const debugSignRoutes = require('./api/debug-sign');
const { startScheduler } = require('./engine/scheduler');
const { runStripPromoCheck } = require('./engine/strip-promo');

// Load certificates: prefer FILE-BASED certs (from repo), fallback to env vars
function loadCerts() {
  const certDir = path.join(__dirname, '..', 'certs');
  if (!fs.existsSync(certDir)) fs.mkdirSync(certDir, { recursive: true });

  const certFile = path.join(certDir, 'signerCert.pem');
  const keyFile = path.join(certDir, 'signerKey.pem');
  const wwdrFile = path.join(certDir, 'wwdr.pem');

  if (fs.existsSync(certFile) && fs.existsSync(keyFile)) {
    console.log('✓ Certificates loaded from files (repo)');
  } else if (process.env.SIGNER_CERT_BASE64) {
    fs.writeFileSync(certFile, Buffer.from(process.env.SIGNER_CERT_BASE64, 'base64'));
    fs.writeFileSync(keyFile, Buffer.from(process.env.SIGNER_KEY_BASE64, 'base64'));
    if (process.env.WWDR_CERT_BASE64) {
      fs.writeFileSync(wwdrFile, Buffer.from(process.env.WWDR_CERT_BASE64, 'base64'));
    }
    console.log('✓ Certificates loaded from environment variables');
  } else {
    console.warn('⚠️ No certificates found — mock signing mode');
  }
}

loadCerts();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Trust reverse proxy (Nginx, DigitalOcean App Platform load balancer, etc.) for correct req.protocol
app.set('trust proxy', true);

// Force HTTPS in production
app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] === 'http' && process.env.NODE_ENV !== 'development') {
    return res.redirect(301, 'https://' + req.headers.host + req.url);
  }
  next();
});

// Middleware
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Apple Wallet debug (public, no auth) — must be before debug router
app.get('/debug/wallet-check', async (req, res) => {
  try {
    const { pool } = require('./db');
    const deviceCount = await pool.query('SELECT COUNT(*) as count FROM device_registrations');
    const passCount = await pool.query('SELECT COUNT(*) as count FROM pass_instances');
    const recentEvents = await pool.query("SELECT event_type, metadata, created_at FROM events WHERE event_type IN ('pass_installed','pass_removed','pass_created') ORDER BY created_at DESC LIMIT 20");
    const devices = await pool.query('SELECT device_library_id, push_token, serial_number FROM device_registrations LIMIT 10');
    // Check what baseUrl would be used for new passes
    const effectiveBaseUrl = process.env.CUSTOM_DOMAIN
      ? `https://${process.env.CUSTOM_DOMAIN}`
      : (process.env.RAILWAY_PUBLIC_DOMAIN
        ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
        : 'https://localhost:3000');

    // Check auth tokens in recent passes
    const recentPasses = await pool.query('SELECT id, serial_number, auth_token, created_at FROM pass_instances ORDER BY created_at DESC LIMIT 5');

    res.json({
      status: 'ok',
      env: {
        CUSTOM_DOMAIN: process.env.CUSTOM_DOMAIN || '(not set)',
        RAILWAY_PUBLIC_DOMAIN: process.env.RAILWAY_PUBLIC_DOMAIN || '(not set)',
        PASS_TYPE_IDENTIFIER: process.env.PASS_TYPE_IDENTIFIER || '(not set, fallback: pass.com.nudj)',
        TEAM_IDENTIFIER: process.env.TEAM_IDENTIFIER ? 'set' : '(not set)'
      },
      effective_baseUrl: effectiveBaseUrl,
      webServiceURL_in_new_passes: `${effectiveBaseUrl}/api`,
      apple_will_call: `${effectiveBaseUrl}/api/v1/devices/{did}/registrations/{ptid}/{sn}`,
      registered_devices: parseInt(deviceCount.rows[0].count),
      total_passes: parseInt(passCount.rows[0].count),
      recent_passes: recentPasses.rows.map(p => ({
        id: p.id,
        serial: p.serial_number?.substring(0, 12) + '...',
        auth_token: p.auth_token ? p.auth_token.substring(0, 8) + '...' : 'NULL',
        created: p.created_at
      })),
      devices: devices.rows.map(d => ({ device: d.device_library_id?.substring(0,12)+'...', token: d.push_token?.substring(0,12)+'...', serial: d.serial_number?.substring(0,12)+'...' })),
      recent_events: recentEvents.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API routes
app.use('/api/v1', apiRoutes);
app.use('/debug', debugSignRoutes);

// Static pages
app.use('/landing', express.static(path.join(__dirname, 'landing')));
app.use('/dashboard', express.static(path.join(__dirname, 'dashboard')));

// Health check + wallet debug
const BUILD_VERSION = '3.0.0-' + Date.now();
app.get('/health', async (req, res) => {
  const base = { status: 'ok', product: 'ads2wallet', version: BUILD_VERSION, timestamp: new Date().toISOString() };
  if (req.query.wallet) {
    try {
      const { pool } = require('./db');
      const dc = await pool.query('SELECT COUNT(*) as count FROM device_registrations');
      const pc = await pool.query('SELECT COUNT(*) as count FROM pass_instances');
      const ev = await pool.query("SELECT event_type, metadata, created_at FROM events WHERE event_type IN ('pass_installed','pass_removed','pass_created') ORDER BY created_at DESC LIMIT 15");
      const dv = await pool.query('SELECT device_library_id, push_token, serial_number FROM device_registrations LIMIT 10');
      base.wallet = {
        webServiceURL: `https://${process.env.CUSTOM_DOMAIN || 'localhost:3000'}/api`,
        registered_devices: parseInt(dc.rows[0].count),
        total_passes: parseInt(pc.rows[0].count),
        devices: dv.rows.map(d => ({ device: d.device_library_id?.substring(0,12), token: d.push_token?.substring(0,12), serial: d.serial_number?.substring(0,12) })),
        recent_events: ev.rows
      };
    } catch (e) { base.wallet_error = e.message; }
  }
  res.json(base);
});

// Root redirect
app.get('/', (req, res) => {
  res.redirect('/dashboard/');
});

// Privacy policy
app.get('/privacy/:slugOrId', (req, res) => {
  res.sendFile(path.join(__dirname, 'privacy', 'index.html'));
});

// ─── Instant Win game page ──────────────────────────────────
app.get('/play/:serial_number', (req, res) => {
  res.sendFile(path.join(__dirname, 'play', 'index.html'));
});

// ─── Gamification game pages ──────────────────────────────────
app.get('/game/quiz/:serial_number', (req, res) => {
  res.sendFile(path.join(__dirname, 'game', 'quiz.html'));
});
app.get('/game/memory/:serial_number', (req, res) => {
  res.sendFile(path.join(__dirname, 'game', 'memory.html'));
});
app.get('/game/puzzle/:serial_number', (req, res) => {
  res.sendFile(path.join(__dirname, 'game', 'puzzle.html'));
});

// ─── Direct Save — skip landing, serve .pkpass immediately ──────────────
// URL: /save/{slug}/{campaignId}?utm_source=instagram&utm_medium=story&...
// For social/digital ads: ad CTA → this URL → iOS opens pass preview → done
const {
  getBrandBySlug, getCampaign, getTemplate, listTemplates,
  createPassInstance, logEvent, incrementCampaignDownloads
} = require('./db');
const { createPkpass } = require('./engine/passkit');

app.get('/save/:slug/:campaignId?', async (req, res) => {
  try {
    const { slug, campaignId } = req.params;
    const brand = await getBrandBySlug(slug);
    if (!brand) return res.status(404).send('Brand non trovato');

    // Find template (campaign-specific or first available)
    let template = null;
    if (campaignId) {
      const campaign = await getCampaign(campaignId);
      if (campaign && campaign.template_id) {
        template = await getTemplate(campaign.template_id);
      }
    }
    if (!template) {
      const templates = await listTemplates(brand.id);
      template = templates[0];
    }
    if (!template) return res.status(400).send('Nessun template configurato');

    // Build UTM from query params
    const utm = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(k => {
      if (req.query[k]) utm[k.replace('utm_', '')] = req.query[k];
    });

    // Create anonymous pass with browser metadata
    const passInstance = await createPassInstance({
      template_id: template.id,
      brand_id: brand.id,
      campaign_id: campaignId || null,
      field_values: {},
      utm,
      user_agent: req.headers['user-agent'] || null,
      referrer_url: req.headers['referer'] || null
    });

    await logEvent({ pass_id: passInstance.id, brand_id: brand.id, event_type: 'pass_created', metadata: { source: 'direct_save', campaign_id: campaignId, utm } });
    if (campaignId) await incrementCampaignDownloads(campaignId);

    // Serve confirmation page that auto-downloads the .pkpass via API
    const brandName = brand.name || slug;
    const bgColor = brand.config?.backgroundColor || '#0D0B1A';
    const fgColor = brand.config?.foregroundColor || '#FFFFFF';
    const accentColor = brand.config?.labelColor || '#00D4AA';
    const passDownloadUrl = `/api/v1/passes/${passInstance.id}/download`;
    const logoUrl = `/api/v1/brands/by-slug/${encodeURIComponent(slug)}/logo?t=${Date.now()}`;

    res.send(`<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <meta name="theme-color" content="${bgColor}">
  <title>${brandName} · Pass Wallet</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif;
      background: ${bgColor}; color: ${fgColor};
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      text-align: center; padding: 40px 24px; max-width: 400px; width: 100%;
    }
    .logo-area {
      width: 160px; height: 60px; margin: 0 auto 32px;
      display: flex; align-items: center; justify-content: center;
    }
    .logo-area img { max-width: 100%; max-height: 100%; object-fit: contain; }
    .logo-letter {
      width: 56px; height: 56px; border-radius: 14px;
      background: ${accentColor}22; border: 2px solid ${accentColor}44;
      display: flex; align-items: center; justify-content: center;
      font-size: 28px; font-weight: 700; color: ${accentColor};
    }
    .icon-circle {
      width: 72px; height: 72px; border-radius: 50%;
      background: ${accentColor}18; border: 2px solid ${accentColor}55;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 24px;
      animation: pulse 2s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.05); opacity: 0.9; }
    }
    .icon-circle .check { font-size: 36px; }
    .state-loading .icon-circle { animation: pulse 1s ease-in-out infinite; }
    .state-success .icon-circle { animation: none; }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 10px; line-height: 1.3; }
    .subtitle {
      font-size: 15px; opacity: 0.6; line-height: 1.5; margin-bottom: 28px;
    }
    .cta-btn {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 14px 32px; border-radius: 50px; border: none;
      background: ${accentColor}; color: ${bgColor};
      font-size: 16px; font-weight: 600; cursor: pointer;
      text-decoration: none; transition: all 0.2s;
    }
    .cta-btn:hover { opacity: 0.9; transform: translateY(-1px); }
    .cta-btn svg { width: 20px; height: 20px; }
    .footer { margin-top: 48px; opacity: 0.3; font-size: 11px; letter-spacing: 0.05em; }
    .hidden { display: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo-area" id="logoArea">
      <div class="logo-letter" id="logoLetter">${brandName.charAt(0).toUpperCase()}</div>
    </div>

    <!-- Loading state -->
    <div id="stateLoading" class="state-loading">
      <div class="icon-circle">
        <span style="font-size:28px;">&#8987;</span>
      </div>
      <h1>Preparazione in corso...</h1>
      <p class="subtitle">Il tuo pass si sta scaricando</p>
    </div>

    <!-- Success state -->
    <div id="stateSuccess" class="hidden state-success">
      <div class="icon-circle">
        <span class="check">&#10003;</span>
      </div>
      <h1>Pass scaricato!</h1>
      <p class="subtitle">Apri il file e tocca <strong>Aggiungi</strong> per salvarlo nel tuo Apple Wallet. Da quel momento riceverai offerte e novit&agrave; direttamente sullo schermo.</p>
      <a href="${passDownloadUrl}" class="cta-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Scarica di nuovo
      </a>
    </div>

    <!-- Error state -->
    <div id="stateError" class="hidden">
      <div class="icon-circle" style="border-color: #ff4444;">
        <span style="font-size:32px; color:#ff4444;">&#10007;</span>
      </div>
      <h1>Ops, qualcosa non ha funzionato</h1>
      <p class="subtitle">Riprova tra qualche istante.</p>
      <a href="${passDownloadUrl}" class="cta-btn">Riprova download</a>
    </div>

    <div class="footer">Powered by Ads2Wallet</div>
  </div>

  <script>
    // Load brand logo
    const logoImg = new Image();
    logoImg.onload = () => {
      document.getElementById('logoLetter').style.display = 'none';
      const img = document.createElement('img');
      img.src = logoImg.src;
      img.alt = '${brandName.replace(/'/g, "\\'")}';
      document.getElementById('logoArea').appendChild(img);
    };
    logoImg.src = '${logoUrl}';

    // Auto-trigger pass download via hidden iframe (iOS opens native "Add to Wallet" sheet)
    // Then show success after a realistic delay
    (function() {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = '${passDownloadUrl}';
      document.body.appendChild(iframe);

      // Show success after pass has had time to generate + present the Wallet dialog
      setTimeout(() => {
        document.getElementById('stateLoading').classList.add('hidden');
        document.getElementById('stateSuccess').classList.remove('hidden');
      }, 3500);

      // Fallback: if page is still visible after 10s, something may have gone wrong
      // but keep success state (user may have added pass and come back)
    })();
  </script>
</body>
</html>`);

  } catch (err) {
    console.error('Direct save error:', err);
    res.status(500).send('Errore generazione pass');
  }
});

// Short URL: /:slug serves the landing page for that brand
app.get('/:slug', (req, res, next) => {
  const slug = req.params.slug;
  if (slug.includes('.') || ['api', 'dashboard', 'landing', 'debug', 'health', 'privacy', 'play', 'save', 'game'].includes(slug)) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'landing', 'index.html'));
});

// Initialize database and start server
getDb().then(db => {
  app.locals.db = db;
  app.listen(PORT, () => {
    console.log('\n🚀 Ads2Wallet server running on port ' + PORT);
    console.log('  Health: http://localhost:' + PORT + '/health');
    console.log('  API:    http://localhost:' + PORT + '/api/v1');

    // Start push notification scheduler (absolute URLs in scheduled jobs)
    const baseUrl =
      process.env.CUSTOM_DOMAIN
        ? `https://${process.env.CUSTOM_DOMAIN}`
        : process.env.RAILWAY_PUBLIC_DOMAIN
          ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
          : `http://localhost:${PORT}`;
    startScheduler(baseUrl);

    // Strip Promo cron — check every hour
    console.log('🎨 Strip Promo scheduler started (every 60 min)');
    setInterval(() => runStripPromoCheck(), 60 * 60 * 1000);
    setTimeout(() => runStripPromoCheck(), 30 * 1000);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
