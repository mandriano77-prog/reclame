/**
 * Filodiretto — shared thank-you page markup & styles (post wallet install).
 */

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getThankYouFooter() {
  const custom = String(process.env.WHITE_LABEL_FOOTER || '').trim();
  return custom || 'Powered by Filodiretto';
}

function normalizeHexColor(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const hex = raw.startsWith('#') ? raw.slice(1) : raw;
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex.toUpperCase()}`;
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    return `#${hex.split('').map((c) => c + c).join('').toUpperCase()}`;
  }
  return null;
}

function shadeHex(hex, factor) {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return hex;
  const num = parseInt(normalized.slice(1), 16);
  const ch = (offset) => (num >> offset) & 255;
  const scale = (v) => Math.max(0, Math.min(255, Math.round(v * factor)));
  const rgb = [scale(ch(16)), scale(ch(8)), scale(ch(0))]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return `#${rgb}`;
}

function thankYouStyles() {
  return `
    :root {
      --brand: #8B5CF6;
      --brand-dark: #7C3AED;
      --brand-light: #A78BFA;
      --brand-subtle: #F5F3FF;
      --bg-canvas: #0A0A0A;
      --bg-card: #141414;
      --text-primary: #F4EDE2;
      --text-muted: #8E8880;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
      background: var(--bg-canvas);
      color: var(--text-primary);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      text-align: center;
      padding: 40px 24px;
      max-width: 420px;
      width: 100%;
    }
    .logo-area {
      width: 160px;
      height: 60px;
      margin: 0 auto 32px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .logo-area img { max-width: 100%; max-height: 100%; object-fit: contain; }
    .logo-letter {
      width: 56px;
      height: 56px;
      border-radius: 14px;
      background: rgba(139, 92, 246, 0.12);
      border: 2px solid rgba(139, 92, 246, 0.35);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      font-weight: 700;
      color: var(--brand);
      margin: 0 auto;
    }
    .icon-circle {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: rgba(139, 92, 246, 0.12);
      border: 2px solid rgba(139, 92, 246, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
    }
    .state-loading .icon-circle { animation: pulse 1s ease-in-out infinite; }
    .state-success .icon-circle { animation: none; }
    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.05); opacity: 0.9; }
    }
    .icon-circle .check { font-size: 36px; color: var(--brand); }
    h1 {
      font-size: 22px;
      font-weight: 700;
      margin-bottom: 14px;
      line-height: 1.3;
      color: var(--text-primary);
    }
    .body-copy {
      font-size: 15px;
      color: var(--text-primary);
      line-height: 1.55;
      margin-bottom: 12px;
      opacity: 0.92;
    }
    .muted {
      font-size: 14px;
      color: var(--text-muted);
      line-height: 1.5;
      margin-bottom: 28px;
    }
    .cta-stack {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
    }
    .btn-primary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 14px 28px;
      border-radius: 50px;
      border: none;
      background: var(--brand);
      color: #fff;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: background 0.2s, transform 0.2s;
      font-family: inherit;
    }
    .btn-primary:hover { background: var(--brand-dark); transform: translateY(-1px); }
    .link-secondary {
      font-size: 14px;
      color: var(--brand-light);
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    .link-secondary:hover { color: var(--brand); }
    .footer {
      margin-top: 48px;
      color: var(--text-muted);
      font-size: 11px;
      letter-spacing: 0.05em;
    }
    .hidden { display: none !important; }
  `;
}

function thankYouSuccessBlock({ brandName, portalHref, passDownloadUrl, showPortal = true }) {
  const brand = escapeHtml(brandName);
  const portalTarget = portalHref && portalHref !== '#' ? portalHref : '#';
  const portalBtn = showPortal
    ? `<a class="btn-primary" href="${escapeHtml(portalTarget)}"${portalTarget === '#' ? ' aria-disabled="true" onclick="return false;"' : ''}>Apri il mio profilo →</a>`
    : '';
  const downloadLink = passDownloadUrl
    ? `<a class="link-secondary" href="${escapeHtml(passDownloadUrl)}">Pass non installato? Scarica di nuovo</a>`
    : '';

  if (!showPortal) {
    return `
    <div class="icon-circle">
      <span class="check" aria-hidden="true">&#10003;</span>
    </div>
    <h1>Pass aggiunto.</h1>
    <p class="body-copy lead">Il pass di <strong>${brand}</strong> è ora nel tuo Wallet.<br>
    Riceverai aggiornamenti e notifiche direttamente sulla lock screen del telefono.</p>
    <div class="cta-stack actions">
      ${downloadLink}
    </div>`;
  }

  return `
    <div class="icon-circle">
      <span class="check" aria-hidden="true">&#10003;</span>
    </div>
    <h1>Benvenuto in ${brand}.</h1>
    <p class="body-copy lead">Il pass è ora nel tuo wallet.<br>
    Hai appena attivato il <strong>filo diretto</strong> con ${brand}: le comunicazioni arrivano direttamente sulla lock-screen del tuo iPhone — niente email, niente intranet.</p>
    <p class="muted">Puoi gestire cosa ricevere dal tuo profilo personale, in qualsiasi momento.</p>
    <div class="cta-stack actions">
      ${portalBtn}
      ${downloadLink}
    </div>`;
}

function renderSaveThankYouPage({
  brandName,
  logoUrl,
  passDownloadUrl,
  portalHref,
  brandColor,
  showPortal = true,
  footer = getThankYouFooter()
}) {
  const safeBrand = escapeHtml(brandName);
  const initial = escapeHtml((brandName || 'B').charAt(0).toUpperCase());
  const successBlock = thankYouSuccessBlock({ brandName, portalHref, passDownloadUrl, showPortal });
  const accent = normalizeHexColor(brandColor) || '#8B5CF6';
  const accentDark = shadeHex(accent, 0.85);
  const accentLight = shadeHex(accent, 1.2);
  const brandVars = `:root{--brand:${accent};--brand-dark:${accentDark};--brand-light:${accentLight};}`;

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <meta name="theme-color" content="#0A0A0A">
  <title>${safeBrand} · Filo Diretto</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>${thankYouStyles()}</style>
  <style>${brandVars}</style>
</head>
<body>
  <div class="container">
    <div class="logo-area" id="logoArea">
      <div class="logo-letter" id="logoLetter">${initial}</div>
    </div>

    <div id="stateLoading" class="state-loading">
      <div class="icon-circle"><span style="font-size:28px;color:var(--brand);">&#8987;</span></div>
      <h1>Preparazione in corso...</h1>
      <p class="muted">Il tuo pass si sta scaricando</p>
    </div>

    <div id="stateSuccess" class="hidden state-success">
      ${successBlock}
    </div>

    <div id="stateUnsupported" class="hidden">
      <div class="icon-circle" style="border-color:#ffb020;">
        <span style="font-size:28px;color:#ffb020;">&#9888;</span>
      </div>
      <h1>Apri da smartphone</h1>
      <p class="muted">Per evitare confusione, il flusso ufficiale supportato è mobile-first: apri questo link su <strong>iPhone</strong> e tocca <strong>Aggiungi</strong> in Wallet.</p>
      <div class="cta-stack" style="margin-top:20px;">
        <a href="${escapeHtml(passDownloadUrl)}" class="btn-primary">Scarica file .pkpass</a>
      </div>
    </div>

    <div id="stateError" class="hidden">
      <div class="icon-circle" style="border-color:#ff4444;">
        <span style="font-size:32px;color:#ff4444;">&#10007;</span>
      </div>
      <h1>Ops, qualcosa non ha funzionato</h1>
      <p class="muted">Riprova tra qualche istante.</p>
      <div class="cta-stack" style="margin-top:20px;">
        <a href="${escapeHtml(passDownloadUrl)}" class="btn-primary">Riprova download</a>
      </div>
    </div>

    <div class="footer">${escapeHtml(footer)}</div>
  </div>

  <script>
    const logoImg = new Image();
    logoImg.onload = () => {
      document.getElementById('logoLetter').style.display = 'none';
      const img = document.createElement('img');
      img.src = logoImg.src;
      img.alt = ${JSON.stringify(brandName || '')};
      document.getElementById('logoArea').appendChild(img);
    };
    logoImg.src = ${JSON.stringify(logoUrl)};

    (function() {
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent || '');
      if (!isIOS) {
        document.getElementById('stateLoading').classList.add('hidden');
        document.getElementById('stateUnsupported').classList.remove('hidden');
        return;
      }
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = ${JSON.stringify(passDownloadUrl)};
      document.body.appendChild(iframe);
      setTimeout(function() {
        document.getElementById('stateLoading').classList.add('hidden');
        document.getElementById('stateSuccess').classList.remove('hidden');
      }, 3500);
    })();
  </script>
</body>
</html>`;
}

async function resolvePortalHref(passId, brandOrId) {
  if (!passId) return null;
  try {
    const { getBrand } = require('../db');
    const { isPortalPassBrand } = require('./pass-product-line');
    let brand = null;
    if (brandOrId && typeof brandOrId === 'object') brand = brandOrId;
    else if (brandOrId) brand = await getBrand(brandOrId);
    if (!brand) {
      const { getPassInstance } = require('../db');
      const pass = await getPassInstance(passId);
      if (pass?.brand_id) brand = await getBrand(pass.brand_id);
    }
    if (brand && !isPortalPassBrand(brand)) return null;
    const { resolvePortalLinkForPass } = require('./portal-pass-link');
    const link = await resolvePortalLinkForPass(passId);
    return link?.portal_url || null;
  } catch (err) {
    console.warn('[portal] thank-you link unavailable:', err.message);
    return null;
  }
}

module.exports = {
  escapeHtml,
  getThankYouFooter,
  thankYouStyles,
  thankYouSuccessBlock,
  renderSaveThankYouPage,
  resolvePortalHref
};
