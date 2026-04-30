const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { sendWelcomeEmail, sendUserInviteEmail } = require('../engine/mailer');
const {
  createBrand,
  createTemplate,
  createPassInstance,
  getPassInstance,
  getPassBySerial,
  updatePassInstance,
  touchPass,
  logEvent,
  getAnalytics,
  registerDevice,
  getDevicesForPass,
  getBrand,
  getBrandBySlug,
  getTemplate,
  updateBrand,
  deleteBrand,
  updateTemplate,
  deleteTemplate,
  deletePass,
  listBrands,
  listTemplates,
  listPasses,
  listEvents,
  unregisterDevice,
  getSerialsForDevice,
  // Rewards
  createReward,
  listRewards,
  getReward,
  updateReward,
  deleteReward,
  // Challenges
  createChallenge,
  listChallenges,
  getChallenge,
  updateChallenge,
  deleteChallenge,
  // Tiers
  createTier,
  listTiers,
  getTier,
  updateTier,
  deleteTier,
  // VIP Cards
  createVipCard,
  listVipCards,
  getVipCard,
  updateVipCard,
  deleteVipCard,
  // Reward Claims
  claimReward,
  listClaims,
  // Challenge Completions
  completeChallenge,
  completeChallengeForMember,
  listCompletions,
  // Challenge Progress
  getChallengeProgress,
  getProgressForChallenge,
  // Push Log
  logPush,
  listPushes,
  deletePush,
  clearPushHistory,
  getDevicesForBrand,
  // Members
  createMember,
  getMember,
  listMembers,
  updateMember,
  deleteMember,
  bulkCreateMembers,
  // Scheduled Push
  createScheduledPush,
  listScheduledPush,
  getScheduledPush,
  updateScheduledPush,
  deleteScheduledPush,
  getDueScheduledPush,
  // Playtomic Sync
  listSyncLogs,
  // Users
  createUser,
  getUserByEmail,
  getUser,
  listUsers,
  updateUser,
  deleteUser,
  verifyPassword,
  // Referral
  getMemberByReferralCode,
  incrementReferralCount,
  // Analytics
  logAnalyticsEvent,
  getAnalyticsStats,
  // Points Log
  logPoints,
  pool
} = require('../db');
const { createPkpass } = require('../engine/passkit');
const { sendPushUpdate } = require('../engine/apns');
const { runFullSync } = require('../engine/playtomic');
const { evaluateChallenges } = require('../engine/challenges');
const { runRecap, sendBrandRecap } = require('../engine/email-recap');
const sharp = require('sharp');
const XLSX = require('xlsx');
const jwt = require('jsonwebtoken');

const router = express.Router();

// JWT secret — use env var in production
const JWT_SECRET = process.env.JWT_SECRET || 'nudj-secret-change-me-in-prod';
const JWT_EXPIRES = '7d';

// ============================================================================
// AUTH MIDDLEWARE
// ============================================================================

/**
 * Auth middleware — verifies JWT token from Authorization header or cookie
 * Attaches req.user = { id, email, name, role, brand_id }
 * Non-auth routes (landing, pass download, Apple Wallet callbacks) skip this
 */
function authMiddleware(req, res, next) {
  // Skip auth for public routes (login, signup, pass download, Apple Wallet callbacks, seed endpoints)
  const publicPrefixes = [
    '/auth/login',
    '/signup',              // landing page signup
    '/brands/',             // brand slug lookup (used by landing page)
    '/landing/',            // landing page API (brand by slug, pass info)
    '/passes/signup',       // public signup endpoint
    '/rewards/seed', '/challenges/seed', '/challenges/migrate-triggers', '/rewards/check', '/rewards/fix-brand', '/cleanup/non-padel', '/cleanup/strip/'
  ];
  // Apple Wallet device registration paths & pass downloads
  if (req.path.match(/\/devices\//) || req.path.match(/\/passes\/.*\/pkpass/) || req.path.match(/\/passes\/.*\/download/)) return next();
  if (publicPrefixes.some(p => req.path.startsWith(p))) return next();

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Token mancante. Effettua il login.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token non valido o scaduto.' });
  }
}

/**
 * Admin-only middleware — must be called after authMiddleware
 */
function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accesso riservato agli amministratori.' });
  }
  next();
}

/**
 * Brand filter middleware — if user is manager, force brand_id filter
 * Modifies req.query.brand_id and req.body.brand_id
 */
function brandFilter(req, res, next) {
  if (req.user && req.user.role === 'manager' && req.user.brand_id) {
    req.query.brand_id = req.user.brand_id;
    if (req.body) req.body.brand_id = req.user.brand_id;
  }
  next();
}

// ============================================================================
// AUTH ENDPOINTS (public, no auth required)
// ============================================================================

/**
 * POST /api/v1/auth/login
 */
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e password sono obbligatorie.' });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Credenziali non valide.' });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Credenziali non valide.' });
    }

    const payload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      brand_id: user.brand_id
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    res.json({
      token,
      user: payload
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/auth/me — get current user from token
 */
router.get('/auth/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// ============================================================================
// USER MANAGEMENT (admin only)
// ============================================================================

/**
 * GET /api/v1/users — list all users (admin only)
 */
router.get('/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const users = await listUsers(req.query.brand_id || null);
    res.json(users);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/**
 * POST /api/v1/users — create user (admin only)
 */
router.post('/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { email, password, name, role, brand_id } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password e nome sono obbligatori.' });
    }
    if (role && !['admin', 'manager'].includes(role)) {
      return res.status(400).json({ error: 'Ruolo non valido. Usa admin o manager.' });
    }
    const user = await createUser({ email, password, name, role: role || 'manager', brand_id });

    // Send invite email with credentials
    let brandName = null;
    if (brand_id) {
      const brand = await getBrand(brand_id);
      if (brand) brandName = brand.name;
    }
    const dashboardUrl = `https://${(process.env.CUSTOM_DOMAIN || 'www.nudj.studio').replace(/^nudj\.studio$/, 'www.nudj.studio')}/dashboard/`;
    sendUserInviteEmail({
      to: email,
      name,
      password,
      role: role || 'manager',
      brandName,
      dashboardUrl
    }).catch(err => console.error('Invite email error:', err));

    res.status(201).json(user);
  } catch (e) {
    if (e.message.includes('duplicate') || e.message.includes('unique')) {
      return res.status(409).json({ error: 'Email già registrata.' });
    }
    res.status(500).json({ error: e.message });
  }
});

/**
 * PUT /api/v1/users/:id — update user (admin only)
 */
router.put('/users/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const user = await updateUser(req.params.id, req.body);
    if (!user) return res.status(404).json({ error: 'Utente non trovato.' });
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/**
 * DELETE /api/v1/users/:id — delete user (admin only)
 */
router.delete('/users/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    await deleteUser(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/**
 * PUT /api/v1/auth/change-password — change own password
 */
router.put('/auth/change-password', authMiddleware, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Password attuale e nuova sono obbligatorie.' });
    }
    const user = await getUserByEmail(req.user.email);
    const valid = await verifyPassword(current_password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Password attuale non corretta.' });

    await updateUser(req.user.id, { password: new_password });
    res.json({ success: true, message: 'Password aggiornata.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Apply auth + brand filter to all routes below
router.use(authMiddleware);
router.use(brandFilter);

// Custom domain for short landing URLs (fallback to request host)
const CUSTOM_DOMAIN = (process.env.CUSTOM_DOMAIN || 'www.nudj.studio').replace(/^nudj\.studio$/, 'www.nudj.studio');

// Helper to ensure cache directory exists
function ensureCacheDir() {
  const cacheDir = path.join(__dirname, '../../data/pkpass-cache');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  return cacheDir;
}

// ============================================================================
// BRAND MANAGEMENT
// ============================================================================

/**
 * POST /api/v1/brands - Create a new brand
 */
router.post('/brands', async (req, res) => {
  try {
    const { name, slug, config } = req.body;

    if (!name || !slug) {
      return res.status(400).json({
        error: 'Name and slug are required'
      });
    }

    const brand = await createBrand({
      name,
      slug,
      config: config || {}
    });

    await logEvent({
      brand_id: brand.id,
      event_type: 'brand_created',
      metadata: { name }
    });

    res.status(201).json(brand);
  } catch (error) {
    console.error('Error creating brand:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/v1/brands - List all brands
 */
router.get('/brands', async (req, res) => {
  try {
    let brands = await listBrands();
    // Filter for manager users — only show their assigned brand
    if (req.user && req.user.role === 'manager' && req.user.brand_id) {
      brands = brands.filter(b => b.id === req.user.brand_id);
    }
    res.json(brands);
  } catch (error) {
    console.error('Error listing brands:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/brands/by-slug/:slug - Get brand by slug
 */
router.get('/brands/by-slug/:slug', async (req, res) => {
  try {
    const brand = await getBrandBySlug(req.params.slug);
    if (!brand) return res.status(404).json({ error: 'Brand not found' });
    res.json(brand);
  } catch (error) {
    console.error('Error getting brand by slug:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/brands/:id - Get brand details
 */
router.get('/brands/:id', async (req, res) => {
  try {
    const brand = await getBrand(req.params.id);

    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    res.json(brand);
  } catch (error) {
    console.error('Error getting brand:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/brands/:id/logo - Serve brand logo as PNG image
 * Priority: static file (slug-based) > landing_logo in DB > logo@2x > logo > icon
 */
router.get('/brands/:id/logo', async (req, res) => {
  try {
    const brand = await getBrand(req.params.id);
    if (!brand) return res.status(404).send('Not found');

    const logos = brand.config?.logos;

    // 1. DB landing_logo has highest priority (uploaded via dashboard)
    if (logos?.landing_logo) {
      const buf = Buffer.from(logos.landing_logo, 'base64');
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.send(buf);
    }

    // 2. Check for static file: public/assets/{slug}-logo.png
    if (brand.slug) {
      const staticPath = path.resolve(__dirname, '..', '..', 'public', 'assets', `${brand.slug}-logo.png`);
      if (fs.existsSync(staticPath)) {
        res.set('Content-Type', 'image/png');
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.sendFile(staticPath);
      }
    }

    // 3. Fallback to other DB logos
    const b64 = logos?.['logo@2x'] || logos?.logo || logos?.['icon@2x'] || logos?.icon;
    if (!b64) return res.status(404).send('No logo');

    const buf = Buffer.from(b64, 'base64');
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(buf);
  } catch (error) {
    res.status(500).send('Error');
  }
});

/**
 * PUT /api/v1/brands/:id - Update brand (name, config)
 */
router.put('/brands/:id', async (req, res) => {
  try {
    const { name, slug, config } = req.body;

    // Merge with existing brand config to preserve logos/strip/links etc.
    const existingBrand = await getBrand(req.params.id);
    if (!existingBrand) return res.status(404).json({ error: 'Brand not found' });
    const existingConfig = existingBrand.config || {};
    const mergedLogos = { ...(existingConfig.logos || {}) };

    // If logo uploaded, resize to Apple Wallet required sizes
    if (config?.logos?.logo) {
      const rawBuf = Buffer.from(config.logos.logo, 'base64');
      const logo1x = await sharp(rawBuf).resize(160, 50, { fit: 'contain', position: 'left', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
      const logo2x = await sharp(rawBuf).resize(320, 100, { fit: 'contain', position: 'left', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
      const icon1x = await sharp(rawBuf).resize(29, 29, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
      const icon2x = await sharp(rawBuf).resize(58, 58, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
      mergedLogos.logo = logo1x.toString('base64');
      mergedLogos['logo@2x'] = logo2x.toString('base64');
      mergedLogos.icon = icon1x.toString('base64');
      mergedLogos['icon@2x'] = icon2x.toString('base64');
      console.log('✓ Logo resized for Apple Wallet');
    }

    // If strip uploaded, store raw base64 (passkit.js resizes it)
    if (config?.logos?.strip) {
      mergedLogos.strip = config.logos.strip;
      console.log('✓ Strip image uploaded');
    }

    // If landing logo uploaded, store raw base64 (used on landing page)
    if (config?.logos?.landing_logo) {
      mergedLogos.landing_logo = config.logos.landing_logo;
      console.log('✓ Landing logo uploaded');
    }

    // Merge config: new values override, but preserve existing keys not in request
    const mergedConfig = { ...existingConfig, ...config, logos: mergedLogos };

    const updated = await updateBrand(req.params.id, { name, slug, config: mergedConfig });

    if (!updated) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    res.json(updated);
  } catch (err) {
    console.error('Error updating brand:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/v1/brands/:id/strip - Upload strip image (dedicated endpoint)
 */
router.post('/brands/:id/strip', async (req, res) => {
  try {
    const { strip } = req.body; // base64 string
    if (!strip) return res.status(400).json({ error: 'Missing strip base64 data' });

    const brand = await getBrand(req.params.id);
    if (!brand) return res.status(404).json({ error: 'Brand not found' });

    const existingConfig = brand.config || {};
    const logos = { ...(existingConfig.logos || {}), strip };
    const config = { ...existingConfig, logos };

    const updated = await updateBrand(req.params.id, { config });
    console.log('✓ Strip image saved for brand', req.params.id, '- base64 length:', strip.length);
    res.json({ success: true, stripLength: strip.length });
  } catch (err) {
    console.error('Error uploading strip:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/v1/brands/:id/ai-strip - Generate strip image via Replicate Flux AI
 */
router.post('/brands/:id/ai-strip', async (req, res) => {
  try {
    const { prompt, style } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

    const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
    if (!REPLICATE_API_TOKEN) {
      return res.status(503).json({ error: 'REPLICATE_API_TOKEN not configured' });
    }

    const brand = await getBrand(req.params.id);
    if (!brand) return res.status(404).json({ error: 'Brand not found' });

    // Build enhanced prompt for strip banner
    const styleHints = {
      dark: 'dark moody atmosphere, deep shadows, premium luxury feel',
      vibrant: 'vibrant vivid colors, energetic, bold contrast',
      minimal: 'clean minimalist, geometric shapes, soft tones',
      sport: 'dynamic sports action, motion blur, athletic energy',
      nature: 'natural outdoor scenery, organic textures, warm light'
    };
    const styleText = styleHints[style] || styleHints.dark;
    const fullPrompt = `Ultra-wide horizontal banner image, purely visual, NO text, NO letters, NO numbers, NO words, NO logos, NO watermarks, NO typography of any kind. ${styleText}. Subject: ${prompt}. Cinematic composition, 3:1 aspect ratio, high quality, photographic.`;

    console.log('🎨 AI Strip generation — brand:', brand.name, 'prompt:', prompt, 'style:', style);

    // Use replicate npm package for reliable API calls
    const Replicate = require('replicate');
    const replicate = new Replicate({ auth: REPLICATE_API_TOKEN });

    console.log('🎨 Calling Replicate flux-schnell...');

    const output = await replicate.run('black-forest-labs/flux-schnell', {
      input: {
        prompt: fullPrompt,
        num_outputs: 1,
        aspect_ratio: '21:9',
        output_format: 'png'
      }
    });

    console.log('🎨 Replicate output type:', typeof output, Array.isArray(output) ? 'array len ' + output.length : '');

    // Output is an array of ReadableStream or URLs
    let imageUrl;
    let imgBuffer;

    if (Array.isArray(output) && output.length > 0) {
      const item = output[0];
      if (typeof item === 'string') {
        // It's a URL string
        imageUrl = item;
        const imgRes = await fetch(imageUrl);
        imgBuffer = Buffer.from(await imgRes.arrayBuffer());
      } else if (item instanceof ReadableStream || (item && typeof item.read === 'function')) {
        // It's a stream — read it
        const chunks = [];
        for await (const chunk of item) {
          chunks.push(chunk);
        }
        imgBuffer = Buffer.concat(chunks);
      } else if (Buffer.isBuffer(item)) {
        imgBuffer = item;
      } else {
        // Try to fetch if it has a url property
        console.log('🎨 Unknown output format:', typeof item, JSON.stringify(item).substring(0, 200));
        return res.status(502).json({ error: 'Unexpected AI output format' });
      }
    } else if (typeof output === 'string') {
      imageUrl = output;
      const imgRes = await fetch(imageUrl);
      imgBuffer = Buffer.from(await imgRes.arrayBuffer());
    } else {
      console.error('🎨 Unexpected output:', typeof output, JSON.stringify(output).substring(0, 500));
      return res.status(502).json({ error: 'Unexpected AI output' });
    }

    if (!imgBuffer || imgBuffer.length === 0) {
      return res.status(502).json({ error: 'Empty image returned from AI' });
    }

    console.log('✓ AI Strip generated — image size:', imgBuffer.length, 'bytes');
    const base64 = `data:image/png;base64,${imgBuffer.toString('base64')}`;

    res.json({ success: true, image_url: imageUrl || 'stream', base64, prompt: fullPrompt });
  } catch (err) {
    console.error('Error generating AI strip:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/v1/brands/:id - Delete a brand and all related data
 */
router.delete('/brands/:id', async (req, res) => {
  try {
    const brand = await getBrand(req.params.id);
    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    await deleteBrand(req.params.id);
    res.json({ success: true, message: `Brand "${brand.name}" deleted` });
  } catch (err) {
    console.error('Error deleting brand:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// TEMPLATE MANAGEMENT
// ============================================================================

/**
 * POST /api/v1/templates - Create a new pass template
 */
router.post('/templates', async (req, res) => {
  try {
    const { brand_id, name, pass_type, style, fields, config } = req.body;

    if (!brand_id || !name) {
      return res.status(400).json({
        error: 'Brand ID and name are required'
      });
    }

    const brand = await getBrand(brand_id);
    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    const template = await createTemplate({
      brand_id,
      name,
      pass_type: pass_type || 'generic',
      style: style || {},
      fields: fields || [],
      config: config || {}
    });

    await logEvent({
      brand_id,
      event_type: 'template_created',
      metadata: { template_id: template.id, name }
    });

    res.status(201).json(template);
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/v1/templates - List templates (optional ?brand_id=)
 */
router.get('/templates', async (req, res) => {
  try {
    const templates = await listTemplates(req.query.brand_id);
    res.json(templates);
  } catch (error) {
    console.error('Error listing templates:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/templates/:id - Get template details
 */
router.get('/templates/:id', async (req, res) => {
  try {
    const template = await getTemplate(req.params.id);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(template);
  } catch (error) {
    console.error('Error getting template:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/v1/templates/:id - Update a template
 */
router.put('/templates/:id', async (req, res) => {
  try {
    const updated = await updateTemplate(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(updated);
  } catch (err) {
    console.error('Error updating template:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/v1/templates/:id - Delete a template and related passes
 */
router.delete('/templates/:id', async (req, res) => {
  try {
    const template = await getTemplate(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    await deleteTemplate(req.params.id);
    res.json({ success: true, message: `Template "${template.name}" deleted` });
  } catch (err) {
    console.error('Error deleting template:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// PASS GENERATION & MANAGEMENT
// ============================================================================

/**
 * POST /api/v1/passes - Generate a pass instance
 */
router.post('/passes', async (req, res) => {
  try {
    const { template_id, customer_data, field_values, member_id } = req.body;

    if (!template_id) {
      return res.status(400).json({
        error: 'Template ID is required'
      });
    }

    // Enforce one pass per member
    if (member_id) {
      const check = await pool.query('SELECT id FROM pass_instances WHERE member_id = $1 AND status = $2', [member_id, 'active']);
      if (check.rows.length > 0) {
        return res.status(400).json({ error: 'Questo membro ha già un pass attivo' });
      }
    }

    const template = await getTemplate(template_id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const brand = await getBrand(template.brand_id);
    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    // Create pass instance
    const passInstance = await createPassInstance({
      template_id,
      brand_id: brand.id,
      customer_data: customer_data || {},
      field_values: field_values || {},
      member_id: member_id || null
    });

    // Generate .pkpass file
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const pkpassBuffer = await createPkpass(template, passInstance, brand, {
      baseUrl
    });

    // Cache the pkpass file
    const cacheDir = ensureCacheDir();
    const pkpassPath = path.join(cacheDir, `${passInstance.id}.pkpass`);
    fs.writeFileSync(pkpassPath, pkpassBuffer);

    await logEvent({
      pass_id: passInstance.id,
      brand_id: brand.id,
      event_type: 'pass_created',
      metadata: { template_id, customer_email: customer_data?.email, source: 'dashboard' }
    });

    // If pass has welcome points (punti = '10' or similar) and is linked to a member, log the points
    const puntiValue = parseInt(field_values?.punti || '0');
    if (member_id && puntiValue > 0) {
      try {
        await logPoints({
          brand_id: brand.id,
          member_id: member_id,
          pass_id: passInstance.id,
          points: puntiValue,
          reason: 'signup',
          details: 'Punti di benvenuto'
        });
        console.log(`[CreatePass] Logged ${puntiValue} welcome points for member ${member_id}`);
      } catch(e) { console.error('[CreatePass] Error logging points:', e.message); }

      // Send welcome email if member has email
      if (member_id) {
        try {
          const memberData = await getMember(member_id);
          if (memberData && memberData.email) {
            const fullName = [memberData.first_name, memberData.last_name].filter(Boolean).join(' ') || 'Membro';
            const downloadUrl = `${baseUrl}/api/v1/passes/${passInstance.id}/download`;
            sendWelcomeEmail({
              to: memberData.email,
              name: fullName,
              brandName: brand.name,
              brandColor: brand.config?.backgroundColor || '#000000',
              points: puntiValue,
              downloadUrl
            }).catch(err => console.error('[CreatePass] Welcome email error:', err.message));
          }
        } catch(e) { console.error('[CreatePass] Member lookup error:', e.message); }
      }
    }

    const downloadUrl = `${baseUrl}/api/v1/passes/${passInstance.id}/download`;
    const brandSlug = brand.slug || '';
    const landingUrl = `https://${CUSTOM_DOMAIN}/${brandSlug}`;

    res.status(201).json({
      id: passInstance.id,
      serial_number: passInstance.serial_number,
      template_id: passInstance.template_id,
      brand_id: passInstance.brand_id,
      status: passInstance.status,
      download_url: downloadUrl,
      landing_url: landingUrl,
      created_at: passInstance.created_at
    });
  } catch (error) {
    console.error('Error creating pass:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/v1/passes/:id - Get pass details
 */
router.get('/passes/:id', async (req, res) => {
  try {
    const passInstance = await getPassInstance(req.params.id);

    if (!passInstance) {
      return res.status(404).json({ error: 'Pass not found' });
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const downloadUrl = `${baseUrl}/api/v1/passes/${passInstance.id}/download`;
    const brand = await getBrand(passInstance.brand_id);
    const landingUrl = `https://${CUSTOM_DOMAIN}/${brand?.slug || ''}`;

    res.json({
      ...passInstance,
      download_url: downloadUrl,
      landing_url: landingUrl
    });
  } catch (error) {
    console.error('Error getting pass:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/passes/:id/download - Download .pkpass file
 */
router.get('/passes/:id/download', async (req, res) => {
  try {
    const passInstance = await getPassInstance(req.params.id);

    if (!passInstance) {
      return res.status(404).json({ error: 'Pass not found' });
    }

    const cacheDir = ensureCacheDir();
    const pkpassPath = path.join(cacheDir, `${req.params.id}.pkpass`);

    // Check if cached file exists
    if (fs.existsSync(pkpassPath)) {
      await logEvent({
        pass_id: req.params.id,
        brand_id: passInstance.brand_id,
        event_type: 'pass_downloaded',
        metadata: {}
      });

      res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
      res.setHeader('Content-Disposition', `attachment; filename="${passInstance.serial_number}.pkpass"`);
      return res.sendFile(pkpassPath);
    }

    // Otherwise generate it
    const template = await getTemplate(passInstance.template_id);
    const brand = await getBrand(passInstance.brand_id);

    if (!template || !brand) {
      return res.status(404).json({ error: 'Template or brand not found' });
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const pkpassBuffer = await createPkpass(template, passInstance, brand, {
      baseUrl
    });

    fs.writeFileSync(pkpassPath, pkpassBuffer);

    await logEvent({
      pass_id: req.params.id,
      brand_id: passInstance.brand_id,
      event_type: 'pass_downloaded',
      metadata: {}
    });

    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', `attachment; filename="${passInstance.serial_number}.pkpass"`);
    res.send(pkpassBuffer);
  } catch (error) {
    console.error('Error downloading pass:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/v1/passes/:id - Update pass fields (triggers re-generation)
 */
router.put('/passes/:id', async (req, res) => {
  try {
    const { field_values, customer_data, status } = req.body;

    const passInstance = await getPassInstance(req.params.id);
    if (!passInstance) {
      return res.status(404).json({ error: 'Pass not found' });
    }

    const updated = await updatePassInstance(req.params.id, {
      field_values: field_values || passInstance.field_values,
      customer_data: customer_data || passInstance.customer_data,
      status: status || passInstance.status
    });

    // Log points change if punti field was updated
    if (field_values && field_values.punti !== undefined) {
      const oldPunti = parseInt(passInstance.field_values?.punti) || 0;
      const newPunti = parseInt(field_values.punti) || 0;
      const diff = newPunti - oldPunti;
      if (diff !== 0) {
        try {
          await logPoints({
            brand_id: passInstance.brand_id,
            member_id: passInstance.member_id || null,
            pass_id: req.params.id,
            points: diff,
            reason: 'manual',
            details: 'Punti aggiornati manualmente'
          });
        } catch(e) { console.log('[PointsLog] Error logging manual points:', e.message); }
      }
    }

    // Clear cache to force regeneration
    const cacheDir = ensureCacheDir();
    const pkpassPath = path.join(cacheDir, `${req.params.id}.pkpass`);
    if (fs.existsSync(pkpassPath)) {
      fs.unlinkSync(pkpassPath);
    }

    await logEvent({
      pass_id: req.params.id,
      brand_id: passInstance.brand_id,
      event_type: 'pass_updated',
      metadata: {}
    });

    const baseUrl = `${req.protocol}://${req.get('host')}`;

    const brand = await getBrand(updated.brand_id);
    res.json({
      ...updated,
      download_url: `${baseUrl}/api/v1/passes/${req.params.id}/download`,
      landing_url: `https://${CUSTOM_DOMAIN}/${brand?.slug || ''}`
    });
  } catch (error) {
    console.error('Error updating pass:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/v1/passes/:id - Delete a pass instance
 */
router.delete('/passes/:id', async (req, res) => {
  try {
    const pass = await getPassInstance(req.params.id);
    if (!pass) {
      return res.status(404).json({ error: 'Pass not found' });
    }

    // Remove cached pkpass file
    const cacheDir = ensureCacheDir();
    const pkpassPath = path.join(cacheDir, `${req.params.id}.pkpass`);
    if (fs.existsSync(pkpassPath)) {
      fs.unlinkSync(pkpassPath);
    }

    await deletePass(req.params.id);
    res.json({ success: true, message: 'Pass deleted' });
  } catch (err) {
    console.error('Error deleting pass:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/v1/passes/:id/regenerate - Clear cache and regenerate .pkpass
 */
router.post('/passes/:id/regenerate', async (req, res) => {
  try {
    const pass = await getPassInstance(req.params.id);
    if (!pass) {
      return res.status(404).json({ error: 'Pass not found' });
    }

    // Delete cached .pkpass
    const cacheDir = ensureCacheDir();
    const pkpassPath = path.join(cacheDir, `${req.params.id}.pkpass`);
    if (fs.existsSync(pkpassPath)) {
      fs.unlinkSync(pkpassPath);
      console.log(`🗑️ Deleted cached pkpass: ${req.params.id}`);
    }

    // Regenerate
    const template = await getTemplate(pass.template_id);
    const brand = await getBrand(pass.brand_id);
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const pkpassBuffer = await createPkpass(template, pass, brand, { baseUrl });
    fs.writeFileSync(pkpassPath, pkpassBuffer);
    console.log(`✓ Regenerated pkpass: ${req.params.id}`);

    await logEvent({
      pass_id: pass.id,
      brand_id: brand.id,
      event_type: 'pass_regenerated',
      metadata: {}
    });

    res.json({
      success: true,
      message: 'Pass regenerated',
      download_url: `${baseUrl}/api/v1/passes/${pass.id}/download`
    });
  } catch (err) {
    console.error('Error regenerating pass:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v1/passes/:id/debug-json - Return the pass.json from cached pkpass (debug)
 */
router.get('/passes/:id/debug-json', async (req, res) => {
  try {
    const cacheDir = ensureCacheDir();
    const pkpassPath = path.join(cacheDir, `${req.params.id}.pkpass`);
    if (!fs.existsSync(pkpassPath)) {
      return res.status(404).json({ error: 'No cached pkpass found. Regenerate first.' });
    }
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(pkpassPath);
    const passEntry = zip.getEntry('pass.json');
    if (!passEntry) return res.status(500).json({ error: 'pass.json not found in pkpass' });
    const passJson = JSON.parse(passEntry.getData().toString('utf8'));
    res.json(passJson);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v1/passes - List passes (optional ?brand_id=&status=)
 */
router.get('/passes', async (req, res) => {
  try {
    const passes = await listPasses(req.query.brand_id, req.query.status);
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    // Get brand slugs for landing URLs
    const brandCache = {};
    const passesWithUrls = await Promise.all(passes.map(async pass => {
      if (!brandCache[pass.brand_id]) {
        brandCache[pass.brand_id] = await getBrand(pass.brand_id);
      }
      const brand = brandCache[pass.brand_id];
      return {
        ...pass,
        download_url: `${baseUrl}/api/v1/passes/${pass.id}/download`,
        landing_url: `https://${CUSTOM_DOMAIN}/${brand?.slug || ''}`
      };
    }));

    res.json(passesWithUrls);
  } catch (error) {
    console.error('Error listing passes:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// APPLE WALLET WEB SERVICE PROTOCOL
// ============================================================================

/**
 * POST /api/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber
 * Register device for push notifications
 */
router.post('/devices/:deviceLibraryId/registrations/:passTypeId/:serialNumber', async (req, res) => {
  try {
    const { deviceLibraryId, serialNumber } = req.params;
    const { pushToken } = req.body;

    if (!pushToken) {
      return res.status(400).json({ error: 'Push token is required' });
    }

    await registerDevice({
      device_library_id: deviceLibraryId,
      push_token: pushToken,
      serial_number: serialNumber
    });

    // Log pass installation analytics event
    await logAnalyticsEvent({
      event_type: 'pass_installed',
      metadata: { serial_number: serialNumber, device_library_id: deviceLibraryId }
    });

    await logEvent({
      event_type: 'device_registered',
      device_id: deviceLibraryId,
      brand_id: 'system',
      metadata: { serial_number: serialNumber }
    });

    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Error registering device:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber
 * Unregister device
 */
router.delete('/devices/:deviceLibraryId/registrations/:passTypeId/:serialNumber', async (req, res) => {
  try {
    const { deviceLibraryId, serialNumber } = req.params;

    await unregisterDevice(deviceLibraryId, serialNumber);

    await logEvent({
      event_type: 'device_unregistered',
      device_id: deviceLibraryId,
      brand_id: 'system',
      metadata: { serial_number: serialNumber }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error unregistering device:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier
 * Get serial numbers for device (Apple Wallet update check)
 *
 * Apple sends ?passesUpdatedSince=<tag> to check which passes changed.
 * We filter by last_updated and return a lastUpdated tag for the next check.
 * If there are no updates, return 204 (Apple spec).
 */
router.get('/devices/:deviceLibraryId/registrations/:passTypeId', async (req, res) => {
  try {
    const { deviceLibraryId } = req.params;
    const passesUpdatedSince = req.query.passesUpdatedSince;

    // Get all serial numbers registered for this device
    const allSerials = await getSerialsForDevice(deviceLibraryId);

    if (allSerials.length === 0) {
      return res.status(204).send();
    }

    // Filter by last_updated if tag is provided
    let filteredSerials = allSerials;
    if (passesUpdatedSince) {
      const sinceDate = new Date(passesUpdatedSince);
      const updatedSerials = [];
      for (const serial of allSerials) {
        const pass = await getPassBySerial(serial);
        if (pass && new Date(pass.last_updated) > sinceDate) {
          updatedSerials.push(serial);
        }
      }
      filteredSerials = updatedSerials;
    }

    if (filteredSerials.length === 0) {
      return res.status(204).send(); // No updates — Apple spec
    }

    // Return serial numbers + lastUpdated tag (ISO string)
    res.json({
      serialNumbers: filteredSerials,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting device registrations:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/passes/:passTypeIdentifier/:serialNumber
 * Get latest pass (returns .pkpass for Apple's update check)
 */
router.get('/passes/:passTypeId/:serialNumber', async (req, res) => {
  try {
    const { serialNumber } = req.params;

    const passInstance = await getPassBySerial(serialNumber);

    if (!passInstance) {
      return res.status(404).json({ error: 'Pass not found' });
    }

    const template = await getTemplate(passInstance.template_id);
    const brand = await getBrand(passInstance.brand_id);

    if (!template || !brand) {
      return res.status(404).json({ error: 'Template or brand not found' });
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const cacheDir = ensureCacheDir();
    const pkpassPath = path.join(cacheDir, `${passInstance.id}.pkpass`);

    // Check if cached file exists
    if (fs.existsSync(pkpassPath)) {
      const stat = fs.statSync(pkpassPath);
      res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
      res.setHeader('Content-Disposition', `attachment; filename="${serialNumber}.pkpass"`);
      res.setHeader('Last-Modified', stat.mtime.toUTCString());
      return res.sendFile(pkpassPath);
    }

    // Generate it
    const pkpassBuffer = await createPkpass(template, passInstance, brand, { baseUrl });
    fs.writeFileSync(pkpassPath, pkpassBuffer);

    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', `attachment; filename="${serialNumber}.pkpass"`);
    res.send(pkpassBuffer);
  } catch (error) {
    console.error('Error getting pass:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// ANALYTICS
// ============================================================================

/**
 * GET /api/v1/analytics/:brand_id - Get analytics summary
 */
router.get('/analytics/:brand_id', async (req, res) => {
  try {
    const { brand_id } = req.params;

    const brand = await getBrand(brand_id);
    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    const analytics = await getAnalytics(brand_id);

    res.json({
      brand_id,
      ...analytics
    });
  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/events/:brand_id - Get recent events (optional ?limit=50)
 */
router.get('/events/:brand_id', async (req, res) => {
  try {
    const events = await listEvents(req.params.brand_id, req.query.limit || 50);
    res.json(events);
  } catch (error) {
    console.error('Error getting events:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// LANDING PAGE DATA
// ============================================================================

/**
 * GET /api/v1/landing/:pass_id - Get data for landing page
 */
router.get('/landing/:pass_id', async (req, res) => {
  try {
    const passInstance = await getPassInstance(req.params.pass_id);

    if (!passInstance) {
      return res.status(404).json({ error: 'Pass not found' });
    }

    const template = await getTemplate(passInstance.template_id);
    const brand = await getBrand(passInstance.brand_id);

    if (!template || !brand) {
      return res.status(404).json({ error: 'Template or brand not found' });
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;

    await logEvent({
      pass_id: req.params.pass_id,
      brand_id: passInstance.brand_id,
      event_type: 'landing_page_viewed',
      metadata: {}
    });

    res.json({
      pass: {
        id: passInstance.id,
        serial_number: passInstance.serial_number,
        status: passInstance.status,
        field_values: passInstance.field_values,
        customer_data: passInstance.customer_data
      },
      template: {
        id: template.id,
        name: template.name,
        pass_type: template.pass_type,
        style: template.style,
        fields: template.fields
      },
      brand: {
        id: brand.id,
        name: brand.name,
        slug: brand.slug,
        config: brand.config
      },
      download_url: `${baseUrl}/api/v1/passes/${passInstance.id}/download`,
      qr_code_url: `${baseUrl}/api/qr/${passInstance.id}`
    });
  } catch (error) {
    console.error('Error getting landing page data:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/landing/brand/:slug - Get brand landing data by slug
 * Used when accessing nudj.studio/:slug
 */
router.get('/landing/brand/:slug', async (req, res) => {
  try {
    const { getBrandBySlug, listPasses, getTemplate } = require('../db');
    const brand = await getBrandBySlug(req.params.slug);
    if (!brand) return res.status(404).json({ error: 'Brand not found' });

    // Get first template for this brand
    const passes = await listPasses(brand.id);
    let template = null;
    if (passes.length > 0) {
      template = await getTemplate(passes[0].template_id);
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;

    res.json({
      brand: { id: brand.id, name: brand.name, slug: brand.slug, config: brand.config },
      template: template ? { id: template.id, name: template.name, pass_type: template.pass_type, style: template.style } : null,
      signup_url: `${baseUrl}/api/v1/passes/signup`,
      passes_count: passes.length
    });
  } catch (error) {
    console.error('Error getting brand landing:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/passes/signup - Public self-signup from brand landing page
 * Creates a member + pass in one step. Expects: brand_id, name, email, phone (optional)
 */
router.post('/passes/signup', async (req, res) => {
  try {
    const { brand_id, name, email, phone, playtomic_email, referral_code } = req.body;
    if (!brand_id || !name || !email) {
      return res.status(400).json({ error: 'brand_id, name e email sono obbligatori' });
    }

    const brand = await getBrand(brand_id);
    if (!brand) return res.status(404).json({ error: 'Brand non trovato' });

    // Get the first template for this brand
    const templates = await listTemplates(brand_id);
    if (!templates || templates.length === 0) {
      return res.status(400).json({ error: 'Nessun template configurato per questo brand' });
    }
    const template = templates[0];

    // Split name into first/last
    const nameParts = name.trim().split(/\s+/);
    const first_name = nameParts[0];
    const last_name = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;

    // Check if member with same email already exists for this brand
    const existingCheck = await pool.query(
      'SELECT id FROM members WHERE brand_id = $1 AND email = $2', [brand_id, email]
    );

    let member;
    let referrer_id = null;

    // Handle referral code if provided
    if (referral_code) {
      const referrer = await getMemberByReferralCode(referral_code);
      if (referrer) {
        referrer_id = referrer.id;
      }
    }

    if (existingCheck.rows.length > 0) {
      // Member exists — check if they already have an active pass
      const memberId = existingCheck.rows[0].id;
      const passCheck = await pool.query(
        'SELECT id FROM pass_instances WHERE member_id = $1 AND status = $2', [memberId, 'active']
      );
      if (passCheck.rows.length > 0) {
        // Already has a pass — return download URL
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        return res.json({
          message: 'Hai già un pass attivo!',
          download_url: `${baseUrl}/api/v1/passes/${passCheck.rows[0].id}/download`
        });
      }
      member = { id: memberId, first_name, last_name, email, phone };
      // Update playtomic_email if provided during signup
      if (playtomic_email) {
        await updateMember(memberId, { playtomic_email });
      }
    } else {
      // Create new member
      member = await createMember({ brand_id, first_name, last_name, email, phone, playtomic_email: playtomic_email || null, referred_by: referrer_id });

      // Increment referrer's referral count and evaluate referral missions
      if (referrer_id) {
        await incrementReferralCount(referrer_id);
        await logAnalyticsEvent({
          event_type: 'member_referred',
          brand_id: brand_id,
          metadata: { referred_member_id: member.id, referrer_id: referrer_id, referral_code: referral_code }
        });
        // Trigger referral challenge evaluation for the referrer
        try {
          const { evaluateChallenges } = require('../engine/challenges');
          await evaluateChallenges(brand_id);
        } catch(e) { console.error('Referral challenge eval error:', e.message); }
      }
    }

    // Get first tier for this brand (lowest sort_order / min_points)
    const tiers = await listTiers(brand_id);
    const firstTier = tiers.length > 0 ? tiers[0].name : '';

    // Create pass instance with name + tier populated
    const fullName = [first_name, last_name].filter(Boolean).join(' ');
    const passInstance = await createPassInstance({
      template_id: template.id,
      brand_id: brand.id,
      customer_data: { email, phone, name: fullName },
      field_values: { nome: fullName, name: fullName, livello: firstTier, punti: '10' },
      member_id: member.id
    });

    // Generate .pkpass file
    const CUSTOM_DOMAIN = (process.env.CUSTOM_DOMAIN || 'www.nudj.studio').replace(/^nudj\.studio$/, 'www.nudj.studio');
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const pkpassBuffer = await createPkpass(template, passInstance, brand, { baseUrl });

    // Cache the pkpass file
    const cacheDir = ensureCacheDir();
    const pkpassPath = path.join(cacheDir, `${passInstance.id}.pkpass`);
    fs.writeFileSync(pkpassPath, pkpassBuffer);

    await logEvent({
      pass_id: passInstance.id,
      brand_id: brand.id,
      event_type: 'pass_created',
      metadata: { source: 'landing_signup', email, welcome_points: 10 }
    });

    // Log welcome points for recap emails
    try {
      await logPoints({
        brand_id: brand.id,
        member_id: member.id,
        pass_id: passInstance.id,
        points: 10,
        reason: 'signup',
        details: 'Punti di benvenuto'
      });
    } catch(e) { console.log('[PointsLog] Error logging welcome points:', e.message); }

    const downloadUrl = `${baseUrl}/api/v1/passes/${passInstance.id}/download`;
    const landingUrl = `https://${CUSTOM_DOMAIN}/${brand.slug || ''}`;

    // Send welcome email (async, don't block response)
    sendWelcomeEmail({
      to: email,
      name: fullName,
      brandName: brand.name,
      brandColor: brand.config?.backgroundColor || '#000000',
      points: 10,
      downloadUrl
    }).catch(err => console.error('Welcome email error:', err));

    res.status(201).json({
      message: 'Pass creato con successo!',
      pass: { id: passInstance.id, serial_number: passInstance.serial_number },
      download_url: downloadUrl
    });
  } catch (error) {
    console.error('Error in signup:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// REWARDS
// ============================================================================

/**
 * GET /api/v1/challenges/seed - Seed challenges for Hirostar
 */
router.get('/challenges/seed', async (req, res) => {
  try {
    // Find Hirostar brand
    const hirostar = await pool.query(`SELECT id, name FROM brands WHERE LOWER(name) LIKE '%hirostar%' OR LOWER(name) LIKE '%hangar%' LIMIT 1`);
    if (!hirostar.rows.length) return res.status(404).json({ error: 'Hirostar brand not found' });
    const bid = hirostar.rows[0].id;

    // Check existing
    const existing = await listChallenges(bid);
    if (existing.length > 0) {
      return res.json({ message: `Already have ${existing.length} challenges`, challenges: existing });
    }

    const challenges = [
      // ── MISSIONI PLAYTOMIC (automatiche) ──
      // Frequenza di gioco
      { title: 'Warm Up', description: 'Gioca la tua prima partita dopo l\'iscrizione al club.', points: 30, icon: '🎾', type: 'action', recurring: false, trigger_type: 'booking_count', trigger_config: { count: 1, period: 'lifetime' } },
      { title: 'Settimana Calda', description: 'Gioca 3 partite in una settimana. Il ritmo fa la differenza!', points: 50, icon: '🔥', type: 'action', recurring: true, trigger_type: 'booking_count', trigger_config: { count: 3, period: 'week' } },
      { title: 'Maratoneta del Mese', description: 'Gioca 10 partite in un mese. Sei un vero habitué!', points: 200, icon: '💪', type: 'action', recurring: true, trigger_type: 'booking_count', trigger_config: { count: 10, period: 'month' } },
      { title: 'Streak Machine', description: 'Gioca almeno una partita a settimana per 4 settimane consecutive.', points: 300, icon: '⚡', type: 'action', recurring: true, trigger_type: 'booking_streak', trigger_config: { weeks: 4 } },

      // Social / Partners
      { title: 'Doppio Misto', description: 'Gioca con 5 partner diversi nello stesso mese. Socialità in campo!', points: 150, icon: '👥', type: 'action', recurring: true, trigger_type: 'booking_partners', trigger_config: { count: 5, period: 'month' } },

      // Fasce orarie
      { title: 'Early Bird', description: 'Gioca 3 volte in fascia mattutina (8:00-12:00). Il padel del mattino ha l\'oro in bocca.', points: 80, icon: '🌅', type: 'action', recurring: true, trigger_type: 'booking_time', trigger_config: { count: 3, period: 'month', time_start: '08:00', time_end: '12:00' } },
      { title: 'Midweek Warrior', description: 'Prenota e gioca un campo dal lunedì al giovedì. I veri giocatori non aspettano il weekend.', points: 40, icon: '📅', type: 'action', recurring: true, trigger_type: 'booking_day', trigger_config: { count: 1, period: 'week', days: [1, 2, 3, 4] } },

      // Stagionali
      { title: 'Estate in Campo', description: 'Gioca 20 partite tra giugno e agosto. Il caldo non ti ferma!', points: 300, icon: '☀️', type: 'action', recurring: false, trigger_type: 'booking_count', trigger_config: { count: 20, period: 'custom', start_month: 6, end_month: 8 } },

      // ── MISSIONI AD HOC (manuali) ──
      // Referral
      { title: 'Porta un Amico', description: 'Invita un amico che si iscrive al programma fedeltà. Tu guadagni punti, lui il benvenuto!', points: 100, icon: '🤝', type: 'action', recurring: true, trigger_type: 'manual', trigger_config: {} },
      { title: 'Capitano', description: 'Organizza una partita completa da 4 persone prenotando tu il campo.', points: 80, icon: '🫡', type: 'action', recurring: true, trigger_type: 'manual', trigger_config: {} },

      // Eventi e tornei
      { title: 'Torneo Debuttante', description: 'Partecipa al tuo primo torneo sociale del club.', points: 150, icon: '🏆', type: 'action', recurring: false, trigger_type: 'manual', trigger_config: {} },
      { title: 'Gladiatore', description: 'Partecipa a 3 tornei in un trimestre. Sei un combattente!', points: 400, icon: '⚔️', type: 'action', recurring: true, trigger_type: 'manual', trigger_config: {} },
      { title: 'Campione Sociale', description: 'Vinci un torneo sociale mensile. Gloria eterna!', points: 300, icon: '👑', type: 'action', recurring: true, trigger_type: 'manual', trigger_config: {} },

      // Cross-selling
      { title: 'After Match', description: 'Ordina al bar dopo la partita 5 volte nel mese. Il terzo tempo è sacro!', points: 100, icon: '🍻', type: 'action', recurring: true, trigger_type: 'manual', trigger_config: {} },
      { title: 'Upgrade Kit', description: 'Effettua un acquisto nel pro shop del club.', points: 80, icon: '🛒', type: 'action', recurring: true, trigger_type: 'manual', trigger_config: {} },

      // Stagionali manuali
      { title: 'Sfida del 1° Maggio', description: 'Gioca una partita il giorno della festa. Chi gioca non fa ponte!', points: 100, icon: '🎉', type: 'action', recurring: false, trigger_type: 'manual', trigger_config: {} },

      // Milestone
      { title: 'Quota 500', description: 'Raggiungi 500 punti totali. Stai scalando!', points: 50, icon: '📈', type: 'action', recurring: false, trigger_type: 'manual', trigger_config: {} },
      { title: 'Level Up', description: 'Passa al livello successivo del programma. Ogni livello è una conquista.', points: 100, icon: '🆙', type: 'action', recurring: true, trigger_type: 'manual', trigger_config: {} },

      // Community
      { title: 'Recensione Google', description: 'Lascia una recensione su Google Maps per il club. Aiutaci a crescere!', points: 50, icon: '⭐', type: 'action', recurring: false, trigger_type: 'manual', trigger_config: {} },
      { title: 'Social Padel', description: 'Condividi un post o una story taggando @HangarPadel. Fai vedere che ci sei!', points: 40, icon: '📱', type: 'action', recurring: true, trigger_type: 'manual', trigger_config: {} },
    ];

    const created = [];
    for (const c of challenges) {
      const challenge = await createChallenge({ brand_id: bid, ...c });
      created.push(challenge);
    }

    res.json({ message: `Created ${created.length} challenges`, count: created.length });
  } catch (error) {
    console.error('Error seeding challenges:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/challenges/migrate-triggers - Update existing challenges with trigger_type/config
 */
router.get('/challenges/migrate-triggers', async (req, res) => {
  try {
    const TRIGGER_MAP = {
      'Warm Up':            { trigger_type: 'booking_count', trigger_config: { count: 1, period: 'lifetime' } },
      'Settimana Calda':    { trigger_type: 'booking_count', trigger_config: { count: 3, period: 'week' } },
      'Maratoneta del Mese':{ trigger_type: 'booking_count', trigger_config: { count: 10, period: 'month' } },
      'Streak Machine':     { trigger_type: 'booking_streak', trigger_config: { weeks: 4 } },
      'Doppio Misto':       { trigger_type: 'booking_partners', trigger_config: { count: 5, period: 'month' } },
      'Early Bird':         { trigger_type: 'booking_time', trigger_config: { count: 3, period: 'month', time_start: '08:00', time_end: '12:00' } },
      'Midweek Warrior':    { trigger_type: 'booking_day', trigger_config: { count: 1, period: 'week', days: [1, 2, 3, 4] } },
      'Estate in Campo':    { trigger_type: 'booking_count', trigger_config: { count: 20, period: 'custom', start_month: 6, end_month: 8 } },
    };

    let updated = 0;
    const results = [];

    // Get all challenges across all brands
    const allBrands = await pool.query('SELECT id, name FROM brands');
    for (const brand of allBrands.rows) {
      const challenges = await listChallenges(brand.id);
      for (const c of challenges) {
        const mapping = TRIGGER_MAP[c.title];
        if (mapping) {
          await updateChallenge(c.id, mapping);
          updated++;
          results.push({ brand: brand.name, title: c.title, trigger_type: mapping.trigger_type });
        }
      }
    }

    res.json({ message: `Updated ${updated} challenges with triggers`, updated, results });
  } catch (error) {
    console.error('Error migrating triggers:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/rewards/check - Check rewards in DB
 */
router.get('/rewards/check', async (req, res) => {
  try {
    const all = await pool.query('SELECT id, brand_id, title, cost FROM rewards ORDER BY cost');
    const brands = await pool.query('SELECT id, name FROM brands');
    res.json({ total: all.rows.length, brands: brands.rows, rewards: all.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/**
 * GET /api/v1/rewards/fix-brand - Move all rewards & tiers to Hirostar brand
 */
router.get('/rewards/fix-brand', async (req, res) => {
  try {
    // Find Hirostar brand
    const hirostar = await pool.query(`SELECT id, name FROM brands WHERE LOWER(name) LIKE '%hirostar%' OR LOWER(name) LIKE '%hangar%' LIMIT 1`);
    if (!hirostar.rows.length) return res.status(404).json({ error: 'Hirostar brand not found' });
    const hid = hirostar.rows[0].id;

    // Move all rewards to Hirostar
    const rResult = await pool.query('UPDATE rewards SET brand_id = $1 WHERE brand_id != $1 RETURNING id, title', [hid]);

    // Move all tiers to Hirostar
    const tResult = await pool.query('UPDATE tiers SET brand_id = $1 WHERE brand_id != $1 RETURNING id, name', [hid]);

    res.json({
      brand: hirostar.rows[0],
      rewards_moved: rResult.rows.length,
      tiers_moved: tResult.rows.length,
      rewards: rResult.rows,
      tiers: tResult.rows
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/**
 * GET /api/v1/cleanup/strip/:brandId - Remove strip image from a specific brand
 */
router.get('/cleanup/strip/:brandId', async (req, res) => {
  try {
    const brandId = req.params.brandId;
    const brand = await pool.query('SELECT id, name, config FROM brands WHERE id = $1', [brandId]);
    if (!brand.rows.length) return res.status(404).json({ error: 'Brand not found' });

    const config = typeof brand.rows[0].config === 'string' ? JSON.parse(brand.rows[0].config) : (brand.rows[0].config || {});
    const hadStrip = !!(config.logos && config.logos.strip);

    if (config.logos && config.logos.strip) {
      delete config.logos.strip;
      await pool.query('UPDATE brands SET config = $1::jsonb WHERE id = $2', [JSON.stringify(config), brandId]);
    }

    res.json({ brand: brand.rows[0].name, had_strip: hadStrip, strip_removed: hadStrip, config_logos: Object.keys(config.logos || {}) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/**
 * GET /api/v1/cleanup/non-padel - Remove padel-specific data from non-padel brands
 * Deletes tiers, rewards, and challenges that were incorrectly seeded
 */
router.get('/cleanup/non-padel', async (req, res) => {
  try {
    // Find non-padel brands (those WITHOUT Playtomic config)
    const nonPadel = await pool.query(`
      SELECT id, name FROM brands
      WHERE config::text NOT LIKE '%playtomic%' OR config IS NULL
    `);

    if (nonPadel.rows.length === 0) {
      return res.json({ message: 'No non-padel brands found', cleaned: [] });
    }

    const cleaned = [];
    for (const brand of nonPadel.rows) {
      const tiersDeleted = await pool.query('DELETE FROM tiers WHERE brand_id = $1 RETURNING id, name', [brand.id]);
      const rewardsDeleted = await pool.query('DELETE FROM rewards WHERE brand_id = $1 RETURNING id, title', [brand.id]);
      const challengesDeleted = await pool.query('DELETE FROM challenges WHERE brand_id = $1 RETURNING id, title', [brand.id]);

      // Remove strip image if it was copied from another brand
      const brandData = await getBrand(brand.id);
      let stripRemoved = false;
      if (brandData?.config?.logos?.strip) {
        const cfg = { ...brandData.config };
        delete cfg.logos.strip;
        await pool.query('UPDATE brands SET config = $1::jsonb WHERE id = $2', [JSON.stringify(cfg), brand.id]);
        stripRemoved = true;
      }

      cleaned.push({
        brand: brand.name,
        brand_id: brand.id,
        tiers_removed: tiersDeleted.rows.length,
        rewards_removed: rewardsDeleted.rows.length,
        challenges_removed: challengesDeleted.rows.length,
        strip_removed: stripRemoved
      });
      console.log(`[Cleanup] Brand ${brand.name}: removed ${tiersDeleted.rows.length} tiers, ${rewardsDeleted.rows.length} rewards, ${challengesDeleted.rows.length} challenges, strip: ${stripRemoved}`);
    }

    res.json({ message: 'Cleanup completed', cleaned });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/**
 * GET/POST /api/v1/rewards/seed - Force-seed the rewards catalog
 */
router.all('/rewards/seed', async (req, res) => {
  try {
    const brand_id = req.body?.brand_id || req.query?.brand_id;
    let bid = brand_id;
    if (!bid) {
      const brandResult = await pool.query('SELECT id FROM brands LIMIT 1');
      if (!brandResult.rows.length) return res.status(404).json({ error: 'No brands found' });
      bid = brandResult.rows[0].id;
    }

    // Check existing
    const existing = await listRewards(bid);
    if (existing.length > 0) {
      return res.json({ message: `Already have ${existing.length} rewards`, rewards: existing });
    }

    const rewards = [
      { title: 'Drink di benvenuto', description: 'Una consumazione gratuita al bar del club: acqua, succo o bibita a scelta.', cost: 50, icon: '🥤' },
      { title: 'Grip overgrip omaggio', description: 'Un overgrip di qualità per la tua racchetta, a scelta tra i modelli disponibili.', cost: 80, icon: '🎾' },
      { title: 'Tubo palline', description: 'Un tubo di 3 palline da padel omaggio per le tue partite.', cost: 100, icon: '🎯' },
      { title: '1 ora campo gratuita', description: 'Prenota 1 ora di campo padel senza costi aggiuntivi.', cost: 150, icon: '🏟️' },
      { title: 'Sconto 10% al bar', description: 'Buono sconto del 10% su tutte le consumazioni al bar, valido per una giornata intera.', cost: 120, icon: '☕' },
      { title: 'Sconto 10% noleggio racchette', description: 'Sconto del 10% sul noleggio racchette per un mese intero.', cost: 200, icon: '🏸' },
      { title: 'Accesso torneo sociale', description: 'Iscrizione gratuita al prossimo torneo sociale mensile del club.', cost: 250, icon: '🏆' },
      { title: '2 ore campo gratuite', description: 'Prenota 2 ore di campo padel senza costi. Utilizzabili anche in giorni diversi.', cost: 300, icon: '⏰' },
      { title: 'Sconto 15% al bar', description: 'Buono sconto del 15% su tutte le consumazioni al bar, valido per una settimana.', cost: 280, icon: '🍹' },
      { title: 'Lezione di gruppo', description: 'Una lezione di gruppo con il coach del club (max 4 partecipanti, 1 ora).', cost: 350, icon: '👨‍🏫' },
      { title: 'Incordatura racchetta', description: 'Servizio di incordatura professionale gratuito per la tua racchetta.', cost: 400, icon: '🔧' },
      { title: 'Maglietta club esclusiva', description: 'T-shirt tecnica con il logo del club, in edizione limitata per i soci.', cost: 500, icon: '👕' },
      { title: '4 ore campo gratuite', description: '4 ore di campo padel gratuite, utilizzabili nel mese corrente.', cost: 550, icon: '🌟' },
      { title: 'Sconto 20% pro shop', description: 'Buono sconto del 20% su tutti i prodotti del pro shop del club.', cost: 500, icon: '🛍️' },
      { title: 'Lezione privata 30 min', description: 'Una sessione privata di 30 minuti con il coach per migliorare la tua tecnica.', cost: 600, icon: '🎓' },
      { title: 'Kit palline mensile', description: 'Un kit completo di palline da padel premium ogni mese per un mese.', cost: 450, icon: '📦' },
      { title: 'Cena club con coach', description: 'Invito alla cena esclusiva del club con il coach e gli altri soci premium.', cost: 800, icon: '🍽️' },
      { title: 'Campo illimitato mensile', description: 'Accesso illimitato ai campi per un mese intero.', cost: 1000, icon: '♾️' },
      { title: 'Bar open giornaliero', description: 'Una consumazione gratuita al giorno al bar per un mese intero.', cost: 800, icon: '🍺' },
      { title: 'Racchetta brandizzata club', description: 'Una racchetta da padel con il logo del club, in edizione esclusiva numerata.', cost: 1500, icon: '🏅' },
      { title: 'Abbigliamento tecnico stagionale', description: 'Kit completo di abbigliamento tecnico (maglia + pantaloncini) con branding club.', cost: 1200, icon: '🎽' },
      { title: 'Ospite illimitato mensile', description: 'Porta un ospite gratuito a ogni partita per un mese intero.', cost: 900, icon: '🤝' },
      { title: 'Trofeo Socio dell\'Anno', description: 'Candidatura al premio annuale con trofeo personalizzato e naming su torneo.', cost: 2000, icon: '🏆' },
    ];

    const created = [];
    for (const r of rewards) {
      const reward = await createReward({ brand_id: bid, ...r });
      created.push(reward);
    }

    res.json({ message: `Created ${created.length} rewards`, count: created.length });
  } catch (error) {
    console.error('Error seeding rewards:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/rewards - Create reward
 */
router.post('/rewards', async (req, res) => {
  try {
    const { brand_id, title, description, cost, icon } = req.body;

    if (!brand_id || !title) {
      return res.status(400).json({
        error: 'Brand ID and title are required'
      });
    }

    const brand = await getBrand(brand_id);
    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    const reward = await createReward({
      brand_id,
      title,
      description: description || '',
      cost: cost || 0,
      icon: icon || '🎁'
    });

    await logEvent({
      brand_id,
      event_type: 'reward_created',
      metadata: { reward_id: reward.id, title }
    });

    res.status(201).json(reward);
  } catch (error) {
    console.error('Error creating reward:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/v1/rewards - List rewards
 */
router.get('/rewards', async (req, res) => {
  try {
    const { brand_id } = req.query;

    if (!brand_id) {
      return res.status(400).json({ error: 'Brand ID is required' });
    }

    const rewards = await listRewards(brand_id);
    res.json(rewards);
  } catch (error) {
    console.error('Error listing rewards:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/v1/rewards/:id - Update reward
 */
router.put('/rewards/:id', async (req, res) => {
  try {
    const { title, description, cost, icon, active } = req.body;

    const reward = await getReward(req.params.id);
    if (!reward) {
      return res.status(404).json({ error: 'Reward not found' });
    }

    const updated = await updateReward(req.params.id, {
      title,
      description,
      cost,
      icon,
      active
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating reward:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/v1/rewards/:id - Delete reward
 */
router.delete('/rewards/:id', async (req, res) => {
  try {
    const reward = await getReward(req.params.id);
    if (!reward) {
      return res.status(404).json({ error: 'Reward not found' });
    }

    await deleteReward(req.params.id);

    await logEvent({
      brand_id: reward.brand_id,
      event_type: 'reward_deleted',
      metadata: { reward_id: req.params.id, title: reward.title }
    });

    res.json({ success: true, message: `Reward "${reward.title}" deleted` });
  } catch (error) {
    console.error('Error deleting reward:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/rewards/:id/claim - Claim reward
 */
router.post('/rewards/:id/claim', async (req, res) => {
  try {
    const { pass_id } = req.body;

    if (!pass_id) {
      return res.status(400).json({ error: 'Pass ID is required' });
    }

    const reward = await getReward(req.params.id);
    if (!reward) {
      return res.status(404).json({ error: 'Reward not found' });
    }

    const pass = await getPassInstance(pass_id);
    if (!pass) {
      return res.status(404).json({ error: 'Pass not found' });
    }

    const claim = await claimReward({
      reward_id: req.params.id,
      pass_id,
      brand_id: reward.brand_id
    });

    await logEvent({
      pass_id,
      brand_id: reward.brand_id,
      event_type: 'reward_claimed',
      metadata: { reward_id: req.params.id, cost: reward.cost }
    });

    res.status(201).json(claim);
  } catch (error) {
    console.error('Error claiming reward:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============================================================================
// CHALLENGES
// ============================================================================

/**
 * POST /api/v1/challenges - Create challenge
 */
router.post('/challenges', async (req, res) => {
  try {
    const { brand_id, title, description, points, icon, type, recurring } = req.body;

    if (!brand_id || !title) {
      return res.status(400).json({
        error: 'Brand ID and title are required'
      });
    }

    const brand = await getBrand(brand_id);
    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    const challenge = await createChallenge({
      brand_id,
      title,
      description: description || '',
      points: points || 0,
      icon: icon || '⭐',
      type: type || 'action',
      recurring: recurring || false
    });

    await logEvent({
      brand_id,
      event_type: 'challenge_created',
      metadata: { challenge_id: challenge.id, title }
    });

    res.status(201).json(challenge);
  } catch (error) {
    console.error('Error creating challenge:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/v1/challenges - List challenges
 */
router.get('/challenges', async (req, res) => {
  try {
    const { brand_id } = req.query;

    if (!brand_id) {
      return res.status(400).json({ error: 'Brand ID is required' });
    }

    const challenges = await listChallenges(brand_id);
    res.json(challenges);
  } catch (error) {
    console.error('Error listing challenges:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/v1/challenges/:id - Update challenge
 */
router.put('/challenges/:id', async (req, res) => {
  try {
    const { title, description, points, icon, type, recurring, active } = req.body;

    const challenge = await getChallenge(req.params.id);
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    const updated = await updateChallenge(req.params.id, {
      title,
      description,
      points,
      icon,
      type,
      recurring,
      active
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating challenge:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/v1/challenges/:id - Delete challenge
 */
router.delete('/challenges/:id', async (req, res) => {
  try {
    const challenge = await getChallenge(req.params.id);
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    await deleteChallenge(req.params.id);

    await logEvent({
      brand_id: challenge.brand_id,
      event_type: 'challenge_deleted',
      metadata: { challenge_id: req.params.id, title: challenge.title }
    });

    res.json({ success: true, message: `Challenge "${challenge.title}" deleted` });
  } catch (error) {
    console.error('Error deleting challenge:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/challenges/:id/complete - Complete challenge
 */
router.post('/challenges/:id/complete', async (req, res) => {
  try {
    const { pass_id } = req.body;

    if (!pass_id) {
      return res.status(400).json({ error: 'Pass ID is required' });
    }

    const challenge = await getChallenge(req.params.id);
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    const pass = await getPassInstance(pass_id);
    if (!pass) {
      return res.status(404).json({ error: 'Pass not found' });
    }

    const completion = await completeChallenge({
      challenge_id: req.params.id,
      pass_id,
      brand_id: challenge.brand_id
    });

    await logEvent({
      pass_id,
      brand_id: challenge.brand_id,
      event_type: 'challenge_completed',
      metadata: { challenge_id: req.params.id, points: challenge.points }
    });

    res.status(201).json(completion);
  } catch (error) {
    console.error('Error completing challenge:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/v1/challenges/:id/progress - Get progress for all members on a challenge
 */
router.get('/challenges/:id/progress', async (req, res) => {
  try {
    const progress = await getProgressForChallenge(req.params.id);
    res.json(progress);
  } catch (error) {
    console.error('Error getting challenge progress:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/members/:id/challenge-progress - Get all challenge progress for a member
 */
router.get('/members/:id/challenge-progress', async (req, res) => {
  try {
    const brand_id = req.query.brand_id;
    if (!brand_id) return res.status(400).json({ error: 'brand_id is required' });
    const progress = await getChallengeProgress(req.params.id, brand_id);
    res.json(progress);
  } catch (error) {
    console.error('Error getting member challenge progress:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/challenges/evaluate - Manually trigger challenge evaluation
 */
router.post('/challenges/evaluate', async (req, res) => {
  try {
    const { brand_id } = req.body;
    if (!brand_id) return res.status(400).json({ error: 'brand_id is required' });
    const result = await evaluateChallenges(brand_id);
    res.json(result);
  } catch (error) {
    console.error('Error evaluating challenges:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// TIERS
// ============================================================================

/**
 * POST /api/v1/tiers - Create tier
 */
router.post('/tiers', async (req, res) => {
  try {
    const { brand_id, name, min_points, color, perks, sort_order } = req.body;

    if (!brand_id || !name) {
      return res.status(400).json({
        error: 'Brand ID and name are required'
      });
    }

    const brand = await getBrand(brand_id);
    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    const tier = await createTier({
      brand_id,
      name,
      min_points: min_points || 0,
      color: color || '#888888',
      perks: perks || [],
      sort_order: sort_order || 0
    });

    await logEvent({
      brand_id,
      event_type: 'tier_created',
      metadata: { tier_id: tier.id, name }
    });

    res.status(201).json(tier);
  } catch (error) {
    console.error('Error creating tier:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/v1/tiers - List tiers
 */
router.get('/tiers', async (req, res) => {
  try {
    const { brand_id } = req.query;

    if (!brand_id) {
      return res.status(400).json({ error: 'Brand ID is required' });
    }

    const tiers = await listTiers(brand_id);
    res.json(tiers);
  } catch (error) {
    console.error('Error listing tiers:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/v1/tiers/:id - Update tier
 */
router.put('/tiers/:id', async (req, res) => {
  try {
    const { name, min_points, color, perks, sort_order } = req.body;

    const tier = await getTier(req.params.id);
    if (!tier) {
      return res.status(404).json({ error: 'Tier not found' });
    }

    const updated = await updateTier(req.params.id, {
      name,
      min_points,
      color,
      perks,
      sort_order
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating tier:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/v1/tiers/:id - Delete tier
 */
router.delete('/tiers/:id', async (req, res) => {
  try {
    const tier = await getTier(req.params.id);
    if (!tier) {
      return res.status(404).json({ error: 'Tier not found' });
    }

    await deleteTier(req.params.id);

    await logEvent({
      brand_id: tier.brand_id,
      event_type: 'tier_deleted',
      metadata: { tier_id: req.params.id, name: tier.name }
    });

    res.json({ success: true, message: `Tier "${tier.name}" deleted` });
  } catch (error) {
    console.error('Error deleting tier:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// VIP CARDS
// ============================================================================

/**
 * POST /api/v1/vip-cards - Create VIP card
 */
router.post('/vip-cards', async (req, res) => {
  try {
    const { brand_id, name, description, color } = req.body;

    if (!brand_id || !name) {
      return res.status(400).json({
        error: 'Brand ID and name are required'
      });
    }

    const brand = await getBrand(brand_id);
    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    const vipCard = await createVipCard({
      brand_id,
      name,
      description: description || '',
      color: color || 'from-blue-400 to-blue-600'
    });

    await logEvent({
      brand_id,
      event_type: 'vip_card_created',
      metadata: { vip_card_id: vipCard.id, name }
    });

    res.status(201).json(vipCard);
  } catch (error) {
    console.error('Error creating VIP card:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/v1/vip-cards - List VIP cards
 */
router.get('/vip-cards', async (req, res) => {
  try {
    const { brand_id } = req.query;

    if (!brand_id) {
      return res.status(400).json({ error: 'Brand ID is required' });
    }

    const vipCards = await listVipCards(brand_id);
    res.json(vipCards);
  } catch (error) {
    console.error('Error listing VIP cards:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/v1/vip-cards/:id - Update VIP card
 */
router.put('/vip-cards/:id', async (req, res) => {
  try {
    const { name, description, color, assigned, active } = req.body;

    const vipCard = await getVipCard(req.params.id);
    if (!vipCard) {
      return res.status(404).json({ error: 'VIP card not found' });
    }

    const updated = await updateVipCard(req.params.id, {
      name,
      description,
      color,
      assigned,
      active
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating VIP card:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/v1/vip-cards/:id - Delete VIP card
 */
router.delete('/vip-cards/:id', async (req, res) => {
  try {
    const vipCard = await getVipCard(req.params.id);
    if (!vipCard) {
      return res.status(404).json({ error: 'VIP card not found' });
    }

    await deleteVipCard(req.params.id);

    await logEvent({
      brand_id: vipCard.brand_id,
      event_type: 'vip_card_deleted',
      metadata: { vip_card_id: req.params.id, name: vipCard.name }
    });

    res.json({ success: true, message: `VIP card "${vipCard.name}" deleted` });
  } catch (error) {
    console.error('Error deleting VIP card:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// PUSH NOTIFICATIONS
// ============================================================================

/**
 * POST /api/v1/push/send - Log push notification
 */
router.post('/push/send', async (req, res) => {
  try {
    const { brand_id, title, message, target, update_pass } = req.body;

    if (!brand_id || !title || !message) {
      return res.status(400).json({
        error: 'Brand ID, title, and message are required'
      });
    }

    const brand = await getBrand(brand_id);
    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    // If update_pass is true, update brand config with the announcement
    // and regenerate all passes so iOS shows "Pass Updated" notification
    let passesUpdated = 0;
    if (update_pass) {
      console.log('📝 Updating pass content with push announcement...');

      // Save announcement to brand config
      const updatedConfig = {
        ...(brand.config || {}),
        pushAnnouncement: {
          title: title,
          message: message,
          date: new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          timestamp: new Date().toISOString()
        }
      };
      await updateBrand(brand_id, { config: updatedConfig });

      // Regenerate all passes for this brand (clear cache + rebuild)
      const passes = await listPasses(brand_id);
      const updatedBrand = await getBrand(brand_id);
      const cacheDir = ensureCacheDir();
      const baseUrl = `${req.protocol}://${req.get('host')}`;

      for (const pass of passes) {
        try {
          // Clear cached pkpass
          const pkpassPath = path.join(cacheDir, `${pass.id}.pkpass`);
          if (fs.existsSync(pkpassPath)) {
            fs.unlinkSync(pkpassPath);
          }
          // Regenerate with updated brand config (includes announcement)
          const template = await getTemplate(pass.template_id);
          if (template) {
            const pkpassBuffer = await createPkpass(template, pass, updatedBrand, { baseUrl });
            fs.writeFileSync(pkpassPath, pkpassBuffer);
            // Touch last_updated so Apple's passesUpdatedSince check finds it
            await touchPass(pass.id);
            passesUpdated++;
          }
        } catch (err) {
          console.error(`Error regenerating pass ${pass.id}:`, err.message);
        }
      }
      console.log(`✓ Regenerated ${passesUpdated}/${passes.length} passes with announcement`);
    }

    // Get all registered devices for this brand's passes
    const devices = await getDevicesForBrand(brand_id);
    let sentCount = 0;
    let failCount = 0;
    const results = [];

    // Send APNs push to each device (empty payload = wallet pass update signal)
    for (const device of devices) {
      try {
        const result = await sendPushUpdate(device.push_token);
        if (result.success) {
          sentCount++;
        } else {
          failCount++;
        }
        results.push({ token: device.push_token.substring(0, 8) + '...', ...result });
      } catch (err) {
        failCount++;
        results.push({ token: device.push_token.substring(0, 8) + '...', success: false, reason: err.message });
      }
    }

    // Log the push to DB
    const pushLog = await logPush({
      brand_id,
      title,
      message,
      target: target || 'all',
      sent_count: sentCount
    });

    await logEvent({
      brand_id,
      event_type: update_pass ? 'push_update_sent' : 'push_sent',
      metadata: {
        title,
        target: target || 'all',
        sent_count: sentCount,
        fail_count: failCount,
        total_devices: devices.length,
        passes_updated: passesUpdated
      }
    });

    res.status(201).json({
      ...pushLog,
      delivery: {
        total_devices: devices.length,
        sent: sentCount,
        failed: failCount,
        passes_updated: passesUpdated,
        results: results,
        note: devices.length === 0
          ? 'No devices registered yet. Passes must be added to Apple Wallet first.'
          : update_pass && passesUpdated > 0
            ? `${passesUpdated} pass aggiornati. iOS mostrerà "Carta aggiornata" ai possessori.`
            : undefined
      }
    });
  } catch (error) {
    console.error('Error sending push:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/v1/push/history - Get push history
 */
router.get('/push/history', async (req, res) => {
  try {
    const { brand_id } = req.query;

    if (!brand_id) {
      return res.status(400).json({ error: 'Brand ID is required' });
    }

    const history = await listPushes(brand_id);
    res.json(history);
  } catch (error) {
    console.error('Error getting push history:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/v1/push/:id - Delete a single push log entry
 */
router.delete('/push/:id', async (req, res) => {
  try {
    await deletePush(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting push:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/v1/push/clear/:brand_id - Clear all push history for a brand
 */
router.delete('/push/clear/:brand_id', async (req, res) => {
  try {
    const result = await clearPushHistory(req.params.brand_id);
    res.json(result);
  } catch (error) {
    console.error('Error clearing push history:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== SCHEDULED PUSH ====================

/**
 * GET /api/v1/push/scheduled?brand_id= - List scheduled notifications
 */
router.get('/push/scheduled', async (req, res) => {
  try {
    const { brand_id } = req.query;
    if (!brand_id) return res.status(400).json({ error: 'brand_id is required' });
    const items = await listScheduledPush(brand_id);
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/push/scheduled - Create a scheduled notification
 */
router.post('/push/scheduled', async (req, res) => {
  try {
    const item = await createScheduledPush(req.body);
    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /api/v1/push/scheduled/:id - Update (toggle active, change schedule)
 */
router.put('/push/scheduled/:id', async (req, res) => {
  try {
    const item = await updateScheduledPush(req.params.id, req.body);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/v1/push/scheduled/:id - Delete a scheduled notification
 */
router.delete('/push/scheduled/:id', async (req, res) => {
  try {
    await deleteScheduledPush(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== MEMBERS ====================

/**
 * GET /api/v1/members?brand_id= - List all members for a brand
 */
router.get('/members', async (req, res) => {
  try {
    const { brand_id } = req.query;
    if (!brand_id) return res.status(400).json({ error: 'brand_id is required' });
    const members = await listMembers(brand_id);
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/members/export?brand_id= - Export members as CSV
 */
router.get('/members/export', async (req, res) => {
  try {
    const { brand_id } = req.query;
    if (!brand_id) return res.status(400).json({ error: 'brand_id is required' });
    const members = await listMembers(brand_id);
    const header = 'Nome,Cognome,Email,Telefono,Email Playtomic,Note,Pass,Punti,Data Iscrizione\n';
    const rows = members.map(m => {
      const date = new Date(m.created_at).toLocaleDateString('it-IT');
      return `"${(m.first_name||'').replace(/"/g,'""')}","${(m.last_name||'').replace(/"/g,'""')}","${m.email||''}","${m.phone||''}","${m.playtomic_email||''}","${(m.notes||'').replace(/"/g,'""')}",${m.pass_count||0},${m.punti||0},${date}`;
    }).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=membri.csv');
    res.send('﻿' + header + rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/members/import - Import members from CSV or Excel
 * Expects JSON body: { brand_id, file_data (base64), file_name }
 */
router.post('/members/import', async (req, res) => {
  try {
    const { brand_id, file_data, file_name } = req.body;
    if (!brand_id || !file_data) return res.status(400).json({ error: 'brand_id and file_data are required' });

    const buffer = Buffer.from(file_data, 'base64');
    let rows = [];

    // Parse file based on extension
    const ext = (file_name || '').toLowerCase().split('.').pop();
    if (ext === 'csv') {
      // Parse CSV
      const text = buffer.toString('utf-8');
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) return res.status(400).json({ error: 'File vuoto o senza dati' });
      const headers = lines[0].split(/[,;]/).map(h => h.replace(/"/g, '').trim().toLowerCase());
      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(/[,;]/).map(v => v.replace(/"/g, '').trim());
        const obj = {};
        headers.forEach((h, idx) => { obj[h] = vals[idx] || ''; });
        rows.push(obj);
      }
    } else {
      // Parse Excel
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      rows = data.map(r => {
        const obj = {};
        Object.keys(r).forEach(k => { obj[k.toLowerCase().trim()] = String(r[k]).trim(); });
        return obj;
      });
    }

    if (rows.length === 0) return res.status(400).json({ error: 'Nessuna riga trovata nel file' });

    // Column mapping — recognize common header names
    const NOME_KEYS = ['nome', 'first_name', 'firstname', 'first name', 'name', 'prenom'];
    const COGNOME_KEYS = ['cognome', 'last_name', 'lastname', 'last name', 'surname', 'family name', 'nom'];
    const EMAIL_KEYS = ['email', 'e-mail', 'mail', 'indirizzo email'];
    const PHONE_KEYS = ['telefono', 'phone', 'tel', 'cellulare', 'mobile', 'cell'];
    const NOTES_KEYS = ['note', 'notes', 'commento', 'commenti', 'osservazioni'];
    const PLAYTOMIC_KEYS = ['playtomic_email', 'email playtomic', 'playtomic', 'email_playtomic'];

    function findKey(obj, candidates) {
      for (const c of candidates) { if (obj[c] !== undefined && obj[c] !== '') return obj[c]; }
      return '';
    }

    // If there's only a "nome" or "name" field with spaces, try to split
    const members = rows.map(r => {
      let firstName = findKey(r, NOME_KEYS);
      let lastName = findKey(r, COGNOME_KEYS);

      // If no separate cognome but nome contains space, split
      if (!lastName && firstName && firstName.includes(' ')) {
        const parts = firstName.split(' ');
        firstName = parts[0];
        lastName = parts.slice(1).join(' ');
      }

      return {
        first_name: firstName,
        last_name: lastName || null,
        email: findKey(r, EMAIL_KEYS) || null,
        phone: findKey(r, PHONE_KEYS) || null,
        notes: findKey(r, NOTES_KEYS) || null,
        playtomic_email: findKey(r, PLAYTOMIC_KEYS) || null
      };
    }).filter(m => m.first_name); // Skip rows without name

    const result = await bulkCreateMembers(brand_id, members);
    res.json({ ...result, total_rows: rows.length, parsed: members.length });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/members - Create a new member (from back office)
 * Also creates pass, assigns welcome points, sends welcome email
 */
router.post('/members', async (req, res) => {
  try {
    const { brand_id, first_name, last_name, email, phone, playtomic_email, notes } = req.body;
    if (!brand_id || !first_name) return res.status(400).json({ error: 'brand_id and first_name are required' });

    // Create the member
    const member = await createMember({ brand_id, first_name, last_name, email, phone, playtomic_email, notes });

    // Try to also create a pass + welcome points (like self-service signup)
    try {
      console.log(`[Backoffice] Creating pass for member ${member.id} (${first_name} ${last_name})`);
      const brand = await getBrand(brand_id);
      const templates = await listTemplates(brand_id);
      const template = templates[0];

      if (brand && template) {
        console.log(`[Backoffice] Brand: ${brand.name}, Template: ${template.id}`);
        const tiers = await listTiers(brand_id);
        const firstTier = tiers.length > 0 ? tiers[0].name : '';
        const fullName = [first_name, last_name].filter(Boolean).join(' ');

        const passInstance = await createPassInstance({
          template_id: template.id,
          brand_id: brand.id,
          customer_data: { email, phone, name: fullName },
          field_values: { nome: fullName, name: fullName, livello: firstTier, punti: '10' },
          member_id: member.id
        });

        // Generate and cache .pkpass
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const pkpassBuffer = await createPkpass(template, passInstance, brand, { baseUrl });
        const cacheDir = ensureCacheDir();
        fs.writeFileSync(path.join(cacheDir, `${passInstance.id}.pkpass`), pkpassBuffer);

        await logEvent({
          pass_id: passInstance.id,
          brand_id: brand.id,
          event_type: 'pass_created',
          metadata: { source: 'backoffice', email, welcome_points: 10 }
        });

        console.log(`[Backoffice] Pass created: ${passInstance.id} with punti=10 for member ${member.id}`);

        // Log welcome points
        try {
          await logPoints({
            brand_id: brand.id,
            member_id: member.id,
            pass_id: passInstance.id,
            points: 10,
            reason: 'signup',
            details: 'Punti di benvenuto'
          });
          console.log(`[Backoffice] Welcome points logged for member ${member.id}`);
        } catch(e) { console.error('[Backoffice] Error logging welcome points:', e.message); }

        // Send welcome email if member has email
        if (email) {
          const CUSTOM_DOMAIN = (process.env.CUSTOM_DOMAIN || 'www.nudj.studio').replace(/^nudj\.studio$/, 'www.nudj.studio');
          const downloadUrl = `${baseUrl}/api/v1/passes/${passInstance.id}/download`;
          sendWelcomeEmail({
            to: email,
            name: fullName,
            brandName: brand.name,
            brandColor: brand.config?.backgroundColor || '#000000',
            points: 10,
            downloadUrl
          }).catch(err => console.error('Welcome email error (backoffice):', err));
        }

        // Log analytics
        await logAnalyticsEvent({
          event_type: 'member_signup',
          brand_id: brand.id,
          metadata: { source: 'backoffice', member_id: member.id }
        });
      }
    } catch(passErr) {
      // Pass creation failed but member was created — log and continue
      console.error('[Members] Pass creation from backoffice failed:', passErr.message);
    }

    res.status(201).json(member);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/v1/members/:id - Get a single member
 */
router.get('/members/:id', async (req, res) => {
  try {
    const member = await getMember(req.params.id);
    if (!member) return res.status(404).json({ error: 'Member not found' });
    res.json(member);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/v1/members/:id - Update a member
 */
router.put('/members/:id', async (req, res) => {
  try {
    const member = await updateMember(req.params.id, req.body);
    if (!member) return res.status(404).json({ error: 'Member not found' });
    res.json(member);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/v1/members/:id - Delete a member
 */
router.delete('/members/:id', async (req, res) => {
  try {
    await deleteMember(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== PLAYTOMIC SYNC ====================

/**
 * POST /api/v1/brands/:id/playtomic/sync - Trigger manual Playtomic sync
 */
router.post('/brands/:id/playtomic/sync', async (req, res) => {
  try {
    const result = await runFullSync(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('Playtomic sync error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/brands/:id/playtomic/logs - Get sync history
 */
router.get('/brands/:id/playtomic/logs', async (req, res) => {
  try {
    const logs = await listSyncLogs(req.params.id, parseInt(req.query.limit) || 50);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== STRIP PROMOS ====================

/**
 * GET /api/v1/brands/:id/strip-promos - List all strip promos for a brand
 */
router.get('/brands/:id/strip-promos', authMiddleware, async (req, res) => {
  try {
    const promos = await pool.query(
      'SELECT * FROM strip_promos WHERE brand_id = $1 ORDER BY created_at DESC',
      [req.params.id]
    );
    res.json(promos.rows);
  } catch (error) {
    console.error('Error listing strip promos:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/brands/:id/strip-promos - Create new strip promo
 * Body: { title, strip_base64, start_date, end_date, push_message, push_frequency }
 */
router.post('/brands/:id/strip-promos', authMiddleware, async (req, res) => {
  try {
    const { title, strip_base64, start_date, end_date, push_message, push_frequency } = req.body;

    if (!title || !strip_base64 || !start_date || !end_date) {
      return res.status(400).json({ error: 'title, strip_base64, start_date, and end_date are required' });
    }

    const result = await pool.query(
      `INSERT INTO strip_promos
       (brand_id, title, strip_base64, start_date, end_date, push_message, push_frequency, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING *`,
      [req.params.id, title, strip_base64, start_date, end_date, push_message || null, push_frequency || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating strip promo:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/v1/strip-promos/:id - Update strip promo
 */
router.put('/strip-promos/:id', authMiddleware, async (req, res) => {
  try {
    const { title, strip_base64, start_date, end_date, push_message, push_frequency } = req.body;

    const updates = [];
    const params = [req.params.id];
    let paramIndex = 2;

    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      params.push(title);
    }
    if (strip_base64 !== undefined) {
      updates.push(`strip_base64 = $${paramIndex++}`);
      params.push(strip_base64);
    }
    if (start_date !== undefined) {
      updates.push(`start_date = $${paramIndex++}`);
      params.push(start_date);
    }
    if (end_date !== undefined) {
      updates.push(`end_date = $${paramIndex++}`);
      params.push(end_date);
    }
    if (push_message !== undefined) {
      updates.push(`push_message = $${paramIndex++}`);
      params.push(push_message);
    }
    if (push_frequency !== undefined) {
      updates.push(`push_frequency = $${paramIndex++}`);
      params.push(push_frequency);
    }

    updates.push(`updated_at = NOW()`);

    if (updates.length === 1) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const result = await pool.query(
      `UPDATE strip_promos SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Strip promo not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating strip promo:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/v1/strip-promos/:id - Delete strip promo
 */
router.delete('/strip-promos/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM strip_promos WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Strip promo not found' });
    }

    res.json({ success: true, id: req.params.id });
  } catch (error) {
    console.error('Error deleting strip promo:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== REFERRAL ====================

/**
 * GET /api/v1/brands/:id/referral-stats - Get referral stats for brand
 */
router.get('/brands/:id/referral-stats', authMiddleware, async (req, res) => {
  try {
    const stats = await pool.query(
      `SELECT
        COUNT(*) as total_members,
        COUNT(*) FILTER (WHERE referred_by IS NOT NULL) as referred_members,
        COALESCE(AVG(referral_count), 0) as avg_referrals_per_member,
        COALESCE(MAX(referral_count), 0) as max_referrals
       FROM members WHERE brand_id = $1`,
      [req.params.id]
    );

    const topReferrers = await pool.query(
      `SELECT id, first_name, last_name, email, referral_count
       FROM members
       WHERE brand_id = $1 AND referral_count > 0
       ORDER BY referral_count DESC
       LIMIT 10`,
      [req.params.id]
    );

    res.json({
      stats: stats.rows[0],
      topReferrers: topReferrers.rows
    });
  } catch (error) {
    console.error('Error getting referral stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== ANALYTICS FULL ====================

/**
 * GET /api/v1/brands/:id/analytics/full - Get comprehensive analytics for brand
 */
router.get('/brands/:id/analytics/full', authMiddleware, async (req, res) => {
  try {
    // Pass statistics
    const passStats = await pool.query(
      `SELECT
        COUNT(*) as total_passes,
        COUNT(*) FILTER (WHERE status = 'active') as active_passes,
        COUNT(*) FILTER (WHERE status = 'inactive') as inactive_passes,
        COUNT(*) FILTER (WHERE status = 'expired') as expired_passes,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as passes_created_week,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as passes_created_month
       FROM pass_instances WHERE brand_id = $1`,
      [req.params.id]
    );

    // Device statistics
    const deviceStats = await pool.query(
      `SELECT
        COUNT(DISTINCT device_library_id) as total_devices,
        COUNT(*) as total_registrations
       FROM devices
       WHERE pass_id IN (SELECT id FROM pass_instances WHERE brand_id = $1)`,
      [req.params.id]
    );

    // Member statistics
    const memberStats = await pool.query(
      `SELECT
        COUNT(*) as total_members,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as members_created_week,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as members_created_month,
        COUNT(*) FILTER (WHERE referred_by IS NOT NULL) as referred_members,
        COALESCE(AVG(referral_count), 0) as avg_referral_count
       FROM members WHERE brand_id = $1`,
      [req.params.id]
    );

    // Event statistics
    const eventStats = await pool.query(
      `SELECT
        COUNT(*) as total_events,
        COUNT(*) FILTER (WHERE event_type = 'pass_created') as passes_created,
        COUNT(*) FILTER (WHERE event_type = 'pass_updated') as passes_updated,
        COUNT(*) FILTER (WHERE event_type = 'device_registered') as devices_registered,
        COUNT(*) FILTER (WHERE event_type = 'push_sent') as pushes_sent,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as events_week
       FROM events WHERE brand_id = $1`,
      [req.params.id]
    );

    // Points/engagement statistics
    const engagementStats = await pool.query(
      `SELECT
        COUNT(*) as total_claims,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as claims_week
       FROM reward_claims WHERE reward_id IN (SELECT id FROM rewards WHERE brand_id = $1)`,
      [req.params.id]
    );

    res.json({
      passes: passStats.rows[0],
      devices: deviceStats.rows[0],
      members: memberStats.rows[0],
      events: eventStats.rows[0],
      engagement: engagementStats.rows[0],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// EMAIL RECAP
// ============================================================================

/**
 * POST /api/v1/brands/:id/send-recap - Manually trigger a recap email for a brand
 */
router.post('/brands/:id/send-recap', authMiddleware, async (req, res) => {
  try {
    const brand = await getBrand(req.params.id);
    if (!brand) return res.status(404).json({ error: 'Brand not found' });
    const { type } = req.body; // 'weekly' or 'monthly'
    if (!type || !['weekly', 'monthly'].includes(type)) {
      return res.status(400).json({ error: 'type must be "weekly" or "monthly"' });
    }
    const result = await sendBrandRecap(brand, type);
    res.json(result);
  } catch (error) {
    console.error('Error sending recap:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/recap/run - Manually trigger recap for all brands
 */
router.post('/recap/run', authMiddleware, async (req, res) => {
  try {
    const { type } = req.body;
    if (!type || !['weekly', 'monthly'].includes(type)) {
      return res.status(400).json({ error: 'type must be "weekly" or "monthly"' });
    }
    const results = await runRecap(type);
    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
