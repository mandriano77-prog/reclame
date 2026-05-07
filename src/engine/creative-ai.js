// Creative AI — fal.ai integration for ad creative generation
// Uses Flux for photorealistic backgrounds, Ideogram for text-heavy creatives

const sharp = require('sharp');

const FAL_API_KEY = process.env.FAL_API_KEY;
const FAL_BASE = 'https://fal.run';

// ─── Format Catalog ──────────────────────────────────────────────
const FORMATS = {
  // Social
  ig_story:     { key: 'ig_story',     label: 'Instagram Story',    w: 1080, h: 1920, segment: 'social' },
  ig_post:      { key: 'ig_post',      label: 'Instagram Post',     w: 1080, h: 1080, segment: 'social' },
  ig_reel:      { key: 'ig_reel',      label: 'Instagram Reel',     w: 1080, h: 1920, segment: 'social' },
  fb_feed:      { key: 'fb_feed',      label: 'Facebook Feed',      w: 1200, h: 628,  segment: 'social' },
  tiktok:       { key: 'tiktok',       label: 'TikTok',             w: 1080, h: 1920, segment: 'social' },
  // Display / Video
  banner_300:   { key: 'banner_300',   label: 'Medium Rectangle',   w: 300,  h: 250,  segment: 'display' },
  banner_728:   { key: 'banner_728',   label: 'Leaderboard',        w: 728,  h: 90,   segment: 'display' },
  banner_160:   { key: 'banner_160',   label: 'Wide Skyscraper',    w: 160,  h: 600,  segment: 'display' },
  banner_320:   { key: 'banner_320',   label: 'Mobile Banner',      w: 320,  h: 50,   segment: 'display' },
  interstitial: { key: 'interstitial', label: 'Interstitial',       w: 320,  h: 480,  segment: 'display' },
  billboard:    { key: 'billboard',    label: 'Billboard',          w: 970,  h: 250,  segment: 'display' },
  // CTV / DOOH
  ctv_16_9:     { key: 'ctv_16_9',     label: 'CTV 16:9',          w: 1920, h: 1080, segment: 'ctv_dooh' },
  dooh_vert:    { key: 'dooh_vert',    label: 'DOOH Verticale',     w: 1080, h: 1920, segment: 'ctv_dooh' },
  dooh_horiz:   { key: 'dooh_horiz',   label: 'DOOH Orizzontale',  w: 1920, h: 1080, segment: 'ctv_dooh' },
  dooh_square:  { key: 'dooh_square',  label: 'DOOH Quadrato',      w: 1080, h: 1080, segment: 'ctv_dooh' },
};

function getFormats(segment) {
  if (!segment) return Object.values(FORMATS);
  return Object.values(FORMATS).filter(f => f.segment === segment);
}

function getFormat(key) {
  return FORMATS[key] || null;
}

// ─── Style prompt defaults ──────────────────────────────────────────────
const DEFAULT_STYLE_PROMPT = `High-end advertising photography, clean composition, professional lighting, luxury brand aesthetic. Shot on medium format camera with shallow depth of field. Minimalist, modern, editorial style. No text, no watermarks, no logos, no UI elements. Clean negative space for text overlay. Commercial ad quality, 8k resolution.`;

// Build the full prompt: style guide + user prompt
function buildPrompt(userPrompt, stylePrompt) {
  const style = stylePrompt || DEFAULT_STYLE_PROMPT;
  return `${style}\n\nSubject: ${userPrompt}`;
}

// ─── fal.ai API call ──────────────────────────────────────────────
async function generateWithFal(prompt, width, height, model = 'fal-ai/flux/dev', referenceImageUrl = null, stylePrompt = null) {
  if (!FAL_API_KEY) throw new Error('FAL_API_KEY non configurata — aggiungi FAL_API_KEY alle variabili d’ambiente (es. dashboard DigitalOcean / .env)');

  const url = `${FAL_BASE}/${model}`;
  console.log(`[fal.ai] POST ${url} — size ${width}x${height}${referenceImageUrl ? ' (with reference image)' : ''}`);

  // Build request body with enhanced prompt
  const fullPrompt = buildPrompt(prompt, stylePrompt);
  console.log(`[fal.ai] Full prompt: ${fullPrompt.substring(0, 150)}...`);

  const requestBody = {
    prompt: fullPrompt,
    image_size: { width, height },
    num_images: 1,
    enable_safety_checker: true
  };

  // Add reference image for image-to-image models
  if (referenceImageUrl) {
    requestBody.image_url = referenceImageUrl;
    requestBody.strength = 0.65; // 0 = identical to input, 1 = fully generated. 0.65 = good creative balance
  }

  // Submit request (fal.run = synchronous endpoint, returns result directly)
  const submitRes = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${FAL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  const rawBody = await submitRes.text();
  console.log(`[fal.ai] Response status: ${submitRes.status}, body length: ${rawBody.length}`);

  if (!submitRes.ok) {
    console.error(`[fal.ai] Error response: ${rawBody.substring(0, 500)}`);
    throw new Error(`fal.ai error ${submitRes.status}: ${rawBody.substring(0, 200)}`);
  }

  if (!rawBody || rawBody.length === 0) {
    throw new Error('fal.ai returned empty response');
  }

  let data;
  try {
    data = JSON.parse(rawBody);
  } catch (e) {
    console.error(`[fal.ai] Non-JSON response: ${rawBody.substring(0, 300)}`);
    throw new Error('fal.ai returned non-JSON response: ' + rawBody.substring(0, 100));
  }

  // Sync response — images directly
  if (data.images && data.images.length > 0) {
    console.log(`[fal.ai] Got image URL: ${data.images[0].url.substring(0, 80)}...`);
    return data.images[0].url;
  }

  // Queue-based: poll for result
  const requestId = data.request_id;
  if (!requestId) {
    console.error('[fal.ai] No images and no request_id in response:', JSON.stringify(data).substring(0, 300));
    throw new Error('fal.ai: no images and no request_id in response');
  }

  const queueBase = 'https://queue.fal.run';
  const statusUrl = `${queueBase}/${model}/requests/${requestId}/status`;
  const resultUrl = `${queueBase}/${model}/requests/${requestId}`;
  console.log(`[fal.ai] Queued, polling request_id: ${requestId}`);

  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const statusRes = await fetch(statusUrl, {
      headers: { 'Authorization': `Key ${FAL_API_KEY}` }
    });
    const statusRaw = await statusRes.text();
    let statusData;
    try { statusData = JSON.parse(statusRaw); } catch(e) { continue; }

    if (statusData.status === 'COMPLETED') {
      const resultRes = await fetch(resultUrl, {
        headers: { 'Authorization': `Key ${FAL_API_KEY}` }
      });
      const resultRaw = await resultRes.text();
      let resultData;
      try { resultData = JSON.parse(resultRaw); } catch(e) {
        throw new Error('fal.ai result non-JSON: ' + resultRaw.substring(0, 100));
      }
      if (resultData.images && resultData.images.length > 0) {
        return resultData.images[0].url;
      }
      throw new Error('No images in fal.ai result');
    }
    if (statusData.status === 'FAILED') {
      throw new Error('fal.ai generation failed: ' + (statusData.error || 'unknown'));
    }
  }
  throw new Error('fal.ai timeout after 120s');
}

// ─── Compose creative with logo + text + QR overlay ──────────────
async function composeCreative(options) {
  const {
    backgroundBuffer,  // Buffer of AI-generated or uploaded background image
    width, height,
    logoBuffer,         // Brand logo PNG (optional)
    headline,           // Main text (optional)
    ctaText,            // CTA button text (optional)
    brandColors,        // { bg, fg, lbl }
    qrBuffer,           // QR code PNG buffer (optional, for DOOH/CTV)
    segment             // 'social' | 'display' | 'ctv_dooh'
  } = options;

  // Resize background to exact format
  let composite = sharp(backgroundBuffer).resize(width, height, { fit: 'cover' });

  const overlays = [];

  // Dark gradient overlay for text readability
  const gradientSvg = `<svg width="${width}" height="${height}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="black" stop-opacity="0.1"/>
      <stop offset="60%" stop-color="black" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="black" stop-opacity="0.75"/>
    </linearGradient></defs>
    <rect width="${width}" height="${height}" fill="url(#g)"/>
  </svg>`;
  overlays.push({ input: Buffer.from(gradientSvg), top: 0, left: 0 });

  // Logo top-left (if provided)
  if (logoBuffer) {
    const logoMaxW = Math.round(width * 0.25);
    const logoMaxH = Math.round(height * 0.08);
    const logoResized = await sharp(logoBuffer)
      .resize(logoMaxW, logoMaxH, { fit: 'inside', withoutEnlargement: true })
      .png().toBuffer();
    const margin = Math.round(width * 0.05);
    overlays.push({ input: logoResized, top: margin, left: margin });
  }

  const fg = brandColors?.fg || '#FFFFFF';
  const lbl = brandColors?.lbl || '#00D4AA';

  // Headline text (bottom area)
  if (headline) {
    const fontSize = Math.max(16, Math.round(width * 0.055));
    const textMargin = Math.round(width * 0.05);
    const textY = Math.round(height * (qrBuffer ? 0.55 : 0.72));
    const maxTextW = width - textMargin * 2;

    const textSvg = `<svg width="${maxTextW}" height="${Math.round(fontSize * 3)}">
      <text x="0" y="${fontSize}" font-family="Helvetica, Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="${fg}">
        ${escXml(headline)}
      </text>
    </svg>`;
    overlays.push({ input: Buffer.from(textSvg), top: textY, left: textMargin });
  }

  // CTA button
  if (ctaText) {
    const btnFontSize = Math.max(12, Math.round(width * 0.035));
    const btnH = Math.round(btnFontSize * 2.8);
    const btnW = Math.min(Math.round(width * 0.5), Math.round(ctaText.length * btnFontSize * 0.7 + 40));
    const btnMargin = Math.round(width * 0.05);
    const btnY = Math.round(height * (qrBuffer ? 0.68 : 0.85));

    const btnSvg = `<svg width="${btnW}" height="${btnH}">
      <rect width="${btnW}" height="${btnH}" rx="${Math.round(btnH/2)}" fill="${lbl}"/>
      <text x="${btnW/2}" y="${btnH/2 + btnFontSize*0.35}" font-family="Helvetica, Arial, sans-serif" font-size="${btnFontSize}" font-weight="700" fill="${brandColors?.bg || '#000'}" text-anchor="middle">
        ${escXml(ctaText)}
      </text>
    </svg>`;
    overlays.push({ input: Buffer.from(btnSvg), top: btnY, left: btnMargin });
  }

  // QR code for CTV/DOOH (bottom-right)
  if (qrBuffer && (segment === 'ctv_dooh' || segment === 'dooh')) {
    const qrSize = Math.round(Math.min(width, height) * 0.2);
    const qrResized = await sharp(qrBuffer).resize(qrSize, qrSize).png().toBuffer();
    const qrMargin = Math.round(width * 0.05);

    // White background behind QR
    const qrBgSvg = `<svg width="${qrSize + 16}" height="${qrSize + 16}">
      <rect width="${qrSize + 16}" height="${qrSize + 16}" rx="8" fill="white"/>
    </svg>`;
    overlays.push({ input: Buffer.from(qrBgSvg), top: height - qrSize - qrMargin - 8, left: width - qrSize - qrMargin - 8 });
    overlays.push({ input: qrResized, top: height - qrSize - qrMargin, left: width - qrSize - qrMargin });
  }

  const result = await composite.composite(overlays).png().toBuffer();
  return result;
}

function escXml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = {
  FORMATS,
  getFormats,
  getFormat,
  generateWithFal,
  composeCreative
};
