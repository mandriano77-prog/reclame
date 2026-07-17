'use strict';

// Le ombre di tokens.css sono nero al 4–8%: calibrate su una pagina bianca, dove bastano.
// Su un canvas #0A0908 il nero all'8% è matematicamente invisibile — e infatti modali,
// toast e pannelli non si staccavano dalla pagina: sembravano incassati, non sopra.
// Nel buio serve più opacità, più raggio e un filo di luce sul bordo.
// Che il valore giusto fosse noto lo dimostra dialog.css, che scrive l'ombra buona come
// FALLBACK di --shadow-lg — fallback che non è mai scattato, perché il token era definito.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const rm = fs.readFileSync(path.join(root, 'src/dashboard/styles/rm-tokens.css'), 'utf8');
const tokens = fs.readFileSync(path.join(root, 'src/dashboard/styles/tokens.css'), 'utf8');

function alphaPrimoStrato(css, nome) {
  const m = css.match(new RegExp('--' + nome + ':\\s*([^;]+);'));
  if (!m) return null;
  const a = m[1].match(/rgba\([^)]*?,\s*([\d.]+)\)/);
  return a ? parseFloat(a[1]) : null;
}

test('il tema scuro ha ombre sue, non quelle della pagina bianca', () => {
  // rm-tokens è il posto dove vive il tema scuro (html[data-shell="dark"].a2w-shell)
  assert.match(rm, /--shadow-sm:/);
  assert.match(rm, /--shadow-md:/);
  assert.match(rm, /--shadow-lg:/);
});

test('sono abbastanza forti da vedersi sul nero', () => {
  for (const n of ['shadow-sm', 'shadow-md', 'shadow-lg']) {
    const chiara = alphaPrimoStrato(tokens, n);
    const scura = alphaPrimoStrato(rm, n);
    assert.ok(chiara !== null && scura !== null, `${n} definita in entrambe`);
    assert.ok(scura > chiara * 3, `${n}: ${scura} deve essere molto più densa di ${chiara} (pagina bianca)`);
  }
});

test("l'elevazione non porta un bordo con sé", () => {
  // Un anello dentro --shadow-lg disegnava un secondo bordo grigio attorno al pannello
  // W.AI, che un bordo colorato ce l'ha già: ammorbidiva lo spigolo scelto apposta.
  // Un'elevazione non è un bordo. Chi non ha un bordo se lo dichiara.
  assert.doesNotMatch(rm, /--shadow-lg:[\s\S]*?0 0 0 1px/);
  assert.match(rm, /html\[data-shell="dark"\]\.a2w-shell \.confirm-dialog \{[\s\S]*?border: 1px solid/);
});

test('la stessa card KPI ha lo stesso aspetto in ogni sezione', () => {
  // Era 8px/24px di base e 16px/16px dentro .a2w-stats-grid — classe che ricevono solo
  // Contatti e Analytics (js/a2w-shell.js). Le KPI di Commerciale e Pass Emessi erano
  // quindi visibilmente diverse dalle altre, cambiando sezione.
  const indexHtml = fs.readFileSync(path.join(root, 'src/dashboard/index.html'), 'utf8');
  const base = indexHtml.match(/\n\s*\.stat-card \{[\s\S]*?\n\s*\}/);
  assert.ok(base, 'regola base trovata');
  assert.match(base[0], /border-radius: var\(--a2w-radius-card, var\(--radius-lg\)\)/);
  assert.match(base[0], /padding: var\(--space-4\)/);
  // il ripiego copre le shell scure senza tema di prodotto. FiloDiretto non ci arriva:
  // stat-card.css lo intercetta prima con più specificità, e aveva già questi valori.
  const tok = fs.readFileSync(path.join(root, 'src/dashboard/styles/tokens.css'), 'utf8');
  assert.doesNotMatch(tok, /--a2w-radius-card/);
  assert.match(rm, /--a2w-radius-card: 16px;/);
  const fd = fs.readFileSync(path.join(root, 'src/dashboard/css/components/stat-card.css'), 'utf8');
  assert.match(fd, /html\[data-shell="light"\] \.stat-card \{[\s\S]*?border-radius: var\(--radius-md\)/);
});

test('il numero della KPI è grande in ogni sezione, non solo in alcune', () => {
  // Il difetto vero, che il test qui sopra prometteva e non verificava: .stat-num — la
  // variante usata da Commerciale e Audiences — non aveva regola base. Era stilata solo
  // per la shell chiara e solo dentro #leadsStats, quindi nel tema scuro cadeva sul testo
  // di pagina: 14px/400, grande quanto la propria etichetta (12px/500). Gerarchia zero.
  // Unificare raggio e padding lo peggiorava: toglieva l'ultimo indizio che quelle card
  // fossero un componente diverso.
  const indexHtml = fs.readFileSync(path.join(root, 'src/dashboard/index.html'), 'utf8');
  assert.match(indexHtml, /\.stat-value, \.stat-num \{ font-size: var\(--text-2xl\); font-weight: 600;/);
  // e il markup che la usa esiste davvero (Commerciale, Audiences)
  assert.match(indexHtml, /class="stat-num"/);
});
