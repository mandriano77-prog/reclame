const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '../../data/nudj.db');
let db = null;
let SQL = null;

// SQL schema definitions
const SCHEMA = `
CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  config TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pass_templates (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id),
  name TEXT NOT NULL,
  pass_type TEXT NOT NULL DEFAULT 'generic',
  style TEXT NOT NULL DEFAULT '{}',
  fields TEXT NOT NULL DEFAULT '[]',
  config TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pass_instances (
  id TEXT PRIMARY KEY,
  serial_number TEXT UNIQUE NOT NULL,
  template_id TEXT NOT NULL REFERENCES pass_templates(id),
  brand_id TEXT NOT NULL REFERENCES brands(id),
  customer_data TEXT DEFAULT '{}',
  field_values TEXT DEFAULT '{}',
  status TEXT DEFAULT 'active',
  device_token TEXT,
  auth_token TEXT NOT NULL,
  last_updated TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pass_id TEXT REFERENCES pass_instances(id),
  brand_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  device_id TEXT,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS device_registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_library_id TEXT NOT NULL,
  push_token TEXT NOT NULL,
  serial_number TEXT NOT NULL REFERENCES pass_instances(serial_number),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(device_library_id, serial_number)
);
`;

/**
 * Initialize and return the sql.js database
 */
async function getDb() {
  if (db && SQL) {
    return db;
  }

  SQL = await initSqlJs();

  // Try to load existing database file
  try {
    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(buffer);
      console.log('✓ Loaded existing database');
    } else {
      db = new SQL.Database();
      console.log('✓ Created new database');
    }
  } catch (error) {
    db = new SQL.Database();
    console.log('⚠ Created new database (load failed):', error.message);
  }

  // Execute schema to create tables (IF NOT EXISTS)
  try {
    db.run(SCHEMA);
    console.log('✓ Database schema initialized');
  } catch (error) {
    console.error('Error initializing schema:', error);
    throw error;
  }

  return db;
}

/**
 * Save in-memory database to disk
 */
function saveDb() {
  if (!db || !SQL) {
    throw new Error('Database not initialized');
  }

  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
    console.log(`✓ Database saved to ${DB_PATH}`);
  } catch (error) {
    console.error('Error saving database:', error);
    throw error;
  }
}

/**
 * Create a new brand
 */
function createBrand(data) {
  if (!db) throw new Error('Database not initialized');

  const id = data.id || uuidv4();
  const { name, slug, config = {} } = data;

  if (!name || !slug) {
    throw new Error('Brand name and slug are required');
  }

  const configStr = typeof config === 'string' ? config : JSON.stringify(config);

  try {
    db.run(
      `INSERT INTO brands (id, name, slug, config) VALUES (?, ?, ?, ?)`,
      [id, name, slug, configStr]
    );
    saveDb();
    return { id, name, slug, config: JSON.parse(configStr) };
  } catch (error) {
    throw new Error(`Failed to create brand: ${error.message}`);
  }
}

/**
 * Create a new pass template
 */
function createTemplate(data) {
  if (!db) throw new Error('Database not initialized');

  const id = data.id || uuidv4();
  const { brand_id, name, pass_type = 'generic', style = {}, fields = [], config = {} } = data;

  if (!brand_id || !name) {
    throw new Error('Brand ID and template name are required');
  }

  const styleStr = typeof style === 'string' ? style : JSON.stringify(style);
  const fieldsStr = typeof fields === 'string' ? fields : JSON.stringify(fields);
  const configStr = typeof config === 'string' ? config : JSON.stringify(config);

  try {
    db.run(
      `INSERT INTO pass_templates (id, brand_id, name, pass_type, style, fields, config) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, brand_id, name, pass_type, styleStr, fieldsStr, configStr]
    );
    saveDb();
    return {
      id,
      brand_id,
      name,
      pass_type,
      style: JSON.parse(styleStr),
      fields: JSON.parse(fieldsStr),
      config: JSON.parse(configStr)
    };
  } catch (error) {
    throw new Error(`Failed to create template: ${error.message}`);
  }
}

/**
 * Create a new pass instance
 */
function createPassInstance(data) {
  if (!db) throw new Error('Database not initialized');

  const id = data.id || uuidv4();
  const serial_number = data.serial_number || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const { template_id, brand_id, customer_data = {}, field_values = {}, device_token = null } = data;
  const auth_token = data.auth_token || uuidv4();

  if (!template_id || !brand_id) {
    throw new Error('Template ID and Brand ID are required');
  }

  const customerStr = typeof customer_data === 'string' ? customer_data : JSON.stringify(customer_data);
  const fieldStr = typeof field_values === 'string' ? field_values : JSON.stringify(field_values);

  try {
    db.run(
      `INSERT INTO pass_instances (id, serial_number, template_id, brand_id, customer_data, field_values, device_token, auth_token)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, serial_number, template_id, brand_id, customerStr, fieldStr, device_token, auth_token]
    );
    saveDb();
    return {
      id,
      serial_number,
      template_id,
      brand_id,
      customer_data: JSON.parse(customerStr),
      field_values: JSON.parse(fieldStr),
      device_token,
      auth_token,
      status: 'active'
    };
  } catch (error) {
    throw new Error(`Failed to create pass instance: ${error.message}`);
  }
}

/**
 * Get a pass instance by ID
 */
function getPassInstance(id) {
  if (!db) throw new Error('Database not initialized');

  try {
    const results = db.exec(
      `SELECT * FROM pass_instances WHERE id = ?`,
      [id]
    );

    if (!results || !results[0]) return null;

    const row = results[0].values[0];
    return {
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
      created_at: row[10]
    };
  } catch (error) {
    throw new Error(`Failed to get pass instance: ${error.message}`);
  }
}

/**
 * Get a pass instance by serial number
 */
function getPassBySerial(serial) {
  if (!db) throw new Error('Database not initialized');

  try {
    const results = db.exec(
      `SELECT * FROM pass_instances WHERE serial_number = ?`,
      [serial]
    );

    if (!results || !results[0]) return null;

    const row = results[0].values[0];
    return {
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
      created_at: row[10]
    };
  } catch (error) {
    throw new Error(`Failed to get pass by serial: ${error.message}`);
  }
}

/**
 * Update a pass instance
 */
function updatePassInstance(id, data) {
  if (!db) throw new Error('Database not initialized');

  const updates = [];
  const values = [];

  if (data.status) {
    updates.push('status = ?');
    values.push(data.status);
  }
  if (data.device_token !== undefined) {
    updates.push('device_token = ?');
    values.push(data.device_token);
  }
  if (data.customer_data) {
    const customerStr = typeof data.customer_data === 'string' ? data.customer_data : JSON.stringify(data.customer_data);
    updates.push('customer_data = ?');
    values.push(customerStr);
  }
  if (data.field_values) {
    const fieldStr = typeof data.field_values === 'string' ? data.field_values : JSON.stringify(data.field_values);
    updates.push('field_values = ?');
    values.push(fieldStr);
  }

  if (updates.length === 0) return getPassInstance(id);

  updates.push('last_updated = datetime("now")');
  values.push(id);

  try {
    db.run(
      `UPDATE pass_instances SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    saveDb();
    return getPassInstance(id);
  } catch (error) {
    throw new Error(`Failed to update pass instance: ${error.message}`);
  }
}

/**
 * Log an event
 */
function logEvent(data) {
  if (!db) throw new Error('Database not initialized');

  const { pass_id, brand_id, event_type, device_id = null, metadata = {} } = data;

  if (!brand_id || !event_type) {
    throw new Error('Brand ID and event type are required');
  }

  const metadataStr = typeof metadata === 'string' ? metadata : JSON.stringify(metadata);

  try {
    db.run(
      `INSERT INTO events (pass_id, brand_id, event_type, device_id, metadata) VALUES (?, ?, ?, ?, ?)`,
      [pass_id || null, brand_id, event_type, device_id, metadataStr]
    );
    saveDb();
    return { success: true };
  } catch (error) {
    throw new Error(`Failed to log event: ${error.message}`);
  }
}

/**
 * Get analytics for a brand
 */
function getAnalytics(brandId) {
  if (!db) throw new Error('Database not initialized');

  try {
    // Total passes
    const passResults = db.exec(
      `SELECT COUNT(*) as count FROM pass_instances WHERE brand_id = ?`,
      [brandId]
    );
    const totalPasses = passResults[0]?.values[0]?.[0] || 0;

    // Passes by status
    const statusResults = db.exec(
      `SELECT status, COUNT(*) as count FROM pass_instances WHERE brand_id = ? GROUP BY status`,
      [brandId]
    );
    const byStatus = {};
    if (statusResults[0]) {
      statusResults[0].values.forEach(row => {
        byStatus[row[0]] = row[1];
      });
    }

    // Event counts by type
    const eventResults = db.exec(
      `SELECT event_type, COUNT(*) as count FROM events WHERE brand_id = ? GROUP BY event_type`,
      [brandId]
    );
    const events = {};
    if (eventResults[0]) {
      eventResults[0].values.forEach(row => {
        events[row[0]] = row[1];
      });
    }

    return {
      totalPasses,
      byStatus,
      events
    };
  } catch (error) {
    throw new Error(`Failed to get analytics: ${error.message}`);
  }
}

/**
 * Register a device for push notifications
 */
function registerDevice(data) {
  if (!db) throw new Error('Database not initialized');

  const { device_library_id, push_token, serial_number } = data;

  if (!device_library_id || !push_token || !serial_number) {
    throw new Error('Device library ID, push token, and serial number are required');
  }

  try {
    db.run(
      `INSERT OR IGNORE INTO device_registrations (device_library_id, push_token, serial_number)
       VALUES (?, ?, ?)`,
      [device_library_id, push_token, serial_number]
    );
    saveDb();
    return { success: true };
  } catch (error) {
    throw new Error(`Failed to register device: ${error.message}`);
  }
}

/**
 * Get all devices registered for a pass
 */
function getDevicesForPass(serial) {
  if (!db) throw new Error('Database not initialized');

  try {
    const results = db.exec(
      `SELECT device_library_id, push_token FROM device_registrations WHERE serial_number = ?`,
      [serial]
    );

    if (!results || !results[0]) return [];

    return results[0].values.map(row => ({
      device_library_id: row[0],
      push_token: row[1]
    }));
  } catch (error) {
    throw new Error(`Failed to get devices for pass: ${error.message}`);
  }
}

/**
 * Get a brand by ID
 */
function getBrand(id) {
  if (!db) throw new Error('Database not initialized');

  try {
    const results = db.exec(
      `SELECT * FROM brands WHERE id = ?`,
      [id]
    );

    if (!results || !results[0]) return null;

    const row = results[0].values[0];
    return {
      id: row[0],
      name: row[1],
      slug: row[2],
      config: JSON.parse(row[3]),
      created_at: row[4],
      updated_at: row[5]
    };
  } catch (error) {
    throw new Error(`Failed to get brand: ${error.message}`);
  }
}

/**
 * Get a template by ID
 */
function getTemplate(id) {
  if (!db) throw new Error('Database not initialized');

  try {
    const results = db.exec(
      `SELECT * FROM pass_templates WHERE id = ?`,
      [id]
    );

    if (!results || !results[0]) return null;

    const row = results[0].values[0];
    return {
      id: row[0],
      brand_id: row[1],
      name: row[2],
      pass_type: row[3],
      style: JSON.parse(row[4]),
      fields: JSON.parse(row[5]),
      config: JSON.parse(row[6]),
      created_at: row[7],
      updated_at: row[8]
    };
  } catch (error) {
    throw new Error(`Failed to get template: ${error.message}`);
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
  getTemplate
};
