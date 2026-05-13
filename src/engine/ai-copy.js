// AI Copywriter — Anthropic Claude (preferred when configured) or Google Gemini
// Produces catchy, conversion-focused text for Ads2Wallet

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

function preferredAiProvider() {
  const explicit = String(process.env.AI_PROVIDER || '').trim().toLowerCase();
  if (explicit === 'anthropic' || explicit === 'gemini') return explicit;
  if (ANTHROPIC_API_KEY) return 'anthropic';
  if (GEMINI_API_KEY) return 'gemini';
  return null;
}

// ─── Gemini REST helper ────────────────────────────────────────────
async function callGemini(systemPrompt, userPrompt) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY non configurata');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': GEMINI_API_KEY
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 1024
      }
    })
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[ai-copy] Gemini API error:', res.status, err);
    throw new Error(`Gemini error ${res.status}: ${err.substring(0, 300)}`);
  }

  const data = await res.json();
  console.log('[ai-copy] Gemini raw response:', JSON.stringify(data).substring(0, 500));
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    // Log full response for debugging
    console.error('[ai-copy] Gemini unexpected response structure:', JSON.stringify(data));
    throw new Error('Gemini returned empty response');
  }
  return text;
}

// ─── Anthropic REST helper (fallback) ──────────────────────────────
async function callAnthropic(systemPrompt, userPrompt, maxTokens) {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY non configurata');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens || 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    })
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[ai-copy] Anthropic API error:', res.status, err);
    throw new Error(`Anthropic error ${res.status}: ${err.substring(0, 200)}`);
  }

  const data = await res.json();
  return data.content[0].text;
}

// ─── Unified AI call: Anthropic when configured, otherwise Gemini ─────────────
async function callAI(systemPrompt, userPrompt, maxTokens) {
  const provider = preferredAiProvider();
  const providers = provider === 'gemini' ? ['gemini', 'anthropic'] : ['anthropic', 'gemini'];
  const errors = [];

  for (const name of providers) {
    if (name === 'anthropic' && !ANTHROPIC_API_KEY) continue;
    if (name === 'gemini' && !GEMINI_API_KEY) continue;
    try {
      if (name === 'anthropic') {
        console.log(`[ai-copy] Using Anthropic Claude (${ANTHROPIC_MODEL})`);
        return await callAnthropic(systemPrompt, userPrompt, maxTokens);
      }
      console.log(`[ai-copy] Using Gemini (${GEMINI_MODEL})`);
      return await callGemini(systemPrompt, userPrompt);
    } catch (err) {
      console.warn(`[ai-copy] ${name} failed:`, err.message);
      errors.push(`${name}: ${err.message}`);
    }
  }

  throw new Error(errors.length
    ? `Nessun provider AI disponibile (${errors.join('; ')})`
    : 'Nessuna AI API configurata. Imposta ANTHROPIC_API_KEY o GEMINI_API_KEY.');
}

// ─── Extract JSON from AI response ─────────────────────────────────
function extractJSON(text) {
  // Try parsing as-is first (sometimes it's pure JSON)
  try { return JSON.parse(text.trim()); } catch (_) {}
  // Strip markdown code blocks: ```json ... ```
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) {
    try { return JSON.parse(codeBlock[1].trim()); } catch (_) {}
  }
  // Find first { ... } block
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('[ai-copy] Cannot extract JSON from:', text.substring(0, 300));
    throw new Error('AI response did not contain valid JSON');
  }
  return JSON.parse(jsonMatch[0]);
}

// ═══════════════════════════════════════════════════════════════════
// LANDING PAGE COPY
// ═══════════════════════════════════════════════════════════════════

const LANDING_SYSTEM_PROMPT = `Sei un copywriter esperto in conversioni mobile e growth marketing.
Il tuo compito è generare testi per una landing page di Apple Wallet Pass — una pagina dove l'utente atterra da un ad (social, display, search) e deve essere convinto a installare un pass nel proprio iPhone Wallet.

Il pass è uno strumento di comunicazione diretta: il brand può mandare notifiche push, aggiornare contenuti, offrire promozioni — tutto tramite il Wallet nativo di Apple, senza app.

REGOLE:
- Scrivi in italiano
- Tono: diretto, moderno, zero fuffa
- Headline: max 6 parole, impattante, con un beneficio chiaro
- Subheadline: max 12 parole, spiega cosa succede dopo l'install
- Claim: 1-2 frasi brevi che rafforzano la value proposition
- Button label: max 4 parole, azione chiara con senso di urgenza leggero
- NON usare emoji
- NON usare punti esclamativi eccessivi (max 1 in tutto)
- Evita "clicca qui", "scarica ora" — preferisci linguaggio naturale
- Pensa mobile-first: tutto deve funzionare su uno schermo piccolo

Rispondi SOLO con un JSON valido con questa struttura:
{
  "options": [
    {
      "headline": "...",
      "subheadline": "...",
      "claim": "...",
      "button_label": "..."
    }
  ]
}

Genera esattamente 3 opzioni diverse per stile e angolo comunicativo:
1. Benefit-driven (cosa ci guadagno?)
2. Curiosity-driven (cosa mi perdo?)
3. Social proof / exclusivity (fai parte del club)`;

async function generateLandingCopy(brandName, brandDescription) {
  const userPrompt = `Brand: ${brandName}
${brandDescription ? `Descrizione: ${brandDescription}` : 'Nessuna descrizione disponibile — genera copy generiche ma efficaci per un brand che usa Apple Wallet Pass come canale di comunicazione diretta.'}

Genera 3 opzioni di copy per la landing page di questo brand.`;

  const text = await callAI(LANDING_SYSTEM_PROMPT, userPrompt, 1024);
  const parsed = extractJSON(text);
  return parsed.options || [];
}

// ═══════════════════════════════════════════════════════════════════
// CREATIVE COPY (banner / video)
// ═══════════════════════════════════════════════════════════════════

const CREATIVE_SYSTEM_PROMPT = `Sei un direttore creativo di un'agenzia digitale top.
Il tuo compito è generare il concept creativo per un banner HTML5 animato o un video pubblicitario.
L'ad promuove un brand che usa Apple Wallet Pass come canale di comunicazione diretta con i clienti.

Dall'input dell'utente (un prompt creativo), genera:
1. Headline: max 5 parole, forte, memorabile
2. Subheadline: max 10 parole, spiega il valore
3. CTA: max 3 parole, call to action
4. Palette colori: background, testo, accent — coerenti con il mood
5. Image prompt: un prompt in INGLESE per generare un'immagine di sfondo con AI (stile fotografico, no testo nell'immagine)

REGOLE:
- Copy in italiano
- Image prompt SEMPRE in inglese, descrittivo, fotografico
- Colori in formato hex (#RRGGBB)
- Zero emoji, zero punti esclamativi
- Tono premium, moderno, diretto

Rispondi SOLO con JSON valido:
{
  "headline": "...",
  "subheadline": "...",
  "cta": "...",
  "colors": { "background": "#...", "text": "#...", "accent": "#..." },
  "image_prompt": "..."
}`;

async function generateCreativeCopy(brandName, prompt, type) {
  const userPrompt = `Brand: ${brandName}
Tipo creatività: ${type === 'video' ? 'Video pubblicitario (3-5 secondi)' : 'Banner HTML5 animato'}
Richiesta: ${prompt}

Genera il concept creativo completo.`;

  const text = await callAI(CREATIVE_SYSTEM_PROMPT, userPrompt, 512);
  return extractJSON(text);
}

module.exports = { generateLandingCopy, generateCreativeCopy, callAI, extractJSON };
