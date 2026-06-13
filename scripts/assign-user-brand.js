#!/usr/bin/env node
'use strict';

/**
 * Assign a brand to dashboard users (manager/sender/reporter).
 *
 * Usage (Railway production DB):
 *   railway run node scripts/assign-user-brand.js "Nuova Telefonia Italiana" adrianococcia@me.com mandriano77@me.com
 *
 * Or by slug / UUID:
 *   railway run node scripts/assign-user-brand.js --slug nuova-telefonia-italiana user@example.com
 *   railway run node scripts/assign-user-brand.js --id <brand-uuid> user@example.com
 */

require('dotenv').config();

async function resolveBrand(db, args) {
  const { getBrand, getBrandBySlug, listBrands } = db;
  if (args.id) {
    const brand = await getBrand(args.id);
    if (!brand) throw new Error('Brand not found for id: ' + args.id);
    return brand;
  }
  if (args.slug) {
    const brand = await getBrandBySlug(args.slug);
    if (!brand) throw new Error('Brand not found for slug: ' + args.slug);
    return brand;
  }
  const name = String(args.name || '').trim();
  if (!name) throw new Error('Provide brand name, --slug, or --id');
  const brands = await listBrands();
  const exact = brands.find((b) => String(b.name || '').trim().toLowerCase() === name.toLowerCase());
  if (exact) return exact;
  const partial = brands.find((b) => String(b.name || '').toLowerCase().includes(name.toLowerCase()));
  if (partial) return partial;
  throw new Error('Brand not found: ' + name);
}

function parseArgs(argv) {
  const out = { id: '', slug: '', name: '', emails: [] };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--id') out.id = String(argv[++i] || '').trim();
    else if (a === '--slug') out.slug = String(argv[++i] || '').trim();
    else if (a.startsWith('--')) throw new Error('Unknown flag: ' + a);
    else rest.push(a);
  }
  if (!out.id && !out.slug) out.name = String(rest.shift() || '').trim();
  out.emails = rest.map((e) => String(e || '').trim().toLowerCase()).filter(Boolean);
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.emails.length) {
    console.error('Usage: node scripts/assign-user-brand.js [--slug SLUG | --id UUID] <brand-name> email [email...]');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required (use: railway run node scripts/assign-user-brand.js ...)');
    process.exit(1);
  }

  const db = require('../src/db/index.js');
  await db.getDb();
  const { getUserByEmail, updateUser } = db;

  const brand = await resolveBrand(db, args);
  console.log('Brand:', brand.name, '(' + brand.id + ')');

  for (const email of args.emails) {
    const user = await getUserByEmail(email);
    if (!user) {
      console.warn('Skipped — user not found:', email);
      continue;
    }
    if (String(user.role || '').toLowerCase() === 'admin') {
      console.warn('Skipped — admin has all brands:', email);
      continue;
    }
    await updateUser(user.id, { brand_id: brand.id });
    console.log('✓ Assigned to', email, '(' + user.role + ')');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
