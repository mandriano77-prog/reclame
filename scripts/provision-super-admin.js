#!/usr/bin/env node
'use strict';

/**
 * Create or promote a dashboard super admin (role=admin, all brands) and send invite email.
 *
 * Usage (Railway production DB):
 *   railway run node scripts/provision-super-admin.js adrianococcia@me.com "Adriano Coccia"
 *
 * Optional: promote an existing account too:
 *   railway run node scripts/provision-super-admin.js adrianococcia@me.com "Adriano" --promote admin@nudj.studio
 *
 * HR deploy: add the email to DASHBOARD_LOGIN_ALLOWLIST on Railway or login will be blocked.
 */

require('dotenv').config();

const { randomBytes } = require('crypto');

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const promoteFlagIdx = process.argv.indexOf('--promote');
  const promoteEmail = promoteFlagIdx >= 0 ? String(process.argv[promoteFlagIdx + 1] || '').trim().toLowerCase() : '';

  const email = String(args[0] || '').trim().toLowerCase();
  const name = String(args[1] || 'Super Admin').trim();

  if (!email) {
    console.error('Usage: node scripts/provision-super-admin.js <email> [name] [--promote other@email]');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required (use: railway run node scripts/provision-super-admin.js ...)');
    process.exit(1);
  }

  const db = require('../src/db/index.js');
  await db.getDb();

  const { createUser, getUserByEmail, updateUser } = db;

  if (promoteEmail) {
    const u = await getUserByEmail(promoteEmail);
    if (!u) {
      console.warn('Promote skipped — user not found:', promoteEmail);
    } else if (u.role !== 'admin' || u.brand_id != null) {
      await updateUser(u.id, { role: 'admin', brand_id: null });
      console.log('✓ Promoted to admin:', promoteEmail);
    } else {
      console.log('Already admin:', promoteEmail);
    }
  }

  let user = await getUserByEmail(email);
  const tempPassword = randomBytes(9).toString('base64url').slice(0, 12);

  if (user) {
    await updateUser(user.id, { role: 'admin', brand_id: null, password: tempPassword, name });
    console.log('✓ Updated existing user to super admin:', email);
  } else {
    user = await createUser({ email, password: tempPassword, name, role: 'admin', brand_id: null });
    console.log('✓ Created super admin:', email);
  }

  const { sendUserInviteEmail } = require('../src/engine/mailer');
  const domain = String(process.env.CUSTOM_DOMAIN || 'studio.filodiretto.app').replace(/^https?:\/\//, '');
  const mailResult = await sendUserInviteEmail({
    to: email,
    name: user.name || name,
    password: tempPassword,
    role: 'admin',
    brandName: null,
    dashboardUrl: `https://${domain}/dashboard`
  });

  if (mailResult?.skipped) {
    console.warn('⚠ Invite email skipped:', mailResult.reason);
  } else {
    console.log('✓ Invite email sent to', email);
  }

  console.log('\nReminder (Filo HR deploy): set on Railway');
  console.log('  DASHBOARD_LOGIN_ALLOWLIST=admin@nudj.studio,' + email);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
