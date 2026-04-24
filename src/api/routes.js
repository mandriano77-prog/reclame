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
  getDb
} = require('../db');
const { createPkpass } = require('../engine/passkit');

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

    const brand = createBrand({
      name,
      slug,
      config: config || {}
    });

    logEvent({
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
    const db = await getDb();
    const results = db.exec('SELECT * FROM brands');

    if (!results || !results[0]) {
      return res.json([]);
    }

    const brands = results[0].values.map(row => ({
      id: row[0],
      name: row[1],
      slug: row[2],
      config: JSON.parse(row[3]),
      created_at: row[4],
      updated_at: row[5]
    }));

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
    const brand = getBrand(req.params.id);

    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    res.json(brand);
  } catch (error) {
    console.error('Error getting brand:', error);
    res.status(500).json({ error: error.message });
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

    const brand = getBrand(brand_id);
    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    const template = createTemplate({
      brand_id,
      name,
      pass_type: pass_type || 'generic',
      style: style || {},
      fields: fields || [],
      config: config || {}
    });

    logEvent({
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
    const db = await getDb();
    const brandId = req.query.brand_id;

    let query = 'SELECT * FROM pass_templates';
    const params = [];

    if (brandId) {
      query += ' WHERE brand_id = ?';
      params.push(brandId);
    }

    const results = db.exec(query, params);

    if (!results || !results[0]) {
      return res.json([]);
    }

    const templates = results[0].values.map(row => ({
      id: row[0],
      brand_id: row[1],
      name: row[2],
      pass_type: row[3],
      style: JSON.parse(row[4]),
      fields: JSON.parse(row[5]),
      config: JSON.parse(row[6]),
      created_at: row[7],
      updated_at: row[8]
    }));

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
    const template = getTemplate(req.params.id);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(template);
  } catch (error) {
    console.error('Error getting template:', error);
    res.status(500).json({ error: error.message });
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

    const template = getTemplate(template_id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const brand = getBrand(template.brand_id);
    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    // Create pass instance
    const passInstance = createPassInstance({
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

    logEvent({
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
    const passInstance = getPassInstance(req.params.id);

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
    const passInstance = getPassInstance(req.params.id);

    if (!passInstance) {
      return res.status(404).json({ error: 'Pass not found' });
    }

    const cacheDir = ensureCacheDir();
    const pkpassPath = path.join(cacheDir, `${req.params.id}.pkpass`);

    // Check if cached file exists
    if (fs.existsSync(pkpassPath)) {
      logEvent({
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
    const template = getTemplate(passInstance.template_id);
    const brand = getBrand(passInstance.brand_id);

    if (!template || !brand) {
      return res.status(404).json({ error: 'Template or brand not found' });
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const pkpassBuffer = await createPkpass(template, passInstance, brand, {
      baseUrl
    });

    fs.writeFileSync(pkpassPath, pkpassBuffer);

    logEvent({
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

    const passInstance = getPassInstance(req.params.id);
    if (!passInstance) {
      return res.status(404).json({ error: 'Pass not found' });
    }

    const updated = updatePassInstance(req.params.id, {
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

    logEvent({
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
 * GET /api/v1/passes - List passes (optional ?brand_id=&status=)
 */
router.get('/passes', async (req, res) => {
  try {
    const db = await getDb();
    const brandId = req.query.brand_id;
    const status = req.query.status;

    let query = 'SELECT * FROM pass_instances ORDER BY created_at DESC';
    const params = [];
    const conditions = [];

    if (brandId) {
      conditions.push('brand_id = ?');
      params.push(brandId);
    }
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    if (conditions.length > 0) {
      query = query.replace('SELECT * FROM pass_instances', `SELECT * FROM pass_instances WHERE ${conditions.join(' AND ')}`);
    }

    const results = db.exec(query, params);

    if (!results || !results[0]) {
      return res.json([]);
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const passes = results[0].values.map(row => ({
      id: row[0],
      serial_number: row[1],
      template_id: row[2],
      brand_id: row[3],
      customer_data: JSON.parse(row[4]),
      field_values: JSON.parse(row[5]),
      status: row[6],
      device_token: row[7],
      auth_token: row[8],
      last_updated: row[9],
      created_at: row[10],
      download_url: `${baseUrl}/api/v1/passes/${row[0]}/download`,
      landing_url: `${baseUrl}/landing/?id=${row[0]}`
    }));

    res.json(passes);
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

    registerDevice({
      device_library_id: deviceLibraryId,
      push_token: pushToken,
      serial_number: serialNumber
    });

    logEvent({
      event_type: 'device_registered',
      device_id: deviceLibraryId,
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
    const db = await getDb();
    const { deviceLibraryId, serialNumber } = req.params;

    db.run(
      'DELETE FROM device_registrations WHERE device_library_id = ? AND serial_number = ?',
      [deviceLibraryId, serialNumber]
    );

    logEvent({
      event_type: 'device_unregistered',
      device_id: deviceLibraryId,
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
    const db = await getDb();
    const { deviceLibraryId } = req.params;

    const results = db.exec(
      'SELECT serial_number FROM device_registrations WHERE device_library_id = ?',
      [deviceLibraryId]
    );

    if (!results || !results[0]) {
      return res.json({ serialNumbers: [] });
    }

    const serialNumbers = results[0].values.map(row => row[0]);

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

    const passInstance = getPassBySerial(serialNumber);

    if (!passInstance) {
      return res.status(404).json({ error: 'Pass not found' });
    }

    const template = getTemplate(passInstance.template_id);
    const brand = getBrand(passInstance.brand_id);

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

    const brand = getBrand(brand_id);
    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    const analytics = getAnalytics(brand_id);

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
    const { brand_id } = req.params;
    const limit = req.query.limit || 50;

    const db = await getDb();
    const results = db.exec(
      'SELECT * FROM events WHERE brand_id = ? ORDER BY created_at DESC LIMIT ?',
      [brand_id, parseInt(limit)]
    );

    if (!results || !results[0]) {
      return res.json([]);
    }

    const events = results[0].values.map(row => ({
      id: row[0],
      pass_id: row[1],
      brand_id: row[2],
      event_type: row[3],
      device_id: row[4],
      metadata: JSON.parse(row[5]),
      created_at: row[6]
    }));

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
    const passInstance = getPassInstance(req.params.pass_id);

    if (!passInstance) {
      return res.status(404).json({ error: 'Pass not found' });
    }

    const template = getTemplate(passInstance.template_id);
    const brand = getBrand(passInstance.brand_id);

    if (!template || !brand) {
      return res.status(404).json({ error: 'Template or brand not found' });
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;

    logEvent({
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

module.exports = router;
