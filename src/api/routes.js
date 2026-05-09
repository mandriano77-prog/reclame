const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const {
  createBrand, getBrand, getBrandBySlug, listBrands, updateBrand, deleteBrand,
  createTemplate, getTemplate, listTemplates, updateTemplate, deleteTemplate,
  createCampaign, getCampaign, listCampaigns, updateCampaign, deleteCampaign,
  incrementCampaignDownloads, incrementCampaignInstalls,
  createPassInstance, getPassInstance, getPassBySerial, updatePassInstance, touchPass, listPasses, deletePass,
  logEvent, listEvents,
  registerDevice, getDevicesForPass, getDevicesForBrand, unregisterDevice, getSerialsForDevice,
  getAnalytics, getCampaignAnalytics,
  logPush, listPushes, deletePush, clearPushHistory,
  createScheduledPush, listScheduledPush, getScheduledPush, updateScheduledPush, deleteScheduledPush,
  createStripPromo, listStripPromos, getStripPromo, updateStripPromo, deleteStripPromo,
  createUser, getUserByEmail, getUser, listUsers, updateUser, deleteUser, verifyPassword,
  createMedia, listMedia, getMedia, deleteMedia,
  logAdEvent, getAdStats, getAdTimeline,
  createCreativeAsset, getCreativeAsset, listCreativeAssets, deleteCreativeAsset,
  createInstantWinCampaign, getInstantWinCampaign, listInstantWinCampaigns,
  updateInstantWinCampaign, deleteInstantWinCampaign,
  createInstantWinPlay, listInstantWinPlays, countPlaysForUser, getInstantWinStats,
  createGamificationCampaign, getGamificationCampaign, listGamificationCampaigns,
  updateGamificationCampaign, deleteGamificationCampaign,
  createGamificationPlay, listGamificationPlays, countGamificationPlaysForUser, getGamificationStats,
  pool,
  updatePassDeviceId
} = require('../db');
const { createPkpass } = require('../engine/passkit');
const googleWallet = require('../engine/google-wallet');
const { getFormats, getFormat, generateWithFal, composeCreative } = require('../engine/creative-ai');
const { generateBanner, BANNER_TEMPLATES, IAB_FORMATS } = require('../engine/banner-builder');
const { generateVideo, cleanupVideo, VIDEO_FORMATS, VIDEO_TEMPLATES } = require('../engine/video-builder');
const { sendPushUpdate } = require('../engine/apns');
const { generateLandingCopy, generateCreativeCopy } = require('../engine/ai-copy');
const sharp = require('sharp');
const jwt = require('jsonwebtoken');
const { execFile } = require('child_process');
const os = require('os');

const router = express.Router();

/**
 * Convert a base64 PDF (first page) to base64 PNG using pdftoppm (poppler-utils).
 * If input is not a PDF (no %PDF header), returns it unchanged.
 */
async function pdfToPngIfNeeded(base64Data) {
  const buf = Buffer.from(base64Data, 'base64');
  // Check PDF magic bytes: %PDF
  if (buf.length < 4 || buf.toString('ascii', 0, 4) !== '%PDF') return base64Data;
  const tmpDir = os.tmpdir();
  const tmpId = `pdf-conv-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const pdfPath = path.join(tmpDir, `${tmpId}.pdf`);
  const outPrefix = path.join(tmpDir, tmpId);
  fs.writeFileSync(pdfPath, buf);
  try {
    await new Promise((resolve, reject) => {
      execFile('pdftoppm', ['-png', '-f', '1', '-l', '1', '-r', '300', '-singlefile', pdfPath, outPrefix], { timeout: 15000 }, (err) => {
        if (err) reject(err); else resolve();
      });
    });
    const pngPath = `${outPrefix}.png`;
    const pngBuf = fs.readFileSync(pngPath);
    // Cleanup
    try { fs.unlinkSync(pdfPath); } catch(e) {}
    try { fs.unlinkSync(pngPath); } catch(e) {}
    return pngBuf.toString('base64');
  } catch (err) {
    console.error('PDFÃÂÃÂ¢ÃÂÃÂÃÂÃÂPNG conversion error:', err.message);
    try { fs.unlinkSync(pdfPath); } catch(e) {}
    throw new Error('Impossibile convertire il PDF in immagine. Verifica che il file sia un PDF valido.');
  }
}

async function syncGoogleWalletObjectsForPasses({ brand, passes, message }) {
  if (!googleWallet.isConfigured()) return { attempted: 0, updated: 0, errors: 0, skipped: true };
  if (!Array.isArray(passes) || passes.length === 0) return { attempted: 0, updated: 0, errors: 0, skipped: false };

  let attempted = 0;
  let updated = 0;
  let errors = 0;

  for (const pass of passes) {
    if (!pass.google_wallet_object_id) continue;
    attempted++;
    try {
      const template = await getTemplate(pass.template_id);
      if (!template) continue;
      const passObject = googleWallet.buildPassObject(brand, template, pass, pass.customer_data || {});
      await googleWallet.createPassObjectOnServer(passObject);
      if (message) {
        await googleWallet.updatePassMessage(pass.serial_number, message);
      }
      updated++;
    } catch (err) {
      errors++;
      console.error('[GoogleWallet] Sync error for serial', pass.serial_number, err.message);
    }
  }

  return { attempted, updated, errors, skipped: false };
}

const JWT_SECRET = process.env.JWT_SECRET || 'nudj-secret-change-me-in-prod';
const JWT_EXPIRES = '7d';

// ============================================================================
// PUBLIC ENDPOINTS (before auth middleware)
// ============================================================================

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Auth ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email e password richiesti' });
    const user = await getUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'Credenziali non valide' });
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Credenziali non valide' });
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role, brand_id: user.brand_id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, brand_id: user.brand_id } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Errore login' });
  }
});

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Debug: Full push diagnostics ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ
router.get('/debug/push-diagnostics', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const certPath = process.env.CERT_PATH || path.join(__dirname, '../../certs/signerCert.pem');
    const keyPath = process.env.KEY_PATH || path.join(__dirname, '../../certs/signerKey.pem');

    const deviceCount = await pool.query('SELECT COUNT(*) as count FROM device_registrations');
    const passCount = await pool.query('SELECT COUNT(*) as count FROM pass_instances');
    const devices = await pool.query('SELECT device_library_id, push_token, serial_number, created_at FROM device_registrations ORDER BY created_at DESC LIMIT 20');
    const passes = await pool.query('SELECT id, serial_number, brand_id, auth_token, created_at FROM pass_instances ORDER BY created_at DESC LIMIT 20');
    const recentEvents = await pool.query("SELECT event_type, metadata, created_at FROM events ORDER BY created_at DESC LIMIT 30");

    // Check certs
    const certsExist = {
      signerCert: fs.existsSync(certPath),
      signerKey: fs.existsSync(keyPath),
      certPath,
      keyPath
    };

    // Check if serial_numbers match between passes and devices
    const orphanDevices = await pool.query(
      `SELECT dr.* FROM device_registrations dr
       LEFT JOIN pass_instances pi ON dr.serial_number = pi.serial_number
       WHERE pi.id IS NULL`
    );

    res.json({
      status: 'ok',
      build_version: '3.0.0-' + Date.now(),
      env: {
        CUSTOM_DOMAIN: process.env.CUSTOM_DOMAIN || 'NOT SET',
        PASS_TYPE_IDENTIFIER: process.env.PASS_TYPE_IDENTIFIER || 'NOT SET',
        TEAM_IDENTIFIER: process.env.TEAM_IDENTIFIER || 'NOT SET',
        APNS_ENV: process.env.APNS_ENV || 'production (default)',
        NODE_ENV: process.env.NODE_ENV || 'NOT SET'
      },
      webServiceURL_in_pass: `https://${process.env.CUSTOM_DOMAIN || 'localhost:3000'}/api`,
      apple_will_call: `https://${process.env.CUSTOM_DOMAIN || 'localhost:3000'}/api/v1/devices/{did}/registrations/{ptid}/{sn}`,
      certs: certsExist,
      counts: {
        registered_devices: parseInt(deviceCount.rows[0].count),
        total_passes: parseInt(passCount.rows[0].count),
        orphan_device_registrations: orphanDevices.rows.length
      },
      devices: devices.rows.map(d => ({
        device: d.device_library_id?.substring(0,16) + '...',
        token: d.push_token?.substring(0,16) + '...',
        serial: d.serial_number,
        created: d.created_at
      })),
      passes: passes.rows.map(p => ({
        id: p.id?.substring(0,12) + '...',
        serial: p.serial_number,
        brand: p.brand_id?.substring(0,12) + '...',
        auth_token_length: p.auth_token?.length,
        created: p.created_at
      })),
      recent_events: recentEvents.rows.map(e => ({
        type: e.event_type,
        meta: e.metadata,
        at: e.created_at
      })),
      troubleshooting: [
        'If registered_devices=0: pass in Wallet may have wrong webServiceURL',
        'Check that webServiceURL in pass.json is baseUrl/api (NOT /api/v1)',
        'Apple adds /v1/ prefix automatically',
        'Fix: delete pass from Wallet, re-download from dashboard, re-add',
        'If certs missing: push will silently fail'
      ]
    });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Brand lookup by slug (used by landing page) ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ
router.get('/brands/by-slug/:slug', async (req, res) => {
  try {
    const brand = await getBrandBySlug(req.params.slug);
    if (!brand) return res.status(404).json({ error: 'Brand non trovato' });
    // Strip heavy base64 data from public response ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ images served via dedicated endpoints
    const safeConfig = { ...(brand.config || {}) };
    delete safeConfig.logos;
    delete safeConfig.landingBg;
    res.json({ ...brand, config: safeConfig });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Brand logo by slug (public, for landing page) ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ
router.get('/brands/by-slug/:slug/logo', async (req, res) => {
  try {
    const brand = await getBrandBySlug(req.params.slug);
    if (!brand?.config?.logos?.['logo@2x']) return res.status(404).json({ error: 'Nessun logo' });
    const buf = Buffer.from(brand.config.logos['logo@2x'], 'base64');
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'no-cache, must-revalidate');
    res.send(buf);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Brand landing background by slug (public) ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ
router.get('/brands/by-slug/:slug/landing-bg', async (req, res) => {
  try {
    const brand = await getBrandBySlug(req.params.slug);
    if (!brand?.config?.landingBg) return res.status(404).json({ error: 'Nessuna immagine' });
    const buf = Buffer.from(brand.config.landingBg, 'base64');
    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'no-cache, must-revalidate');
    res.send(buf);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Anonymous signup ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ zero data, just download .pkpass ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ
router.post('/signup', async (req, res) => {
  try {
    const { brand_slug, campaign_id, utm } = req.body;
    if (!brand_slug) return res.status(400).json({ error: 'brand_slug richiesto' });

    // Find brand
    const brand = await getBrandBySlug(brand_slug);
    if (!brand) return res.status(404).json({ error: 'Brand non trovato' });

    // Find template (use campaign template if specified, otherwise first active template)
    let template = null;
    if (campaign_id) {
      const campaign = await getCampaign(campaign_id);
      if (campaign && campaign.template_id) {
        template = await getTemplate(campaign.template_id);
      }
    }
    if (!template) {
      const templates = await listTemplates(brand.id);
      template = templates[0];
    }
    if (!template) return res.status(400).json({ error: 'Nessun template configurato per questo brand' });

    // Create anonymous pass instance with browser metadata
    const passData = {
      template_id: template.id,
      brand_id: brand.id,
      campaign_id: campaign_id || null,
      field_values: {},
      utm: utm || {},
      user_agent: req.headers['user-agent'] || null,
      referrer_url: req.headers['referer'] || req.body.referrer || null
    };
    const passInstance = await createPassInstance(passData);

    // Log event
    await logEvent({ pass_id: passInstance.id, brand_id: brand.id, event_type: 'pass_created', metadata: { source: 'landing', campaign_id, utm } });

    // Increment campaign downloads
    if (campaign_id) await incrementCampaignDownloads(campaign_id);

    // Generate .pkpass
    const baseUrl = process.env.CUSTOM_DOMAIN
      ? `https://${process.env.CUSTOM_DOMAIN}`
      : `${req.protocol}://${req.get('host')}`;

    const pkpassBuffer = await createPkpass(template, passInstance, brand, {
      baseUrl,
      passTypeIdentifier: process.env.PASS_TYPE_IDENTIFIER || 'pass.com.nudj',
      teamIdentifier: process.env.TEAM_IDENTIFIER || 'YOUR_TEAM_ID'
    });

    res.set({
      'Content-Type': 'application/vnd.apple.pkpass',
      'Content-Disposition': `attachment; filename="${brand.slug || 'pass'}.pkpass"`,
      'Content-Length': pkpassBuffer.length
    });
    res.send(pkpassBuffer);

  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Errore creazione pass: ' + err.message });
  }
});
// ============================================================================
// GOOGLE WALLET SIGNUP â same flow as /signup but returns Google Wallet save link
// ============================================================================
router.post('/signup/google-wallet', async (req, res) => {
  try {
    if (!googleWallet.isConfigured()) {
      return res.status(501).json({ error: 'Google Wallet non configurato' });
    }

    const { brand_slug, campaign_id, utm } = req.body;
    if (!brand_slug) return res.status(400).json({ error: 'brand_slug richiesto' });

    const brand = await getBrandBySlug(brand_slug);
    if (!brand) return res.status(404).json({ error: 'Brand non trovato' });

    let template = null;
    if (campaign_id) {
      const campaign = await getCampaign(campaign_id);
      if (campaign && campaign.template_id) {
        template = await getTemplate(campaign.template_id);
      }
    }
    if (!template) {
      const templates = await listTemplates(brand.id);
      template = templates[0];
    }
    if (!template) return res.status(400).json({ error: 'Nessun template configurato' });

    // Create anonymous pass instance (same as Apple Wallet signup)
    const passData = {
      template_id: template.id,
      brand_id: brand.id,
      campaign_id: campaign_id || null,
      field_values: {},
      utm: utm || {},
      user_agent: req.headers['user-agent'] || null,
      referrer_url: req.headers['referer'] || req.body.referrer || null
    };
    const passInstance = await createPassInstance(passData);

    await logEvent({ pass_id: passInstance.id, brand_id: brand.id, event_type: 'pass_created', metadata: { source: 'landing_google', campaign_id, utm } });
    if (campaign_id) await incrementCampaignDownloads(campaign_id);

    // Create Google Wallet pass class + object and generate save link
    await googleWallet.createOrUpdatePassClass(brand, template);
    const passObject = googleWallet.buildPassObject(brand, template, passInstance, passInstance.customer_data || {});
    await googleWallet.createPassObjectOnServer(passObject);
    await updatePassInstance(passInstance.id, {
      google_wallet_object_id: passObject.id,
      google_wallet_saved: false,
      google_installed_at: null
    });
    const saveLink = googleWallet.generateSaveLink(passObject);

    await logEvent({ brand_id: brand.id, pass_id: passInstance.id, event_type: 'google_wallet_link_generated', metadata: {} });

    res.json({ save_link: saveLink, pass_id: passInstance.id });
  } catch (err) {
    console.error('Google Wallet signup error:', err);
    res.status(500).json({ error: 'Errore Google Wallet: ' + err.message });
  }
});

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Pass download ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ
router.get('/passes/:id/download', async (req, res) => {
  try {
    const passInstance = await getPassInstance(req.params.id);
    if (!passInstance) return res.status(404).json({ error: 'Pass non trovato' });
    const brand = await getBrand(passInstance.brand_id);
    const template = await getTemplate(passInstance.template_id);
    if (!brand || !template) return res.status(404).json({ error: 'Dati incompleti' });

    const baseUrl = process.env.CUSTOM_DOMAIN
      ? `https://${process.env.CUSTOM_DOMAIN}`
      : `${req.protocol}://${req.get('host')}`;

    const pkpassBuffer = await createPkpass(template, passInstance, brand, {
      baseUrl,
      passTypeIdentifier: process.env.PASS_TYPE_IDENTIFIER || 'pass.com.nudj',
      teamIdentifier: process.env.TEAM_IDENTIFIER || 'YOUR_TEAM_ID'
    });

    await logEvent({ pass_id: passInstance.id, brand_id: brand.id, event_type: 'pass_downloaded' });

    res.set({
      'Content-Type': 'application/vnd.apple.pkpass',
      'Content-Disposition': `attachment; filename="${brand.slug || 'pass'}.pkpass"`,
      'Content-Length': pkpassBuffer.length
    });
    res.send(pkpassBuffer);
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Apple Wallet Protocol ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ

// Log all Apple Wallet protocol calls for debugging
router.all('/devices/*', (req, res, next) => {
  console.log(`[Apple Wallet] ${req.method} ${req.originalUrl} | Auth: ${req.headers.authorization ? 'yes' : 'no'} | Body: ${JSON.stringify(req.body || {})}`);
  next();
});
router.all('/passes/:passTypeId/:serialNumber', (req, res, next) => {
  if (req.params.passTypeId && req.params.serialNumber && !req.path.includes('/download') && !req.path.includes('/regenerate')) {
    console.log(`[Apple Wallet] ${req.method} ${req.originalUrl} | Auth: ${req.headers.authorization ? 'yes' : 'no'}`);
  }
  next();
});

// Register device for push notifications
router.post('/devices/:deviceLibraryId/registrations/:passTypeId/:serialNumber', async (req, res) => {
  try {
    const { deviceLibraryId, serialNumber } = req.params;
    const pushToken = req.body.pushToken;
    console.log(`[Apple Wallet] REGISTER device=${deviceLibraryId.substring(0,8)}... serial=${serialNumber.substring(0,8)}... pushToken=${pushToken ? pushToken.substring(0,8)+'...' : 'MISSING'}`);
    if (!pushToken) return res.status(400).send();

    await registerDevice({ device_library_id: deviceLibraryId, push_token: pushToken, serial_number: serialNumber });
    await updatePassDeviceId(serialNumber, deviceLibraryId, 'apple');

    // Track install
    const pass = await getPassBySerial(serialNumber);
    if (pass) {
      await logEvent({ pass_id: pass.id, brand_id: pass.brand_id, event_type: 'pass_installed', device_id: deviceLibraryId });
      if (pass.campaign_id) await incrementCampaignInstalls(pass.campaign_id);
      console.log(`[Apple Wallet] ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Device registered for pass ${pass.id}`);
    } else {
      console.warn(`[Apple Wallet] ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ ÃÂÃÂ¯ÃÂÃÂ¸ÃÂÃÂ No pass found for serial ${serialNumber}`);
    }

    res.status(201).send();
  } catch (err) {
    console.error('[Apple Wallet] Registration error:', err);
    res.status(200).send(); // Apple expects 200 if already registered
  }
});

// Unregister device
router.delete('/devices/:deviceLibraryId/registrations/:passTypeId/:serialNumber', async (req, res) => {
  try {
    const { deviceLibraryId, serialNumber } = req.params;
    await unregisterDevice(deviceLibraryId, serialNumber);

    const pass = await getPassBySerial(serialNumber);
    if (pass) {
      await logEvent({ pass_id: pass.id, brand_id: pass.brand_id, event_type: 'pass_removed', device_id: deviceLibraryId });
      if (pass.device_source === 'apple') {
        const { rows } = await pool.query(
          'SELECT COUNT(*)::int AS c FROM device_registrations WHERE serial_number = $1',
          [serialNumber]
        );
        if (rows[0].c === 0) {
          await updatePassInstance(pass.id, { device_id: null, device_source: null });
        }
      }
    }

    res.status(200).send();
  } catch (err) {
    console.error('Device unregister error:', err);
    res.status(200).send();
  }
});

// Get serial numbers for device
router.get('/devices/:deviceLibraryId/registrations/:passTypeId', async (req, res) => {
  try {
    const tag = req.query.passesUpdatedSince || null;
    const serials = await getSerialsForDevice(req.params.deviceLibraryId, tag);
    if (serials.length === 0) return res.status(204).send();
    res.json({ serialNumbers: serials, lastUpdated: new Date().toISOString() });
  } catch (err) {
    console.error('Get serials error:', err);
    res.status(500).send();
  }
});

// Get latest pass (Apple Wallet refresh)
router.get('/passes/:passTypeId/:serialNumber', async (req, res) => {
  try {
    const pass = await getPassBySerial(req.params.serialNumber);
    if (!pass) return res.status(404).send();

    const brand = await getBrand(pass.brand_id);
    const template = await getTemplate(pass.template_id);
    if (!brand || !template) return res.status(404).send();

    const baseUrl = process.env.CUSTOM_DOMAIN
      ? `https://${process.env.CUSTOM_DOMAIN}`
      : `${req.protocol}://${req.get('host')}`;

    const pkpassBuffer = await createPkpass(template, pass, brand, {
      baseUrl,
      passTypeIdentifier: process.env.PASS_TYPE_IDENTIFIER || 'pass.com.nudj',
      teamIdentifier: process.env.TEAM_IDENTIFIER || 'YOUR_TEAM_ID'
    });

    await logEvent({ pass_id: pass.id, brand_id: pass.brand_id, event_type: 'pass_fetched' });

    res.set({
      'Content-Type': 'application/vnd.apple.pkpass',
      'Last-Modified': new Date(pass.last_updated).toUTCString()
    });
    res.send(pkpassBuffer);
  } catch (err) {
    console.error('Pass fetch error:', err);
    res.status(500).send();
  }
});

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Creative asset image (public, used by <img> tags) ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ
router.get('/creative-assets/:id/image', async (req, res) => {
  try {
    const asset = await getCreativeAsset(req.params.id);
    if (!asset || !asset.image_base64) return res.status(404).send('No image');
    const buf = Buffer.from(asset.image_base64, 'base64');
    res.set({ 'Content-Type': 'image/png', 'Content-Length': buf.length, 'Cache-Control': 'public, max-age=3600' });
    res.send(buf);
  } catch (err) {
    console.error('Creative image error:', err);
    res.status(500).send('Error');
  }
});

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Media image (public, used by <img> tags) ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ
router.get('/media/:id/image', async (req, res) => {
  try {
    const item = await getMedia(req.params.id);
    if (!item || !item.image_base64) return res.status(404).send('No image');
    const buf = Buffer.from(item.image_base64, 'base64');
    res.set({ 'Content-Type': 'image/png', 'Content-Length': buf.length, 'Cache-Control': 'public, max-age=3600' });
    res.send(buf);
  } catch (err) {
    console.error('Media image error:', err);
    res.status(500).send('Error');
  }
});

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Ad Serving (public) ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ

const PIXEL_1x1 = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

// Serve ad tag ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ returns HTML snippet with creative + impression pixel
router.get('/serve/:campaign_id', async (req, res) => {
  try {
    const campaign = await getCampaign(req.params.campaign_id);
    if (!campaign) return res.status(404).send('Campaign not found');
    const brand = await getBrand(campaign.brand_id);
    if (!brand) return res.status(404).send('Brand not found');

    // Check for HTML5 banner creative first (type: 'banner' in media table)
    const reqW = parseInt(req.query.w) || 300;
    const reqH = parseInt(req.query.h) || 250;
    const bannerMedia = await listMedia(campaign.brand_id, 'banner');
    const matchedBanner = bannerMedia.find(m => m.width === reqW && m.height === reqH);
    if (matchedBanner && req.query.format !== 'json') {
      // Serve the HTML5 animated banner directly
      const bannerHtml = Buffer.from(matchedBanner.image_base64, 'base64').toString('utf-8');
      // Inject campaign tracking
      const baseUrl = `${req.protocol}://${req.get('host')}/api/v1`;
      const pixelTag = `<img src="${baseUrl}/pixel/${campaign.id}" width="1" height="1" style="position:absolute;opacity:0">`;
      const tracked = bannerHtml.replace('</body>', pixelTag + '</body>')
        .replace('href="#"', `href="${baseUrl}/click/${campaign.id}"`);
      res.set({ 'Content-Type': 'text/html', 'Cache-Control': 'public, max-age=300' });
      return res.send(tracked);
    }

    // Find best creative for this campaign
    const creatives = await listCreativeAssets(campaign.brand_id, { campaign_id: campaign.id, limit: 1 });
    const creative = creatives[0] || null;

    // Determine dimensions from query or creative
    const width = reqW || (creative ? creative.width : 300);
    const height = reqH || (creative ? creative.height : 250);

    const baseUrl = `${req.protocol}://${req.get('host')}/api/v1`;
    const cid = campaign.id;
    const crId = creative ? creative.id : '';
    const clickUrl = `${baseUrl}/click/${cid}?cr=${crId}`;
    const pixelUrl = `${baseUrl}/pixel/${cid}?cr=${crId}`;
    const imageUrl = creative ? `${baseUrl}/serve/${cid}/image?cr=${crId}` : '';
    const landingUrl = `${req.protocol}://${req.get('host')}/${brand.slug}?utm_source=${campaign.utm_source || 'walletad'}&utm_medium=${campaign.utm_medium || 'display'}&utm_campaign=${campaign.utm_campaign || campaign.name}`;

    const config = brand.config || {};
    const bgColor = config.backgroundColor || '#000000';
    const fgColor = config.foregroundColor || '#ffffff';
    const brandName = brand.name || '';

    // Return format based on query param
    const format = req.query.format || 'html';

    if (format === 'json') {
      return res.json({
        campaign_id: cid, brand: brandName, creative_id: crId,
        click_url: clickUrl, pixel_url: pixelUrl, image_url: imageUrl,
        landing_url: landingUrl, width, height
      });
    }

    // HTML ad tag
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{overflow:hidden}
.wa-ad{position:relative;width:${width}px;height:${height}px;background:${bgColor};cursor:pointer;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,sans-serif}
.wa-ad img.wa-creative{width:100%;height:100%;object-fit:cover}
.wa-ad .wa-overlay{position:absolute;bottom:0;left:0;right:0;padding:8px 12px;background:linear-gradient(transparent,rgba(0,0,0,.7))}
.wa-ad .wa-brand{color:${fgColor};font-size:${height > 100 ? 14 : 11}px;font-weight:700}
.wa-ad .wa-cta{display:inline-block;margin-top:4px;padding:4px 12px;background:${fgColor};color:${bgColor};border-radius:4px;font-size:${height > 100 ? 12 : 10}px;font-weight:600}
.wa-ad .wa-badge{position:absolute;top:6px;right:6px;background:rgba(0,0,0,.5);color:#fff;font-size:8px;padding:2px 5px;border-radius:3px}
</style></head><body>
<div class="wa-ad" onclick="window.open('${clickUrl}','_blank')">
${imageUrl ? `<img class="wa-creative" src="${imageUrl}" alt="${brandName}">` : ''}
<div class="wa-overlay">
<div class="wa-brand">${brandName}</div>
<span class="wa-cta">${creative?.cta_text || 'Aggiungi a Wallet'}</span>
</div>
<div class="wa-badge">Ad</div>
</div>
<img src="${pixelUrl}" width="1" height="1" style="position:absolute;opacity:0">
</body></html>`;

    res.set({ 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' });
    res.send(html);
  } catch (err) {
    console.error('Ad serve error:', err);
    res.status(500).send('Error');
  }
});

// Serve creative image for ad tag
router.get('/serve/:campaign_id/image', async (req, res) => {
  try {
    const crId = req.query.cr;
    let imageData = null;
    if (crId) {
      const asset = await getCreativeAsset(crId);
      if (asset?.image_base64) imageData = asset.image_base64;
    }
    if (!imageData) {
      const campaign = await getCampaign(req.params.campaign_id);
      if (campaign) {
        const creatives = await listCreativeAssets(campaign.brand_id, { campaign_id: campaign.id, limit: 1 });
        if (creatives[0]?.image_base64) imageData = creatives[0].image_base64;
      }
    }
    if (!imageData) return res.status(404).send('No image');
    const buf = Buffer.from(imageData, 'base64');
    res.set({ 'Content-Type': 'image/png', 'Content-Length': buf.length, 'Cache-Control': 'public, max-age=3600' });
    res.send(buf);
  } catch (err) {
    console.error('Ad image error:', err);
    res.status(500).send('Error');
  }
});

// Impression tracking pixel
router.get('/pixel/:campaign_id', async (req, res) => {
  try {
    const campaign = await getCampaign(req.params.campaign_id);
    if (campaign) {
      logAdEvent({
        brand_id: campaign.brand_id,
        campaign_id: campaign.id,
        creative_id: req.query.cr || null,
        event_type: 'impression',
        ip: req.ip || req.headers['x-forwarded-for'],
        user_agent: req.headers['user-agent'],
        referer: req.headers['referer'] || req.headers['referrer']
      }).catch(err => console.error('Pixel log error:', err));
    }
  } catch (e) { /* fire-and-forget */ }
  res.set({ 'Content-Type': 'image/gif', 'Content-Length': PIXEL_1x1.length, 'Cache-Control': 'no-store, no-cache' });
  res.send(PIXEL_1x1);
});

// Click redirect + tracking
router.get('/click/:campaign_id', async (req, res) => {
  try {
    const campaign = await getCampaign(req.params.campaign_id);
    if (!campaign) return res.status(404).send('Campaign not found');
    const brand = await getBrand(campaign.brand_id);
    if (!brand) return res.status(404).send('Brand not found');

    // Log click
    logAdEvent({
      brand_id: campaign.brand_id,
      campaign_id: campaign.id,
      creative_id: req.query.cr || null,
      event_type: 'click',
      ip: req.ip || req.headers['x-forwarded-for'],
      user_agent: req.headers['user-agent'],
      referer: req.headers['referer'] || req.headers['referrer']
    }).catch(err => console.error('Click log error:', err));

    // Redirect to landing
    const landingUrl = `${req.protocol}://${req.get('host')}/${brand.slug}?utm_source=${campaign.utm_source || 'walletad'}&utm_medium=${campaign.utm_medium || 'display'}&utm_campaign=${campaign.utm_campaign || campaign.name}`;
    res.redirect(302, landingUrl);
  } catch (err) {
    console.error('Click redirect error:', err);
    res.status(500).send('Error');
  }
});

// ============================================================================
// AUTH MIDDLEWARE ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ everything below requires JWT
// ============================================================================

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token mancante. Effettua il login.' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token non valido o scaduto' });
  }
}

// Auth middleware disabled ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ open access
// router.use(authMiddleware);

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Auth (authenticated) ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ
router.get('/auth/me', (req, res) => {
  res.json({ user: req.user });
});

router.put('/auth/change-password', async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'Entrambe le password richieste' });
    const user = await getUser(req.user.id);
    const fullUser = await getUserByEmail(user.email);
    const valid = await verifyPassword(current_password, fullUser.password_hash);
    if (!valid) return res.status(401).json({ error: 'Password attuale errata' });
    await updateUser(req.user.id, { password: new_password });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Users (admin only) ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ
router.get('/users', async (req, res) => {
  try {
    const users = await listUsers(req.query.brand_id || null);
    res.json(users);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/users', async (req, res) => {
  try {
    const tempPassword = req.body.password || Math.random().toString(36).slice(-10);
    req.body.password = tempPassword;
    const user = await createUser(req.body);
    // Send invite email with temp password
    try {
      const { sendUserInviteEmail } = require('../engine/mailer');
      const domain = process.env.CUSTOM_DOMAIN || req.headers.host;
      await sendUserInviteEmail({
        to: user.email,
        name: user.name,
        password: tempPassword,
        role: req.body.role || 'manager',
        brandName: 'Ads2Wallet',
        dashboardUrl: `https://${domain}/dashboard`
      });
    } catch(emailErr) { console.error('Invite email failed:', emailErr.message); }
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/users/:id/resend-invite', async (req, res) => {
  try {
    const user = await getUser(req.params.id);
    if (!user) return res.status(404).json({ error: 'Utente non trovato' });

    // Generate new temp password
    const tempPassword = Math.random().toString(36).slice(-10);
    await updateUser(user.id, { password: tempPassword });

    const { sendUserInviteEmail } = require('../engine/mailer');
    const domain = process.env.CUSTOM_DOMAIN || req.headers.host;
    await sendUserInviteEmail({
      to: user.email,
      name: user.name,
      password: tempPassword,
      role: user.role || 'manager',
      brandName: 'Ads2Wallet',
      dashboardUrl: `https://${domain}/dashboard`
    });

    res.json({ success: true, message: 'Email di invito reinviata' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/users/:id', async (req, res) => {
  try {
    const user = await updateUser(req.params.id, req.body);
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/users/:id', async (req, res) => {
  try {
    await deleteUser(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Brands ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ

router.get('/brands', async (req, res) => {
  try {
    const brands = await listBrands();
    res.json(brands);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/brands', async (req, res) => {
  try {
    const brand = await createBrand(req.body);
    res.json(brand);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/brands/:id', async (req, res) => {
  try {
    const brand = await getBrand(req.params.id);
    if (!brand) return res.status(404).json({ error: 'Brand non trovato' });
    res.json(brand);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/brands/:id', async (req, res) => {
  try {
    const brand = await updateBrand(req.params.id, req.body);
    res.json(brand);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/brands/:id', async (req, res) => {
  try {
    await deleteBrand(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Brand logo upload ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ
router.post('/brands/:id/logo', async (req, res) => {
  try {
    const brand = await getBrand(req.params.id);
    if (!brand) return res.status(404).json({ error: 'Brand non trovato' });

    let { logo_base64 } = req.body;
    if (!logo_base64) return res.status(400).json({ error: 'logo_base64 richiesto' });

    // Convert PDF to PNG if needed
    logo_base64 = await pdfToPngIfNeeded(logo_base64);
    const imgBuffer = Buffer.from(logo_base64, 'base64');
    // Generate @1x and @2x logos
    const logo1x = await sharp(imgBuffer).resize(160, 50, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const logo2x = await sharp(imgBuffer).resize(320, 100, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    // Generate icons
    const icon1x = await sharp(imgBuffer).resize(29, 29, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const icon2x = await sharp(imgBuffer).resize(58, 58, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const icon3x = await sharp(imgBuffer).resize(87, 87, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();

    const config = brand.config || {};
    config.logos = config.logos || {};
    config.logos.logo = logo1x.toString('base64');
    config.logos['logo@2x'] = logo2x.toString('base64');
    config.logos.icon = icon1x.toString('base64');
    config.logos['icon@2x'] = icon2x.toString('base64');
    config.logos['icon@3x'] = icon3x.toString('base64');

    await updateBrand(req.params.id, { config });
    res.json({ success: true });
  } catch (err) {
    console.error('Logo upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/brands/:id/logo', async (req, res) => {
  try {
    const brand = await getBrand(req.params.id);
    if (!brand?.config?.logos?.logo) return res.status(404).json({ error: 'Nessun logo' });
    const buf = Buffer.from(brand.config.logos.logo, 'base64');
    res.set('Content-Type', 'image/png');
    res.send(buf);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Brand landing background upload ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ
router.post('/brands/:id/landing-bg', async (req, res) => {
  try {
    const brand = await getBrand(req.params.id);
    if (!brand) return res.status(404).json({ error: 'Brand non trovato' });
    let { image_base64 } = req.body;
    if (!image_base64) return res.status(400).json({ error: 'image_base64 richiesto' });
    // Convert PDF to PNG if needed
    image_base64 = await pdfToPngIfNeeded(image_base64);
    const imgBuffer = Buffer.from(image_base64, 'base64');
    // Resize to max 1200px wide, optimize as JPEG for faster loading
    const optimized = await sharp(imgBuffer)
      .resize(1200, 2400, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    const config = brand.config || {};
    config.landingBg = optimized.toString('base64');
    await updateBrand(req.params.id, { config });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Brand strip upload ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ
router.post('/brands/:id/strip', async (req, res) => {
  try {
    const brand = await getBrand(req.params.id);
    if (!brand) return res.status(404).json({ error: 'Brand non trovato' });

    let { strip_base64 } = req.body;
    if (!strip_base64) return res.status(400).json({ error: 'strip_base64 richiesto' });

    // Convert PDF to PNG if needed
    strip_base64 = await pdfToPngIfNeeded(strip_base64);

    const config = brand.config || {};
    config.logos = config.logos || {};
    config.logos.strip = strip_base64;

    await updateBrand(req.params.id, { config });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/brands/:id/strip', async (req, res) => {
  try {
    const brand = await getBrand(req.params.id);
    const stripBase64 = brand?.config?.logos?.strip || brand?.config?.strip_base64 || null;
    if (!stripBase64) return res.status(404).json({ error: 'Nessuna strip' });
    const buf = Buffer.from(stripBase64, 'base64');
    res.set('Content-Type', 'image/png');
    res.send(buf);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/brands/:id/strip', async (req, res) => {
  try {
    const brand = await getBrand(req.params.id);
    if (!brand) return res.status(404).json({ error: 'Brand non trovato' });
    const config = brand.config || {};
    if (config.logos) delete config.logos.strip;
    await updateBrand(req.params.id, { config });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ AI strip generation ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ
router.post('/brands/:id/ai-strip', async (req, res) => {
  try {
    const brand = await getBrand(req.params.id);
    if (!brand) return res.status(404).json({ error: 'Brand non trovato' });
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt richiesto' });

    const { generateWithFal } = require('../engine/creative-ai');
    const stylePrompt = (brand.config && brand.config.aiStylePrompt) || null;

    // Strip dimensions: 1125x432 (Apple Wallet @3x)
    const imageUrl = await generateWithFal(
      `${prompt}, promotional banner, wide aspect ratio, no text, no watermark`,
      1125, 432, 'fal-ai/flux/dev', null, stylePrompt
    );

    // Download and convert to base64
    const imgResponse = await fetch(imageUrl);
    const arrayBuf = await imgResponse.arrayBuffer();
    const base64 = Buffer.from(arrayBuf).toString('base64');

    const config = brand.config || {};
    config.logos = config.logos || {};
    config.logos.strip = base64;
    await updateBrand(req.params.id, { config });

    res.json({ success: true, strip_base64: base64 });
  } catch (err) {
    console.error('AI strip error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ AI landing page copy ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ
router.post('/brands/:id/ai-copy', async (req, res) => {
  try {
    const brand = await getBrand(req.params.id);
    if (!brand) return res.status(404).json({ error: 'Brand non trovato' });
    const description = req.body.description || '';
    const options = await generateLandingCopy(brand.name, description);
    res.json({ options });
  } catch (err) {
    console.error('AI copy error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ AI Creative Generator (copy + image in one shot) ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ
router.post('/brands/:id/ai-creative', async (req, res) => {
  try {
    const brand = await getBrand(req.params.id);
    if (!brand) return res.status(404).json({ error: 'Brand non trovato' });
    const { prompt, type, generate_image } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt richiesto' });

    console.log(`[AI Creative] Generating ${type || 'banner'} concept for "${brand.name}": ${prompt}`);

    // Step 1: Generate copy + colors + image prompt via Claude
    const concept = await generateCreativeCopy(brand.name, prompt, type || 'banner');

    // Step 2: Optionally generate background image via fal.ai
    let image_url = null;
    if (generate_image !== false && concept.image_prompt) {
      try {
        const { generateWithFal } = require('../engine/creative-ai');
        const stylePrompt = (brand.config && brand.config.aiStylePrompt) || null;
        const fullPrompt = stylePrompt
          ? `${concept.image_prompt}. Style: ${stylePrompt}`
          : concept.image_prompt;
        const falUrl = await generateWithFal(fullPrompt, 1080, 1080, 'fal-ai/flux/dev', null, null);
        // Save as media
        const imgRes = await fetch(falUrl);
        const imgBuf = Buffer.from(await imgRes.arrayBuffer());
        const media = await createMedia({
          brand_id: brand.id,
          type: 'ai_generated',
          title: prompt.substring(0, 60),
          image_base64: imgBuf.toString('base64'),
          width: 1080, height: 1080
        });
        image_url = `/api/v1/media/${media.id}/image`;
        console.log(`[AI Creative] Image generated and saved as media ${media.id}`);
      } catch (imgErr) {
        console.error('[AI Creative] Image generation failed:', imgErr.message);
        // Continue without image ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ copy is still useful
      }
    }

    res.json({ ...concept, image_url });
  } catch (err) {
    console.error('AI creative error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Templates ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ

router.get('/templates', async (req, res) => {
  try {
    const { brand_id } = req.query;
    if (!brand_id) return res.status(400).json({ error: 'brand_id richiesto' });
    const templates = await listTemplates(brand_id);
    res.json(templates);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/templates', async (req, res) => {
  try {
    const template = await createTemplate(req.body);
    res.json(template);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/templates/:id', async (req, res) => {
  try {
    const template = await getTemplate(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template non trovato' });
    res.json(template);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/templates/:id', async (req, res) => {
  try {
    const template = await updateTemplate(req.params.id, req.body);
    res.json(template);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Template image upload (base64 in style JSONB) ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ
router.post('/templates/:id/images', async (req, res) => {
  try {
    const template = await getTemplate(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template non trovato' });
    const { image_type, image_base64 } = req.body;
    // image_type: 'logo', 'strip', 'thumbnail', 'background'
    if (!['logo', 'strip', 'thumbnail', 'background'].includes(image_type)) {
      return res.status(400).json({ error: 'image_type deve essere: logo, strip, thumbnail, background' });
    }
    if (!image_base64) return res.status(400).json({ error: 'image_base64 richiesto' });
    const style = template.style || {};
    style.images = style.images || {};
    style.images[image_type] = image_base64;
    await updateTemplate(req.params.id, { style });
    res.json({ success: true, image_type });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/templates/:id/images/:imageType', async (req, res) => {
  try {
    const template = await getTemplate(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template non trovato' });
    const style = template.style || {};
    if (style.images) {
      delete style.images[req.params.imageType];
      await updateTemplate(req.params.id, { style });
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/templates/:id', async (req, res) => {
  try {
    await deleteTemplate(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Campaigns ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ

router.get('/campaigns', async (req, res) => {
  try {
    const { brand_id } = req.query;
    if (!brand_id) return res.status(400).json({ error: 'brand_id richiesto' });
    const campaigns = await listCampaigns(brand_id);
    res.json(campaigns);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/campaigns', async (req, res) => {
  try {
    const campaign = await createCampaign(req.body);
    res.json(campaign);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/campaigns/:id', async (req, res) => {
  try {
    const campaign = await getCampaign(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campagna non trovata' });
    res.json(campaign);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/campaigns/:id', async (req, res) => {
  try {
    const campaign = await updateCampaign(req.params.id, req.body);
    res.json(campaign);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/campaigns/:id', async (req, res) => {
  try {
    await deleteCampaign(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Passes (backoffice) ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ

router.get('/passes', async (req, res) => {
  try {
    const { brand_id, status, campaign_id, limit, offset } = req.query;
    if (!brand_id) return res.status(400).json({ error: 'brand_id richiesto' });
    const passes = await listPasses(brand_id, {
      status,
      campaign_id,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined
    });
    res.json(passes);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/passes', async (req, res) => {
  try {
    const { brand_id, template_id, campaign_id, field_values } = req.body;
    if (!brand_id || !template_id) return res.status(400).json({ error: 'brand_id e template_id richiesti' });

    const passInstance = await createPassInstance({ template_id, brand_id, campaign_id, field_values });
    await logEvent({ pass_id: passInstance.id, brand_id, event_type: 'pass_created', metadata: { source: 'backoffice' } });
    if (campaign_id) await incrementCampaignDownloads(campaign_id);

    res.json(passInstance);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/passes/:id', async (req, res) => {
  try {
    const pass = await getPassInstance(req.params.id);
    if (!pass) return res.status(404).json({ error: 'Pass non trovato' });
    res.json(pass);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/passes/:id', async (req, res) => {
  try {
    const pass = await updatePassInstance(req.params.id, req.body);
    res.json(pass);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/passes/:id', async (req, res) => {
  try {
    await deletePass(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/passes/:id/regenerate', async (req, res) => {
  try {
    const pass = await getPassInstance(req.params.id);
    if (!pass) return res.status(404).json({ error: 'Pass non trovato' });
    const brand = await getBrand(pass.brand_id);
    const template = await getTemplate(pass.template_id);

    const baseUrl = process.env.CUSTOM_DOMAIN
      ? `https://${process.env.CUSTOM_DOMAIN}`
      : `${req.protocol}://${req.get('host')}`;

    const pkpassBuffer = await createPkpass(template, pass, brand, {
      baseUrl,
      passTypeIdentifier: process.env.PASS_TYPE_IDENTIFIER || 'pass.com.nudj',
      teamIdentifier: process.env.TEAM_IDENTIFIER || 'YOUR_TEAM_ID'
    });

    res.set({
      'Content-Type': 'application/vnd.apple.pkpass',
      'Content-Disposition': `attachment; filename="${brand.slug || 'pass'}.pkpass"`,
      'Content-Length': pkpassBuffer.length
    });
    res.send(pkpassBuffer);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Push Notifications ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ

router.post('/push/send', async (req, res) => {
  try {
    const { brand_id, title, message, campaign_id, update_pass, field_values, instant_win_id, gamification_id, channel = 'apple' } = req.body;
    if (!brand_id || !title || !message) return res.status(400).json({ error: 'brand_id, title, message richiesti' });
    if (!['apple', 'google', 'both'].includes(channel)) {
      return res.status(400).json({ error: 'channel non valido (apple|google|both)' });
    }
    const sendApple = channel === 'apple' || channel === 'both';
    const sendGoogle = channel === 'google' || channel === 'both';

    console.log(`[PUSH DEBUG] brand_id from dashboard: "${brand_id}" | campaign_id: "${campaign_id || 'none'}"`);

    // Debug: check what's in the DB
    const allDevices = await pool.query('SELECT COUNT(*) as count FROM device_registrations');
    const allPasses = await pool.query('SELECT DISTINCT brand_id FROM pass_instances');
    console.log(`[PUSH DEBUG] Total devices in DB: ${allDevices.rows[0].count} | Brand IDs in passes: ${JSON.stringify(allPasses.rows.map(r => r.brand_id))}`);

    // Get all targeted passes once (used by Apple and Google channels)
    const passQuery = campaign_id
      ? await pool.query('SELECT * FROM pass_instances WHERE brand_id = $1 AND campaign_id = $2', [brand_id, campaign_id])
      : await pool.query('SELECT * FROM pass_instances WHERE brand_id = $1', [brand_id]);
    const targetPasses = passQuery.rows;
    const googleEligible = targetPasses.filter(p => p.google_wallet_object_id);

    // Get Apple APNs devices only if requested
    let devices = [];
    if (sendApple) {
      if (campaign_id) {
        const result = await pool.query(
          `SELECT DISTINCT dr.push_token, dr.serial_number
           FROM device_registrations dr
           JOIN pass_instances pi ON dr.serial_number = pi.serial_number
           WHERE pi.brand_id = $1 AND pi.campaign_id = $2`,
          [brand_id, campaign_id]
        );
        devices = result.rows;
      } else {
        devices = await getDevicesForBrand(brand_id);
      }
    }

    console.log(`[PUSH DEBUG] Devices found for brand: ${devices.length}`);
    if ((!sendApple || devices.length === 0) && (!sendGoogle || googleEligible.length === 0)) {
      return res.json({
        sent_apns: 0,
        total_apns: sendApple ? devices.length : 0,
        google: { attempted: sendGoogle ? googleEligible.length : 0, updated: 0, errors: 0, skipped: !sendGoogle || !googleWallet.isConfigured() },
        message: 'Nessun destinatario per i canali selezionati',
        debug: { brand_id_sent: brand_id, total_devices_in_db: parseInt(allDevices.rows[0].count), brand_ids_in_passes: allPasses.rows.map(r => r.brand_id) }
      });
    }

    // Update pass content if requested
    if (update_pass !== false) {
      const brand = await getBrand(brand_id);

      // Update brand.config.pushAnnouncement ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ this is what passkit.js reads
      // to build the announcement field with changeMessage on the pass
      const config = brand.config || {};
      config.pushAnnouncement = { title, message, ts: Date.now() };

      // Engagement links must be explicit per push action.
      // If not selected in this request, clear old sticky values.
      if (!instant_win_id) delete config.instantWinActive;
      if (!gamification_id) delete config.gamificationActive;
      if (!instant_win_id && !gamification_id) delete config.stripOverride;

      // Instant Win: inject play link into pass back field
      if (instant_win_id) {
        const iwCampaign = await getInstantWinCampaign(instant_win_id);
        if (iwCampaign && iwCampaign.status === 'active') {
          config.instantWinActive = {
            campaign_id: iwCampaign.id,
            label: iwCampaign.push_message || iwCampaign.name || 'Gioca e Vinci!',
            game_type: iwCampaign.game_type
          };
          // If campaign has a strip image, inject it
          if (iwCampaign.strip_base64) {
            config.stripOverride = iwCampaign.strip_base64;
          }
          console.log(`[PUSH] Instant Win injected: campaign=${iwCampaign.id}, game=${iwCampaign.game_type}`);
        }
      }

      // Gamification: inject game link into pass back field
      if (gamification_id) {
        const gamCampaign = await getGamificationCampaign(gamification_id);
        if (gamCampaign && gamCampaign.status === 'active') {
          config.gamificationActive = {
            campaign_id: gamCampaign.id,
            label: gamCampaign.push_message || gamCampaign.name || 'Gioca ora!',
            game_type: gamCampaign.game_type
          };
          // If campaign has a strip image, inject it
          if (gamCampaign.strip_base64) {
            config.stripOverride = gamCampaign.strip_base64;
          }
          console.log(`[PUSH] Gamification injected: campaign=${gamCampaign.id}, game=${gamCampaign.game_type}`);
        }
      }

      await updateBrand(brand_id, { config });
      console.log(`[PUSH] Updated brand.config.pushAnnouncement: "${title}: ${message}"`);

      // Touch affected passes only for Apple channel refresh
      if (sendApple) {
        for (const p of targetPasses) {
          await touchPass(p.id);
        }
      }
    }

    // Google Wallet channel push-like update/message
    let googleSync = { attempted: 0, updated: 0, errors: 0, skipped: !sendGoogle };
    if (sendGoogle) {
      const brand = await getBrand(brand_id);
      googleSync = await syncGoogleWalletObjectsForPasses({
        brand,
        passes: targetPasses,
        message
      });
      console.log('[GoogleWallet] Push sync', googleSync);
    }

    // Apple APNs push — track per-pass status
    let sentAppleCount = 0;
    const pushResults = [];
    if (sendApple) {
      for (const device of devices) {
        try {
          const result = await sendPushUpdate(device.push_token);
          console.log(`[PUSH] token=${device.push_token.substring(0,12)}... result=${JSON.stringify(result)}`);
          pushResults.push({ token: device.push_token.substring(0,12) + '...', serial: device.serial_number, ...result });
          if (result.success) sentAppleCount++;

          // Update per-pass push status
          if (device.serial_number) {
            const status = result.success ? 'delivered' : (result.reason || 'failed');
            await pool.query(
              `UPDATE pass_instances SET last_push_at = NOW(), last_push_status = $1, push_count = COALESCE(push_count, 0) + 1 WHERE serial_number = $2`,
              [status, device.serial_number]
            );
          }
        } catch (pushErr) {
          console.error('Push error for token:', device.push_token, pushErr.message);
          pushResults.push({ token: device.push_token.substring(0,12) + '...', success: false, reason: pushErr.message });
          if (device.serial_number) {
            await pool.query(
              `UPDATE pass_instances SET last_push_at = NOW(), last_push_status = $1, push_count = COALESCE(push_count, 0) + 1 WHERE serial_number = $2`,
              ['error: ' + pushErr.message.substring(0, 100), device.serial_number]
            );
          }
        }
      }
    }

    const sentCombined = sentAppleCount + (googleSync.updated || 0);
    await logPush({ brand_id, title, message, campaign_id, sent_count: sentCombined, channel });
    res.json({
      sent_apns: sentAppleCount,
      total_apns: sendApple ? devices.length : 0,
      google: googleSync,
      sent: sentCombined,
      apns_results: pushResults
    });
  } catch (err) {
    console.error('Push send error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/push/history', async (req, res) => {
  try {
    const { brand_id } = req.query;
    if (!brand_id) return res.status(400).json({ error: 'brand_id richiesto' });
    const pushes = await listPushes(brand_id);
    res.json(pushes);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/push/:id', async (req, res) => {
  try {
    await deletePush(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/push/clear/:brand_id', async (req, res) => {
  try {
    const result = await clearPushHistory(req.params.brand_id);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Scheduled Push ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ

router.get('/push/scheduled', async (req, res) => {
  try {
    const { brand_id } = req.query;
    if (!brand_id) return res.status(400).json({ error: 'brand_id richiesto' });
    const items = await listScheduledPush(brand_id);
    res.json(items);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/push/scheduled', async (req, res) => {
  try {
    if (req.body.channel && !['apple', 'google', 'both'].includes(req.body.channel)) {
      return res.status(400).json({ error: 'channel non valido (apple|google|both)' });
    }
    const item = await createScheduledPush(req.body);
    res.json(item);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/push/scheduled/:id', async (req, res) => {
  try {
    if (req.body.channel && !['apple', 'google', 'both'].includes(req.body.channel)) {
      return res.status(400).json({ error: 'channel non valido (apple|google|both)' });
    }
    const item = await updateScheduledPush(req.params.id, req.body);
    res.json(item);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/push/scheduled/:id', async (req, res) => {
  try {
    await deleteScheduledPush(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// OpenStreetMap Nominatim (pubblico) — proxy server-side: User-Agent obbligatorio, evita CORS dal browser
const NOMINATIM_UA = `Ads2Wallet/1.0 (${process.env.CUSTOM_DOMAIN || 'localhost'})`;

function nominatimFormatLine(feature) {
  const a = feature.address || {};
  const street = [a.road || a.pedestrian, a.house_number].filter(Boolean).join(' ').trim();
  const locality = a.city || a.town || a.village || a.hamlet || a.municipality || a.city_district || a.suburb || a.neighbourhood;
  const parts = [street || a.road, a.postcode, locality, a.state, a.country].filter(Boolean);
  if (parts.length) return parts.join(', ');
  return feature.display_name || '';
}

// GET /geocode/search?q=   → [{ lat, lon, display_name, address }]
router.get('/geocode/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 3) return res.json([]);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=8&addressdetails=1`;
    const r = await fetch(url, { headers: { 'User-Agent': NOMINATIM_UA, 'Accept-Language': 'it,en' } });
    if (!r.ok) return res.status(502).json({ error: 'Servizio indirizzi non disponibile' });
    const rows = await r.json();
    const out = (Array.isArray(rows) ? rows : []).map((x) => ({
      lat: parseFloat(x.lat),
      lon: parseFloat(x.lon),
      display_name: x.display_name,
      address: nominatimFormatLine(x)
    })).filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lon));
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /geocode/reverse?lat=&lon=
router.get('/geocode/reverse', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ error: 'lat e lon sono richiesti' });
    }
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`;
    const r = await fetch(url, { headers: { 'User-Agent': NOMINATIM_UA, 'Accept-Language': 'it,en' } });
    if (!r.ok) return res.status(502).json({ error: 'Reverse geocoding non disponibile' });
    const data = await r.json();
    res.json({
      display_name: data.display_name || '',
      address: nominatimFormatLine(data),
      lat,
      lon
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Geofencing Locations ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ

router.get('/brands/:id/geofencing', async (req, res) => {
  try {
    const brand = await getBrand(req.params.id);
    if (!brand) return res.status(404).json({ error: 'Brand not found' });
    const locations = brand.config?.locations || [];
    res.json({ locations, maxDistance: brand.config?.maxDistance || 500, channel: brand.config?.geofencing_channel || 'apple' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/brands/:id/geofencing', async (req, res) => {
  try {
    const { locations, maxDistance, channel = 'apple' } = req.body;
    if (!['apple', 'google', 'both'].includes(channel)) {
      return res.status(400).json({ error: 'channel non valido (apple|google|both)' });
    }
    const sendApple = channel === 'apple' || channel === 'both';
    const sendGoogle = channel === 'google' || channel === 'both';
    const brand = await getBrand(req.params.id);
    if (!brand) return res.status(404).json({ error: 'Brand not found' });
    const config = brand.config || {};
    config.locations = (locations || []).map(loc => ({
      latitude: parseFloat(loc.latitude),
      longitude: parseFloat(loc.longitude),
      relevantText: loc.relevantText || '',
      name: loc.name || '',
      radius: parseInt(loc.radius) || 500,
      address: typeof loc.address === 'string' ? loc.address.slice(0, 500) : ''
    }));
    if (maxDistance) config.maxDistance = parseInt(maxDistance);
    config.geofencing_channel = channel;
    await updateBrand(req.params.id, { config });

    // Regenerate all active passes to include new locations
    const passes = await pool.query(
      'SELECT id FROM pass_instances WHERE brand_id = $1', [req.params.id]
    );
    for (const p of passes.rows) {
      await touchPass(p.id);
    }

    // Push update to Apple devices so they re-download the pass with new locations
    let pushCount = 0;
    if (sendApple) {
      const devices = await getDevicesForBrand(req.params.id);
      for (const d of devices) {
        try {
          await sendPushUpdate(d.push_token);
          pushCount++;
        } catch (e) { console.error('Geofencing push error:', e.message); }
      }
    }

    let googleSync = { attempted: 0, updated: 0, errors: 0, skipped: !sendGoogle };
    if (sendGoogle) {
      const passRows = await pool.query('SELECT * FROM pass_instances WHERE brand_id = $1', [req.params.id]);
      googleSync = await syncGoogleWalletObjectsForPasses({
        brand: await getBrand(req.params.id),
        passes: passRows.rows,
        message: (config.locations && config.locations[0] && config.locations[0].relevantText) || 'Aggiornamento geolocalizzazione'
      });
    }

    res.json({ success: true, channel, locations: config.locations, pushes_sent: pushCount, google: googleSync });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Analytics ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ

router.get('/analytics/:brand_id', async (req, res) => {
  try {
    const analytics = await getAnalytics(req.params.brand_id);
    res.json(analytics);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/analytics/:brand_id/campaigns', async (req, res) => {
  try {
    const data = await getCampaignAnalytics(req.params.brand_id);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/events/:brand_id', async (req, res) => {
  try {
    const events = await listEvents(req.params.brand_id, parseInt(req.query.limit) || 50);
    res.json(events);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Strip Promos ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ

router.get('/brands/:id/strip-promos', async (req, res) => {
  try {
    const promos = await listStripPromos(req.params.id);
    res.json(promos);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/brands/:id/strip-promos', async (req, res) => {
  try {
    const promo = await createStripPromo({ brand_id: req.params.id, ...req.body });
    res.json(promo);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/strip-promos/:id', async (req, res) => {
  try {
    await updateStripPromo(req.params.id, req.body);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/strip-promos/:id', async (req, res) => {
  try {
    await deleteStripPromo(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get strip promo image base64 (for template reuse)
router.get('/strip-promos/:id/image', async (req, res) => {
  try {
    const promo = await getStripPromo(req.params.id);
    if (!promo) return res.status(404).json({ error: 'Strip promo non trovata' });
    // If ?raw=1, serve as actual image for <img> tags
    if (req.query.raw === '1') {
      const buf = Buffer.from(promo.strip_base64, 'base64');
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'public, max-age=600');
      return res.send(buf);
    }
    res.json({ strip_base64: promo.strip_base64 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Creative Assets ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ

// Get available formats (optionally filter by segment)
router.get('/creative-formats', (req, res) => {
  const { segment } = req.query;
  res.json(getFormats(segment || null));
});

// List assets for a brand
router.get('/creative-assets', async (req, res) => {
  const { brand_id, segment, campaign_id, limit } = req.query;
  if (!brand_id) return res.status(400).json({ error: 'brand_id richiesto' });
  const assets = await listCreativeAssets(brand_id, {
    segment, campaign_id, limit: limit ? parseInt(limit) : undefined
  });
  // Don't send image_base64 in list (too heavy) ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ send thumbnail info
  const light = assets.map(a => ({ ...a, image_base64: a.image_base64 ? '[has_image]' : null }));
  res.json(light);
});

// Get single asset (with image)
router.get('/creative-assets/:id', async (req, res) => {
  const asset = await getCreativeAsset(req.params.id);
  if (!asset) return res.status(404).json({ error: 'Asset non trovato' });
  res.json(asset);
});

// Upload a creative asset (manual upload)
router.post('/creative-assets/upload', express.raw({ type: 'image/*', limit: '10mb' }), async (req, res) => {
  try {
    const { brand_id, campaign_id, segment, format_key, title } = req.query;
    if (!brand_id || !segment || !format_key) {
      return res.status(400).json({ error: 'brand_id, segment, format_key richiesti' });
    }
    const fmt = getFormat(format_key);
    if (!fmt) return res.status(400).json({ error: 'Formato non valido: ' + format_key });

    // Resize uploaded image to format dimensions
    const sharp = require('sharp');
    const resized = await sharp(req.body).resize(fmt.w, fmt.h, { fit: 'cover' }).png().toBuffer();

    const asset = await createCreativeAsset({
      brand_id, campaign_id: campaign_id || null, segment, format_key: fmt.key,
      format_label: fmt.label, width: fmt.w, height: fmt.h, title: title || fmt.label,
      source: 'upload', image_base64: resized.toString('base64')
    });
    res.json(asset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Upload via multipart form
router.post('/creative-assets/upload-form', async (req, res) => {
  try {
    const { brand_id, campaign_id, segment, format_key, title } = req.body;
    if (!brand_id || !segment || !format_key) {
      return res.status(400).json({ error: 'brand_id, segment, format_key richiesti' });
    }
    const fmt = getFormat(format_key);
    if (!fmt) return res.status(400).json({ error: 'Formato non valido' });

    // Expect image_base64 in body (from dashboard FileReader)
    if (!req.body.image_base64) return res.status(400).json({ error: 'image_base64 richiesto' });

    const sharp = require('sharp');
    const imgBuf = Buffer.from(req.body.image_base64, 'base64');
    const resized = await sharp(imgBuf).resize(fmt.w, fmt.h, { fit: 'cover' }).png().toBuffer();

    const asset = await createCreativeAsset({
      brand_id, campaign_id: campaign_id || null, segment, format_key: fmt.key,
      format_label: fmt.label, width: fmt.w, height: fmt.h, title: title || fmt.label,
      source: 'upload', image_base64: resized.toString('base64')
    });
    res.json({ id: asset.id, format_label: asset.format_label, width: asset.width, height: asset.height, created_at: asset.created_at });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Generate creative with AI (fal.ai)
router.post('/creative-assets/generate', async (req, res) => {
  try {
    const { brand_id, campaign_id, segment, format_key, prompt, headline, cta_text, model, reference_image } = req.body;
    if (!brand_id || !segment || !format_key || !prompt) {
      return res.status(400).json({ error: 'brand_id, segment, format_key, prompt richiesti' });
    }
    const fmt = getFormat(format_key);
    if (!fmt) return res.status(400).json({ error: 'Formato non valido' });

    const brand = await getBrand(brand_id);
    if (!brand) return res.status(404).json({ error: 'Brand non trovato' });

    // Choose model: image-to-image if reference provided, otherwise text-to-image
    let aiModel = model || 'fal-ai/flux/dev';
    let refImageUrl = null;
    if (reference_image) {
      aiModel = 'fal-ai/flux/dev/image-to-image';
      refImageUrl = `data:image/png;base64,${reference_image}`;
      console.log(`[Creative AI] Using image-to-image with reference (${Math.round(reference_image.length/1024)}KB)`);
    }

    // Step 1: Generate background with AI (using brand style prompt if configured)
    const stylePrompt = (brand.config && brand.config.aiStylePrompt) || null;
    console.log(`[Creative AI] Generating ${fmt.key} (${fmt.w}x${fmt.h}) with model: ${aiModel}${stylePrompt ? ' + brand style' : ' + default style'}`);
    const imageUrl = await generateWithFal(prompt, fmt.w, fmt.h, aiModel, refImageUrl, stylePrompt);

    // Step 2: Download generated image
    const imgRes = await fetch(imageUrl);
    const bgBuffer = Buffer.from(await imgRes.arrayBuffer());

    // Step 3: Get brand logo (if available)
    let logoBuffer = null;
    if (brand.config && brand.config.logos && brand.config.logos.logo) {
      logoBuffer = Buffer.from(brand.config.logos.logo, 'base64');
    }

    // Step 4: Generate QR for CTV/DOOH
    let qrBuffer = null;
    const isDooh = segment === 'ctv_dooh';
    if (isDooh && campaign_id) {
      // Generate QR code as PNG using a simple SVG-based QR
      // For now, we'll mark it and the dashboard will handle QR separately
    }

    // Step 5: Compose final creative
    const brandColors = {
      bg: brand.config?.backgroundColor || '#0A0A0A',
      fg: brand.config?.foregroundColor || '#FFFFFF',
      lbl: brand.config?.labelColor || '#00D4AA'
    };

    const finalBuffer = await composeCreative({
      backgroundBuffer: bgBuffer, width: fmt.w, height: fmt.h,
      logoBuffer, headline, ctaText: cta_text, brandColors, qrBuffer, segment
    });

    // Step 6: Save to DB
    const asset = await createCreativeAsset({
      brand_id, campaign_id: campaign_id || null, segment, format_key: fmt.key,
      format_label: fmt.label, width: fmt.w, height: fmt.h,
      title: headline || prompt.substring(0, 60),
      headline, cta_text, ai_prompt: prompt, ai_model: aiModel,
      source: 'ai', image_base64: finalBuffer.toString('base64'),
      qr_embedded: isDooh, metadata: { original_image_url: imageUrl }
    });

    res.json({ id: asset.id, format_label: asset.format_label, width: asset.width, height: asset.height, created_at: asset.created_at });
  } catch (err) {
    console.error('Creative AI error:', err);
    res.status(500).json({ error: 'Errore generazione: ' + err.message });
  }
});

// Delete asset
router.delete('/creative-assets/:id', async (req, res) => {
  try {
    await deleteCreativeAsset(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Media Hub ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ
router.get('/media', async (req, res) => {
  try {
    const brand_id = req.query.brand_id;
    if (!brand_id) return res.status(400).json({ error: 'brand_id richiesto' });
    const type = req.query.type || 'all';
    const campaign_id = req.query.campaign_id || null;
    const items = await listMedia(brand_id, type, campaign_id);
    res.json(items);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/media', async (req, res) => {
  try {
    let { brand_id, campaign_id, type, title, image_base64 } = req.body;
    if (!brand_id || !image_base64) return res.status(400).json({ error: 'brand_id e image_base64 richiesti' });
    // Convert PDF to PNG if needed
    image_base64 = await pdfToPngIfNeeded(image_base64);
    const item = await createMedia({ brand_id, campaign_id: campaign_id || null, type, title, image_base64 });
    res.json(item);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/media/:id', async (req, res) => {
  try {
    await deleteMedia(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Bulk delete all media for a brand
router.delete('/media', async (req, res) => {
  try {
    const brand_id = req.query.brand_id;
    if (!brand_id) return res.status(400).json({ error: 'brand_id richiesto' });
    const items = await listMedia(brand_id);
    for (const it of items) await deleteMedia(it.id);
    res.json({ ok: true, deleted: items.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Ad Serving Stats (protected) ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ
router.get('/ad-stats', async (req, res) => {
  try {
    const brand_id = req.query.brand_id;
    if (!brand_id) return res.status(400).json({ error: 'brand_id richiesto' });
    const campaign_id = req.query.campaign_id || null;
    const days = parseInt(req.query.days) || 30;
    const stats = await getAdStats(brand_id, campaign_id, days);
    res.json(stats);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/ad-timeline', async (req, res) => {
  try {
    const brand_id = req.query.brand_id;
    if (!brand_id) return res.status(400).json({ error: 'brand_id richiesto' });
    const campaign_id = req.query.campaign_id || null;
    const days = parseInt(req.query.days) || 30;
    const timeline = await getAdTimeline(brand_id, campaign_id, days);
    res.json(timeline);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Ad tag generator ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ returns embeddable code for a campaign
router.get('/ad-tag/:campaign_id', async (req, res) => {
  try {
    const campaign = await getCampaign(req.params.campaign_id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    const baseUrl = process.env.CUSTOM_DOMAIN ? `https://${process.env.CUSTOM_DOMAIN}` : `${req.protocol}://${req.get('host')}`;
    const w = parseInt(req.query.w) || 300;
    const h = parseInt(req.query.h) || 250;

    const iframeTag = `<iframe src="${baseUrl}/api/v1/serve/${campaign.id}?w=${w}&h=${h}" width="${w}" height="${h}" frameborder="0" scrolling="no" style="border:none;overflow:hidden"></iframe>`;
    const scriptTag = `<script>!function(){var d=document,f=d.createElement('iframe');f.src='${baseUrl}/api/v1/serve/${campaign.id}?w=${w}&h=${h}';f.width=${w};f.height=${h};f.frameBorder=0;f.scrolling='no';f.style.cssText='border:none;overflow:hidden';d.currentScript.parentNode.insertBefore(f,d.currentScript)}()</script>`;
    const jsonUrl = `${baseUrl}/api/v1/serve/${campaign.id}?format=json`;

    res.json({
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      formats: {
        iframe: iframeTag,
        script: scriptTag,
        json_endpoint: jsonUrl,
        direct_image: `${baseUrl}/api/v1/serve/${campaign.id}/image`
      },
      tracking: {
        pixel: `${baseUrl}/api/v1/pixel/${campaign.id}`,
        click: `${baseUrl}/api/v1/click/${campaign.id}`
      }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Banner Builder endpoints ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ

// Get available templates & formats
router.get('/banners/templates', (req, res) => {
  res.json({ templates: BANNER_TEMPLATES, formats: IAB_FORMATS });
});

// Generate HTML5 banner preview (does not save)
router.post('/banners/preview', async (req, res) => {
  try {
    const { brandName, headline, subheadline, ctaText, clickUrl, logoUrl, backgroundUrl, bgColor, fgColor, accentColor, format, template } = req.body;
    const brand_id = req.query.brand_id || req.body.brand_id;
    const baseUrl = process.env.CUSTOM_DOMAIN ? `https://${process.env.CUSTOM_DOMAIN}` : `${req.protocol}://${req.get('host')}`;

    const html = generateBanner({
      brandName, headline, subheadline, ctaText,
      clickUrl: clickUrl || '#',
      pixelUrl: '',
      logoUrl, backgroundUrl,
      bgColor, fgColor, accentColor,
      format: format || '300x250',
      template: template || 'fade-slide'
    });

    res.json({ html, format: format || '300x250', template: template || 'fade-slide' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Generate and save as creative asset
router.post('/banners/generate', async (req, res) => {
  try {
    const { brandName, headline, subheadline, ctaText, clickUrl, logoUrl, backgroundUrl, bgColor, fgColor, accentColor, format, template, campaign_id, title } = req.body;
    const brand_id = req.query.brand_id || req.body.brand_id;
    if (!brand_id) return res.status(400).json({ error: 'brand_id required' });

    const baseUrl = process.env.CUSTOM_DOMAIN ? `https://${process.env.CUSTOM_DOMAIN}` : `${req.protocol}://${req.get('host')}`;
    const pixelUrl = campaign_id ? `${baseUrl}/api/v1/pixel/${campaign_id}` : '';
    const clickTarget = campaign_id ? `${baseUrl}/api/v1/click/${campaign_id}` : (clickUrl || '#');

    const html = generateBanner({
      brandName, headline, subheadline, ctaText,
      clickUrl: clickTarget,
      pixelUrl,
      logoUrl, backgroundUrl,
      bgColor, fgColor, accentColor,
      format: format || '300x250',
      template: template || 'fade-slide'
    });

    // Save as media asset (type: banner)
    const fmtInfo = IAB_FORMATS[format] || IAB_FORMATS['300x250'];
    const mediaId = uuidv4();
    const assetTitle = title || `Banner ${fmtInfo.label} - ${template || 'fade-slide'}`;

    await createMedia({
      id: mediaId,
      brand_id,
      type: 'banner',
      title: assetTitle,
      image_base64: Buffer.from(html).toString('base64'),
      width: fmtInfo.w,
      height: fmtInfo.h
    });

    res.json({
      id: mediaId,
      title: assetTitle,
      format,
      template,
      width: fmtInfo.w,
      height: fmtInfo.h,
      html
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Serve a saved banner creative
router.get('/banners/:id/serve', async (req, res) => {
  try {
    const media = await getMedia(req.params.id);
    if (!media) return res.status(404).send('Not found');
    if (media.type !== 'banner') return res.status(400).send('Not a banner');
    const html = Buffer.from(media.image_base64, 'base64').toString('utf-8');
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(html);
  } catch (err) { res.status(500).send('Error'); }
});

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Video Builder endpoints ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ

// Get available video templates & formats
router.get('/videos/templates', (req, res) => {
  res.json({ templates: VIDEO_TEMPLATES, formats: VIDEO_FORMATS });
});

// Generate video and return as downloadable MP4
router.post('/videos/generate', async (req, res) => {
  try {
    const { headline, subheadline, ctaText, brandName, bgColor, fgColor, accentColor, format, template, duration } = req.body;
    const brand_id = req.query.brand_id || req.body.brand_id;

    // If there's a logo in media, get its path
    let logoPath = null;
    let backgroundPath = null;

    // Generate video
    const result = await generateVideo({
      headline, subheadline, ctaText, brandName,
      bgColor, fgColor, accentColor,
      format: format || '1080x1080',
      template: template || 'brand-reveal',
      duration: duration || undefined,
      logoPath, backgroundPath
    });

    // Send the file
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Length', result.size);

    const stream = require('fs').createReadStream(result.path);
    stream.pipe(res);
    stream.on('end', () => cleanupVideo(result.tmpDir));
    stream.on('error', () => cleanupVideo(result.tmpDir));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate video and save as media asset (base64 stored in DB)
router.post('/videos/save', async (req, res) => {
  try {
    const { headline, subheadline, ctaText, brandName, bgColor, fgColor, accentColor, format, template, duration, title } = req.body;
    const brand_id = req.query.brand_id || req.body.brand_id;
    if (!brand_id) return res.status(400).json({ error: 'brand_id required' });

    const result = await generateVideo({
      headline, subheadline, ctaText, brandName,
      bgColor, fgColor, accentColor,
      format: format || '1080x1080',
      template: template || 'brand-reveal',
      duration: duration || undefined
    });

    // Read file and store as base64
    const videoBuffer = require('fs').readFileSync(result.path);
    const videoBase64 = videoBuffer.toString('base64');

    const mediaId = uuidv4();
    const fmtInfo = VIDEO_FORMATS[format] || VIDEO_FORMATS['1080x1080'];
    const assetTitle = title || `Video ${fmtInfo.label} - ${template || 'brand-reveal'}`;

    await createMedia({
      id: mediaId,
      brand_id,
      type: 'video',
      title: assetTitle,
      image_base64: videoBase64,
      width: fmtInfo.w,
      height: fmtInfo.h
    });

    cleanupVideo(result.tmpDir);

    res.json({
      id: mediaId,
      title: assetTitle,
      format,
      template,
      width: fmtInfo.w,
      height: fmtInfo.h,
      duration: result.duration,
      size: result.size
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve a saved video
router.get('/videos/:id/serve', async (req, res) => {
  try {
    const media = await getMedia(req.params.id);
    if (!media) return res.status(404).send('Not found');
    if (media.type !== 'video') return res.status(400).send('Not a video');
    const videoBuf = Buffer.from(media.image_base64, 'base64');
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', videoBuf.length);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(videoBuf);
  } catch (err) { res.status(500).send('Error'); }
});

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Instant Win ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ

// List campaigns for a brand
router.get('/instant-win', async (req, res) => {
  try {
    const brand_id = req.query.brand_id;
    if (!brand_id) return res.status(400).json({ error: 'brand_id richiesto' });
    const campaigns = await listInstantWinCampaigns(brand_id);
    res.json(campaigns);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Stats for a brand
router.get('/instant-win/stats', async (req, res) => {
  try {
    const brand_id = req.query.brand_id;
    if (!brand_id) return res.status(400).json({ error: 'brand_id richiesto' });
    const stats = await getInstantWinStats(brand_id);
    res.json(stats);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get single campaign
router.get('/instant-win/:id', async (req, res) => {
  try {
    const campaign = await getInstantWinCampaign(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campagna non trovata' });
    res.json(campaign);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Create campaign
router.post('/instant-win', async (req, res) => {
  try {
    const campaign = await createInstantWinCampaign(req.body);
    res.json(campaign);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update campaign
router.put('/instant-win/:id', async (req, res) => {
  try {
    const campaign = await updateInstantWinCampaign(req.params.id, req.body);
    if (!campaign) return res.status(404).json({ error: 'Campagna non trovata' });
    res.json(campaign);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete campaign
router.delete('/instant-win/:id', async (req, res) => {
  try {
    await deleteInstantWinCampaign(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// List plays for a campaign
router.get('/instant-win/:id/plays', async (req, res) => {
  try {
    const plays = await listInstantWinPlays(req.params.id);
    res.json(plays);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Play endpoint (public, no auth) ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ
// Called from the game page when user plays
router.post('/play/:serial_number', async (req, res) => {
  try {
    const { serial_number } = req.params;
    const { campaign_id, player_email, player_phone, player_first_name, player_last_name, privacy_accepted } = req.body;

    // Validate player data (required before playing)
    if (!player_email || !player_first_name || !player_last_name) {
      return res.status(400).json({ error: 'Compila tutti i campi obbligatori (nome, cognome, email)' });
    }

    // Find the pass by serial
    const pass = await getPassBySerial(serial_number);
    if (!pass) return res.status(404).json({ error: 'Pass non trovato' });

    // Get campaign
    const campaign = await getInstantWinCampaign(campaign_id);
    if (!campaign) return res.status(404).json({ error: 'Campagna non trovata' });
    if (campaign.status !== 'active') return res.status(400).json({ error: 'Campagna non attiva' });
    if (campaign.brand_id !== pass.brand_id) return res.status(403).json({ error: 'Brand mismatch' });

    // Check date range
    const now = new Date();
    if (campaign.start_date && new Date(campaign.start_date) > now)
      return res.status(400).json({ error: 'Campagna non ancora iniziata' });
    if (campaign.end_date && new Date(campaign.end_date) < now)
      return res.status(400).json({ error: 'Campagna terminata' });

    // Check max plays per user
    const playCount = await countPlaysForUser(campaign_id, serial_number);
    if (campaign.max_plays_per_user && playCount >= campaign.max_plays_per_user)
      return res.status(400).json({ error: 'Hai giÃÂÃÂÃÂÃÂ  giocato il massimo numero di volte', already_played: true });

    // Check budget
    if (campaign.total_budget && campaign.total_wins >= campaign.total_budget)
      return res.status(400).json({ error: 'Premi esauriti', budget_exhausted: true });

    // Determine result
    const rand = Math.random();
    const isWin = rand < parseFloat(campaign.win_probability);
    // If budget would be exceeded, force lose
    const result = (isWin && (!campaign.total_budget || campaign.total_wins < campaign.total_budget))
      ? 'win' : 'lose';

    const play = await createInstantWinPlay({
      campaign_id,
      serial_number,
      brand_id: pass.brand_id,
      result,
      prize_name: result === 'win' ? campaign.prize_name : null,
      player_email: player_email || null,
      player_phone: player_phone || null,
      player_first_name: player_first_name || null,
      player_last_name: player_last_name || null,
      privacy_accepted: privacy_accepted || false
    });

    // Log event
    await logEvent({
      pass_id: pass.id,
      brand_id: pass.brand_id,
      event_type: `instant_win_${result}`,
      metadata: { campaign_id, game_type: campaign.game_type, prize_name: play.prize_name }
    });

    res.json({
      result,
      prize_name: result === 'win' ? campaign.prize_name : null,
      prize_description: result === 'win' ? campaign.prize_description : null,
      play_id: play.id
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Remove Instant Win from pass (resets brand config) ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ
router.post('/instant-win/:id/deactivate', async (req, res) => {
  try {
    const campaign = await getInstantWinCampaign(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campagna non trovata' });
    // Remove instantWinActive from brand config
    const brand = await getBrand(campaign.brand_id);
    if (brand) {
      const config = brand.config || {};
      delete config.instantWinActive;
      delete config.stripOverride;
      await updateBrand(campaign.brand_id, { config });
    }
    // Set campaign status to ended
    await updateInstantWinCampaign(req.params.id, { status: 'ended' });
    res.json({ ok: true, message: 'Campagna disattivata e link rimosso dal pass' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Game page info (public, no auth) ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ
// Returns campaign info for the game page to render
router.get('/play/:serial_number/info', async (req, res) => {
  try {
    const { serial_number } = req.params;
    const pass = await getPassBySerial(serial_number);
    if (!pass) return res.status(404).json({ error: 'Pass non trovato' });

    const brand = await getBrand(pass.brand_id);

    // Find active campaign for this brand
    const campaigns = await listInstantWinCampaigns(pass.brand_id);
    const activeCampaign = campaigns.find(c => c.status === 'active');
    if (!activeCampaign) return res.status(404).json({ error: 'Nessuna campagna attiva' });

    // Check if user already played
    const playCount = await countPlaysForUser(activeCampaign.id, serial_number);
    const canPlay = !activeCampaign.max_plays_per_user || playCount < activeCampaign.max_plays_per_user;

    // Check if this serial already has player data from a previous play
    let registeredPlayer = null;
    const { pool } = require('../db');
    const prevPlay = await pool.query(
      `SELECT player_first_name, player_last_name, player_email, player_phone
       FROM instant_win_plays WHERE serial_number = $1 AND player_email IS NOT NULL
       ORDER BY played_at DESC LIMIT 1`,
      [serial_number]
    );
    if (prevPlay.rows.length > 0) {
      registeredPlayer = prevPlay.rows[0];
    }

    res.json({
      campaign_id: activeCampaign.id,
      game_type: activeCampaign.game_type,
      name: activeCampaign.name,
      prize_name: activeCampaign.prize_name,
      prize_description: activeCampaign.prize_description,
      brand_name: brand?.name || 'Brand',
      brand_colors: brand?.config?.colors || {},
      can_play: canPlay,
      plays_remaining: activeCampaign.max_plays_per_user
        ? Math.max(0, activeCampaign.max_plays_per_user - playCount)
        : null,
      config: activeCampaign.config || {},
      registered_player: registeredPlayer
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Leads Database (aggregated player data) ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ
router.get('/brands/:brand_id/leads', async (req, res) => {
  try {
    const { brand_id } = req.params;
    const { pool } = require('../db');

    // Get unique leads by serial_number with their latest player data,
    // joined with pass_instances for pass_id and device_registrations for device_id
    const result = await pool.query(`
      SELECT
        p.serial_number,
        p.player_first_name,
        p.player_last_name,
        p.player_email,
        p.player_phone,
        p.registered_at,
        pi.id AS pass_id,
        dr.device_library_id AS device_id
      FROM (
        SELECT
          serial_number,
          MAX(player_first_name) AS player_first_name,
          MAX(player_last_name) AS player_last_name,
          MAX(player_email) AS player_email,
          MAX(player_phone) AS player_phone,
          MIN(played_at) AS registered_at
        FROM instant_win_plays
        WHERE brand_id = $1 AND player_email IS NOT NULL
        GROUP BY serial_number
      ) p
      LEFT JOIN pass_instances pi ON pi.serial_number = p.serial_number
      LEFT JOIN device_registrations dr ON dr.serial_number = p.serial_number
      ORDER BY p.registered_at DESC
    `, [brand_id]);

    const leads = result.rows;
    const withDevice = leads.filter(l => l.device_id).length;
    const withPhone = leads.filter(l => l.player_phone).length;
    const withEmail = leads.filter(l => l.player_email).length;

    res.json({
      leads,
      total_leads: leads.length,
      with_device: withDevice,
      with_phone: withPhone,
      with_email: withEmail
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Gamification Campaigns CRUD ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ

router.get('/gamification/campaigns/:brand_id', async (req, res) => {
  try {
    const campaigns = await listGamificationCampaigns(req.params.brand_id);
    res.json(campaigns);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/gamification/campaign/:id', async (req, res) => {
  try {
    const campaign = await getGamificationCampaign(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campagna non trovata' });
    res.json(campaign);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/gamification/campaigns', async (req, res) => {
  try {
    const campaign = await createGamificationCampaign(req.body);
    res.status(201).json(campaign);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/gamification/campaign/:id', async (req, res) => {
  try {
    const campaign = await updateGamificationCampaign(req.params.id, req.body);
    if (!campaign) return res.status(404).json({ error: 'Campagna non trovata' });
    res.json(campaign);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/gamification/campaign/:id', async (req, res) => {
  try {
    await deleteGamificationCampaign(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/gamification/stats/:brand_id', async (req, res) => {
  try {
    const stats = await getGamificationStats(req.params.brand_id);
    res.json(stats);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/gamification/plays/:campaign_id', async (req, res) => {
  try {
    const plays = await listGamificationPlays(req.params.campaign_id, {
      limit: parseInt(req.query.limit) || 100
    });
    res.json(plays);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Gamification Game Info (public, no auth) ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ

router.get('/game/:serial_number/info', async (req, res) => {
  try {
    const { serial_number } = req.params;
    const pass = await getPassBySerial(serial_number);
    if (!pass) return res.status(404).json({ error: 'Pass non trovato' });

    const brand = await getBrand(pass.brand_id);
    if (!brand) return res.status(404).json({ error: 'Brand non trovato' });

    // Find active gamification campaign for this brand
    const allCampaigns = await listGamificationCampaigns(pass.brand_id);
    const activeCampaign = allCampaigns.find(c => c.status === 'active');

    // Check if player already registered (from gamification or instant win plays)
    let registeredPlayer = null;
    const prevPlay = await pool.query(
      `SELECT player_first_name, player_last_name, player_email, player_phone
       FROM gamification_plays WHERE serial_number = $1 AND player_email IS NOT NULL
       ORDER BY played_at DESC LIMIT 1`,
      [serial_number]
    );
    if (prevPlay.rows.length > 0) {
      registeredPlayer = prevPlay.rows[0];
    } else {
      // Fallback: check instant_win_plays too
      const iwPlay = await pool.query(
        `SELECT player_first_name, player_last_name, player_email, player_phone
         FROM instant_win_plays WHERE serial_number = $1 AND player_email IS NOT NULL
         ORDER BY played_at DESC LIMIT 1`,
        [serial_number]
      );
      if (iwPlay.rows.length > 0) registeredPlayer = iwPlay.rows[0];
    }

    res.json({
      brand: { id: brand.id, name: brand.name, slug: brand.slug, config: brand.config },
      campaign: activeCampaign || null,
      serial_number,
      registered_player: registeredPlayer
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Gamification Play endpoint (public, no auth) ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ

router.post('/game/:serial_number', async (req, res) => {
  try {
    const { serial_number } = req.params;
    const { campaign_id, completion_time_secs, score,
            player_email, player_phone, player_first_name, player_last_name, privacy_accepted } = req.body;

    const pass = await getPassBySerial(serial_number);
    if (!pass) return res.status(404).json({ error: 'Pass non trovato' });

    const campaign = await getGamificationCampaign(campaign_id);
    if (!campaign) return res.status(404).json({ error: 'Campagna non trovata' });
    if (campaign.status !== 'active') return res.status(400).json({ error: 'Campagna non attiva' });
    if (campaign.brand_id !== pass.brand_id) return res.status(403).json({ error: 'Brand mismatch' });

    // Check date range
    const now = new Date();
    if (campaign.start_date && new Date(campaign.start_date) > now)
      return res.status(400).json({ error: 'Campagna non ancora iniziata' });
    if (campaign.end_date && new Date(campaign.end_date) < now)
      return res.status(400).json({ error: 'Campagna terminata' });

    // Check max plays per user
    const playCount = await countGamificationPlaysForUser(campaign_id, serial_number);
    if (campaign.max_plays_per_user && playCount >= campaign.max_plays_per_user)
      return res.status(400).json({ error: 'Hai giÃÂÃÂÃÂÃÂ  giocato il massimo numero di volte', already_played: true });

    // Determine tier based on completion time
    const timeSecs = parseFloat(completion_time_secs);
    let tier = 'none';
    let prizeName = null;
    if (timeSecs <= parseFloat(campaign.gold_threshold_secs)) {
      tier = 'gold';
      prizeName = campaign.gold_prize;
    } else if (timeSecs <= parseFloat(campaign.silver_threshold_secs)) {
      tier = 'silver';
      prizeName = campaign.silver_prize;
    } else if (timeSecs <= parseFloat(campaign.bronze_threshold_secs)) {
      tier = 'bronze';
      prizeName = campaign.bronze_prize;
    }

    const play = await createGamificationPlay({
      campaign_id,
      serial_number,
      brand_id: pass.brand_id,
      completion_time_secs: timeSecs,
      tier,
      prize_name: prizeName,
      score: score || 0,
      player_email: player_email || null,
      player_phone: player_phone || null,
      player_first_name: player_first_name || null,
      player_last_name: player_last_name || null,
      privacy_accepted: privacy_accepted || false
    });

    // Log event
    await logEvent({
      pass_id: pass.id,
      brand_id: pass.brand_id,
      event_type: `gamification_${tier}`,
      metadata: { campaign_id, game_type: campaign.game_type, completion_time_secs: timeSecs, tier, prize_name: prizeName }
    });

    res.json({
      result: tier !== 'none' ? 'win' : 'lose',
      tier,
      prize_name: prizeName,
      completion_time_secs: timeSecs,
      play_id: play.id
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Google Wallet ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ

/**
 * GET /api/v1/google-wallet/pass/:id - Get "Add to Google Wallet" link
 */
router.get('/google-wallet/pass/:id', async (req, res) => {
  try {
    if (!googleWallet.isConfigured()) {
      return res.status(501).json({ error: 'Google Wallet not configured' });
    }

    const instance = await getPassInstance(req.params.id);
    if (!instance) return res.status(404).json({ error: 'Pass not found' });

    const template = await getTemplate(instance.template_id);
    const brand = await getBrand(instance.brand_id);

    await googleWallet.createOrUpdatePassClass(brand, template);

    const passObject = googleWallet.buildPassObject(brand, template, instance, instance.customer_data);

    await googleWallet.createPassObjectOnServer(passObject);
    await updatePassInstance(instance.id, {
      google_wallet_object_id: passObject.id,
      google_wallet_saved: false,
      google_installed_at: null
    });

    const saveLink = googleWallet.generateSaveLink(passObject);

    await logEvent({
      brand_id: instance.brand_id,
      pass_id: instance.id,
      event_type: 'google_wallet_link_generated',
      metadata: {}
    });

    res.json({ save_link: saveLink });
  } catch (err) {
    console.error('[GoogleWallet] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v1/google-wallet/status - Config + URL callback effettivo (come in createOrUpdatePassClass)
 */
router.get('/google-wallet/status', (req, res) => {
  res.json(googleWallet.getStatusInfo());
});

/**
 * GET /api/v1/google-wallet/callback — solo spiegazione (il browser fa GET; Google usa POST)
 */
router.get('/google-wallet/callback', (req, res) => {
  res.type('html').send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Google Wallet callback</title></head><body style="font-family:system-ui,sans-serif;max-width:640px;margin:40px auto;line-height:1.5;padding:16px;">
<h1>Endpoint attivo</h1>
<p>Questo indirizzo non va “aperto” nel browser per funzionare.</p>
<p><strong>Google Wallet</strong> invia qui una richiesta <code>POST</code> quando un utente <strong>salva</strong> o <strong>rimuove</strong> il pass dall’app Google Wallet. Il server aggiorna il database (stato GW / GW°).</p>
<p>Se apri questo link nel browser vedi questa pagina; se prima vedevi “Cannot GET”, era normale: mancava proprio questa risposta GET informativa.</p>
<p style="color:#666;font-size:14px;">Metodo atteso dalle notifiche: <code>POST</code> · Payload: eventi firmati / JSON da Google.</p>
</body></html>`);
});

/**
 * POST /api/v1/google-wallet/callback - Google Wallet event callback
 *
 * Google sends a POST when a user saves or deletes a pass.
 * We use this to update the pass installation status in our DB.
 */
router.post('/google-wallet/callback', async (req, res) => {
  try {
    console.log('[GoogleWallet Callback] Received:', JSON.stringify(req.body).substring(0, 500));

    const { classId, objectId, eventType, signedMessage } = req.body;

    let eventData = req.body;
    if (signedMessage) {
      try {
        const parts = signedMessage.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
          eventData = payload;
          console.log('[GoogleWallet Callback] Decoded JWT payload:', JSON.stringify(payload).substring(0, 500));
        }
      } catch (e) {
        console.log('[GoogleWallet Callback] JWT decode note:', e.message);
      }
    }

    const evtObjectId = eventData.objectId || objectId;
    const evtType = eventData.eventType || eventType;

    if (!evtObjectId) {
      console.log('[GoogleWallet Callback] No objectId in payload, ignoring');
      return res.status(200).send('OK');
    }

    if (evtType === 'save' || evtType === 'SAVE') {
      const pass = await updateGoogleWalletStatus(evtObjectId, true);
      if (pass) {
        await logEvent({
          pass_id: pass.id,
          brand_id: pass.brand_id,
          event_type: 'google_wallet_installed',
          metadata: { object_id: evtObjectId }
        });
        await updatePassDeviceId(pass.serial_number, evtObjectId, 'google');
        console.log('[GoogleWallet Callback] Pass ' + pass.id + ' marked as installed (device_id set)');
      } else {
        console.log('[GoogleWallet Callback] No pass found for objectId: ' + evtObjectId);
      }
    } else if (evtType === 'del' || evtType === 'DEL' || evtType === 'delete' || evtType === 'DELETE') {
      const pass = await updateGoogleWalletStatus(evtObjectId, false);
      if (pass) {
        await logEvent({
          pass_id: pass.id,
          brand_id: pass.brand_id,
          event_type: 'google_wallet_removed',
          metadata: { object_id: evtObjectId }
        });
        console.log('[GoogleWallet Callback] Pass ' + pass.id + ' marked as removed');
      }
    } else {
      console.log('[GoogleWallet Callback] Unknown event type: ' + evtType);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('[GoogleWallet Callback] Error:', error);
    res.status(200).send('OK');
  }
});

module.exports = router;
