const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const {
  createBrand,
  createTemplate,
  createPassInstance,
  getPassInstance,
  getPassBySerial,
  updatePassInstance,
  logEvent,
  getAnalytics,
  registerDevice,
  getDevicesForPass,
  getBrand,
  getTemplate,
  updateBrand,
  deleteBrand,
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
  listCompletions,
  // Push Log
  logPush,
  listPushes,
  deletePush,
  clearPushHistory,
  getDevicesForBrand
} = require('../db');
const { createPkpass } = require('../engine/passkit');
const { sendPushUpdate } = require('../engine/apns');
const sharp = require('sharp');

const router = express.Router();

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
    const brands = await listBrands();
    res.json(brands);
  } catch (error) {
    console.error('Error listing brands:', error);
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
 * PUT /api/v1/brands/:id - Update brand (name, config)
 */
router.put('/brands/:id', async (req, res) => {
  try {
    const { name, slug, config } = req.body;

    // If logos uploaded, resize to Apple Wallet required sizes
    if (config?.logos?.logo) {
      const rawBuf = Buffer.from(config.logos.logo, 'base64');

      // logo.png = 160x50, logo@2x.png = 320x100
      const logo1x = await sharp(rawBuf).resize(160, 50, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
      const logo2x = await sharp(rawBuf).resize(320, 100, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();

      // icon.png = 29x29, icon@2x.png = 58x58
      const icon1x = await sharp(rawBuf).resize(29, 29, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
      const icon2x = await sharp(rawBuf).resize(58, 58, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();

      config.logos = {
        'logo': logo1x.toString('base64'),
        'logo@2x': logo2x.toString('base64'),
        'icon': icon1x.toString('base64'),
        'icon@2x': icon2x.toString('base64')
      };
      console.log('✓ Logo resized for Apple Wallet');
    }

    const updated = await updateBrand(req.params.id, { name, slug, config });

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
    const { template_id, customer_data, field_values } = req.body;

    if (!template_id) {
      return res.status(400).json({
        error: 'Template ID is required'
      });
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
      field_values: field_values || {}
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
      metadata: { template_id, customer_email: customer_data?.email }
    });

    const downloadUrl = `${baseUrl}/api/v1/passes/${passInstance.id}/download`;
    const landingUrl = `${baseUrl}/landing/?id=${passInstance.id}`;

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
    const landingUrl = `${baseUrl}/landing/?id=${passInstance.id}`;

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

    res.json({
      ...updated,
      download_url: `${baseUrl}/api/v1/passes/${req.params.id}/download`,
      landing_url: `${baseUrl}/landing/?id=${req.params.id}`
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
 * GET /api/v1/passes - List passes (optional ?brand_id=&status=)
 */
router.get('/passes', async (req, res) => {
  try {
    const passes = await listPasses(req.query.brand_id, req.query.status);
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    const passesWithUrls = passes.map(pass => ({
      ...pass,
      download_url: `${baseUrl}/api/v1/passes/${pass.id}/download`,
      landing_url: `${baseUrl}/landing/?id=${pass.id}`
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
 * Get serial numbers for device
 */
router.get('/devices/:deviceLibraryId/registrations/:passTypeId', async (req, res) => {
  try {
    const serialNumbers = await getSerialsForDevice(req.params.deviceLibraryId);
    res.json({ serialNumbers });
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
      res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
      res.setHeader('Content-Disposition', `attachment; filename="${serialNumber}.pkpass"`);
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

// ============================================================================
// REWARDS
// ============================================================================

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
    const { brand_id, title, message, target } = req.body;

    if (!brand_id || !title || !message) {
      return res.status(400).json({
        error: 'Brand ID, title, and message are required'
      });
    }

    const brand = await getBrand(brand_id);
    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
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
      event_type: 'push_sent',
      metadata: {
        title,
        target: target || 'all',
        sent_count: sentCount,
        fail_count: failCount,
        total_devices: devices.length
      }
    });

    res.status(201).json({
      ...pushLog,
      delivery: {
        total_devices: devices.length,
        sent: sentCount,
        failed: failCount,
        note: devices.length === 0
          ? 'No devices registered yet. Passes must be added to Apple Wallet first.'
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

module.exports = router;
