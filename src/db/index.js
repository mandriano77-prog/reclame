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

ALTER TABLE tiers ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE tiers ADD COLUMN IF NOT EXISTS rewards_list JSONB DEFAULT '[]';

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

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id),
  first_name TEXT NOT NULL,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  playtomic_email TEXT,
  playtomic_player_id TEXT,
  playtomic_accepts_marketing BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS playtomic_sync_log (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id),
  booking_id TEXT NOT NULL,
  member_id TEXT REFERENCES members(id),
  participant_email TEXT,
  points_awarded INT DEFAULT 0,
  booking_date TIMESTAMPTZ,
  sport_id TEXT,
  resource_name TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brand_id, booking_id, member_id)
);

CREATE TABLE IF NOT EXISTS scheduled_push (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target TEXT DEFAULT 'all',
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
  target TEXT DEFAULT 'all',
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
`;

/**
 * Initialize database - create tables if they don't exist
 */
async function getDb() {
  try {
    await pool.query(SCHEMA);
    console.log('â Database schema initialized (PostgreSQL)');
    // --- One-shot migrations ---
    // Update "Prenota un campo" link to Playtomic URL
    await pool.query(`
      UPDATE brands
      SET config = jsonb_set(
        config,
        '{links}',
        (
          SELECT jsonb_agg(
            CASE
              WHEN elem->>'label' = 'Prenota un campo'
              THEN jsonb_set(elem, '{url}', '"https://playtomic.com/clubs/hangar-padel-club-origgio-va"')
              ELSE elem
            END
          )
          FROM jsonb_array_elements(config->'links') AS elem
        )
      )
      WHERE config->'links' IS NOT NULL
        AND config::text LIKE '%hangarpadel.it/prenota%'
    `);

    // Update Instagram link
    await pool.query(`
      UPDATE brands
      SET config = jsonb_set(
        config,
        '{links}',
        (
          SELECT jsonb_agg(
            CASE
              WHEN elem->>'label' = 'Seguici su Instagram'
              THEN jsonb_set(elem, '{url}', '"https://www.instagram.com/hirostar_hangar/"')
              ELSE elem
            END
          )
          FROM jsonb_array_elements(config->'links') AS elem
        )
      )
      WHERE config->'links' IS NOT NULL
        AND config::text LIKE '%instagram.com/hangarpadel%'
    `);

    // Switch template to eventTicket
    await pool.query(`
      UPDATE pass_templates SET pass_type = 'eventTicket'
      WHERE pass_type = 'storeCard'
    `);

    // Load default strip image into DB for all brands (overwrite old ugly strips)
    const stripPath = require('path').join(__dirname, '..', '..', 'public', 'assets', 'default-strip.png');
    if (require('fs').existsSync(stripPath)) {
      const stripB64 = require('fs').readFileSync(stripPath).toString('base64');
      await pool.query(`
        UPDATE brands
        SET config = jsonb_set(
          jsonb_set(COALESCE(config, '{}'), '{logos}', COALESCE(config->'logos', '{}'))
          , '{logos,strip}', $1::jsonb)
      `, [JSON.stringify(stripB64)]);
      console.log('✓ Default strip image loaded into DB for all brands');
    }

    // Load default icon images into DB for all brands (H mark)
    const iconPath = require('path').join(__dirname, '..', '..', 'public', 'assets', 'default-icon.png');
    const icon2xPath = require('path').join(__dirname, '..', '..', 'public', 'assets', 'default-icon@2x.png');
    if (require('fs').existsSync(iconPath)) {
      const iconB64 = require('fs').readFileSync(iconPath).toString('base64');
      const icon2xB64 = require('fs').existsSync(icon2xPath)
        ? require('fs').readFileSync(icon2xPath).toString('base64')
        : iconB64;
      await pool.query(`
        UPDATE brands
        SET config = jsonb_set(
          jsonb_set(COALESCE(config, '{}'), '{logos}', COALESCE(config->'logos', '{}'))
          , '{logos,icon}', $1::jsonb)
      `, [JSON.stringify(iconB64)]);
      await pool.query(`
        UPDATE brands
        SET config = jsonb_set(
          COALESCE(config, '{}')
          , '{logos,icon@2x}', $1::jsonb)
      `, [JSON.stringify(icon2xB64)]);
      console.log('✓ Default icon (H mark) loaded into DB for all brands');
    }

    // Add member_id column to pass_instances if not exists
    await pool.query(`
      ALTER TABLE pass_instances ADD COLUMN IF NOT EXISTS member_id TEXT REFERENCES members(id)
    `);

    // Migrate members: split name → first_name + last_name
    try {
      await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS first_name TEXT`);
      await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS last_name TEXT`);
      // Copy data from name to first_name/last_name if name column exists
      const colCheck = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'name'`);
      if (colCheck.rows.length > 0) {
        await pool.query(`UPDATE members SET first_name = split_part(name, ' ', 1), last_name = NULLIF(substr(name, position(' ' in name) + 1), name) WHERE first_name IS NULL AND name IS NOT NULL`);
        await pool.query(`ALTER TABLE members DROP COLUMN IF EXISTS name`);
        console.log('✓ Migrated members name → first_name + last_name');
      }
    } catch(e) { console.log('Members migration note:', e.message); }

    // Add playtomic columns to members if not exists
    try {
      await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS playtomic_email TEXT`);
      await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS playtomic_player_id TEXT`);
      await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS playtomic_accepts_marketing BOOLEAN DEFAULT false`);
      console.log('✓ playtomic columns ensured on members');
    } catch(e) { console.log('playtomic migration note:', e.message); }

    // Create playtomic_sync_log table if not exists
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS playtomic_sync_log (
          id TEXT PRIMARY KEY,
          brand_id TEXT NOT NULL REFERENCES brands(id),
          booking_id TEXT NOT NULL,
          member_id TEXT REFERENCES members(id),
          participant_email TEXT,
          points_awarded INT DEFAULT 0,
          booking_date TIMESTAMPTZ,
          sport_id TEXT,
          resource_name TEXT,
          synced_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(brand_id, booking_id, member_id)
        )
      `);
      console.log('✓ playtomic_sync_log table ensured');
    } catch(e) { console.log('playtomic_sync_log migration note:', e.message); }

    // Add trigger_type and trigger_config columns to challenges
    try {
      await pool.query(`ALTER TABLE challenges ADD COLUMN IF NOT EXISTS trigger_type TEXT DEFAULT 'manual'`);
      await pool.query(`ALTER TABLE challenges ADD COLUMN IF NOT EXISTS trigger_config JSONB DEFAULT '{}'`);
      console.log('✓ challenges trigger columns ensured');
    } catch(e) { console.log('challenges trigger migration note:', e.message); }

    // Create challenge_progress table for tracking per-member progress
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS challenge_progress (
          id TEXT PRIMARY KEY,
          challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
          member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
          brand_id TEXT NOT NULL REFERENCES brands(id),
          current_count INTEGER DEFAULT 0,
          target_count INTEGER DEFAULT 1,
          period_start TIMESTAMPTZ,
          period_end TIMESTAMPTZ,
          streak_weeks INTEGER DEFAULT 0,
          last_booking_week TEXT,
          status TEXT DEFAULT 'in_progress',
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(challenge_id, member_id, period_start)
        )
      `);
      console.log('✓ challenge_progress table ensured');
    } catch(e) { console.log('challenge_progress migration note:', e.message); }

    // --- Seed default tiers for brands that have none ---
    try {
      const brandsWithoutTiers = await pool.query(`
        SELECT b.id FROM brands b
        WHERE NOT EXISTS (SELECT 1 FROM tiers t WHERE t.brand_id = b.id)
      `);
      for (const row of brandsWithoutTiers.rows) {
        const defaultTiers = [
          { name: 'Pared',   min_points: 0,    color: '#888888', sort_order: 1 },
          { name: 'Bandeja', min_points: 100,  color: '#4CAF50', sort_order: 2 },
          { name: 'Víbora',  min_points: 300,  color: '#2196F3', sort_order: 3 },
          { name: 'Bajada',  min_points: 600,  color: '#9C27B0', sort_order: 4 },
          { name: 'Por Tres', min_points: 1000, color: '#FFD700', sort_order: 5 }
        ];
        for (const tier of defaultTiers) {
          await pool.query(
            `INSERT INTO tiers (id, brand_id, name, min_points, color, perks, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [uuidv4(), row.id, tier.name, tier.min_points, tier.color, '[]', tier.sort_order]
          );
        }
        console.log(`✓ Seeded 5 padel tiers for brand ${row.id}`);
      }
    } catch(e) { console.log('Tier seed note:', e.message); }

    // --- Populate tier content (description, perks, rewards) where empty ---
    try {
      const tierContent = {
        'Pared': {
          description: 'Il primo passo nel club. Benvenuto in campo!',
          perks: ['Accesso area soci', 'Newsletter settimanale eventi', 'Prenotazione campi online'],
          rewards_list: ['Drink di benvenuto al bar', 'Grip overgrip omaggio']
        },
        'Bandeja': {
          description: 'Stai prendendo ritmo. I vantaggi crescono con te.',
          perks: ['Tutti i vantaggi Pared', 'Sconto 10% noleggio racchette', 'Accesso tornei sociali mensili', 'Priorita prenotazione weekend'],
          rewards_list: ['1 ora campo gratuita al mese', 'Sconto 10% al bar', 'Tubo palline omaggio ogni 2 mesi']
        },
        'Víbora': {
          description: 'Giocatore esperto. Il club ti riconosce.',
          perks: ['Tutti i vantaggi Bandeja', 'Sconto 15% pro shop', 'Lezione di gruppo gratuita al mese', 'Invito eventi esclusivi', 'Parcheggio riservato'],
          rewards_list: ['2 ore campo gratuite al mese', 'Sconto 15% al bar', 'Incordatura racchetta gratuita trimestrale', 'Maglietta club esclusiva']
        },
        'Bajada': {
          description: 'Hai conquistato il campo. Trattamento premium.',
          perks: ['Tutti i vantaggi Vibora', 'Sconto 20% su tutto il pro shop', 'Accesso spogliatoio VIP', 'Lezione privata al mese (30 min)', 'Ospite gratuito 1 volta al mese'],
          rewards_list: ['4 ore campo gratuite al mese', 'Sconto 20% al bar', 'Kit completo palline ogni mese', 'Accesso anticipato tornei', 'Cena club semestrale con coach']
        },
        'Por Tres': {
          description: 'Il livello massimo. Sei la leggenda del club.',
          perks: ['Tutti i vantaggi Bajada', 'Campo riservato fascia prime time', 'Personal coach dedicato (1h/mese)', 'Accesso illimitato ospiti', 'Naming su torneo mensile', 'Posto riservato area lounge'],
          rewards_list: ['Campo illimitato', 'Bar open 1 consumazione/giorno', 'Racchetta brandizzata club in omaggio', 'Abbigliamento tecnico stagionale', 'Invito cena annuale con sponsor', 'Trofeo socio dell\'anno (votazione)']
        }
      };

      const allTiers = await pool.query(`SELECT id, name, description FROM tiers`);
      for (const t of allTiers.rows) {
        const content = tierContent[t.name];
        if (content && (!t.description || t.description === '')) {
          await pool.query(
            `UPDATE tiers SET description = $1, perks = $2, rewards_list = $3 WHERE id = $4`,
            [content.description, JSON.stringify(content.perks), JSON.stringify(content.rewards_list), t.id]
          );
          console.log(`✓ Populated content for tier: ${t.name}`);
        }
      }
    } catch(e) { console.log('Tier content population note:', e.message); }

    // --- Populate rewards catalog where empty ---
    try {
      const existingRewards = await pool.query(`SELECT COUNT(*) as count FROM rewards`);
      if (parseInt(existingRewards.rows[0].count) === 0) {
        // Get first brand
        const brandResult = await pool.query(`SELECT id FROM brands LIMIT 1`);
        if (brandResult.rows.length > 0) {
          const brandId = brandResult.rows[0].id;
          const rewards = [
            // Livello Pared (base) — 50-100 punti
            { title: 'Drink di benvenuto', description: 'Una consumazione gratuita al bar del club: acqua, succo o bibita a scelta.', cost: 50, icon: '🥤' },
            { title: 'Grip overgrip omaggio', description: 'Un overgrip di qualità per la tua racchetta, a scelta tra i modelli disponibili.', cost: 80, icon: '🎾' },
            { title: 'Tubo palline', description: 'Un tubo di 3 palline da padel omaggio per le tue partite.', cost: 100, icon: '🎯' },

            // Livello Bandeja — 150-300 punti
            { title: '1 ora campo gratuita', description: 'Prenota 1 ora di campo padel senza costi aggiuntivi. Valido in qualsiasi fascia oraria disponibile.', cost: 150, icon: '🏟️' },
            { title: 'Sconto 10% al bar', description: 'Buono sconto del 10% su tutte le consumazioni al bar, valido per una giornata intera.', cost: 120, icon: '☕' },
            { title: 'Sconto 10% noleggio racchette', description: 'Sconto del 10% sul noleggio racchette per un mese intero.', cost: 200, icon: '🏸' },
            { title: 'Accesso torneo sociale', description: 'Iscrizione gratuita al prossimo torneo sociale mensile del club.', cost: 250, icon: '🏆' },

            // Livello Víbora — 300-500 punti
            { title: '2 ore campo gratuite', description: 'Prenota 2 ore di campo padel senza costi. Utilizzabili anche in giorni diversi.', cost: 300, icon: '⏰' },
            { title: 'Sconto 15% al bar', description: 'Buono sconto del 15% su tutte le consumazioni al bar, valido per una settimana.', cost: 280, icon: '🍹' },
            { title: 'Lezione di gruppo', description: 'Una lezione di gruppo con il coach del club (max 4 partecipanti, 1 ora).', cost: 350, icon: '👨‍🏫' },
            { title: 'Incordatura racchetta', description: 'Servizio di incordatura professionale gratuito per la tua racchetta.', cost: 400, icon: '🔧' },
            { title: 'Maglietta club esclusiva', description: 'T-shirt tecnica con il logo del club, in edizione limitata per i soci.', cost: 500, icon: '👕' },

            // Livello Bajada — 500-800 punti
            { title: '4 ore campo gratuite', description: '4 ore di campo padel gratuite, utilizzabili nel mese corrente.', cost: 550, icon: '🌟' },
            { title: 'Sconto 20% pro shop', description: 'Buono sconto del 20% su tutti i prodotti del pro shop del club.', cost: 500, icon: '🛍️' },
            { title: 'Lezione privata 30 min', description: 'Una sessione privata di 30 minuti con il coach per migliorare la tua tecnica.', cost: 600, icon: '🎓' },
            { title: 'Kit palline mensile', description: 'Un kit completo di palline da padel premium ogni mese per un mese.', cost: 450, icon: '📦' },
            { title: 'Cena club con coach', description: 'Invito alla cena esclusiva del club con il coach e gli altri soci premium.', cost: 800, icon: '🍽️' },

            // Livello Por Tres — 800-2000 punti
            { title: 'Campo illimitato mensile', description: 'Accesso illimitato ai campi per un mese intero. Il sogno di ogni padelista.', cost: 1000, icon: '♾️' },
            { title: 'Bar open giornaliero', description: 'Una consumazione gratuita al giorno al bar per un mese intero.', cost: 800, icon: '🍺' },
            { title: 'Racchetta brandizzata club', description: 'Una racchetta da padel con il logo del club, in edizione esclusiva numerata.', cost: 1500, icon: '🏅' },
            { title: 'Abbigliamento tecnico stagionale', description: 'Kit completo di abbigliamento tecnico (maglia + pantaloncini) con branding club.', cost: 1200, icon: '🎽' },
            { title: 'Ospite illimitato mensile', description: 'Porta un ospite gratuito a ogni partita per un mese intero.', cost: 900, icon: '🤝' },
            { title: 'Trofeo Socio dell\'Anno', description: 'Candidatura al premio annuale "Socio dell\'Anno" con trofeo personalizzato e naming su torneo.', cost: 2000, icon: '🏆' },
          ];

          for (const r of rewards) {
            const id = uuidv4();
            await pool.query(
              `INSERT INTO rewards (id, brand_id, title, description, cost, icon, active) VALUES ($1, $2, $3, $4, $5, $6, true)`,
              [id, brandId, r.title, r.description, r.cost, r.icon]
            );
          }
          console.log(`✓ Populated ${rewards.length} rewards in catalog`);
        }
      }
    } catch(e) { console.log('Rewards population note:', e.message); }

    // --- Seed default admin user ---
    await seedAdminUser();

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
  const { template_id, brand_id, customer_data = {}, field_values = {}, device_token = null, member_id = null } = data;
  const auth_token = data.auth_token || uuidv4();

  if (!template_id || !brand_id) {
    throw new Error('Template ID and Brand ID are required');
  }

  const customerObj = typeof customer_data === 'string' ? JSON.parse(customer_data) : customer_data;
  const fieldObj = typeof field_values === 'string' ? JSON.parse(field_values) : field_values;

  try {
    await pool.query(
      `INSERT INTO pass_instances (id, serial_number, template_id, brand_id, customer_data, field_values, device_token, auth_token, member_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, serial_number, template_id, brand_id, JSON.stringify(customerObj), JSON.stringify(fieldObj), device_token, auth_token, member_id]
    );
    return {
      id, serial_number, template_id, brand_id,
      customer_data: customerObj,
      field_values: fieldObj,
      device_token, auth_token, member_id,
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
 * Touch a pass — update last_updated timestamp to signal a change to Apple Wallet
 */
async function touchPass(id) {
  try {
    await pool.query('UPDATE pass_instances SET last_updated = NOW() WHERE id = $1', [id]);
    return { success: true };
  } catch (error) {
    throw new Error(`Failed to touch pass: ${error.message}`);
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
 * Get all push tokens for devices registered to passes of a given brand
 */
async function getDevicesForBrand(brandId) {
  try {
    const result = await pool.query(
      `SELECT DISTINCT dr.push_token, dr.device_library_id, dr.serial_number
       FROM device_registrations dr
       JOIN pass_instances pi ON dr.serial_number = pi.serial_number
       WHERE pi.brand_id = $1`,
      [brandId]
    );
    return result.rows;
  } catch (error) {
    throw new Error(`Failed to get devices for brand: ${error.message}`);
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

async function getBrandBySlug(slug) {
  try {
    const result = await pool.query(`SELECT * FROM brands WHERE slug = $1`, [slug]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return { id: row.id, name: row.name, slug: row.slug, config: row.config, created_at: row.created_at, updated_at: row.updated_at };
  } catch (error) {
    throw new Error(`Failed to get brand by slug: ${error.message}`);
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
  const { brand_id, title, description = '', points = 0, icon = '⭐', type = 'action', recurring = false, active = true, trigger_type = 'manual', trigger_config = {} } = data;

  if (!brand_id || !title) {
    throw new Error('Brand ID and title are required');
  }

  try {
    await pool.query(
      `INSERT INTO challenges (id, brand_id, title, description, points, icon, type, recurring, active, trigger_type, trigger_config)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [id, brand_id, title, description, points, icon, type, recurring, active, trigger_type, JSON.stringify(trigger_config)]
    );
    return { id, brand_id, title, description, points, icon, type, recurring, active, trigger_type, trigger_config };
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
    if (data.trigger_type !== undefined) {
      paramCount++;
      updates.push(`trigger_type = $${paramCount}`);
      values.push(data.trigger_type);
    }
    if (data.trigger_config !== undefined) {
      paramCount++;
      updates.push(`trigger_config = $${paramCount}`);
      values.push(JSON.stringify(data.trigger_config));
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
  const { brand_id, name, min_points = 0, color = '#888888', perks = [], sort_order = 0, description = '', rewards_list = [] } = data;

  if (!brand_id || !name) {
    throw new Error('Brand ID and name are required');
  }

  try {
    const perksJson = typeof perks === 'string' ? perks : JSON.stringify(perks);
    const rewardsJson = typeof rewards_list === 'string' ? rewards_list : JSON.stringify(rewards_list);
    await pool.query(
      `INSERT INTO tiers (id, brand_id, name, min_points, color, perks, sort_order, description, rewards_list)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, brand_id, name, min_points, color, perksJson, sort_order, description, rewardsJson]
    );
    return { id, brand_id, name, min_points, color, perks, sort_order, description, rewards_list };
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
    if (data.description !== undefined) {
      paramCount++;
      updates.push(`description = $${paramCount}`);
      values.push(data.description);
    }
    if (data.rewards_list !== undefined) {
      paramCount++;
      const rewardsJson = typeof data.rewards_list === 'string' ? data.rewards_list : JSON.stringify(data.rewards_list);
      updates.push(`rewards_list = $${paramCount}`);
      values.push(rewardsJson);
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
// CHALLENGE PROGRESS
// ============================================================================

/**
 * Upsert challenge progress for a member
 */
async function upsertChallengeProgress(data) {
  const id = uuidv4();
  const { challenge_id, member_id, brand_id, current_count = 0, target_count = 1, period_start = null, period_end = null, streak_weeks = 0, last_booking_week = null, status = 'in_progress' } = data;

  try {
    const result = await pool.query(`
      INSERT INTO challenge_progress (id, challenge_id, member_id, brand_id, current_count, target_count, period_start, period_end, streak_weeks, last_booking_week, status, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      ON CONFLICT (challenge_id, member_id, period_start)
      DO UPDATE SET current_count = $5, target_count = $6, period_end = $8, streak_weeks = $9, last_booking_week = $10, status = $11, updated_at = NOW()
      RETURNING *
    `, [id, challenge_id, member_id, brand_id, current_count, target_count, period_start, period_end, streak_weeks, last_booking_week, status]);
    return result.rows[0];
  } catch (error) {
    throw new Error(`Failed to upsert challenge progress: ${error.message}`);
  }
}

/**
 * Get challenge progress for a member
 */
async function getChallengeProgress(member_id, brand_id) {
  try {
    const result = await pool.query(`
      SELECT cp.*, c.title, c.description, c.points, c.icon, c.trigger_type, c.trigger_config, c.recurring
      FROM challenge_progress cp
      JOIN challenges c ON c.id = cp.challenge_id
      WHERE cp.member_id = $1 AND cp.brand_id = $2
      ORDER BY cp.updated_at DESC
    `, [member_id, brand_id]);
    return result.rows;
  } catch (error) {
    throw new Error(`Failed to get challenge progress: ${error.message}`);
  }
}

/**
 * Get all active progress for a specific challenge (across all members)
 */
async function getProgressForChallenge(challenge_id) {
  try {
    const result = await pool.query(`
      SELECT cp.*, m.first_name, m.last_name, m.email
      FROM challenge_progress cp
      JOIN members m ON m.id = cp.member_id
      WHERE cp.challenge_id = $1
      ORDER BY cp.current_count DESC
    `, [challenge_id]);
    return result.rows;
  } catch (error) {
    throw new Error(`Failed to get progress for challenge: ${error.message}`);
  }
}

/**
 * Complete a challenge for a member (via auto-evaluation)
 * Works with member_id instead of pass_id
 */
async function completeChallengeForMember(data) {
  const id = uuidv4();
  const { challenge_id, member_id, brand_id } = data;

  try {
    const challenge = await getChallenge(challenge_id);
    if (!challenge) throw new Error('Challenge not found');

    // Find member's active pass
    const passes = await listPasses(brand_id);
    const memberPass = passes.find(p => p.member_id === member_id && p.status === 'active');
    if (!memberPass) return null; // No active pass, skip

    // Check if already completed for this period (non-recurring)
    if (!challenge.recurring) {
      const existing = await pool.query(
        'SELECT id FROM challenge_completions WHERE challenge_id = $1 AND pass_id = $2',
        [challenge_id, memberPass.id]
      );
      if (existing.rows.length > 0) return null; // Already completed
    }

    // Create completion record
    await pool.query(
      'INSERT INTO challenge_completions (id, challenge_id, pass_id, brand_id) VALUES ($1, $2, $3, $4)',
      [id, challenge_id, memberPass.id, brand_id]
    );

    // Award points to pass
    const currentPoints = parseInt(memberPass.field_values?.punti) || 0;
    const newPoints = currentPoints + challenge.points;
    const updatedFieldValues = { ...memberPass.field_values, punti: String(newPoints) };
    await updatePassInstance(memberPass.id, { field_values: updatedFieldValues });

    console.log(`[Challenges] ✓ ${challenge.title} completed for member ${member_id} (+${challenge.points} pts)`);
    return { id, challenge_id, member_id, pass_id: memberPass.id, points: challenge.points };
  } catch (error) {
    throw new Error(`Failed to complete challenge for member: ${error.message}`);
  }
}

/**
 * Count bookings for a member in a date range with optional filters
 */
async function countMemberBookings(brand_id, member_id, startDate, endDate, filters = {}) {
  try {
    let query = `
      SELECT COUNT(*) as count,
             json_agg(json_build_object(
               'booking_date', booking_date,
               'sport_id', sport_id,
               'resource_name', resource_name
             )) as bookings
      FROM playtomic_sync_log
      WHERE brand_id = $1 AND member_id = $2 AND synced_at >= $3 AND synced_at <= $4
    `;
    const params = [brand_id, member_id, startDate, endDate];

    const result = await pool.query(query, params);
    const row = result.rows[0];
    return { count: parseInt(row.count) || 0, bookings: row.bookings || [] };
  } catch (error) {
    throw new Error(`Failed to count member bookings: ${error.message}`);
  }
}

/**
 * Count distinct booking weeks for streak calculation
 */
async function getMemberBookingWeeks(brand_id, member_id, weeksBack = 8) {
  try {
    const result = await pool.query(`
      SELECT DISTINCT to_char(booking_date, 'IYYY-IW') as week_key
      FROM playtomic_sync_log
      WHERE brand_id = $1 AND member_id = $2 AND booking_date >= NOW() - interval '${weeksBack} weeks'
      ORDER BY week_key DESC
    `, [brand_id, member_id]);
    return result.rows.map(r => r.week_key);
  } catch (error) {
    throw new Error(`Failed to get member booking weeks: ${error.message}`);
  }
}

/**
 * Count total bookings for a member (lifetime)
 */
async function countMemberTotalBookings(brand_id, member_id) {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM playtomic_sync_log WHERE brand_id = $1 AND member_id = $2',
      [brand_id, member_id]
    );
    return parseInt(result.rows[0].count) || 0;
  } catch (error) {
    throw new Error(`Failed to count total bookings: ${error.message}`);
  }
}

/**
 * Count unique partners for a member in a period
 */
async function countMemberUniquePartners(brand_id, member_id, startDate, endDate) {
  try {
    // Find all booking_ids where this member participated
    const memberBookings = await pool.query(`
      SELECT DISTINCT booking_id FROM playtomic_sync_log
      WHERE brand_id = $1 AND member_id = $2 AND booking_date >= $3 AND booking_date <= $4
    `, [brand_id, member_id, startDate, endDate]);

    if (memberBookings.rows.length === 0) return 0;

    const bookingIds = memberBookings.rows.map(r => r.booking_id);

    // Count distinct other members in those same bookings
    const result = await pool.query(`
      SELECT COUNT(DISTINCT member_id) as count
      FROM playtomic_sync_log
      WHERE brand_id = $1 AND booking_id = ANY($2) AND member_id != $3
    `, [brand_id, bookingIds, member_id]);

    return parseInt(result.rows[0].count) || 0;
  } catch (error) {
    throw new Error(`Failed to count unique partners: ${error.message}`);
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
 * Delete a single push log entry
 */
async function deletePush(id) {
  try {
    await pool.query('DELETE FROM push_log WHERE id = $1', [id]);
    return { success: true };
  } catch (error) {
    throw new Error(`Failed to delete push: ${error.message}`);
  }
}

/**
 * Delete all push log entries for a brand
 */
async function clearPushHistory(brandId) {
  try {
    const result = await pool.query('DELETE FROM push_log WHERE brand_id = $1', [brandId]);
    return { success: true, deleted: result.rowCount };
  } catch (error) {
    throw new Error(`Failed to clear push history: ${error.message}`);
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
async function updateTemplate(id, data) {
  try {
    const setClauses = [];
    const values = [];
    let idx = 1;
    if (data.name !== undefined) { setClauses.push(`name = $${idx++}`); values.push(data.name); }
    if (data.pass_type !== undefined) { setClauses.push(`pass_type = $${idx++}`); values.push(data.pass_type); }
    if (data.style !== undefined) { setClauses.push(`style = $${idx++}`); values.push(JSON.stringify(data.style)); }
    if (data.fields !== undefined) { setClauses.push(`fields = $${idx++}`); values.push(JSON.stringify(data.fields)); }
    if (data.config !== undefined) { setClauses.push(`config = $${idx++}`); values.push(JSON.stringify(data.config)); }
    setClauses.push(`updated_at = NOW()`);
    values.push(id);
    const result = await pool.query(
      `UPDATE pass_templates SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return null;
    return result.rows[0];
  } catch (error) {
    throw new Error(`Failed to update template: ${error.message}`);
  }
}

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

// ==================== SCHEDULED PUSH ====================

async function createScheduledPush(data) {
  const id = data.id || uuidv4();
  const { brand_id, title, message, target = 'all', schedule_type = 'once', schedule_time = '09:00', schedule_days = '', update_pass = true, next_run_at } = data;
  if (!brand_id || !title || !message) throw new Error('brand_id, title, and message are required');
  await pool.query(
    `INSERT INTO scheduled_push (id, brand_id, title, message, target, schedule_type, schedule_time, schedule_days, update_pass, next_run_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [id, brand_id, title, message, target, schedule_type, schedule_time, schedule_days, update_pass, next_run_at]
  );
  return { id, brand_id, title, message, target, schedule_type, schedule_time, schedule_days, update_pass, next_run_at, active: true };
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
  for (const key of ['title', 'message', 'target', 'schedule_type', 'schedule_time', 'schedule_days', 'active', 'update_pass', 'next_run_at', 'last_run_at']) {
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
    `SELECT * FROM scheduled_push WHERE active = true AND next_run_at <= NOW() ORDER BY next_run_at ASC`
  );
  return result.rows;
}

// ==================== MEMBERS ====================

async function createMember(data) {
  const id = data.id || uuidv4();
  const { brand_id, first_name, last_name = null, email = null, phone = null, notes = null, playtomic_email = null } = data;
  if (!brand_id || !first_name) throw new Error('Brand ID and first_name are required');
  await pool.query(
    `INSERT INTO members (id, brand_id, first_name, last_name, email, phone, notes, playtomic_email) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, brand_id, first_name, last_name, email, phone, notes, playtomic_email]
  );
  return { id, brand_id, first_name, last_name, email, phone, notes, playtomic_email, created_at: new Date() };
}

async function getMember(id) {
  const result = await pool.query(`SELECT * FROM members WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

async function listMembers(brand_id) {
  const result = await pool.query(
    `SELECT m.*, CONCAT(m.first_name, COALESCE(' ' || m.last_name, '')) as full_name,
      (SELECT COUNT(*) FROM pass_instances p WHERE p.member_id = m.id) as pass_count,
      (SELECT COALESCE((p.field_values->>'punti')::int, 0) FROM pass_instances p WHERE p.member_id = m.id AND p.status = 'active' ORDER BY p.created_at DESC LIMIT 1) as punti
    FROM members m WHERE m.brand_id = $1 ORDER BY m.last_name ASC NULLS LAST, m.first_name ASC`,
    [brand_id]
  );
  return result.rows;
}

async function updateMember(id, data) {
  const { first_name, last_name, email, phone, notes, playtomic_email } = data;
  await pool.query(
    `UPDATE members SET first_name = COALESCE($2, first_name), last_name = COALESCE($3, last_name), email = COALESCE($4, email), phone = COALESCE($5, phone), notes = COALESCE($6, notes), playtomic_email = COALESCE($7, playtomic_email), updated_at = NOW() WHERE id = $1`,
    [id, first_name, last_name, email, phone, notes, playtomic_email]
  );
  return getMember(id);
}

async function bulkCreateMembers(brand_id, members) {
  const results = { created: 0, skipped: 0, errors: [] };
  for (const m of members) {
    try {
      if (!m.first_name) { results.skipped++; continue; }
      await createMember({ brand_id, first_name: m.first_name, last_name: m.last_name || null, email: m.email || null, phone: m.phone || null, notes: m.notes || null, playtomic_email: m.playtomic_email || null });
      results.created++;
    } catch (e) {
      results.errors.push(`${m.first_name} ${m.last_name || ''}: ${e.message}`);
    }
  }
  return results;
}

async function deleteMember(id) {
  // Unlink passes from member (don't delete them)
  await pool.query(`UPDATE pass_instances SET member_id = NULL WHERE member_id = $1`, [id]);
  await pool.query(`DELETE FROM members WHERE id = $1`, [id]);
  return { success: true };
}

// ─── Playtomic Sync Log ─────────────────────────────────

async function addSyncLogEntry({ brand_id, booking_id, member_id, participant_email, points_awarded, booking_date, sport_id, resource_name }) {
  const id = uuidv4();
  try {
    await pool.query(
      `INSERT INTO playtomic_sync_log (id, brand_id, booking_id, member_id, participant_email, points_awarded, booking_date, sport_id, resource_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (brand_id, booking_id, member_id) DO NOTHING`,
      [id, brand_id, booking_id, member_id, participant_email, points_awarded || 0, booking_date, sport_id, resource_name]
    );
    return { id, inserted: true };
  } catch(e) {
    return { id: null, inserted: false, error: e.message };
  }
}

async function isBookingSynced(brand_id, booking_id, member_id) {
  const res = await pool.query(
    `SELECT id FROM playtomic_sync_log WHERE brand_id = $1 AND booking_id = $2 AND member_id = $3`,
    [brand_id, booking_id, member_id]
  );
  return res.rows.length > 0;
}

async function listSyncLogs(brand_id, limit = 50) {
  const res = await pool.query(
    `SELECT s.*, m.first_name, m.last_name FROM playtomic_sync_log s
     LEFT JOIN members m ON s.member_id = m.id
     WHERE s.brand_id = $1 ORDER BY s.synced_at DESC LIMIT $2`,
    [brand_id, limit]
  );
  return res.rows;
}

async function getMembersByPlaytomicEmail(brand_id) {
  const res = await pool.query(
    `SELECT * FROM members WHERE brand_id = $1 AND (playtomic_email IS NOT NULL OR playtomic_player_id IS NOT NULL)`,
    [brand_id]
  );
  return res.rows;
}

async function updateMemberPlaytomic(member_id, { playtomic_player_id, playtomic_accepts_marketing }) {
  await pool.query(
    `UPDATE members SET playtomic_player_id = COALESCE($2, playtomic_player_id), playtomic_accepts_marketing = COALESCE($3, playtomic_accepts_marketing), updated_at = NOW() WHERE id = $1`,
    [member_id, playtomic_player_id, playtomic_accepts_marketing]
  );
}

// ─── Users ──────────────────────────────────────────────
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
  const res = await pool.query(`SELECT * FROM users WHERE email = $1 AND active = true`, [email.toLowerCase().trim()]);
  return res.rows[0] || null;
}

async function getUser(id) {
  const res = await pool.query(`SELECT id, email, name, role, brand_id, active, created_at FROM users WHERE id = $1`, [id]);
  return res.rows[0] || null;
}

async function listUsers() {
  const res = await pool.query(`SELECT u.id, u.email, u.name, u.role, u.brand_id, b.name as brand_name, u.active, u.created_at FROM users u LEFT JOIN brands b ON u.brand_id = b.id ORDER BY u.created_at`);
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
  await pool.query(`DELETE FROM users WHERE id = $1`, [id]);
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
        email: 'admin@nudj.studio',
        password: 'Nudj2026!',
        name: 'Admin',
        role: 'admin',
        brand_id: null
      });
      console.log('✓ Seeded default admin user: admin@nudj.studio / Nudj2026!');
    }
  } catch(e) { console.log('Admin seed note:', e.message); }
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
  touchPass,
  logEvent,
  getAnalytics,
  registerDevice,
  getDevicesForPass,
  getDevicesForBrand,
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
  upsertChallengeProgress,
  getChallengeProgress,
  getProgressForChallenge,
  // Booking Analytics (for challenge evaluation)
  countMemberBookings,
  getMemberBookingWeeks,
  countMemberTotalBookings,
  countMemberUniquePartners,
  // Push Log
  logPush,
  listPushes,
  deletePush,
  clearPushHistory,
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
  addSyncLogEntry,
  isBookingSynced,
  listSyncLogs,
  getMembersByPlaytomicEmail,
  updateMemberPlaytomic,
  // Users
  createUser,
  getUserByEmail,
  getUser,
  listUsers,
  updateUser,
  deleteUser,
  verifyPassword,
  seedAdminUser,
  pool
};
