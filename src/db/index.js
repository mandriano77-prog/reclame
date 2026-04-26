const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

// Use DATABASE_URL from Railway (or local dev)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway')
    ? { rejectUnauthorized: false }
    : false
});

// SQL schema definitions (PostgreSQL syntax)
const SCHEMA = `
CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pass_templates (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id),
  name TEXT NOT NULL,
  pass_type TEXT NOT NULL DEFAULT 'generic',
  style JSONB NOT NULL DEFAULT '{}',
  fields JSONB NOT NULL DEFAULT '[]',
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pass_instances (
  id TEXT PRIMARY KEY,
  serial_number TEXT UNIQUE NOT NULL,
  template_id TEXT NOT NULL REFERENCES pass_templates(id),
  brand_id TEXT NOT NULL REFERENCES brands(id),
  customer_data JSONB DEFAULT '{}',
  field_values JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active',
  device_token TEXT,
  auth_token TEXT NOT NULL,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  pass_id TEXT REFERENCES pass_instances(id),
  brand_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  device_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS device_registrations (
  id SERIAL PRIMARY KEY,
  device_library_id TEXT NOT NULL,
  push_token TEXT NOT NULL,
  serial_number TEXT NOT NULL REFERENCES pass_instances(serial_number),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(device_library_id, serial_number)
);

CREATE TABLE IF NOT EXISTS rewards (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id),
  title TEXT NOT NULL,
  description TEXT,
  cost INTEGER NOT NULL DEFAULT 0,
  icon TEXT DEFAULT '🎁',
  active BOOLEAN DEFAULT true,
  max_claims INTEGER,
  total_claimed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id),
  title TEXT NOT NULL,
  description TEXT,
  points INTEGER NOT NULL DEFAULT 0,
  icon TEXT DEFAULT '⭐',
  type TEXT DEFAULT 'action',
  recurring BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tiers (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id),
  name TEXT NOT NULL,
  min_points INTEGER NOT NULL DEFAULT 0,
  color TEXT DEFAULT '#888888',
  perks JSONB DEFAULT '[]',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vip_cards (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT 'from-blue-400 to-blue-600',
  assigned INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reward_claims (
  id TEXT PRIMARY KEY,
  reward_id TEXT NOT NULL REFERENCES rewards(id),
  pass_id TEXT NOT NULL REFERENCES pass_instances(id),
  brand_id TEXT NOT NULL,
  claimed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS challenge_completions (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL REFERENCES challenges(id),
  pass_id TEXT NOT NULL REFERENCES pass_instances(id),
  brand_id TEXT NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS push_log (
  id SERIAL PRIMARY KEY,
  brand_id TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target TEXT DEFAULT 'all',
  sent_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

/**
 * Initialize database - create tables if they don't exist
 */
async function getDb() {
  try {
    await pool.query(SCHEMA);
    console.log('â Database schema initialized (PostgreSQL)');
  } catch (error) {
    console.error('Error initializing schema:', error);
    throw error;
  }
  return pool;
}

/**
 * saveDb - no-op for PostgreSQL (data is persisted automatically)
 */
function saveDb() {
  // No-op: PostgreSQL persists automatically
}

/**
 * Create a new brand
 */
async function createBrand(data) {
  const id = data.id || uuidv4();
  const { name, slug, config = {} } = data;

  if (!name || !slug) {
    throw new Error('Brand name and slug are required');
  }

  const configObj = typeof config === 'string' ? JSON.parse(config) : config;

  try {
    await pool.query(
      `INSERT INTO brands (id, name, slug, config) VALUES ($1, $2, $3, $4)`,
      [id, name, slug, JSON.stringify(configObj)]
    );
    return { id, name, slug, config: configObj };
  } catch (error) {
    throw new Error(`Failed to create brand: ${error.message}`);
  }
}

/**
 * Create a new pass template
 */
async function createTemplate(data) {
  const id = data.id || uuidv4();
  const { brand_id, name, pass_type = 'generic', style = {}, fields = [], config = {} } = data;

  if (!brand_id || !name) {
    throw new Error('Brand ID and template name are required');
  }

  const styleObj = typeof style === 'string' ? JSON.parse(style) : style;
  const fieldsObj = typeof fields === 'string' ? JSON.parse(fields) : fields;
  const configObj = typeof config === 'string' ? JSON.parse(config) : config;

  try {
    await pool.query(
      `INSERT INTO pass_templates (id, brand_id, name, pass_type, style, fields, config) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, brand_id, name, pass_type, JSON.stringify(styleObj), JSON.stringify(fieldsObj), JSON.stringify(configObj)]
    );
    return {
      id, brand_id, name, pass_type,
      style: styleObj,
      fields: fieldsObj,
      config: configObj
    };
  } catch (error) {
    throw new Error(`Failed to create template: ${error.message}`);
  }
}

/**
 * Create a new pass instance
 */
async function createPassInstance(data) {
  const id = data.id || uuidv4();
  const serial_number = data.serial_number || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const { template_id, brand_id, customer_data = {}, field_values = {}, device_token = null } = data;
  const auth_token = data.auth_token || uuidv4();

  if (!template_id || !brand_id) {
    throw new Error('Template ID and Brand ID are required');
  }

  const customerObj = typeof customer_data === 'string' ? JSON.parse(customer_data) : customer_data;
  const fieldObj = typeof field_values === 'string' ? JSON.parse(field_values) : field_values;

  try {
    await pool.query(
      `INSERT INTO pass_instances (id, serial_number, template_id, brand_id, customer_data, field_values, device_token, auth_token)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, serial_number, template_id, brand_id, JSON.stringify(customerObj), JSON.stringify(fieldObj), device_token, auth_token]
    );
    return {
      id, serial_number, template_id, brand_id,
      customer_data: customerObj,
      field_values: fieldObj,
      device_token, auth_token,
      status: 'active'
    };
  } catch (error) {
    throw new Error(`Failed to create pass instance: ${error.message}`);
  }
}

/**
 * Get a pass instance by ID
 */
async function getPassInstance(id) {
  try {
    const result = await pool.query(
      `SELECT * FROM pass_instances WHERE id = $1`, [id]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      serial_number: row.serial_number,
      template_id: row.template_id,
      brand_id: row.brand_id,
      customer_data: row.customer_data,
      field_values: row.field_values,
      status: row.status,
      device_token: row.device_token,
      auth_token: row.auth_token,
      last_updated: row.last_updated,
      created_at: row.created_at
    };
  } catch (error) {
    throw new Error(`Failed to get pass instance: ${error.message}`);
  }
}

/**
 * Get a pass instance by serial number
 */
async function getPassBySerial(serial) {
  try {
    const result = await pool.query(
      `SELECT * FROM pass_instances WHERE serial_number = $1`, [serial]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      serial_number: row.serial_number,
      template_id: row.template_id,
      brand_id: row.brand_id,
      customer_data: row.customer_data,
      field_values: row.field_values,
      status: row.status,
      device_token: row.device_token,
      auth_token: row.auth_token,
      last_updated: row.last_updated,
      created_at: row.created_at
    };
  } catch (error) {
    throw new Error(`Failed to get pass by serial: ${error.message}`);
  }
}

/**
 * Update a pass instance
 */
async function updatePassInstance(id, data) {
  const updates = [];
  const values = [];
  let paramCount = 0;

  if (data.status) {
    paramCount++;
    updates.push(`status = $${paramCount}`);
    values.push(data.status);
  }
  if (data.device_token !== undefined) {
    paramCount++;
    updates.push(`device_token = $${paramCount}`);
    values.push(data.device_token);
  }
  if (data.customer_data) {
    paramCount++;
    const customerObj = typeof data.customer_data === 'string' ? data.customer_data : JSON.stringify(data.customer_data);
    updates.push(`customer_data = $${paramCount}`);
    values.push(customerObj);
  }
  if (data.field_values) {
    paramCount++;
    const fieldObj = typeof data.field_values === 'string' ? data.field_values : JSON.stringify(data.field_values);
    updates.push(`field_values = $${paramCount}`);
    values.push(fieldObj);
  }

  if (updates.length === 0) return getPassInstance(id);

  updates.push('last_updated = NOW()');
  paramCount++;
  values.push(id);

  try {
    await pool.query(
      `UPDATE pass_instances SET ${updates.join(', ')} WHERE id = $${paramCount}`,
      values
    );
    return getPassInstance(id);
  } catch (error) {
    throw new Error(`Failed to update pass instance: ${error.message}`);
  }
}

/**
 * Log an event
 */
async function logEvent(data) {
  const { pass_id, brand_id, event_type, device_id = null, metadata = {} } = data;

  if (!brand_id || !event_type) {
    throw new Error('Brand ID and event type are required');
  }

  const metadataObj = typeof metadata === 'string' ? metadata : JSON.stringify(metadata);

  try {
    await pool.query(
      `INSERT INTO events (pass_id, brand_id, event_type, device_id, metadata) VALUES ($1, $2, $3, $4, $5)`,
      [pass_id || null, brand_id, event_type, device_id, metadataObj]
    );
    return { success: true };
  } catch (error) {
    throw new Error(`Failed to log event: ${error.message}`);
  }
}

/**
 * Get analytics for a brand
 */
async function getAnalytics(brandId) {
  try {
    // Total passes
    const passResult = await pool.query(
      `SELECT COUNT(*) as count FROM pass_instances WHERE brand_id = $1`, [brandId]
    );
    const totalPasses = parseInt(passResult.rows[0].count) || 0;

    // Passes by status
    const statusResult = await pool.query(
      `SELECT status, COUNT(*) as count FROM pass_instances WHERE brand_id = $1 GROUP BY status`, [brandId]
    );
    const byStatus = {};
    statusResult.rows.forEach(row => {
      byStatus[row.status] = parseInt(row.count);
    });

    // Event counts by type
    const eventResult = await pool.query(
      `SELECT event_type, COUNT(*) as count FROM events WHERE brand_id = $1 GROUP BY event_type`, [brandId]
    );
    const events = {};
    eventResult.rows.forEach(row => {
      events[row.event_type] = parseInt(row.count);
    });

    return { totalPasses, byStatus, events };
  } catch (error) {
    throw new Error(`Failed to get analytics: ${error.message}`);
  }
}

/**
 * Register a device for push notifications
 */
async function registerDevice(data) {
  const { device_library_id, push_token, serial_number } = data;

  if (!device_library_id || !push_token || !serial_number) {
    throw new Error('Device library ID, push token, and serial number are required');
  }

  try {
    await pool.query(
      `INSERT INTO device_registrations (device_library_id, push_token, serial_number)
       VALUES ($1, $2, $3)
       ON CONFLICT (device_library_id, serial_number) DO NOTHING`,
      [device_library_id, push_token, serial_number]
    );
    return { success: true };
  } catch (error) {
    throw new Error(`Failed to register device: ${error.message}`);
  }
}

/**
 * Get all devices registered for a pass
 */
async function getDevicesForPass(serial) {
  try {
    const result = await pool.query(
      `SELECT device_library_id, push_token FROM device_registrations WHERE serial_number = $1`,
      [serial]
    );
    return result.rows;
  } catch (error) {
    throw new Error(`Failed to get devices for pass: ${error.message}`);
  }
}

/**
 * Get a brand by ID
 */
async function getBrand(id) {
  try {
    const result = await pool.query(
      `SELECT * FROM brands WHERE id = $1`, [id]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      config: row.config,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  } catch (error) {
    throw new Error(`Failed to get brand: ${error.message}`);
  }
}

/**
 * Get a template by ID
 */
async function getTemplate(id) {
  try {
    const result = await pool.query(
      `SELECT * FROM pass_templates WHERE id = $1`, [id]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      brand_id: row.brand_id,
      name: row.name,
      pass_type: row.pass_type,
      style: row.style,
      fields: row.fields,
      config: row.config,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  } catch (error) {
    throw new Error(`Failed to get template: ${error.message}`);
  }
}

// ============================================================================
// LIST FUNCTIONS (previously done via db.exec() in routes.js)
// ============================================================================

/**
 * List all brands
 */
async function listBrands() {
  const result = await pool.query('SELECT * FROM brands ORDER BY created_at DESC');
  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    config: row.config,
    created_at: row.created_at,
    updated_at: row.updated_at
  }));
}

/**
 * List templates (optionally filtered by brand_id)
 */
async function listTemplates(brandId) {
  let query = 'SELECT * FROM pass_templates';
  const params = [];
  if (brandId) {
    query += ' WHERE brand_id = $1';
    params.push(brandId);
  }
  query += ' ORDER BY created_at DESC';
  const result = await pool.query(query, params);
  return result.rows.map(row => ({
    id: row.id,
    brand_id: row.brand_id,
    name: row.name,
    pass_type: row.pass_type,
    style: row.style,
    fields: row.fields,
    config: row.config,
    created_at: row.created_at,
    updated_at: row.updated_at
  }));
}

/**
 * List passes (optionally filtered by brand_id and/or status)
 */
async function listPasses(brandId, status) {
  let query = 'SELECT * FROM pass_instances';
  const conditions = [];
  const params = [];
  let paramCount = 0;

  if (brandId) {
    paramCount++;
    conditions.push(`brand_id = $${paramCount}`);
    params.push(brandId);
  }
  if (status) {
    paramCount++;
    conditions.push(`status = $${paramCount}`);
    params.push(status);
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }
  query += ' ORDER BY created_at DESC';

  const result = await pool.query(query, params);
  return result.rows.map(row => ({
    id: row.id,
    serial_number: row.serial_number,
    template_id: row.template_id,
    brand_id: row.brand_id,
    customer_data: row.customer_data,
    field_values: row.field_values,
    status: row.status,
    device_token: row.device_token,
    auth_token: row.auth_token,
    last_updated: row.last_updated,
    created_at: row.created_at
  }));
}

/**
 * List events for a brand
 */
async function listEvents(brandId, limit = 50) {
  const result = await pool.query(
    'SELECT * FROM events WHERE brand_id = $1 ORDER BY created_at DESC LIMIT $2',
    [brandId, parseInt(limit)]
  );
  return result.rows.map(row => ({
    id: row.id,
    pass_id: row.pass_id,
    brand_id: row.brand_id,
    event_type: row.event_type,
    device_id: row.device_id,
    metadata: row.metadata,
    created_at: row.created_at
  }));
}

/**
 * Delete device registration
 */
async function unregisterDevice(deviceLibraryId, serialNumber) {
  await pool.query(
    'DELETE FROM device_registrations WHERE device_library_id = $1 AND serial_number = $2',
    [deviceLibraryId, serialNumber]
  );
}

/**
 * Get serial numbers for a device
 */
async function getSerialsForDevice(deviceLibraryId) {
  const result = await pool.query(
    'SELECT serial_number FROM device_registrations WHERE device_library_id = $1',
    [deviceLibraryId]
  );
  return result.rows.map(row => row.serial_number);
}

// ============================================================================
// REWARDS CRUD
// ============================================================================

/**
 * Create a new reward
 */
async function createReward(data) {
  const id = data.id || uuidv4();
  const { brand_id, title, description = '', cost = 0, icon = '🎁', active = true, max_claims = null } = data;

  if (!brand_id || !title) {
    throw new Error('Brand ID and title are required');
  }

  try {
    await pool.query(
      `INSERT INTO rewards (id, brand_id, title, description, cost, icon, active, max_claims)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, brand_id, title, description, cost, icon, active, max_claims]
    );
    return { id, brand_id, title, description, cost, icon, active, max_claims, total_claimed: 0 };
  } catch (error) {
    throw new Error(`Failed to create reward: ${error.message}`);
  }
}

/**
 * List rewards for a brand
 */
async function listRewards(brandId) {
  try {
    const result = await pool.query(
      `SELECT * FROM rewards WHERE brand_id = $1 ORDER BY created_at DESC`,
      [brandId]
    );
    return result.rows;
  } catch (error) {
    throw new Error(`Failed to list rewards: ${error.message}`);
  }
}

/**
 * Get a single reward by ID
 */
async function getReward(id) {
  try {
    const result = await pool.query('SELECT * FROM rewards WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return result.rows[0];
  } catch (error) {
    throw new Error(`Failed to get reward: ${error.message}`);
  }
}

/**
 * Update a reward
 */
async function updateReward(id, data) {
  try {
    const current = await getReward(id);
    if (!current) return null;

    const updates = [];
    const values = [];
    let paramCount = 0;

    if (data.title) {
      paramCount++;
      updates.push(`title = $${paramCount}`);
      values.push(data.title);
    }
    if (data.description !== undefined) {
      paramCount++;
      updates.push(`description = $${paramCount}`);
      values.push(data.description);
    }
    if (data.cost !== undefined) {
      paramCount++;
      updates.push(`cost = $${paramCount}`);
      values.push(data.cost);
    }
    if (data.icon !== undefined) {
      paramCount++;
      updates.push(`icon = $${paramCount}`);
      values.push(data.icon);
    }
    if (data.active !== undefined) {
      paramCount++;
      updates.push(`active = $${paramCount}`);
      values.push(data.active);
    }

    if (updates.length === 0) return getReward(id);

    paramCount++;
    values.push(id);

    await pool.query(
      `UPDATE rewards SET ${updates.join(', ')} WHERE id = $${paramCount}`,
      values
    );
    return getReward(id);
  } catch (error) {
    throw new Error(`Failed to update reward: ${error.message}`);
  }
}

/**
 * Delete a reward and its claims
 */
async function deleteReward(id) {
  try {
    await pool.query('DELETE FROM reward_claims WHERE reward_id = $1', [id]);
    await pool.query('DELETE FROM rewards WHERE id = $1', [id]);
    return { success: true };
  } catch (error) {
    throw new Error(`Failed to delete reward: ${error.message}`);
  }
}

// ============================================================================
// CHALLENGES CRUD
// ============================================================================

/**
 * Create a new challenge
 */
async function createChallenge(data) {
  const id = data.id || uuidv4();
  const { brand_id, title, description = '', points = 0, icon = '⭐', type = 'action', recurring = false, active = true } = data;

  if (!brand_id || !title) {
    throw new Error('Brand ID and title are required');
  }

  try {
    await pool.query(
      `INSERT INTO challenges (id, brand_id, title, description, points, icon, type, recurring, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, brand_id, title, description, points, icon, type, recurring, active]
    );
    return { id, brand_id, title, description, points, icon, type, recurring, active };
  } catch (error) {
    throw new Error(`Failed to create challenge: ${error.message}`);
  }
}

/**
 * List challenges for a brand
 */
async function listChallenges(brandId) {
  try {
    const result = await pool.query(
      `SELECT * FROM challenges WHERE brand_id = $1 ORDER BY created_at DESC`,
      [brandId]
    );
    return result.rows;
  } catch (error) {
    throw new Error(`Failed to list challenges: ${error.message}`);
  }
}

/**
 * Get a single challenge by ID
 */
async function getChallenge(id) {
  try {
    const result = await pool.query('SELECT * FROM challenges WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return result.rows[0];
  } catch (error) {
    throw new Error(`Failed to get challenge: ${error.message}`);
  }
}

/**
 * Update a challenge
 */
async function updateChallenge(id, data) {
  try {
    const current = await getChallenge(id);
    if (!current) return null;

    const updates = [];
    const values = [];
    let paramCount = 0;

    if (data.title) {
      paramCount++;
      updates.push(`title = $${paramCount}`);
      values.push(data.title);
    }
    if (data.description !== undefined) {
      paramCount++;
      updates.push(`description = $${paramCount}`);
      values.push(data.description);
    }
    if (data.points !== undefined) {
      paramCount++;
      updates.push(`points = $${paramCount}`);
      values.push(data.points);
    }
    if (data.icon !== undefined) {
      paramCount++;
      updates.push(`icon = $${paramCount}`);
      values.push(data.icon);
    }
    if (data.type !== undefined) {
      paramCount++;
      updates.push(`type = $${paramCount}`);
      values.push(data.type);
    }
    if (data.recurring !== undefined) {
      paramCount++;
      updates.push(`recurring = $${paramCount}`);
      values.push(data.recurring);
    }
    if (data.active !== undefined) {
      paramCount++;
      updates.push(`active = $${paramCount}`);
      values.push(data.active);
    }

    if (updates.length === 0) return getChallenge(id);

    paramCount++;
    values.push(id);

    await pool.query(
      `UPDATE challenges SET ${updates.join(', ')} WHERE id = $${paramCount}`,
      values
    );
    return getChallenge(id);
  } catch (error) {
    throw new Error(`Failed to update challenge: ${error.message}`);
  }
}

/**
 * Delete a challenge and its completions
 */
async function deleteChallenge(id) {
  try {
    await pool.query('DELETE FROM challenge_completions WHERE challenge_id = $1', [id]);
    await pool.query('DELETE FROM challenges WHERE id = $1', [id]);
    return { success: true };
  } catch (error) {
    throw new Error(`Failed to delete challenge: ${error.message}`);
  }
}

// ============================================================================
// TIERS CRUD
// ============================================================================

/**
 * Create a new tier
 */
async function createTier(data) {
  const id = data.id || uuidv4();
  const { brand_id, name, min_points = 0, color = '#888888', perks = [], sort_order = 0 } = data;

  if (!brand_id || !name) {
    throw new Error('Brand ID and name are required');
  }

  try {
    const perksJson = typeof perks === 'string' ? perks : JSON.stringify(perks);
    await pool.query(
      `INSERT INTO tiers (id, brand_id, name, min_points, color, perks, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, brand_id, name, min_points, color, perksJson, sort_order]
    );
    return { id, brand_id, name, min_points, color, perks, sort_order };
  } catch (error) {
    throw new Error(`Failed to create tier: ${error.message}`);
  }
}

/**
 * List tiers for a brand
 */
async function listTiers(brandId) {
  try {
    const result = await pool.query(
      `SELECT * FROM tiers WHERE brand_id = $1 ORDER BY min_points ASC`,
      [brandId]
    );
    return result.rows;
  } catch (error) {
    throw new Error(`Failed to list tiers: ${error.message}`);
  }
}

/**
 * Get a single tier by ID
 */
async function getTier(id) {
  try {
    const result = await pool.query('SELECT * FROM tiers WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return result.rows[0];
  } catch (error) {
    throw new Error(`Failed to get tier: ${error.message}`);
  }
}

/**
 * Update a tier
 */
async function updateTier(id, data) {
  try {
    const current = await getTier(id);
    if (!current) return null;

    const updates = [];
    const values = [];
    let paramCount = 0;

    if (data.name) {
      paramCount++;
      updates.push(`name = $${paramCount}`);
      values.push(data.name);
    }
    if (data.min_points !== undefined) {
      paramCount++;
      updates.push(`min_points = $${paramCount}`);
      values.push(data.min_points);
    }
    if (data.color !== undefined) {
      paramCount++;
      updates.push(`color = $${paramCount}`);
      values.push(data.color);
    }
    if (data.perks !== undefined) {
      paramCount++;
      const perksJson = typeof data.perks === 'string' ? data.perks : JSON.stringify(data.perks);
      updates.push(`perks = $${paramCount}`);
      values.push(perksJson);
    }
    if (data.sort_order !== undefined) {
      paramCount++;
      updates.push(`sort_order = $${paramCount}`);
      values.push(data.sort_order);
    }

    if (updates.length === 0) return getTier(id);

    paramCount++;
    values.push(id);

    await pool.query(
      `UPDATE tiers SET ${updates.join(', ')} WHERE id = $${paramCount}`,
      values
    );
    return getTier(id);
  } catch (error) {
    throw new Error(`Failed to update tier: ${error.message}`);
  }
}

/**
 * Delete a tier
 */
async function deleteTier(id) {
  try {
    await pool.query('DELETE FROM tiers WHERE id = $1', [id]);
    return { success: true };
  } catch (error) {
    throw new Error(`Failed to delete tier: ${error.message}`);
  }
}

// ============================================================================
// VIP CARDS CRUD
// ============================================================================

/**
 * Create a new VIP card
 */
async function createVipCard(data) {
  const id = data.id || uuidv4();
  const { brand_id, name, description = '', color = 'from-blue-400 to-blue-600', active = true } = data;

  if (!brand_id || !name) {
    throw new Error('Brand ID and name are required');
  }

  try {
    await pool.query(
      `INSERT INTO vip_cards (id, brand_id, name, description, color, active)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, brand_id, name, description, color, active]
    );
    return { id, brand_id, name, description, color, assigned: 0, active };
  } catch (error) {
    throw new Error(`Failed to create VIP card: ${error.message}`);
  }
}

/**
 * List VIP cards for a brand
 */
async function listVipCards(brandId) {
  try {
    const result = await pool.query(
      `SELECT * FROM vip_cards WHERE brand_id = $1 ORDER BY created_at DESC`,
      [brandId]
    );
    return result.rows;
  } catch (error) {
    throw new Error(`Failed to list VIP cards: ${error.message}`);
  }
}

/**
 * Get a single VIP card by ID
 */
async function getVipCard(id) {
  try {
    const result = await pool.query('SELECT * FROM vip_cards WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return result.rows[0];
  } catch (error) {
    throw new Error(`Failed to get VIP card: ${error.message}`);
  }
}

/**
 * Update a VIP card
 */
async function updateVipCard(id, data) {
  try {
    const current = await getVipCard(id);
    if (!current) return null;

    const updates = [];
    const values = [];
    let paramCount = 0;

    if (data.name) {
      paramCount++;
      updates.push(`name = $${paramCount}`);
      values.push(data.name);
    }
    if (data.description !== undefined) {
      paramCount++;
      updates.push(`description = $${paramCount}`);
      values.push(data.description);
    }
    if (data.color !== undefined) {
      paramCount++;
      updates.push(`color = $${paramCount}`);
      values.push(data.color);
    }
    if (data.assigned !== undefined) {
      paramCount++;
      updates.push(`assigned = $${paramCount}`);
      values.push(data.assigned);
    }
    if (data.active !== undefined) {
      paramCount++;
      updates.push(`active = $${paramCount}`);
      values.push(data.active);
    }

    if (updates.length === 0) return getVipCard(id);

    paramCount++;
    values.push(id);

    await pool.query(
      `UPDATE vip_cards SET ${updates.join(', ')} WHERE id = $${paramCount}`,
      values
    );
    return getVipCard(id);
  } catch (error) {
    throw new Error(`Failed to update VIP card: ${error.message}`);
  }
}

/**
 * Delete a VIP card
 */
async function deleteVipCard(id) {
  try {
    await pool.query('DELETE FROM vip_cards WHERE id = $1', [id]);
    return { success: true };
  } catch (error) {
    throw new Error(`Failed to delete VIP card: ${error.message}`);
  }
}

// ============================================================================
// REWARD CLAIMS
// ============================================================================

/**
 * Claim a reward - creates claim, increments total_claimed, deducts points from pass
 */
async function claimReward(data) {
  const id = data.id || uuidv4();
  const { reward_id, pass_id, brand_id } = data;

  if (!reward_id || !pass_id || !brand_id) {
    throw new Error('Reward ID, pass ID, and brand ID are required');
  }

  try {
    // Get reward
    const reward = await getReward(reward_id);
    if (!reward) {
      throw new Error('Reward not found');
    }

    // Get pass
    const pass = await getPassInstance(pass_id);
    if (!pass) {
      throw new Error('Pass not found');
    }

    // Check if pass has enough points
    const currentPoints = pass.field_values?.punti || 0;
    if (currentPoints < reward.cost) {
      throw new Error(`Insufficient points. Required: ${reward.cost}, Available: ${currentPoints}`);
    }

    // Create claim
    await pool.query(
      `INSERT INTO reward_claims (id, reward_id, pass_id, brand_id) VALUES ($1, $2, $3, $4)`,
      [id, reward_id, pass_id, brand_id]
    );

    // Increment total_claimed
    await pool.query(
      `UPDATE rewards SET total_claimed = total_claimed + 1 WHERE id = $1`,
      [reward_id]
    );

    // Deduct points from pass
    const newPoints = currentPoints - reward.cost;
    const updatedFieldValues = { ...pass.field_values, punti: newPoints };
    await updatePassInstance(pass_id, { field_values: updatedFieldValues });

    return { id, reward_id, pass_id, brand_id, claimed_at: new Date().toISOString() };
  } catch (error) {
    throw new Error(`Failed to claim reward: ${error.message}`);
  }
}

/**
 * List reward claims
 */
async function listClaims(brandId, passId = null) {
  try {
    let query = 'SELECT * FROM reward_claims WHERE brand_id = $1';
    const params = [brandId];

    if (passId) {
      query += ' AND pass_id = $2';
      params.push(passId);
    }

    query += ' ORDER BY claimed_at DESC';
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    throw new Error(`Failed to list claims: ${error.message}`);
  }
}

// ============================================================================
// CHALLENGE COMPLETIONS
// ============================================================================

/**
 * Complete a challenge - creates completion, adds points to pass
 */
async function completeChallenge(data) {
  const id = data.id || uuidv4();
  const { challenge_id, pass_id, brand_id } = data;

  if (!challenge_id || !pass_id || !brand_id) {
    throw new Error('Challenge ID, pass ID, and brand ID are required');
  }

  try {
    // Get challenge
    const challenge = await getChallenge(challenge_id);
    if (!challenge) {
      throw new Error('Challenge not found');
    }

    // Get pass
    const pass = await getPassInstance(pass_id);
    if (!pass) {
      throw new Error('Pass not found');
    }

    // Create completion
    await pool.query(
      `INSERT INTO challenge_completions (id, challenge_id, pass_id, brand_id) VALUES ($1, $2, $3, $4)`,
      [id, challenge_id, pass_id, brand_id]
    );

    // Add points to pass
    const currentPoints = pass.field_values?.punti || 0;
    const newPoints = currentPoints + challenge.points;
    const updatedFieldValues = { ...pass.field_values, punti: newPoints };
    await updatePassInstance(pass_id, { field_values: updatedFieldValues });

    return { id, challenge_id, pass_id, brand_id, completed_at: new Date().toISOString() };
  } catch (error) {
    throw new Error(`Failed to complete challenge: ${error.message}`);
  }
}

/**
 * List challenge completions
 */
async function listCompletions(brandId, passId = null) {
  try {
    let query = 'SELECT * FROM challenge_completions WHERE brand_id = $1';
    const params = [brandId];

    if (passId) {
      query += ' AND pass_id = $2';
      params.push(passId);
    }

    query += ' ORDER BY completed_at DESC';
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    throw new Error(`Failed to list completions: ${error.message}`);
  }
}

// ============================================================================
// PUSH LOG
// ============================================================================

/**
 * Log a push notification
 */
async function logPush(data) {
  const { brand_id, title, message, target = 'all', sent_count = 0 } = data;

  if (!brand_id || !title || !message) {
    throw new Error('Brand ID, title, and message are required');
  }

  try {
    const result = await pool.query(
      `INSERT INTO push_log (brand_id, title, message, target, sent_count) VALUES ($1, $2, $3, $4, $5)
       RETURNING id, brand_id, title, message, target, sent_count, created_at`,
      [brand_id, title, message, target, sent_count]
    );
    return result.rows[0];
  } catch (error) {
    throw new Error(`Failed to log push: ${error.message}`);
  }
}

/**
 * List push history for a brand
 */
async function listPushes(brandId) {
  try {
    const result = await pool.query(
      `SELECT * FROM push_log WHERE brand_id = $1 ORDER BY created_at DESC`,
      [brandId]
    );
    return result.rows;
  } catch (error) {
    throw new Error(`Failed to list pushes: ${error.message}`);
  }
}

/**
 * Update a brand
 */
async function updateBrand(id, data) {
  const current = await getBrand(id);
  if (!current) return null;

  const newName = data.name || current.name;
  const newSlug = data.slug || current.slug;
  let newConfig = current.config || {};
  if (data.config) {
    newConfig = { ...newConfig, ...data.config };
  }

  try {
    await pool.query(
      'UPDATE brands SET name = $1, slug = $2, config = $3, updated_at = NOW() WHERE id = $4',
      [newName, newSlug, JSON.stringify(newConfig), id]
    );
    return getBrand(id);
  } catch (error) {
    throw new Error(`Failed to update brand: ${error.message}`);
  }
}

/**
 * Delete a brand (and cascade)
 */
async function deleteBrand(id) {
  try {
    // Delete in order due to foreign keys
    await pool.query('DELETE FROM device_registrations WHERE serial_number IN (SELECT serial_number FROM pass_instances WHERE brand_id = $1)', [id]);
    await pool.query('DELETE FROM events WHERE brand_id = $1', [id]);
    await pool.query('DELETE FROM pass_instances WHERE brand_id = $1', [id]);
    await pool.query('DELETE FROM pass_templates WHERE brand_id = $1', [id]);
    await pool.query('DELETE FROM brands WHERE id = $1', [id]);
    return { success: true };
  } catch (error) {
    throw new Error(`Failed to delete brand: ${error.message}`);
  }
}

/**
 * Delete a template
 */
async function deleteTemplate(id) {
  try {
    await pool.query('DELETE FROM device_registrations WHERE serial_number IN (SELECT serial_number FROM pass_instances WHERE template_id = $1)', [id]);
    await pool.query('DELETE FROM events WHERE pass_id IN (SELECT id FROM pass_instances WHERE template_id = $1)', [id]);
    await pool.query('DELETE FROM pass_instances WHERE template_id = $1', [id]);
    await pool.query('DELETE FROM pass_templates WHERE id = $1', [id]);
    return { success: true };
  } catch (error) {
    throw new Error(`Failed to delete template: ${error.message}`);
  }
}

/**
 * Delete a pass instance
 */
async function deletePass(id) {
  try {
    const pass = await getPassInstance(id);
    if (!pass) return null;
    await pool.query('DELETE FROM device_registrations WHERE serial_number = $1', [pass.serial_number]);
    await pool.query('DELETE FROM events WHERE pass_id = $1', [id]);
    await pool.query('DELETE FROM pass_instances WHERE id = $1', [id]);
    return { success: true };
  } catch (error) {
    throw new Error(`Failed to delete pass: ${error.message}`);
  }
}

module.exports = {
  getDb,
  saveDb,
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
  pool
};
