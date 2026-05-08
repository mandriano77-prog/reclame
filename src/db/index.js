const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

function dbUrlNeedsFlexibleSsl(url) {
  if (!url) return false;
  return (
    url.includes('railway.app') ||
    url.includes('ondigitalocean.com') ||
    /\bsslmode=require\b/i.test(url)
  );
}

// DATABASE_URL — managed Postgres on DigitalOcean, Railway-style hosts, etc.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: dbUrlNeedsFlexibleSsl(process.env.DATABASE_URL)
    ? { rejectUnauthorized: false }
    : false,
});

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Schema Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
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
  pass_type TEXT NOT NULL DEFAULT 'coupon',
  style JSONB NOT NULL DEFAULT '{}',
  fields JSONB NOT NULL DEFAULT '[]',
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id),
  name TEXT NOT NULL,
  description TEXT,
  template_id TEXT REFERENCES pass_templates(id),
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  active BOOLEAN DEFAULT true,
  total_downloads INTEGER DEFAULT 0,
  total_installs INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pass_instances (
  id TEXT PRIMARY KEY,
  serial_number TEXT UNIQUE NOT NULL,
  template_id TEXT NOT NULL REFERENCES pass_templates(id),
  brand_id TEXT NOT NULL REFERENCES brands(id),
  campaign_id TEXT REFERENCES campaigns(id),
  field_values JSONB DEFAULT '{}',
  utm JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active',
  device_token TEXT,
  auth_token TEXT NOT NULL,
  user_agent TEXT,
  referrer_url TEXT,
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

CREATE TABLE IF NOT EXISTS scheduled_push (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  campaign_id TEXT REFERENCES campaigns(id),
  schedule_type TEXT NOT NULL DEFAULT 'once',
  schedule_time TEXT NOT NULL DEFAULT '09:00',
  schedule_days TEXT DEFAULT '',
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  active BOOLEAN DEFAULT true,
  update_pass BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS push_log (
  id SERIAL PRIMARY KEY,
  brand_id TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  campaign_id TEXT,
  sent_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'manager',
  brand_id TEXT REFERENCES brands(id),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS strip_promos (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  strip_base64 TEXT NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  push_message TEXT,
  push_frequency TEXT DEFAULT 'none',
  last_push_sent TIMESTAMPTZ,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS creative_assets (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
  segment TEXT NOT NULL CHECK (segment IN ('social', 'display', 'ctv_dooh')),
  format_key TEXT NOT NULL,
  format_label TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  title TEXT,
  headline TEXT,
  cta_text TEXT,
  ai_prompt TEXT,
  ai_model TEXT,
  source TEXT NOT NULL DEFAULT 'upload' CHECK (source IN ('upload', 'ai', 'template')),
  image_base64 TEXT,
  image_url TEXT,
  qr_embedded BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ad_events (
  id SERIAL PRIMARY KEY,
  brand_id TEXT NOT NULL,
  campaign_id TEXT,
  creative_id TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('impression', 'click', 'install')),
  ip TEXT,
  user_agent TEXT,
  referer TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ad_events_campaign ON ad_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_events_brand ON ad_events(brand_id);
CREATE INDEX IF NOT EXISTS idx_ad_events_type ON ad_events(event_type);
CREATE INDEX IF NOT EXISTS idx_ad_events_created ON ad_events(created_at);

CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL DEFAULT 'generic',
  title VARCHAR(200),
  image_base64 TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_media_brand ON media(brand_id);

CREATE TABLE IF NOT EXISTS instant_win_campaigns (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  game_type TEXT NOT NULL CHECK (game_type IN ('scratch', 'wheel', 'slots')),
  prize_name TEXT NOT NULL,
  prize_description TEXT,
  win_probability NUMERIC NOT NULL DEFAULT 0.1,
  max_plays_per_user INTEGER DEFAULT 1,
  total_budget INTEGER,
  total_wins INTEGER DEFAULT 0,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'ended')),
  strip_base64 TEXT,
  push_message TEXT,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS instant_win_plays (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES instant_win_campaigns(id) ON DELETE CASCADE,
  serial_number TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('win', 'lose')),
  prize_name TEXT,
  played_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gamification_campaigns (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  game_type TEXT NOT NULL CHECK (game_type IN ('quiz', 'memory', 'puzzle')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'ended')),
  gold_threshold_secs NUMERIC NOT NULL DEFAULT 15,
  silver_threshold_secs NUMERIC NOT NULL DEFAULT 30,
  bronze_threshold_secs NUMERIC NOT NULL DEFAULT 60,
  gold_prize TEXT NOT NULL DEFAULT '',
  silver_prize TEXT NOT NULL DEFAULT '',
  bronze_prize TEXT NOT NULL DEFAULT '',
  max_plays_per_user INTEGER DEFAULT 1,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  strip_base64 TEXT,
  push_message TEXT,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gamification_plays (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES gamification_campaigns(id) ON DELETE CASCADE,
  serial_number TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  completion_time_secs NUMERIC NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('gold', 'silver', 'bronze', 'none')),
  prize_name TEXT,
  score INTEGER DEFAULT 0,
  player_email TEXT,
  player_phone TEXT,
  player_first_name TEXT,
  player_last_name TEXT,
  privacy_accepted BOOLEAN DEFAULT FALSE,
  privacy_accepted_at TIMESTAMPTZ,
  played_at TIMESTAMPTZ DEFAULT NOW()
);
`;

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Init Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
async function getDb() {
  try {
    await pool.query(SCHEMA);
    console.log('Ã¢ÂÂ Database schema initialized (PostgreSQL Ã¢ÂÂ Ads2Wallet)');

    // Migrations
    await pool.query(`ALTER TABLE pass_instances ADD COLUMN IF NOT EXISTS campaign_id TEXT`).catch(()=>{});
    await pool.query(`ALTER TABLE pass_instances ADD COLUMN IF NOT EXISTS field_values JSONB DEFAULT '{}'`).catch(()=>{});
    await pool.query(`ALTER TABLE pass_instances ADD COLUMN IF NOT EXISTS utm JSONB DEFAULT '{}'`).catch(()=>{});
    await pool.query(`ALTER TABLE pass_instances ADD COLUMN IF NOT EXISTS device_token TEXT`).catch(()=>{});
    await pool.query(`ALTER TABLE pass_instances ADD COLUMN IF NOT EXISTS user_agent TEXT`).catch(()=>{});
    await pool.query(`ALTER TABLE pass_instances ADD COLUMN IF NOT EXISTS referrer_url TEXT`).catch(()=>{});
    // Campaigns columns added after initial schema
    await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS description TEXT`).catch(()=>{});
    await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS template_id TEXT`).catch(()=>{});
    await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS utm_source TEXT`).catch(()=>{});
    await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS utm_medium TEXT`).catch(()=>{});
    await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS utm_campaign TEXT`).catch(()=>{});
    await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS utm_content TEXT`).catch(()=>{});
    await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS utm_term TEXT`).catch(()=>{});
    await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ`).catch(()=>{});
    await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ`).catch(()=>{});
    await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS total_downloads INTEGER DEFAULT 0`).catch(()=>{});
    await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS total_installs INTEGER DEFAULT 0`).catch(()=>{});
    await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true`).catch(()=>{});
    await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`).catch(()=>{});

    // pass_instances Ã¢ÂÂ columns added after initial schema
    await pool.query(`ALTER TABLE pass_instances ADD COLUMN IF NOT EXISTS auth_token TEXT DEFAULT gen_random_uuid()::text`).catch(()=>{});
    await pool.query(`ALTER TABLE pass_instances ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'`).catch(()=>{});
    await pool.query(`ALTER TABLE pass_instances ADD COLUMN IF NOT EXISTS last_updated TIMESTAMPTZ DEFAULT NOW()`).catch(()=>{});

    // pass_instances Ã¢ÂÂ push tracking per pass
    await pool.query(`ALTER TABLE pass_instances ADD COLUMN IF NOT EXISTS last_push_at TIMESTAMPTZ`).catch(()=>{});
    await pool.query(`ALTER TABLE pass_instances ADD COLUMN IF NOT EXISTS last_push_status TEXT`).catch(()=>{});
    await pool.query(`ALTER TABLE pass_instances ADD COLUMN IF NOT EXISTS push_count INTEGER DEFAULT 0`).catch(()=>{});

    // push_log Ã¢ÂÂ columns added after initial schema
    await pool.query(`ALTER TABLE push_log ADD COLUMN IF NOT EXISTS campaign_id TEXT`).catch(()=>{});
    await pool.query(`ALTER TABLE push_log ADD COLUMN IF NOT EXISTS sent_count INTEGER DEFAULT 0`).catch(()=>{});

    // scheduled_push Ã¢ÂÂ columns added after initial schema
    await pool.query(`ALTER TABLE scheduled_push ADD COLUMN IF NOT EXISTS campaign_id TEXT`).catch(()=>{});
    await pool.query(`ALTER TABLE scheduled_push ADD COLUMN IF NOT EXISTS schedule_type TEXT DEFAULT 'once'`).catch(()=>{});
    await pool.query(`ALTER TABLE scheduled_push ADD COLUMN IF NOT EXISTS schedule_time TEXT DEFAULT '09:00'`).catch(()=>{});
    await pool.query(`ALTER TABLE scheduled_push ADD COLUMN IF NOT EXISTS schedule_days TEXT DEFAULT ''`).catch(()=>{});
    await pool.query(`ALTER TABLE scheduled_push ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMPTZ`).catch(()=>{});
    await pool.query(`ALTER TABLE scheduled_push ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMPTZ`).catch(()=>{});
    await pool.query(`ALTER TABLE scheduled_push ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true`).catch(()=>{});
    await pool.query(`ALTER TABLE scheduled_push ADD COLUMN IF NOT EXISTS update_pass BOOLEAN DEFAULT true`).catch(()=>{});

    // events Ã¢ÂÂ columns added after initial schema
    await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS device_id TEXT`).catch(()=>{});
    await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'`).catch(()=>{});

    // instant_win_campaigns Ã¢ÂÂ columns added after initial schema
    // Old schema had "title" NOT NULL Ã¢ÂÂ drop constraint, keep column for compat
    await pool.query(`ALTER TABLE instant_win_campaigns ALTER COLUMN title DROP NOT NULL`).catch(()=>{});
    await pool.query(`ALTER TABLE instant_win_campaigns ALTER COLUMN title SET DEFAULT ''`).catch(()=>{});
    await pool.query(`ALTER TABLE instant_win_campaigns ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT ''`).catch(()=>{});
    await pool.query(`ALTER TABLE instant_win_campaigns ADD COLUMN IF NOT EXISTS brand_id TEXT`).catch(()=>{});
    await pool.query(`ALTER TABLE instant_win_campaigns ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`).catch(()=>{});
    await pool.query(`ALTER TABLE instant_win_campaigns ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'`).catch(()=>{});
    await pool.query(`ALTER TABLE instant_win_campaigns ADD COLUMN IF NOT EXISTS game_type TEXT NOT NULL DEFAULT 'scratch'`).catch(()=>{});
    await pool.query(`ALTER TABLE instant_win_campaigns ADD COLUMN IF NOT EXISTS prize_name TEXT NOT NULL DEFAULT ''`).catch(()=>{});
    await pool.query(`ALTER TABLE instant_win_campaigns ADD COLUMN IF NOT EXISTS prize_description TEXT`).catch(()=>{});
    await pool.query(`ALTER TABLE instant_win_campaigns ADD COLUMN IF NOT EXISTS win_probability NUMERIC NOT NULL DEFAULT 0.1`).catch(()=>{});
    await pool.query(`ALTER TABLE instant_win_campaigns ADD COLUMN IF NOT EXISTS max_plays_per_user INTEGER DEFAULT 1`).catch(()=>{});
    await pool.query(`ALTER TABLE instant_win_campaigns ADD COLUMN IF NOT EXISTS total_budget INTEGER`).catch(()=>{});
    await pool.query(`ALTER TABLE instant_win_campaigns ADD COLUMN IF NOT EXISTS total_wins INTEGER DEFAULT 0`).catch(()=>{});
    await pool.query(`ALTER TABLE instant_win_campaigns ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ`).catch(()=>{});
    await pool.query(`ALTER TABLE instant_win_campaigns ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ`).catch(()=>{});
    await pool.query(`ALTER TABLE instant_win_campaigns ADD COLUMN IF NOT EXISTS strip_base64 TEXT`).catch(()=>{});
    await pool.query(`ALTER TABLE instant_win_campaigns ADD COLUMN IF NOT EXISTS push_message TEXT`).catch(()=>{});
    await pool.query(`ALTER TABLE instant_win_campaigns ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'`).catch(()=>{});
    await pool.query(`ALTER TABLE instant_win_campaigns ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`).catch(()=>{});

    // instant_win_plays Ã¢ÂÂ columns added after initial schema
    await pool.query(`ALTER TABLE instant_win_plays ADD COLUMN IF NOT EXISTS campaign_id TEXT`).catch(()=>{});
    await pool.query(`ALTER TABLE instant_win_plays ADD COLUMN IF NOT EXISTS serial_number TEXT`).catch(()=>{});
    await pool.query(`ALTER TABLE instant_win_plays ADD COLUMN IF NOT EXISTS brand_id TEXT`).catch(()=>{});
    await pool.query(`ALTER TABLE instant_win_plays ADD COLUMN IF NOT EXISTS result TEXT`).catch(()=>{});
    await pool.query(`ALTER TABLE instant_win_plays ADD COLUMN IF NOT EXISTS prize_name TEXT`).catch(()=>{});
    await pool.query(`ALTER TABLE instant_win_plays ADD COLUMN IF NOT EXISTS played_at TIMESTAMPTZ DEFAULT NOW()`).catch(()=>{});
    // Player data collection (lead gen before game)
    await pool.query(`ALTER TABLE instant_win_plays ADD COLUMN IF NOT EXISTS player_email TEXT`).catch(()=>{});
    await pool.query(`ALTER TABLE instant_win_plays ADD COLUMN IF NOT EXISTS player_phone TEXT`).catch(()=>{});
    await pool.query(`ALTER TABLE instant_win_plays ADD COLUMN IF NOT EXISTS player_first_name TEXT`).catch(()=>{});
    await pool.query(`ALTER TABLE instant_win_plays ADD COLUMN IF NOT EXISTS player_last_name TEXT`).catch(()=>{});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_iw_plays_email ON instant_win_plays(player_email)`).catch(()=>{});
    await pool.query(`ALTER TABLE instant_win_plays ADD COLUMN IF NOT EXISTS privacy_accepted BOOLEAN DEFAULT FALSE`).catch(()=>{});
    await pool.query(`ALTER TABLE instant_win_plays ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ`).catch(()=>{});

    // Indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_passes_brand ON pass_instances(brand_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_passes_campaign ON pass_instances(campaign_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_events_brand ON events(brand_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_campaigns_brand ON campaigns(brand_id)`);
    // Instant Win indexes (after ALTER TABLEs ensure columns exist)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_iw_campaigns_brand ON instant_win_campaigns(brand_id)`).catch(()=>{});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_iw_campaigns_status ON instant_win_campaigns(status)`).catch(()=>{});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_iw_plays_campaign ON instant_win_plays(campaign_id)`).catch(()=>{});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_iw_plays_serial ON instant_win_plays(serial_number)`).catch(()=>{});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_iw_plays_brand ON instant_win_plays(brand_id)`).catch(()=>{});

    // Drop legacy member_id NOT NULL constraint (plays use serial_number, not member_id)
    await pool.query(`ALTER TABLE instant_win_plays ALTER COLUMN member_id DROP NOT NULL`).catch(()=>{});

    // Google Wallet columns
    await pool.query(`ALTER TABLE pass_instances ADD COLUMN IF NOT EXISTS google_wallet_object_id TEXT`);
    await pool.query(`ALTER TABLE pass_instances ADD COLUMN IF NOT EXISTS google_wallet_saved BOOLEAN DEFAULT FALSE`);
    await pool.query(`ALTER TABLE pass_instances ADD COLUMN IF NOT EXISTS google_installed_at TIMESTAMPTZ`);

    // Unified device tracking
    await pool.query(`ALTER TABLE pass_instances ADD COLUMN IF NOT EXISTS device_id TEXT`);
    await pool.query(`ALTER TABLE pass_instances ADD COLUMN IF NOT EXISTS device_source TEXT`);

    // Gamification indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_gam_campaigns_brand ON gamification_campaigns(brand_id)`).catch(()=>{});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_gam_campaigns_status ON gamification_campaigns(status)`).catch(()=>{});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_gam_plays_campaign ON gamification_plays(campaign_id)`).catch(()=>{});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_gam_plays_serial ON gamification_plays(serial_number)`).catch(()=>{});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_gam_plays_brand ON gamification_plays(brand_id)`).catch(()=>{});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_gam_plays_email ON gamification_plays(player_email)`).catch(()=>{});

    // Seed admin
    await seedAdminUser();

  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

function saveDb() {
  // No-op: PostgreSQL persists automatically
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Brands Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

async function createBrand(data) {
  const id = data.id || uuidv4();
  const { name, slug, config = {} } = data;
  if (!name || !slug) throw new Error('Brand name and slug are required');
  const configObj = typeof config === 'string' ? JSON.parse(config) : config;
  await pool.query(
    `INSERT INTO brands (id, name, slug, config) VALUES ($1, $2, $3, $4)`,
    [id, name, slug, JSON.stringify(configObj)]
  );
  return { id, name, slug, config: configObj };
}

async function getBrand(id) {
  const result = await pool.query('SELECT * FROM brands WHERE id = $1', [id]);
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return { ...row, config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config };
}

async function getBrandBySlug(slug) {
  const result = await pool.query('SELECT * FROM brands WHERE slug = $1', [slug]);
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return { ...row, config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config };
}

async function listBrands() {
  const result = await pool.query('SELECT * FROM brands ORDER BY created_at DESC');
  return result.rows.map(row => ({
    ...row,
    config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config
  }));
}

async function updateBrand(id, data) {
  const current = await getBrand(id);
  if (!current) return null;
  const newName = data.name || current.name;
  const newSlug = data.slug || current.slug;
  let newConfig = current.config || {};
  if (data.config) newConfig = { ...newConfig, ...data.config };
  await pool.query(
    'UPDATE brands SET name = $1, slug = $2, config = $3, updated_at = NOW() WHERE id = $4',
    [newName, newSlug, JSON.stringify(newConfig), id]
  );
  return getBrand(id);
}

async function deleteBrand(id) {
  await pool.query('DELETE FROM device_registrations WHERE serial_number IN (SELECT serial_number FROM pass_instances WHERE brand_id = $1)', [id]);
  await pool.query('DELETE FROM events WHERE brand_id = $1', [id]);
  await pool.query('DELETE FROM push_log WHERE brand_id = $1', [id]);
  await pool.query('DELETE FROM scheduled_push WHERE brand_id = $1', [id]);
  await pool.query('DELETE FROM pass_instances WHERE brand_id = $1', [id]);
  await pool.query('DELETE FROM campaigns WHERE brand_id = $1', [id]);
  await pool.query('DELETE FROM strip_promos WHERE brand_id = $1', [id]);
  await pool.query('DELETE FROM pass_templates WHERE brand_id = $1', [id]);
  await pool.query('DELETE FROM brands WHERE id = $1', [id]);
  return { success: true };
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Templates Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

async function createTemplate(data) {
  const id = data.id || uuidv4();
  const { brand_id, name, pass_type = 'coupon', style = {}, fields = [], config = {} } = data;
  if (!brand_id || !name) throw new Error('Brand ID and template name are required');
  const styleObj = typeof style === 'string' ? JSON.parse(style) : style;
  const fieldsObj = typeof fields === 'string' ? JSON.parse(fields) : fields;
  const configObj = typeof config === 'string' ? JSON.parse(config) : config;
  await pool.query(
    `INSERT INTO pass_templates (id, brand_id, name, pass_type, style, fields, config) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, brand_id, name, pass_type, JSON.stringify(styleObj), JSON.stringify(fieldsObj), JSON.stringify(configObj)]
  );
  return { id, brand_id, name, pass_type, style: styleObj, fields: fieldsObj, config: configObj };
}

async function getTemplate(id) {
  const result = await pool.query('SELECT * FROM pass_templates WHERE id = $1', [id]);
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    ...row,
    style: typeof row.style === 'string' ? JSON.parse(row.style) : row.style,
    fields: typeof row.fields === 'string' ? JSON.parse(row.fields) : row.fields,
    config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config
  };
}

async function listTemplates(brandId) {
  const result = await pool.query(
    'SELECT * FROM pass_templates WHERE brand_id = $1 ORDER BY created_at DESC', [brandId]
  );
  return result.rows.map(row => ({
    ...row,
    style: typeof row.style === 'string' ? JSON.parse(row.style) : row.style,
    fields: typeof row.fields === 'string' ? JSON.parse(row.fields) : row.fields,
    config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config
  }));
}

async function updateTemplate(id, data) {
  const sets = [];
  const vals = [];
  let idx = 1;
  if (data.name !== undefined) { sets.push(`name = $${idx++}`); vals.push(data.name); }
  if (data.pass_type !== undefined) { sets.push(`pass_type = $${idx++}`); vals.push(data.pass_type); }
  if (data.style !== undefined) { sets.push(`style = $${idx++}`); vals.push(JSON.stringify(data.style)); }
  if (data.fields !== undefined) { sets.push(`fields = $${idx++}`); vals.push(JSON.stringify(data.fields)); }
  if (data.config !== undefined) { sets.push(`config = $${idx++}`); vals.push(JSON.stringify(data.config)); }
  sets.push(`updated_at = NOW()`);
  vals.push(id);
  const result = await pool.query(
    `UPDATE pass_templates SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, vals
  );
  return result.rows[0] || null;
}

async function deleteTemplate(id) {
  await pool.query('DELETE FROM device_registrations WHERE serial_number IN (SELECT serial_number FROM pass_instances WHERE template_id = $1)', [id]);
  await pool.query('DELETE FROM events WHERE pass_id IN (SELECT id FROM pass_instances WHERE template_id = $1)', [id]);
  await pool.query('DELETE FROM pass_instances WHERE template_id = $1', [id]);
  await pool.query('DELETE FROM pass_templates WHERE id = $1', [id]);
  return { success: true };
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Campaigns Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

async function createCampaign(data) {
  const id = data.id || uuidv4();
  const { brand_id, name, description, template_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term, start_date, end_date } = data;
  if (!brand_id || !name) throw new Error('Brand ID and campaign name are required');
  await pool.query(
    `INSERT INTO campaigns (id, brand_id, name, description, template_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term, start_date, end_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [id, brand_id, name, description || null, template_id || null, utm_source || null, utm_medium || null, utm_campaign || null, utm_content || null, utm_term || null, start_date || null, end_date || null]
  );
  return { id, brand_id, name, description, template_id, active: true, total_downloads: 0, total_installs: 0 };
}

async function getCampaign(id) {
  const res = await pool.query('SELECT * FROM campaigns WHERE id = $1', [id]);
  return res.rows[0] || null;
}

async function listCampaigns(brand_id) {
  const res = await pool.query('SELECT * FROM campaigns WHERE brand_id = $1 ORDER BY created_at DESC', [brand_id]);
  return res.rows;
}

async function updateCampaign(id, data) {
  const fields = [];
  const values = [];
  let idx = 1;
  for (const key of ['name', 'description', 'template_id', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'start_date', 'end_date', 'active']) {
    if (data[key] !== undefined) { fields.push(`${key} = $${idx}`); values.push(data[key]); idx++; }
  }
  if (fields.length === 0) return getCampaign(id);
  fields.push('updated_at = NOW()');
  values.push(id);
  await pool.query(`UPDATE campaigns SET ${fields.join(', ')} WHERE id = $${idx}`, values);
  return getCampaign(id);
}

async function deleteCampaign(id) {
  // Nullify campaign_id on passes (don't delete passes)
  await pool.query('UPDATE pass_instances SET campaign_id = NULL WHERE campaign_id = $1', [id]);
  await pool.query('DELETE FROM campaigns WHERE id = $1', [id]);
  return { success: true };
}

async function incrementCampaignDownloads(id) {
  await pool.query('UPDATE campaigns SET total_downloads = total_downloads + 1 WHERE id = $1', [id]);
}

async function incrementCampaignInstalls(id) {
  await pool.query('UPDATE campaigns SET total_installs = total_installs + 1 WHERE id = $1', [id]);
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Pass Instances Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

async function createPassInstance(data) {
  const id = data.id || uuidv4();
  const serial_number = data.serial_number || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const { template_id, brand_id, campaign_id = null, field_values = {}, utm = {}, device_token = null, user_agent = null, referrer_url = null } = data;
  const auth_token = data.auth_token || uuidv4();
  if (!template_id || !brand_id) throw new Error('Template ID and Brand ID are required');
  const fieldObj = typeof field_values === 'string' ? JSON.parse(field_values) : field_values;
  const utmObj = typeof utm === 'string' ? JSON.parse(utm) : utm;
  await pool.query(
    `INSERT INTO pass_instances (id, serial_number, template_id, brand_id, campaign_id, field_values, utm, device_token, auth_token, user_agent, referrer_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [id, serial_number, template_id, brand_id, campaign_id, JSON.stringify(fieldObj), JSON.stringify(utmObj), device_token, auth_token, user_agent, referrer_url]
  );
  return { id, serial_number, template_id, brand_id, campaign_id, field_values: fieldObj, utm: utmObj, device_token, auth_token, user_agent, referrer_url, status: 'active' };
}

async function getPassInstance(id) {
  const result = await pool.query('SELECT * FROM pass_instances WHERE id = $1', [id]);
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

async function getPassBySerial(serial) {
  const result = await pool.query('SELECT * FROM pass_instances WHERE serial_number = $1', [serial]);
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

async function updatePassInstance(id, data) {
  const updates = [];
  const values = [];
  let p = 0;
  if (data.status) { p++; updates.push(`status = $${p}`); values.push(data.status); }
  if (data.device_token !== undefined) { p++; updates.push(`device_token = $${p}`); values.push(data.device_token); }
  if (data.field_values) { p++; updates.push(`field_values = $${p}`); values.push(JSON.stringify(data.field_values)); }
  if (data.google_wallet_object_id !== undefined) { p++; updates.push(`google_wallet_object_id = $${p}`); values.push(data.google_wallet_object_id); }
  if (data.google_wallet_saved !== undefined) { p++; updates.push(`google_wallet_saved = $${p}`); values.push(!!data.google_wallet_saved); }
  if (data.google_installed_at !== undefined) { p++; updates.push(`google_installed_at = $${p}`); values.push(data.google_installed_at); }
  if (data.device_id !== undefined) { p++; updates.push(`device_id = $${p}`); values.push(data.device_id); }
  if (data.device_source !== undefined) { p++; updates.push(`device_source = $${p}`); values.push(data.device_source); }
  if (updates.length === 0) return getPassInstance(id);
  updates.push('last_updated = NOW()');
  p++; values.push(id);
  await pool.query(`UPDATE pass_instances SET ${updates.join(', ')} WHERE id = $${p}`, values);
  return getPassInstance(id);
}

async function touchPass(id) {
  await pool.query('UPDATE pass_instances SET last_updated = NOW() WHERE id = $1', [id]);
  return { success: true };
}

async function listPasses(brandId, options = {}) {
  // install_date: Google callback sets google_installed_at; Apple Wallet sets device_registrations on POST register.
  // Dashboard column "Installato il" reads install_date (was undefined before — always showed "-").
  let query = `SELECT p.*,
    c.name as campaign_name,
    (SELECT dr.push_token FROM device_registrations dr WHERE dr.serial_number = p.serial_number ORDER BY dr.created_at DESC NULLS LAST LIMIT 1) AS push_token,
    COALESCE(
      p.google_installed_at,
      (SELECT MIN(dr2.created_at) FROM device_registrations dr2 WHERE dr2.serial_number = p.serial_number)
    ) AS install_date
    FROM pass_instances p
    LEFT JOIN campaigns c ON p.campaign_id = c.id
    WHERE p.brand_id = $1`;
  const params = [brandId];
  let idx = 2;
  if (options.status) { query += ` AND p.status = $${idx++}`; params.push(options.status); }
  if (options.campaign_id) { query += ` AND p.campaign_id = $${idx++}`; params.push(options.campaign_id); }
  query += ' ORDER BY p.created_at DESC';
  if (options.limit) { query += ` LIMIT $${idx++}`; params.push(options.limit); }
  if (options.offset) { query += ` OFFSET $${idx++}`; params.push(options.offset); }
  const result = await pool.query(query, params);
  return result.rows;
}

async function deletePass(id) {
  const pass = await getPassInstance(id);
  if (!pass) return null;
  await pool.query('DELETE FROM device_registrations WHERE serial_number = $1', [pass.serial_number]);
  await pool.query('DELETE FROM events WHERE pass_id = $1', [id]);
  await pool.query('DELETE FROM pass_instances WHERE id = $1', [id]);
  return { success: true };
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Events Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

async function logEvent(data) {
  const { pass_id, brand_id, event_type, device_id = null, metadata = {} } = data;
  if (!brand_id || !event_type) throw new Error('Brand ID and event type are required');
  await pool.query(
    `INSERT INTO events (pass_id, brand_id, event_type, device_id, metadata) VALUES ($1, $2, $3, $4, $5)`,
    [pass_id || null, brand_id, event_type, device_id, JSON.stringify(metadata)]
  );
  return { success: true };
}

async function listEvents(brandId, limit = 50) {
  const result = await pool.query(
    'SELECT * FROM events WHERE brand_id = $1 ORDER BY created_at DESC LIMIT $2',
    [brandId, limit]
  );
  return result.rows;
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Device Registrations (Apple Wallet Protocol) Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

async function registerDevice(data) {
  const { device_library_id, push_token, serial_number } = data;
  if (!device_library_id || !push_token || !serial_number) throw new Error('All device registration fields required');
  await pool.query(
    `INSERT INTO device_registrations (device_library_id, push_token, serial_number)
     VALUES ($1, $2, $3)
     ON CONFLICT (device_library_id, serial_number) DO UPDATE SET push_token = $2`,
    [device_library_id, push_token, serial_number]
  );
  return { success: true };
}

async function getDevicesForPass(serial) {
  const result = await pool.query(
    'SELECT device_library_id, push_token FROM device_registrations WHERE serial_number = $1', [serial]
  );
  return result.rows;
}

async function getDevicesForBrand(brandId) {
  const result = await pool.query(
    `SELECT DISTINCT dr.push_token, dr.device_library_id, dr.serial_number
     FROM device_registrations dr
     JOIN pass_instances pi ON dr.serial_number = pi.serial_number
     WHERE pi.brand_id = $1`,
    [brandId]
  );
  return result.rows;
}

async function unregisterDevice(deviceLibraryId, serialNumber) {
  await pool.query('DELETE FROM device_registrations WHERE device_library_id = $1 AND serial_number = $2', [deviceLibraryId, serialNumber]);
  return { success: true };
}

async function getSerialsForDevice(deviceLibraryId, passesUpdatedSince) {
  let query, params;
  if (passesUpdatedSince) {
    // Apple sends this tag Ã¢ÂÂ only return passes updated after that timestamp
    query = `SELECT dr.serial_number FROM device_registrations dr
             JOIN pass_instances pi ON dr.serial_number = pi.serial_number
             WHERE dr.device_library_id = $1 AND pi.last_updated > $2`;
    params = [deviceLibraryId, new Date(passesUpdatedSince)];
  } else {
    query = 'SELECT serial_number FROM device_registrations WHERE device_library_id = $1';
    params = [deviceLibraryId];
  }
  const result = await pool.query(query, params);
  return result.rows.map(r => r.serial_number);
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Analytics Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

async function getAnalytics(brandId) {
  const [passResult, statusResult, eventResult, deviceResult] = await Promise.all([
    pool.query('SELECT COUNT(*) as count FROM pass_instances WHERE brand_id = $1', [brandId]),
    pool.query('SELECT status, COUNT(*) as count FROM pass_instances WHERE brand_id = $1 GROUP BY status', [brandId]),
    pool.query('SELECT event_type, COUNT(*) as count FROM events WHERE brand_id = $1 GROUP BY event_type', [brandId]),
    pool.query('SELECT COUNT(DISTINCT dr.device_library_id) as count FROM device_registrations dr JOIN pass_instances p ON dr.serial_number = p.serial_number WHERE p.brand_id = $1', [brandId])
  ]);
  const byStatus = {};
  for (const row of statusResult.rows) byStatus[row.status] = parseInt(row.count);
  const events = {};
  for (const row of eventResult.rows) events[row.event_type] = parseInt(row.count);
  return { totalPasses: parseInt(passResult.rows[0].count), byStatus, events, deviceCount: parseInt(deviceResult.rows[0].count) };
}

async function getCampaignAnalytics(brandId) {
  const result = await pool.query(
    `SELECT c.*,
       (SELECT COUNT(*) FROM pass_instances p WHERE p.campaign_id = c.id) as pass_count,
       (SELECT COUNT(*) FROM device_registrations dr JOIN pass_instances p ON dr.serial_number = p.serial_number WHERE p.campaign_id = c.id) as install_count
     FROM campaigns c WHERE c.brand_id = $1 ORDER BY c.created_at DESC`,
    [brandId]
  );
  return result.rows;
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Push Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

async function logPush(data) {
  const { brand_id, title, message, campaign_id = null, sent_count = 0 } = data;
  if (!brand_id || !title || !message) throw new Error('Brand ID, title, and message are required');
  const result = await pool.query(
    `INSERT INTO push_log (brand_id, title, message, campaign_id, sent_count) VALUES ($1, $2, $3, $4, $5)
     RETURNING id, brand_id, title, message, campaign_id, sent_count, created_at`,
    [brand_id, title, message, campaign_id, sent_count]
  );
  return result.rows[0];
}

async function listPushes(brandId) {
  const result = await pool.query('SELECT * FROM push_log WHERE brand_id = $1 ORDER BY created_at DESC', [brandId]);
  return result.rows;
}

async function deletePush(id) {
  await pool.query('DELETE FROM push_log WHERE id = $1', [id]);
  return { success: true };
}

async function clearPushHistory(brandId) {
  const result = await pool.query('DELETE FROM push_log WHERE brand_id = $1', [brandId]);
  return { success: true, deleted: result.rowCount };
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Scheduled Push Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

async function createScheduledPush(data) {
  const id = data.id || uuidv4();
  const { brand_id, title, message, campaign_id = null, schedule_type = 'once', schedule_time = '09:00', schedule_days = '', update_pass = true, next_run_at } = data;
  if (!brand_id || !title || !message) throw new Error('brand_id, title, and message are required');
  await pool.query(
    `INSERT INTO scheduled_push (id, brand_id, title, message, campaign_id, schedule_type, schedule_time, schedule_days, update_pass, next_run_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [id, brand_id, title, message, campaign_id, schedule_type, schedule_time, schedule_days, update_pass, next_run_at]
  );
  return { id, brand_id, title, message, campaign_id, schedule_type, schedule_time, schedule_days, update_pass, next_run_at, active: true };
}

async function listScheduledPush(brand_id) {
  const result = await pool.query('SELECT * FROM scheduled_push WHERE brand_id = $1 ORDER BY created_at DESC', [brand_id]);
  return result.rows;
}

async function getScheduledPush(id) {
  const result = await pool.query('SELECT * FROM scheduled_push WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function updateScheduledPush(id, data) {
  const fields = [];
  const values = [id];
  let idx = 2;
  for (const key of ['title', 'message', 'campaign_id', 'schedule_type', 'schedule_time', 'schedule_days', 'active', 'update_pass', 'next_run_at', 'last_run_at']) {
    if (data[key] !== undefined) { fields.push(`${key} = $${idx}`); values.push(data[key]); idx++; }
  }
  if (fields.length === 0) return getScheduledPush(id);
  await pool.query(`UPDATE scheduled_push SET ${fields.join(', ')} WHERE id = $1`, values);
  return getScheduledPush(id);
}

async function deleteScheduledPush(id) {
  await pool.query('DELETE FROM scheduled_push WHERE id = $1', [id]);
  return { success: true };
}

async function getDueScheduledPush() {
  const result = await pool.query(
    `SELECT * FROM scheduled_push WHERE active = true AND next_run_at <= NOW()`
  );
  return result.rows;
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Strip Promos Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

async function createStripPromo({ brand_id, title, strip_base64, start_date, end_date, push_message, push_frequency }) {
  const id = uuidv4();
  await pool.query(
    `INSERT INTO strip_promos (id, brand_id, title, strip_base64, start_date, end_date, push_message, push_frequency)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id, brand_id, title, strip_base64, start_date, end_date, push_message || null, push_frequency || 'none']
  );
  return { id };
}

async function listStripPromos(brand_id) {
  const res = await pool.query(
    'SELECT id, brand_id, title, start_date, end_date, push_message, push_frequency, active, created_at FROM strip_promos WHERE brand_id = $1 ORDER BY start_date DESC',
    [brand_id]
  );
  return res.rows;
}

async function getStripPromo(id) {
  const res = await pool.query('SELECT * FROM strip_promos WHERE id = $1', [id]);
  return res.rows[0] || null;
}

async function updateStripPromo(id, fields) {
  const sets = [];
  const vals = [];
  let i = 1;
  for (const [k, v] of Object.entries(fields)) {
    if (['title', 'strip_base64', 'start_date', 'end_date', 'push_message', 'push_frequency', 'active', 'last_push_sent'].includes(k)) {
      sets.push(`${k} = $${i++}`);
      vals.push(v);
    }
  }
  if (sets.length === 0) return;
  vals.push(id);
  await pool.query(`UPDATE strip_promos SET ${sets.join(', ')} WHERE id = $${i}`, vals);
}

async function deleteStripPromo(id) {
  await pool.query('DELETE FROM strip_promos WHERE id = $1', [id]);
}

async function getActiveStripPromos() {
  const res = await pool.query(
    `SELECT sp.*, b.name as brand_name, b.config as brand_config
     FROM strip_promos sp JOIN brands b ON b.id = sp.brand_id
     WHERE sp.active = true AND sp.start_date <= NOW() AND sp.end_date >= NOW()`
  );
  return res.rows;
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Users Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
const bcrypt = require('bcryptjs');

async function createUser({ email, password, name, role, brand_id }) {
  const id = uuidv4();
  const password_hash = await bcrypt.hash(password, 10);
  const res = await pool.query(
    `INSERT INTO users (id, email, password_hash, name, role, brand_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, email, name, role, brand_id, active, created_at`,
    [id, email.toLowerCase().trim(), password_hash, name, role || 'manager', brand_id || null]
  );
  return res.rows[0];
}

async function getUserByEmail(email) {
  const res = await pool.query('SELECT * FROM users WHERE email = $1 AND active = true', [email.toLowerCase().trim()]);
  return res.rows[0] || null;
}

async function getUser(id) {
  const res = await pool.query('SELECT id, email, name, role, brand_id, active, created_at FROM users WHERE id = $1', [id]);
  return res.rows[0] || null;
}

async function listUsers(brand_id = null) {
  let query = `SELECT u.id, u.email, u.name, u.role, u.brand_id, b.name as brand_name, u.active, u.created_at FROM users u LEFT JOIN brands b ON u.brand_id = b.id`;
  const params = [];
  if (brand_id) {
    query += ` WHERE (u.brand_id = $1 OR u.brand_id IS NULL)`;
    params.push(brand_id);
  }
  query += ` ORDER BY u.created_at`;
  const res = await pool.query(query, params);
  return res.rows;
}

async function updateUser(id, data) {
  const fields = [];
  const values = [];
  let idx = 1;
  for (const key of ['email', 'name', 'role', 'brand_id', 'active']) {
    if (data[key] !== undefined) {
      fields.push(`${key} = $${idx}`);
      values.push(key === 'email' ? data[key].toLowerCase().trim() : data[key]);
      idx++;
    }
  }
  if (data.password) {
    fields.push(`password_hash = $${idx}`);
    values.push(await bcrypt.hash(data.password, 10));
    idx++;
  }
  if (fields.length === 0) return getUser(id);
  fields.push(`updated_at = NOW()`);
  values.push(id);
  await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}`, values);
  return getUser(id);
}

async function deleteUser(id) {
  await pool.query('DELETE FROM users WHERE id = $1', [id]);
  return { success: true };
}

async function verifyPassword(plaintext, hash) {
  return bcrypt.compare(plaintext, hash);
}

async function seedAdminUser() {
  try {
    const existing = await pool.query(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
    if (existing.rows.length === 0) {
      await createUser({
        email: 'admin@ads2wallet.com',
        password: 'Ads2Wallet2026!',
        name: 'Admin',
        role: 'admin',
        brand_id: null
      });
      console.log('Ã¢ÂÂ Seeded default admin user: admin@ads2wallet.com / Ads2Wallet2026!');
    }
  } catch(e) { console.log('Admin seed note:', e.message); }
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Media Hub Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

async function createMedia({ brand_id, type, title, image_base64, width, height }) {
  const id = uuidv4();
  await pool.query(
    `INSERT INTO media (id, brand_id, type, title, image_base64, width, height) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id, brand_id, type || 'generic', title || null, image_base64, width || null, height || null]
  );
  return { id, brand_id, type, title, created_at: new Date().toISOString() };
}

async function listMedia(brand_id, type) {
  let q = 'SELECT id, brand_id, type, title, width, height, created_at FROM media WHERE brand_id = $1';
  const params = [brand_id];
  if (type && type !== 'all') { q += ' AND type = $2'; params.push(type); }
  q += ' ORDER BY created_at DESC';
  const { rows } = await pool.query(q, params);
  return rows;
}

async function getMedia(id) {
  const { rows } = await pool.query('SELECT * FROM media WHERE id = $1', [id]);
  return rows[0] || null;
}

async function deleteMedia(id) {
  await pool.query('DELETE FROM media WHERE id = $1', [id]);
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Ad Events (Ad Serving Tracking) Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

async function logAdEvent({ brand_id, campaign_id, creative_id, event_type, ip, user_agent, referer, metadata }) {
  await pool.query(
    `INSERT INTO ad_events (brand_id, campaign_id, creative_id, event_type, ip, user_agent, referer, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [brand_id, campaign_id || null, creative_id || null, event_type, ip || null, user_agent || null, referer || null, JSON.stringify(metadata || {})]
  );
}

async function getAdStats(brand_id, campaign_id, days = 30) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  let where = 'brand_id = $1 AND created_at >= $2';
  const params = [brand_id, since];
  if (campaign_id) { where += ' AND campaign_id = $3'; params.push(campaign_id); }
  const { rows } = await pool.query(
    `SELECT event_type, COUNT(*)::int as count,
            COUNT(DISTINCT ip) as unique_count
     FROM ad_events WHERE ${where}
     GROUP BY event_type`, params
  );
  const stats = { impressions: 0, clicks: 0, installs: 0, unique_impressions: 0, unique_clicks: 0 };
  rows.forEach(r => {
    if (r.event_type === 'impression') { stats.impressions = r.count; stats.unique_impressions = r.unique_count; }
    if (r.event_type === 'click') { stats.clicks = r.count; stats.unique_clicks = r.unique_count; }
    if (r.event_type === 'install') { stats.installs = r.count; }
  });
  stats.ctr = stats.impressions > 0 ? (stats.clicks / stats.impressions * 100).toFixed(2) : '0.00';
  stats.install_rate = stats.clicks > 0 ? (stats.installs / stats.clicks * 100).toFixed(2) : '0.00';
  return stats;
}

async function getAdTimeline(brand_id, campaign_id, days = 30) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  let where = 'brand_id = $1 AND created_at >= $2';
  const params = [brand_id, since];
  if (campaign_id) { where += ' AND campaign_id = $3'; params.push(campaign_id); }
  const { rows } = await pool.query(
    `SELECT DATE(created_at) as date, event_type, COUNT(*)::int as count
     FROM ad_events WHERE ${where}
     GROUP BY DATE(created_at), event_type
     ORDER BY date`, params
  );
  return rows;
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Creative Assets Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

async function createCreativeAsset(data) {
  const id = uuidv4();
  await pool.query(
    `INSERT INTO creative_assets (id, brand_id, campaign_id, segment, format_key, format_label, width, height, title, headline, cta_text, ai_prompt, ai_model, source, image_base64, image_url, qr_embedded, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
    [id, data.brand_id, data.campaign_id || null, data.segment, data.format_key, data.format_label,
     data.width, data.height, data.title || null, data.headline || null, data.cta_text || null,
     data.ai_prompt || null, data.ai_model || null, data.source || 'upload',
     data.image_base64 || null, data.image_url || null, data.qr_embedded || false,
     JSON.stringify(data.metadata || {})]
  );
  return getCreativeAsset(id);
}

async function getCreativeAsset(id) {
  const r = await pool.query('SELECT * FROM creative_assets WHERE id = $1', [id]);
  return r.rows[0] || null;
}

async function listCreativeAssets(brandId, options = {}) {
  let query = 'SELECT * FROM creative_assets WHERE brand_id = $1';
  const params = [brandId];
  let idx = 2;
  if (options.segment) { query += ` AND segment = $${idx}`; params.push(options.segment); idx++; }
  if (options.campaign_id) { query += ` AND campaign_id = $${idx}`; params.push(options.campaign_id); idx++; }
  query += ' ORDER BY created_at DESC';
  if (options.limit) { query += ` LIMIT $${idx}`; params.push(options.limit); }
  const r = await pool.query(query, params);
  return r.rows;
}

async function deleteCreativeAsset(id) {
  await pool.query('DELETE FROM creative_assets WHERE id = $1', [id]);
  return { success: true };
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Instant Win Campaigns Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

async function createInstantWinCampaign(data) {
  const id = data.id || uuidv4();
  const { brand_id, name, game_type, prize_name, prize_description, win_probability = 0.1,
    max_plays_per_user = 1, total_budget, start_date, end_date, status = 'draft',
    strip_base64, push_message, config = {} } = data;
  await pool.query(
    `INSERT INTO instant_win_campaigns (id, brand_id, name, game_type, prize_name, prize_description,
      win_probability, max_plays_per_user, total_budget, start_date, end_date, status,
      strip_base64, push_message, config)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [id, brand_id, name, game_type, prize_name, prize_description,
      win_probability, max_plays_per_user, total_budget, start_date || null, end_date || null,
      status, strip_base64 || null, push_message || null, JSON.stringify(config)]
  );
  return getInstantWinCampaign(id);
}

async function getInstantWinCampaign(id) {
  const r = await pool.query('SELECT * FROM instant_win_campaigns WHERE id = $1', [id]);
  return r.rows[0] || null;
}

async function listInstantWinCampaigns(brandId) {
  const r = await pool.query(`
    SELECT c.*, COALESCE(p.play_count, 0)::int AS total_plays
    FROM instant_win_campaigns c
    LEFT JOIN (
      SELECT campaign_id, COUNT(*) AS play_count
      FROM instant_win_plays GROUP BY campaign_id
    ) p ON p.campaign_id = c.id
    WHERE c.brand_id = $1
    ORDER BY c.created_at DESC
  `, [brandId]);
  return r.rows;
}

async function updateInstantWinCampaign(id, data) {
  const current = await getInstantWinCampaign(id);
  if (!current) return null;
  const fields = ['name', 'game_type', 'prize_name', 'prize_description', 'win_probability',
    'max_plays_per_user', 'total_budget', 'start_date', 'end_date', 'status',
    'strip_base64', 'push_message', 'config'];
  const updated = { ...current };
  for (const f of fields) {
    if (data[f] !== undefined) updated[f] = data[f];
  }
  if (typeof updated.config === 'object') updated.config = JSON.stringify(updated.config);
  await pool.query(
    `UPDATE instant_win_campaigns SET name=$1, game_type=$2, prize_name=$3, prize_description=$4,
      win_probability=$5, max_plays_per_user=$6, total_budget=$7, start_date=$8, end_date=$9,
      status=$10, strip_base64=$11, push_message=$12, config=$13, updated_at=NOW()
     WHERE id=$14`,
    [updated.name, updated.game_type, updated.prize_name, updated.prize_description,
      updated.win_probability, updated.max_plays_per_user, updated.total_budget,
      updated.start_date, updated.end_date, updated.status, updated.strip_base64,
      updated.push_message, updated.config, id]
  );
  return getInstantWinCampaign(id);
}

async function deleteInstantWinCampaign(id) {
  await pool.query('DELETE FROM instant_win_plays WHERE campaign_id = $1', [id]);
  await pool.query('DELETE FROM instant_win_campaigns WHERE id = $1', [id]);
  return { success: true };
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Instant Win Plays Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

async function createInstantWinPlay(data) {
  const id = data.id || uuidv4();
  const { campaign_id, serial_number, brand_id, result, prize_name,
          player_email, player_phone, player_first_name, player_last_name, privacy_accepted } = data;
  await pool.query(
    `INSERT INTO instant_win_plays (id, campaign_id, serial_number, brand_id, result, prize_name,
     player_email, player_phone, player_first_name, player_last_name, privacy_accepted, privacy_accepted_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [id, campaign_id, serial_number, brand_id, result, prize_name || null,
     player_email || null, player_phone || null, player_first_name || null, player_last_name || null,
     privacy_accepted || false, privacy_accepted ? new Date().toISOString() : null]
  );
  // Increment total_wins if result is 'win'
  if (result === 'win') {
    await pool.query(
      'UPDATE instant_win_campaigns SET total_wins = total_wins + 1 WHERE id = $1', [campaign_id]);
  }
  return { id, campaign_id, serial_number, brand_id, result, prize_name,
           player_email, player_phone, player_first_name, player_last_name };
}

async function listInstantWinPlays(campaignId, options = {}) {
  let query = 'SELECT * FROM instant_win_plays WHERE campaign_id = $1';
  const params = [campaignId];
  if (options.serial_number) {
    query += ' AND serial_number = $2';
    params.push(options.serial_number);
  }
  query += ' ORDER BY played_at DESC';
  if (options.limit) { query += ` LIMIT $${params.length + 1}`; params.push(options.limit); }
  const r = await pool.query(query, params);
  return r.rows;
}

async function countPlaysForUser(campaignId, serialNumber) {
  const r = await pool.query(
    'SELECT COUNT(*) as count FROM instant_win_plays WHERE campaign_id = $1 AND serial_number = $2',
    [campaignId, serialNumber]
  );
  return parseInt(r.rows[0].count, 10);
}

async function getInstantWinStats(brandId) {
  const campaigns = await pool.query(
    'SELECT COUNT(*) as total FROM instant_win_campaigns WHERE brand_id = $1', [brandId]);
  const activeCampaigns = await pool.query(
    "SELECT COUNT(*) as total FROM instant_win_campaigns WHERE brand_id = $1 AND status = 'active'", [brandId]);
  const plays = await pool.query(
    'SELECT COUNT(*) as total FROM instant_win_plays WHERE brand_id = $1', [brandId]);
  const wins = await pool.query(
    "SELECT COUNT(*) as total FROM instant_win_plays WHERE brand_id = $1 AND result = 'win'", [brandId]);
  return {
    campaigns: parseInt(campaigns.rows[0].total, 10),
    active_campaigns: parseInt(activeCampaigns.rows[0].total, 10),
    total_plays: parseInt(plays.rows[0].total, 10),
    total_wins: parseInt(wins.rows[0].total, 10),
    win_rate: parseInt(plays.rows[0].total, 10) > 0
      ? (parseInt(wins.rows[0].total, 10) / parseInt(plays.rows[0].total, 10) * 100).toFixed(1)
      : '0.0'
  };
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Gamification Campaigns Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

async function createGamificationCampaign(data) {
  const id = data.id || uuidv4();
  const { brand_id, name, game_type, status = 'draft',
    gold_threshold_secs = 15, silver_threshold_secs = 30, bronze_threshold_secs = 60,
    gold_prize = '', silver_prize = '', bronze_prize = '',
    max_plays_per_user = 1, start_date, end_date,
    strip_base64, push_message, config = {} } = data;
  await pool.query(
    `INSERT INTO gamification_campaigns (id, brand_id, name, game_type, status,
      gold_threshold_secs, silver_threshold_secs, bronze_threshold_secs,
      gold_prize, silver_prize, bronze_prize,
      max_plays_per_user, start_date, end_date, strip_base64, push_message, config)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
    [id, brand_id, name, game_type, status,
      gold_threshold_secs, silver_threshold_secs, bronze_threshold_secs,
      gold_prize, silver_prize, bronze_prize,
      max_plays_per_user, start_date || null, end_date || null,
      strip_base64 || null, push_message || null, JSON.stringify(config)]
  );
  return getGamificationCampaign(id);
}

async function getGamificationCampaign(id) {
  const r = await pool.query('SELECT * FROM gamification_campaigns WHERE id = $1', [id]);
  return r.rows[0] || null;
}

async function listGamificationCampaigns(brandId) {
  const r = await pool.query(`
    SELECT c.*, COALESCE(p.play_count, 0)::int AS total_plays
    FROM gamification_campaigns c
    LEFT JOIN (
      SELECT campaign_id, COUNT(*) AS play_count
      FROM gamification_plays GROUP BY campaign_id
    ) p ON p.campaign_id = c.id
    WHERE c.brand_id = $1
    ORDER BY c.created_at DESC
  `, [brandId]);
  return r.rows;
}

async function updateGamificationCampaign(id, data) {
  const current = await getGamificationCampaign(id);
  if (!current) return null;
  const fields = ['name', 'game_type', 'status',
    'gold_threshold_secs', 'silver_threshold_secs', 'bronze_threshold_secs',
    'gold_prize', 'silver_prize', 'bronze_prize',
    'max_plays_per_user', 'start_date', 'end_date',
    'strip_base64', 'push_message', 'config'];
  const updated = { ...current };
  for (const f of fields) {
    if (data[f] !== undefined) updated[f] = data[f];
  }
  if (typeof updated.config === 'object') updated.config = JSON.stringify(updated.config);
  await pool.query(
    `UPDATE gamification_campaigns SET name=$1, game_type=$2, status=$3,
      gold_threshold_secs=$4, silver_threshold_secs=$5, bronze_threshold_secs=$6,
      gold_prize=$7, silver_prize=$8, bronze_prize=$9,
      max_plays_per_user=$10, start_date=$11, end_date=$12,
      strip_base64=$13, push_message=$14, config=$15, updated_at=NOW()
     WHERE id=$16`,
    [updated.name, updated.game_type, updated.status,
      updated.gold_threshold_secs, updated.silver_threshold_secs, updated.bronze_threshold_secs,
      updated.gold_prize, updated.silver_prize, updated.bronze_prize,
      updated.max_plays_per_user, updated.start_date, updated.end_date,
      updated.strip_base64, updated.push_message, updated.config, id]
  );
  return getGamificationCampaign(id);
}

async function deleteGamificationCampaign(id) {
  await pool.query('DELETE FROM gamification_plays WHERE campaign_id = $1', [id]);
  await pool.query('DELETE FROM gamification_campaigns WHERE id = $1', [id]);
  return { success: true };
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Gamification Plays Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

async function createGamificationPlay(data) {
  const id = data.id || uuidv4();
  const { campaign_id, serial_number, brand_id, completion_time_secs, tier, prize_name,
          score, player_email, player_phone, player_first_name, player_last_name, privacy_accepted } = data;
  await pool.query(
    `INSERT INTO gamification_plays (id, campaign_id, serial_number, brand_id, completion_time_secs,
     tier, prize_name, score, player_email, player_phone, player_first_name, player_last_name,
     privacy_accepted, privacy_accepted_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [id, campaign_id, serial_number, brand_id, completion_time_secs,
     tier, prize_name || null, score || 0,
     player_email || null, player_phone || null, player_first_name || null, player_last_name || null,
     privacy_accepted || false, privacy_accepted ? new Date().toISOString() : null]
  );
  return { id, campaign_id, serial_number, brand_id, completion_time_secs, tier, prize_name, score };
}

async function listGamificationPlays(campaignId, options = {}) {
  let query = 'SELECT * FROM gamification_plays WHERE campaign_id = $1';
  const params = [campaignId];
  if (options.serial_number) {
    query += ' AND serial_number = $2';
    params.push(options.serial_number);
  }
  query += ' ORDER BY played_at DESC';
  if (options.limit) { query += ` LIMIT $${params.length + 1}`; params.push(options.limit); }
  const r = await pool.query(query, params);
  return r.rows;
}

async function countGamificationPlaysForUser(campaignId, serialNumber) {
  const r = await pool.query(
    'SELECT COUNT(*) as count FROM gamification_plays WHERE campaign_id = $1 AND serial_number = $2',
    [campaignId, serialNumber]
  );
  return parseInt(r.rows[0].count, 10);
}

async function getGamificationStats(brandId) {
  const campaigns = await pool.query(
    'SELECT COUNT(*) as total FROM gamification_campaigns WHERE brand_id = $1', [brandId]);
  const activeCampaigns = await pool.query(
    "SELECT COUNT(*) as total FROM gamification_campaigns WHERE brand_id = $1 AND status = 'active'", [brandId]);
  const plays = await pool.query(
    'SELECT COUNT(*) as total FROM gamification_plays WHERE brand_id = $1', [brandId]);
  const goldWins = await pool.query(
    "SELECT COUNT(*) as total FROM gamification_plays WHERE brand_id = $1 AND tier = 'gold'", [brandId]);
  return {
    campaigns: parseInt(campaigns.rows[0].total, 10),
    active_campaigns: parseInt(activeCampaigns.rows[0].total, 10),
    total_plays: parseInt(plays.rows[0].total, 10),
    total_gold: parseInt(goldWins.rows[0].total, 10)
  };
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Exports Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

// ---- Google Wallet status tracking ----
async function updateGoogleWalletStatus(objectId, installed) {
  try {
    if (installed) {
      await pool.query(
        `UPDATE pass_instances SET google_wallet_saved = TRUE, google_installed_at = NOW(), device_source = 'google', last_updated = NOW() WHERE google_wallet_object_id = $1`,
        [objectId]
      );
    } else {
      await pool.query(
        `UPDATE pass_instances SET google_wallet_saved = FALSE, google_installed_at = NULL,
          device_id = CASE WHEN device_source = 'google' THEN NULL ELSE device_id END,
          device_source = CASE WHEN device_source = 'google' THEN NULL ELSE device_source END,
          last_updated = NOW() WHERE google_wallet_object_id = $1`,
        [objectId]
      );
    }
    const result = await pool.query(`SELECT * FROM pass_instances WHERE google_wallet_object_id = $1`, [objectId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('[DB] updateGoogleWalletStatus error:', error.message);
    return null;
  }
}

async function updatePassDeviceId(serialNumber, deviceId, source) {
  await pool.query(
    `UPDATE pass_instances SET device_id = $1, device_source = $2, last_updated = NOW() WHERE serial_number = $3`,
    [deviceId, source, serialNumber]
  );
}

module.exports = {
  getDb,
  saveDb,
  pool,
  // Brands
  createBrand,
  getBrand,
  getBrandBySlug,
  listBrands,
  updateBrand,
  deleteBrand,
  // Templates
  createTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
  deleteTemplate,
  // Campaigns
  createCampaign,
  getCampaign,
  listCampaigns,
  updateCampaign,
  deleteCampaign,
  incrementCampaignDownloads,
  incrementCampaignInstalls,
  // Pass Instances
  createPassInstance,
  getPassInstance,
  getPassBySerial,
  updatePassInstance,
  touchPass,
  listPasses,
  deletePass,
  // Events
  logEvent,
  listEvents,
  // Device Registrations
  registerDevice,
  getDevicesForPass,
  getDevicesForBrand,
  unregisterDevice,
  getSerialsForDevice,
  // Analytics
  getAnalytics,
  getCampaignAnalytics,
  // Push
  logPush,
  listPushes,
  deletePush,
  clearPushHistory,
  // Scheduled Push
  createScheduledPush,
  listScheduledPush,
  getScheduledPush,
  updateScheduledPush,
  deleteScheduledPush,
  getDueScheduledPush,
  // Strip Promos
  createStripPromo,
  listStripPromos,
  getStripPromo,
  updateStripPromo,
  deleteStripPromo,
  getActiveStripPromos,
  // Users
  createUser,
  getUserByEmail,
  getUser,
  listUsers,
  updateUser,
  deleteUser,
  verifyPassword,
  seedAdminUser,
  // Media Hub
  createMedia,
  listMedia,
  getMedia,
  deleteMedia,
  // Ad Events
  logAdEvent,
  getAdStats,
  getAdTimeline,
  // Creative Assets
  createCreativeAsset,
  getCreativeAsset,
  listCreativeAssets,
  deleteCreativeAsset,
  // Instant Win
  createInstantWinCampaign,
  getInstantWinCampaign,
  listInstantWinCampaigns,
  updateInstantWinCampaign,
  deleteInstantWinCampaign,
  createInstantWinPlay,
  listInstantWinPlays,
  countPlaysForUser,
  getInstantWinStats,
  // Gamification
  createGamificationCampaign,
  getGamificationCampaign,
  listGamificationCampaigns,
  updateGamificationCampaign,
  deleteGamificationCampaign,
  createGamificationPlay,
  listGamificationPlays,
  countGamificationPlaysForUser,
  getGamificationStats,
  updateGoogleWalletStatus,
  updatePassDeviceId
};
