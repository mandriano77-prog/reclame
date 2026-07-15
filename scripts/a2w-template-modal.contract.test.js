'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'src/dashboard/index.html'), 'utf8');
const tplEditor = fs.readFileSync(path.join(root, 'src/dashboard/js/a2w-template-editor.js'), 'utf8');
const tplCss = fs.readFileSync(path.join(root, 'src/dashboard/styles/a2w-template-modal.css'), 'utf8');

const modalStart = indexHtml.indexOf('id="templateModal"');
const modalEndMarker = '<!-- Strip Promo Modal -->';
const modalEnd = indexHtml.indexOf(modalEndMarker, modalStart);
const modalBlock = modalEnd > modalStart
  ? indexHtml.slice(modalStart, modalEnd)
  : indexHtml.slice(modalStart, modalStart + 20000);

test('STEP 4–5: template modal wired with sticky layout and front/back toggle', () => {
  assert.match(indexHtml, /a2w-template-modal\.css/);
  assert.match(indexHtml, /a2w-template-editor\.js/);
  assert.match(modalBlock, /a2w-tpl-modal/);
  assert.match(modalBlock, /a2w-tpl-modal__header/);
  assert.match(modalBlock, /a2w-tpl-modal__body/);
  assert.match(modalBlock, /a2w-tpl-modal__footer/);
  assert.match(modalBlock, /a2w-tpl-preview-toggle/);
  assert.match(modalBlock, /data-tpl-face="front"/);
  assert.match(modalBlock, /data-tpl-face="back"/);
  assert.doesNotMatch(modalBlock, /Passa il mouse per vedere il retro/);
  assert.match(tplCss, /a2w-tpl-show-back/);
  assert.match(tplEditor, /setPreviewFace/);
});

test('STEP 5: pass preview DOM has strip wrap and no overlapping absolute header', () => {
  assert.match(modalBlock, /pp-strip-wrap/);
  assert.match(modalBlock, /pp-front-main/);
  assert.match(modalBlock, /id="tplPassFlip"/);
  assert.match(tplCss, /pp-strip-wrap/);
  assert.match(tplCss, /pp-front-main/);
});

test('STEP 6: unified upload zones sync from style.images and media library', () => {
  assert.match(tplEditor, /a2wApplyTplStyleImages/);
  assert.match(tplEditor, /persistedImages/);
  assert.match(tplEditor, /ensurePreviewImg/);
  assert.match(tplEditor, /syncAllTplUploadZones/);
  assert.match(tplEditor, /patchTplPickFromMedia/);
  assert.match(indexHtml, /a2wApplyTplStyleImages\(existingImages\)/);
});

test('STEP 7: palette SOLO automatica dal logo (nessun override manuale)', () => {
  assert.match(modalBlock, /id="tplColorsSection"/);
  assert.match(modalBlock, /id="tplPaletteAutoBlock"/);
  assert.match(modalBlock, /id="tplPaletteSwatches"/);
  // gli input colore restano (nascosti) per alimentare anteprima + salvataggio
  assert.match(modalBlock, /id="tplColorBg"/);
  // ma NIENTE UI per modificarli a mano: rimossi il toggle e il blocco manuale
  assert.doesNotMatch(modalBlock, /id="tplPaletteCustomizeBtn"/);
  assert.doesNotMatch(modalBlock, /Personalizza colori/);
  assert.doesNotMatch(modalBlock, /id="tplPaletteManualBlock"/);
  assert.doesNotMatch(modalBlock, /id="tplPaletteRestoreAutoBtn"/);
  assert.match(tplEditor, /loadBrandPaletteForTemplate/);
  assert.match(tplEditor, /getTemplatePreviewColors/);
  assert.match(tplEditor, /applyPreviewColors/);
});

test('STEP 7a: il template non fissa mai i colori a mano (comanda sempre il logo del brand)', () => {
  assert.match(tplEditor, /a2wIsTplManualPaletteOn/);
  assert.match(indexHtml, /a2wIsTplManualPaletteOn/);
  assert.match(indexHtml, /delete styleBase\.backgroundColor/);
  assert.match(indexHtml, /delete styleBase\.foregroundColor/);
  assert.match(indexHtml, /delete styleBase\.labelColor/);
  // il percorso di scrittura palette manuale è stato rimosso del tutto
  assert.doesNotMatch(tplEditor, /palette_source = 'manual'/);
  assert.doesNotMatch(tplEditor, /persistManualBrandPaletteIfNeeded/);
  // e un brand rimasto in manuale viene auto-rigenerato dal logo all'apertura
  assert.match(tplEditor, /isManualBrandPalette\(brandPaletteCache\)/);
  assert.match(tplEditor, /restoreAutoBrandPalette/);
});

test('STEP 7b: wallet notification icon in template modal (Ads shell)', () => {
  assert.match(modalBlock, /id="tplImgWalletIconRow"/);
  assert.match(modalBlock, /Icona notifica/);
  assert.match(indexHtml, /isTplWalletIconUiEnabled/);
  assert.match(indexHtml, /persistHrWalletIcon/);
});

test('STEP 8: save button in footer with async feedback', () => {
  assert.match(modalBlock, /id="tplSaveBtn"/);
  assert.match(modalBlock, /id="tplSaveStatus"/);
  assert.match(tplEditor, /patchSaveTemplate/);
  assert.match(tplEditor, /setSaveStatus/);
  assert.match(indexHtml, /throw new Error\('Nome template obbligatorio'\)/);
  assert.match(indexHtml, /throw new Error\(msg\)/);
});
