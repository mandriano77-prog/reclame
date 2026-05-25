/**
 * HR pass distribution: activation tokens, public join, confirm + pass issue.
 */
const { signActivationToken, verifyActivationToken } = require('./activation-auth');
const { sendActivationEmail, sendActivationReminderEmail } = require('./mailer');
const { employeesToFieldValues } = require('./member-import');
const { upsertPassConsent, PORTAL_CONSENT_TYPES } = require('../db/portal');

function publicBaseUrl() {
  const domain = process.env.CUSTOM_DOMAIN;
  if (domain) return `https://${domain.replace(/^https?:\/\//, '')}`;
  return 'http://localhost:3000';
}

function activationUrl(token) {
  return `${publicBaseUrl()}/activate/${encodeURIComponent(token)}`;
}

function joinUrl(slug) {
  return `${publicBaseUrl()}/join/${encodeURIComponent(slug)}`;
}

function emailDomain(email) {
  const parts = String(email || '').trim().toLowerCase().split('@');
  return parts.length === 2 ? parts[1] : '';
}

function brandAllowedDomains(brand) {
  const raw = brand?.allowed_email_domains;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((d) => String(d).trim().toLowerCase()).filter(Boolean);
  return [];
}

function domainAllowed(email, brand) {
  const domains = brandAllowedDomains(brand);
  if (!domains.length) return true;
  const dom = emailDomain(email);
  return domains.some((d) => dom === d || dom.endsWith('.' + d));
}

async function issueMemberActivation(db, member, { source = 'bulk_email' } = {}) {
  const token = signActivationToken(member.id);
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.pool.query(
    `UPDATE members SET
      activation_token = $1,
      activation_token_expires_at = $2,
      activation_status = 'invited',
      invited_at = COALESCE(invited_at, NOW()),
      activation_source = COALESCE(activation_source, $3),
      updated_at = NOW()
     WHERE id = $4`,
    [token, expires, source, member.id]
  );
  return { token, url: activationUrl(token), expiresAt: expires };
}

async function getMemberForActivationToken(db, token) {
  let memberId;
  try {
    ({ memberId } = verifyActivationToken(token));
  } catch {
    return null;
  }
  const r = await db.pool.query(
    `SELECT m.*, b.name AS brand_name, b.slug AS brand_slug, b.dpo_email, b.hr_email
     FROM members m
     JOIN brands b ON b.id = m.brand_id
     WHERE m.id = $1
       AND m.activation_token = $2
       AND m.activation_token_expires_at > NOW()
     LIMIT 1`,
    [memberId, token]
  );
  return r.rows[0] || null;
}

async function findBrandForPublicJoin(db, slugOrQr) {
  const slug = String(slugOrQr || '').trim().toLowerCase();
  if (!slug) return null;
  const r = await db.pool.query(
    `SELECT * FROM brands
     WHERE public_qr_enabled = true
       AND (public_qr_slug = $1 OR slug = $1)
     LIMIT 1`,
    [slug]
  );
  return r.rows[0] || null;
}

async function countEnrollmentAttemptsForIp(db, ip, hours = 1) {
  const r = await db.pool.query(
    `SELECT COUNT(*)::int AS c FROM enrollment_attempts
     WHERE ip_address = $1 AND attempted_at > NOW() - ($2::text || ' hours')::interval`,
    [ip, String(hours)]
  );
  return r.rows[0]?.c || 0;
}

async function resolveHrTemplate(db, brandId, templateId) {
  if (templateId) {
    const t = await db.getTemplate(templateId);
    if (t && String(t.brand_id) === String(brandId)) return t;
    throw new Error('Template non valido');
  }
  const templates = await db.listTemplates(brandId);
  const hrTpl = templates.find((t) => t.pass_type === 'employee_pass') || templates[0];
  if (!hrTpl) throw new Error('Nessun template pass per questo brand');
  return hrTpl;
}

async function ensurePassForMember(db, member, template) {
  if (member.pass_id) {
    const pass = await db.getPassInstance(member.pass_id);
    if (pass) return pass;
  }
  const field_values = employeesToFieldValues(member);
  const pass = await db.createPassInstance({
    template_id: template.id,
    brand_id: member.brand_id,
    field_values
  });
  await db.updateMemberRecord(member.id, { pass_id: pass.id });
  await db.updatePassInstance(pass.id, { member_id: member.id, activated_at: new Date() });
  return pass;
}

async function saveActivationConsents(passId, consents, meta) {
  const types = PORTAL_CONSENT_TYPES || [
    'birthday', 'welfare_geo', 'gamification', 'climate_survey', 'partner_offers'
  ];
  for (const type of types) {
    const granted = !!consents[type];
    await upsertPassConsent(passId, type, granted, meta);
  }
}

async function confirmMemberActivation(db, token, { consents = {}, template_id, ip, userAgent }) {
  const member = await getMemberForActivationToken(db, token);
  if (!member) throw new Error('Link di attivazione non valido o scaduto');

  const template = await resolveHrTemplate(db, member.brand_id, template_id);
  const pass = await ensurePassForMember(db, member, template);

  await saveActivationConsents(pass.id, consents, {
    ip_address: ip,
    user_agent: userAgent,
    privacy_policy_version: 'filodiretto-v1'
  });

  await db.pool.query(
    `UPDATE members SET
      activation_status = 'activated',
      activated_at = NOW(),
      activation_token = NULL,
      updated_at = NOW()
     WHERE id = $1`,
    [member.id]
  );

  await db.logEvent({
    pass_id: pass.id,
    brand_id: member.brand_id,
    event_type: 'pass_created',
    metadata: { source: 'activation_confirm', member_id: member.id }
  });

  return {
    pass,
    member,
    brand_name: member.brand_name,
    download_url: `/api/v1/passes/${pass.id}/download`
  };
}

async function distributeActivationEmails(db, brandId, memberIds, { template_id, resend: resendExisting = false } = {}) {
  const brand = await db.getBrand(brandId);
  if (!brand) throw new Error('Brand non trovato');

  const summary = { sent: 0, skipped: 0, errors: [] };

  for (const mid of memberIds) {
    try {
      const r = await db.pool.query(
        'SELECT * FROM members WHERE id = $1 AND brand_id = $2',
        [mid, brandId]
      );
      const member = r.rows[0];
      if (!member) {
        summary.skipped++;
        summary.errors.push({ member_id: mid, reason: 'Non trovato' });
        continue;
      }
      if (!member.email) {
        summary.skipped++;
        summary.errors.push({ member_id: mid, reason: 'Email mancante' });
        continue;
      }
      if (member.activation_status === 'activated' && !resendExisting) {
        summary.skipped++;
        continue;
      }
      const { url } = await issueMemberActivation(db, member, { source: 'bulk_email' });
      await sendActivationEmail({
        to: member.email,
        firstName: member.first_name,
        brandName: brand.name,
        activateUrl: url,
        dpoEmail: brand.dpo_email
      });
      summary.sent++;
    } catch (err) {
      summary.errors.push({ member_id: mid, reason: err.message });
    }
  }
  return summary;
}

async function publicJoinByEmail(db, {
  slug,
  email,
  ip,
  userAgent
}) {
  const brand = await findBrandForPublicJoin(db, slug);
  if (!brand) {
    return { ok: false, message: 'Programma non disponibile.' };
  }

  if (await countEnrollmentAttemptsForIp(db, ip) >= 5) {
    await db.logEnrollmentAttempt({
      brand_id: brand.id,
      email_attempted: email,
      ip_address: ip,
      user_agent: userAgent,
      result: 'rate_limited'
    });
    return { ok: false, message: 'Troppi tentativi. Riprova tra un\'ora.' };
  }

  const normalized = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    await db.logEnrollmentAttempt({
      brand_id: brand.id,
      email_attempted: normalized,
      ip_address: ip,
      user_agent: userAgent,
      result: 'invalid'
    });
    return { ok: false, message: 'Inserisci un\'email aziendale valida.' };
  }

  if (!domainAllowed(normalized, brand)) {
    await db.logEnrollmentAttempt({
      brand_id: brand.id,
      email_attempted: normalized,
      ip_address: ip,
      user_agent: userAgent,
      result: 'domain_rejected'
    });
    return {
      ok: false,
      message: 'Non risulti tra i dipendenti registrati per questo programma. Contatta HR.'
    };
  }

  const r = await db.pool.query(
    `SELECT * FROM members
     WHERE brand_id = $1 AND LOWER(email) = $2
     LIMIT 1`,
    [brand.id, normalized]
  );
  const member = r.rows[0];
  if (!member) {
    await db.logEnrollmentAttempt({
      brand_id: brand.id,
      email_attempted: normalized,
      ip_address: ip,
      user_agent: userAgent,
      result: 'no_match'
    });
    return {
      ok: false,
      message: 'Non risulti tra i dipendenti registrati. Verifica l\'email o contatta HR.'
    };
  }

  const { url } = await issueMemberActivation(db, member, { source: 'public_qr' });
  await sendActivationEmail({
    to: member.email,
    firstName: member.first_name,
    brandName: brand.name,
    activateUrl: url,
    dpoEmail: brand.dpo_email
  });

  await db.logEnrollmentAttempt({
    brand_id: brand.id,
    email_attempted: normalized,
    ip_address: ip,
    user_agent: userAgent,
    result: 'matched'
  });

  return {
    ok: true,
    message: 'Ti abbiamo inviato un\'email con il link per attivare il pass.'
  };
}

async function runActivationReminders(db) {
  const r = await db.pool.query(
    `SELECT m.*, b.name AS brand_name, b.dpo_email
     FROM members m
     JOIN brands b ON b.id = m.brand_id
     WHERE m.activation_status = 'invited'
       AND m.email IS NOT NULL
       AND m.invited_at IS NOT NULL
       AND COALESCE(m.activation_reminder_count, 0) < 2
       AND (
         (COALESCE(m.activation_reminder_count, 0) = 0 AND m.invited_at < NOW() - INTERVAL '7 days')
         OR (COALESCE(m.activation_reminder_count, 0) = 1 AND m.invited_at < NOW() - INTERVAL '21 days')
       )`
  );
  let sent = 0;
  for (const member of r.rows) {
    try {
      const { url } = await issueMemberActivation(db, member, { source: member.activation_source || 'bulk_email' });
      await sendActivationReminderEmail({
        to: member.email,
        firstName: member.first_name,
        brandName: member.brand_name,
        activateUrl: url
      });
      await db.pool.query(
        `UPDATE members SET activation_reminder_count = COALESCE(activation_reminder_count, 0) + 1, updated_at = NOW() WHERE id = $1`,
        [member.id]
      );
      sent++;
    } catch (err) {
      console.error('[activation-reminder]', member.id, err.message);
    }
  }
  if (sent) console.log(`[activation-reminder] Sent ${sent} reminder(s)`);
  return { sent };
}

module.exports = {
  publicBaseUrl,
  activationUrl,
  joinUrl,
  issueMemberActivation,
  getMemberForActivationToken,
  findBrandForPublicJoin,
  confirmMemberActivation,
  distributeActivationEmails,
  publicJoinByEmail,
  runActivationReminders,
  domainAllowed
};
