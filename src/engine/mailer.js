/**
 * Mailer module — Resend integration for transactional emails
 */
const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@nudj.studio';
const FROM_NAME = process.env.FROM_NAME || 'Nudj';

/**
 * Send welcome email after signup
 */
async function sendWelcomeEmail({ to, name, brandName, brandColor, points, landingUrl }) {
  if (!resend) {
    console.log('⚠️ RESEND_API_KEY not set — skipping welcome email to', to);
    return null;
  }

  const firstName = name.split(/\s+/)[0];
  const bg = brandColor || '#000000';
  const accent = '#CCFF00';

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
        Grazie per esserti iscritto al programma fedelta di <strong style="color:#fff;">${brandName}</strong>.
        La tua card digitale e pronta nel tuo Apple Wallet!
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
        <a href="${landingUrl}" style="display:inline-block; background:${accent}; color:#000; font-weight:700; font-size:15px; padding:14px 32px; border-radius:10px; text-decoration:none;">
          Apri la tua Card
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

  try {
    const result = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject: `Benvenuto nel club ${brandName}! 🎾`,
      html
    });
    console.log('✓ Welcome email sent to', to, result);
    return result;
  } catch (error) {
    console.error('✗ Failed to send welcome email:', error);
    return null;
  }
}

module.exports = { sendWelcomeEmail };
