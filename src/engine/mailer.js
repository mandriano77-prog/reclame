/**
 * Mailer module — Resend integration for transactional emails
 * Uses lazy initialization to ensure env vars are loaded
 */
const { Resend } = require('resend');

let resendClient = null;

function getResend() {
  if (resendClient) return resendClient;
  if (process.env.RESEND_API_KEY) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
    return resendClient;
  }
  return null;
}

const getFromEmail = () => process.env.FROM_EMAIL || 'noreply@ads2wallet.com';
const getFromName = () => process.env.FROM_NAME || 'Ads2Wallet';

/**
 * Send welcome email after signup
 */
async function sendWelcomeEmail({ to, name, brandName, brandColor, points, downloadUrl }) {
  console.log('📧 sendWelcomeEmail called — to:', to, 'RESEND_API_KEY set:', !!process.env.RESEND_API_KEY);

  const resend = getResend();
  if (!resend) {
    console.log('⚠️ RESEND_API_KEY not set — skipping welcome email to', to);
    return { skipped: true, reason: 'RESEND_API_KEY not set' };
  }

  const firstName = name.split(/\s+/)[0];
  const bg = brandColor || '#000000';
  const accent = '#CCFF00';
  const fromEmail = getFromEmail();
  const fromName = getFromName();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background:#111; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width:500px; margin:0 auto; padding:32px 20px;">

    <!-- Header -->
    <div style="text-align:center; padding:40px 24px; background:${bg}; border-radius:16px 16px 0 0;">
      <h1 style="color:#fff; font-size:24px; margin:0 0 8px; font-weight:700;">${brandName}</h1>
      <p style="color:${accent}; font-size:16px; margin:0; font-weight:600;">Benvenuto nel Club!</p>
    </div>

    <!-- Body -->
    <div style="background:#1a1a1a; padding:32px 24px; border-radius:0 0 16px 16px;">

      <p style="color:#e0e0e0; font-size:16px; line-height:1.6; margin:0 0 20px;">
        Ciao <strong style="color:#fff;">${firstName}</strong>,
      </p>

      <p style="color:#bbb; font-size:14px; line-height:1.6; margin:0 0 24px;">
        Grazie per esserti iscritto al programma fedeltà di <strong style="color:#fff;">${brandName}</strong>.
        La tua card digitale è pronta nel tuo Apple Wallet!
      </p>

      <!-- Points box -->
      <div style="background:#222; border:1px solid ${accent}33; border-radius:12px; padding:24px; text-align:center; margin:0 0 24px;">
        <p style="color:${accent}; font-size:12px; text-transform:uppercase; letter-spacing:1px; margin:0 0 8px; font-weight:600;">I tuoi primi punti</p>
        <p style="color:#fff; font-size:48px; font-weight:700; margin:0 0 4px; line-height:1;">${points}</p>
        <p style="color:#888; font-size:13px; margin:0;">punti di benvenuto</p>
      </div>

      <p style="color:#bbb; font-size:14px; line-height:1.6; margin:0 0 24px;">
        Ogni partita vale! Accumula punti ad ogni visita, sblocca premi esclusivi
        e scala i livelli del programma.
      </p>

      <!-- Levels preview -->
      <div style="background:#222; border-radius:12px; padding:20px; margin:0 0 24px;">
        <p style="color:#fff; font-size:13px; font-weight:600; margin:0 0 12px;">I livelli del club:</p>
        <div style="display:flex; flex-wrap:wrap; gap:8px;">
          <span style="background:#88888822; color:#888; padding:4px 10px; border-radius:20px; font-size:12px;">Pared</span>
          <span style="background:#4CAF5022; color:#4CAF50; padding:4px 10px; border-radius:20px; font-size:12px;">Bandeja</span>
          <span style="background:#2196F322; color:#2196F3; padding:4px 10px; border-radius:20px; font-size:12px;">Vibora</span>
          <span style="background:#9C27B022; color:#9C27B0; padding:4px 10px; border-radius:20px; font-size:12px;">Bajada</span>
          <span style="background:#FFD70022; color:#FFD700; padding:4px 10px; border-radius:20px; font-size:12px;">Por Tres</span>
        </div>
      </div>

      <!-- CTA -->
      <div style="text-align:center; margin:0 0 16px;">
        <a href="${downloadUrl}" style="display:inline-block; background:${accent}; color:#000; font-weight:700; font-size:15px; padding:14px 32px; border-radius:10px; text-decoration:none;">
          Scarica la tua Card
        </a>
      </div>

      <p style="color:#666; font-size:12px; text-align:center; margin:0;">
        Ci vediamo in campo!
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align:center; padding:24px 0 0;">
      <p style="color:#444; font-size:11px; margin:0;">
        Powered by Precise Consulting
      </p>
    </div>

  </div>
</body>
</html>`;

  console.log('📧 Sending via Resend — from:', `${fromName} <${fromEmail}>`, 'to:', to);

  const result = await resend.emails.send({
    from: `${fromName} <${fromEmail}>`,
    to: [to],
    subject: `Benvenuto nel club ${brandName}! 🎾`,
    html
  });

  console.log('✓ Welcome email sent to', to, JSON.stringify(result));
  return result;
}

/**
 * Send invite email when admin creates a new dashboard user
 */
async function sendUserInviteEmail({ to, name, password, role, brandName, dashboardUrl }) {
  console.log('📧 sendUserInviteEmail called — to:', to);

  const resend = getResend();
  if (!resend) {
    console.log('⚠️ RESEND_API_KEY not set — skipping invite email to', to);
    return { skipped: true, reason: 'RESEND_API_KEY not set' };
  }

  const firstName = name.split(/\s+/)[0];
  const fromEmail = getFromEmail();
  const fromName = getFromName();
  const roleLabels = { admin: 'Amministratore', manager: 'Manager', viewer: 'Viewer (solo lettura)' };
  const roleLabel = roleLabels[role] || 'Manager';
  const brandLine = brandName ? `per <strong style="color:#fff;">${brandName}</strong>` : 'con accesso a tutti i brand';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background:#111; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width:500px; margin:0 auto; padding:32px 20px;">

    <!-- Header -->
    <div style="text-align:center; padding:40px 24px; background:#1E1A36; border-radius:16px 16px 0 0;">
      <h1 style="color:#E8192C; font-size:24px; margin:0 0 8px; font-weight:700;">Ads2Wallet</h1>
      <p style="color:#B0A8C1; font-size:14px; margin:0;">Dashboard Access</p>
    </div>

    <!-- Body -->
    <div style="background:#1a1a1a; padding:32px 24px; border-radius:0 0 16px 16px;">

      <p style="color:#e0e0e0; font-size:16px; line-height:1.6; margin:0 0 20px;">
        Ciao <strong style="color:#fff;">${firstName}</strong>,
      </p>

      <p style="color:#bbb; font-size:14px; line-height:1.6; margin:0 0 24px;">
        Ti è stato creato un accesso alla dashboard Ads2Wallet come <strong style="color:#00D4AA;">${roleLabel}</strong> ${brandLine}.
      </p>

      <!-- Credentials box -->
      <div style="background:#222; border:1px solid #00D4AA33; border-radius:12px; padding:24px; margin:0 0 24px;">
        <p style="color:#00D4AA; font-size:12px; text-transform:uppercase; letter-spacing:1px; margin:0 0 16px; font-weight:600;">Le tue credenziali</p>
        <table style="width:100%; border-collapse:collapse;">
          <tr>
            <td style="color:#888; font-size:13px; padding:6px 0; width:80px;">Email</td>
            <td style="color:#fff; font-size:14px; font-weight:600; padding:6px 0;">${to}</td>
          </tr>
          <tr>
            <td style="color:#888; font-size:13px; padding:6px 0;">Password</td>
            <td style="color:#fff; font-size:14px; font-weight:600; padding:6px 0; font-family:monospace;">${password}</td>
          </tr>
        </table>
      </div>

      <p style="color:#bbb; font-size:13px; line-height:1.6; margin:0 0 24px;">
        Ti consigliamo di cambiare la password al primo accesso.
      </p>

      <!-- CTA -->
      <div style="text-align:center; margin:0 0 16px;">
        <a href="${dashboardUrl}" style="display:inline-block; background:#00D4AA; color:#000; font-weight:700; font-size:15px; padding:14px 32px; border-radius:10px; text-decoration:none;">
          Accedi alla Dashboard
        </a>
      </div>

      <p style="color:#666; font-size:12px; text-align:center; margin:0;">
        Se non hai richiesto questo accesso, ignora questa email.
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align:center; padding:24px 0 0;">
      <p style="color:#444; font-size:11px; margin:0;">
        Powered by Precise Consulting
      </p>
    </div>

  </div>
</body>
</html>`;

  const result = await resend.emails.send({
    from: `${fromName} <${fromEmail}>`,
    to: [to],
    subject: `Il tuo accesso alla dashboard Ads2Wallet`,
    html
  });

  console.log('✓ Invite email sent to', to, JSON.stringify(result));
  return result;
}

/**
 * Send points recap email (weekly or monthly)
 */
async function sendRecapEmail({ to, brandName, brandColor, memberName, periodLabel, periodPoints, pointsDetails, totalPoints, tierName }) {
  const resend = getResend();
  if (!resend) {
    console.log('[Mailer] RESEND_API_KEY not set — skipping recap email to', to);
    return { skipped: true, reason: 'RESEND_API_KEY not set' };
  }

  const fromEmail = getFromEmail();
  const fromName = getFromName();
  const bg = brandColor || '#000000';
  const accent = '#CCFF00';
  const firstName = memberName.split(/\s+/)[0];

  // Build points detail rows
  const hasDetails = pointsDetails && pointsDetails.length > 0;
  const rows = (pointsDetails || []).map(d => {
    const icon = d.reason === 'challenge' ? '&#127942;' : d.reason === 'manual' ? '&#9997;' : d.reason === 'signup' ? '&#127881;' : '&#128204;';
    const date = new Date(d.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
    return `<tr>
      <td style="padding:10px 12px;border-bottom:1px solid #222;font-size:13px;color:#ccc;">${icon} ${d.details || d.reason}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #222;font-size:13px;color:${accent};font-weight:700;text-align:right;">+${d.points}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #222;font-size:11px;color:#666;text-align:right;">${date}</td>
    </tr>`;
  }).join('');

  const detailsSection = hasDetails ? `
    <table style="width:100%;border-collapse:collapse;margin:0 0 24px;">
      <thead><tr style="background:#1a1a1a;">
        <th style="padding:10px 12px;text-align:left;font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.5px;">Attivita</th>
        <th style="padding:10px 12px;text-align:right;font-size:11px;color:#666;text-transform:uppercase;">Punti</th>
        <th style="padding:10px 12px;text-align:right;font-size:11px;color:#666;text-transform:uppercase;">Data</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>` : '';

  // Message varies based on whether they earned points
  const bodyMessage = periodPoints > 0
    ? `Questa ${periodLabel.toLowerCase().startsWith('settimana') ? 'settimana' : 'volta'} hai guadagnato <strong style="color:${accent};">${periodPoints} punti</strong>. Ecco il dettaglio.`
    : `Questa ${periodLabel.toLowerCase().startsWith('settimana') ? 'settimana' : 'volta'} non hai guadagnato punti, ma la tua posizione nel club resta attiva!`;

  const ctaMessage = periodPoints > 0
    ? 'Ottimo lavoro! Continua cosi per sbloccare nuovi premi.'
    : 'Torna a giocare e completa missioni per accumulare punti e salire di livello!';

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:500px;margin:0 auto;padding:32px 20px;">

  <!-- Header -->
  <div style="text-align:center;padding:40px 24px;background:${bg};border-radius:16px 16px 0 0;">
    <h1 style="color:#fff;font-size:24px;margin:0 0 8px;font-weight:700;">${brandName}</h1>
    <p style="color:${accent};font-size:14px;margin:0;font-weight:600;">Il tuo recap ${periodLabel.toLowerCase()}</p>
  </div>

  <!-- Body -->
  <div style="background:#1a1a1a;padding:32px 24px;border-radius:0 0 16px 16px;">
    <p style="color:#e0e0e0;font-size:16px;line-height:1.6;margin:0 0 20px;">
      Ciao <strong style="color:#fff;">${firstName}</strong>,
    </p>
    <p style="color:#bbb;font-size:14px;line-height:1.6;margin:0 0 24px;">
      ${bodyMessage}
    </p>

    <!-- Summary card: period points -->
    <div style="background:linear-gradient(135deg,${bg},#1a1a2e);border:1px solid ${accent}33;border-radius:12px;padding:28px;margin:0 0 16px;text-align:center;">
      <p style="margin:0;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Punti del periodo</p>
      <p style="margin:8px 0;font-size:48px;font-weight:800;color:${periodPoints > 0 ? accent : '#555'};line-height:1;">${periodPoints > 0 ? '+' : ''}${periodPoints}</p>
    </div>

    <!-- Position card: total + tier -->
    <div style="background:#222;border:1px solid #333;border-radius:12px;padding:20px;margin:0 0 24px;text-align:center;">
      <p style="margin:0;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;">La tua posizione</p>
      <p style="margin:8px 0 4px;font-size:32px;font-weight:700;color:#fff;line-height:1;">${totalPoints}</p>
      <p style="margin:0;color:#888;font-size:13px;">punti totali${tierName ? ` &mdash; Livello <strong style="color:${accent};">${tierName}</strong>` : ''}</p>
    </div>

    ${detailsSection}

    <p style="margin:20px 0 0;font-size:13px;color:#666;text-align:center;">${ctaMessage}</p>
  </div>

  <!-- Footer -->
  <div style="text-align:center;padding:24px 0 0;">
    <p style="color:#444;font-size:11px;margin:0;">Powered by Precise Consulting</p>
    <p style="color:#333;font-size:10px;margin:6px 0 0;">Ricevi questa email perche fai parte del programma fedelta di ${brandName}.</p>
  </div>

</div>
</body>
</html>`;

  const subject = periodPoints > 0
    ? `${brandName} — +${periodPoints} punti ${periodLabel.toLowerCase()}!`
    : `${brandName} — Il tuo recap ${periodLabel.toLowerCase()}`;

  try {
    const result = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject,
      html
    });
    console.log(`[Mailer] ✓ Recap email sent to ${to}: ${subject}`);
    return result;
  } catch(e) {
    console.error(`[Mailer] ✗ Failed to send recap to ${to}:`, e.message);
    return { error: e.message };
  }
}

/**
 * Send scratch card invitation email
 */
async function sendScratchEmail({ to, name, brandName, brandColor, scratchUrl, campaignTitle }) {
  const resend = getResend();
  if (!resend) {
    console.log('[Mailer] RESEND_API_KEY not set — skipping scratch email to', to);
    return { skipped: true };
  }

  const fromEmail = getFromEmail();
  const fromName = getFromName();
  const firstName = (name || '').split(/\s+/)[0] || 'Ciao';
  const color = brandColor || '#D4E600';

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:32px 24px;">

    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-size:48px;margin-bottom:8px;">🎰</div>
      <h1 style="color:#fff;font-size:24px;font-weight:700;margin:0;">${campaignTitle || 'Gratta e Vinci!'}</h1>
      <p style="color:#888;font-size:14px;margin:8px 0 0;">da ${brandName}</p>
    </div>

    <div style="background:#111;border-radius:16px;padding:28px 24px;text-align:center;border:1px solid #222;">
      <p style="color:#ccc;font-size:16px;line-height:1.6;margin:0 0 8px;">
        ${firstName}, hai una scratch card tutta per te!
      </p>
      <p style="color:#888;font-size:14px;line-height:1.5;margin:0 0 24px;">
        Gratta per scoprire se hai vinto punti bonus.
      </p>
      <a href="${scratchUrl}" style="display:inline-block;background:${color};color:#000;font-size:16px;font-weight:700;padding:14px 40px;border-radius:50px;text-decoration:none;letter-spacing:0.5px;">
        GRATTA ORA
      </a>
    </div>

    <div style="text-align:center;padding:24px 0 0;">
      <p style="color:#444;font-size:11px;margin:0;">
        Powered by Ads2Wallet
      </p>
    </div>

  </div>
</body></html>`;

  try {
    const result = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject: `🎰 ${firstName}, hai una scratch card da ${brandName}!`,
      html
    });
    console.log(`[Mailer] ✓ Scratch email sent to ${to}`);
    return result;
  } catch(e) {
    console.error(`[Mailer] ✗ Failed to send scratch to ${to}:`, e.message);
    return { error: e.message };
  }
}

/**
 * Password reset link for dashboard users
 */
async function sendPasswordResetEmail({ to, name, resetUrl }) {
  const resend = getResend();
  if (!resend) {
    console.log('⚠️ RESEND_API_KEY not set — skipping password reset email to', to);
    return { skipped: true, reason: 'RESEND_API_KEY not set' };
  }

  const firstName = String(name || 'utente').split(/\s+/)[0];
  const fromEmail = getFromEmail();
  const fromName = getFromName();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background:#111; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width:500px; margin:0 auto; padding:32px 20px;">

    <div style="text-align:center; padding:40px 24px; background:#1E1A36; border-radius:16px 16px 0 0;">
      <h1 style="color:#E8192C; font-size:24px; margin:0 0 8px; font-weight:700;">Ads2Wallet</h1>
      <p style="color:#B0A8C1; font-size:14px; margin:0;">Recupero password</p>
    </div>

    <div style="background:#1a1a1a; padding:32px 24px; border-radius:0 0 16px 16px;">
      <p style="color:#e0e0e0; font-size:16px; line-height:1.6; margin:0 0 20px;">
        Ciao <strong style="color:#fff;">${firstName}</strong>,
      </p>
      <p style="color:#bbb; font-size:14px; line-height:1.6; margin:0 0 24px;">
        Hai richiesto di reimpostare la password della dashboard. Il link è valido per <strong style="color:#fff;">1 ora</strong>.
      </p>
      <div style="text-align:center; margin:0 0 24px;">
        <a href="${resetUrl}" style="display:inline-block; background:#00D4AA; color:#000; font-weight:700; font-size:15px; padding:14px 32px; border-radius:10px; text-decoration:none;">
          Reimposta password
        </a>
      </div>
      <p style="color:#888; font-size:12px; line-height:1.6; margin:0 0 16px; word-break:break-all;">
        Se il pulsante non funziona, copia questo link nel browser:<br>
        <a href="${resetUrl}" style="color:#00D4AA;">${resetUrl}</a>
      </p>
      <p style="color:#666; font-size:12px; text-align:center; margin:0;">
        Se non hai richiesto il recupero, ignora questa email.
      </p>
    </div>

    <div style="text-align:center; padding:24px 0 0;">
      <p style="color:#444; font-size:11px; margin:0;">Powered by Precise Consulting</p>
    </div>

  </div>
</body>
</html>`;

  const result = await resend.emails.send({
    from: `${fromName} <${fromEmail}>`,
    to: [to],
    subject: 'Reimposta la password Ads2Wallet',
    html
  });

  console.log('✓ Password reset email sent to', to);
  return result;
}

module.exports = {
  sendWelcomeEmail,
  sendUserInviteEmail,
  sendRecapEmail,
  sendScratchEmail,
  sendPasswordResetEmail
};
