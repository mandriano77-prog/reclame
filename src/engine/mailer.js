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

const getFromEmail = () => process.env.FROM_EMAIL || 'noreply@nudj.studio';
const getFromName = () => process.env.FROM_NAME || 'Nudj';

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
  const roleLabel = role === 'admin' ? 'Amministratore' : 'Manager';
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
      <h1 style="color:#00D4AA; font-size:24px; margin:0 0 8px; font-weight:700;">&#9670; Nudj</h1>
      <p style="color:#B0A8C1; font-size:14px; margin:0;">Dashboard Access</p>
    </div>

    <!-- Body -->
    <div style="background:#1a1a1a; padding:32px 24px; border-radius:0 0 16px 16px;">

      <p style="color:#e0e0e0; font-size:16px; line-height:1.6; margin:0 0 20px;">
        Ciao <strong style="color:#fff;">${firstName}</strong>,
      </p>

      <p style="color:#bbb; font-size:14px; line-height:1.6; margin:0 0 24px;">
        Ti è stato creato un accesso alla dashboard Nudj come <strong style="color:#00D4AA;">${roleLabel}</strong> ${brandLine}.
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
    subject: `Il tuo accesso alla dashboard Nudj`,
    html
  });

  console.log('✓ Invite email sent to', to, JSON.stringify(result));
  return result;
}

module.exports = { sendWelcomeEmail, sendUserInviteEmail };
