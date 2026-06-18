'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'src/dashboard/index.html'), 'utf8');
const biCss = fs.readFileSync(path.join(root, 'src/dashboard/styles/a2w-brand-identity.css'), 'utf8');

test('brand identity traccia dirty state con baseline serializzato', () => {
  assert.match(indexHtml, /brandIdentityState\s*=\s*\{[\s\S]*dirty:\s*false[\s\S]*baseline:/);
  assert.match(indexHtml, /function a2wBiSerializeState\(/);
  assert.match(indexHtml, /brandIdentityState\.dirty = current !== brandIdentityState\.baseline/);
});

test('salva modifiche disabilitato quando pulito e abilitato solo se dirty', () => {
  assert.match(indexHtml, /function a2wBiRefreshSaveUi\(/);
  assert.match(indexHtml, /if \(brandIdentityState\.dirty\)/);
  assert.match(indexHtml, /btn\.disabled = false/);
  assert.match(indexHtml, /btn\.disabled = true[\s\S]*Nessuna modifica da salvare/);
});

test('badge riflette dirty, salvataggio e stato salvato relativo', () => {
  assert.match(indexHtml, /Modifiche non salvate/);
  assert.match(indexHtml, /Salvataggio…/);
  assert.match(indexHtml, /formatRelativeSavedLabel/);
  assert.match(indexHtml, /a2wBiStartSavedLabelTicker/);
  assert.match(indexHtml, /id="a2wBiSaveStateBadge"[^>]*aria-live="polite"/);
});

test('css distingue bottone salvataggio inattivo vs dirty attivo', () => {
  assert.match(biCss, /\.a2w-bi-save-btn:disabled:not\(\.is-saving\)/);
  assert.match(biCss, /\.a2w-bi-save-btn\.is-dirty:not\(:disabled\)/);
  assert.match(biCss, /--a2w-action-primary/);
});

test('brand identity mostra riepilogo identità senza anteprima pass wallet', () => {
  assert.match(indexHtml, /a2w-bi-identity-summary/);
  assert.match(indexHtml, /a2wBiSummaryName/);
  assert.match(indexHtml, /a2wBiSummarySettore/);
  assert.match(indexHtml, /Il design dei pass si configura in/);
  assert.match(indexHtml, /onclick="nav\('templates'\)">Template Pass/);
  assert.doesNotMatch(indexHtml, /a2w-bi-preview-tabs/);
  assert.doesNotMatch(indexHtml, /a2w-bi-pass-preview/);
  assert.doesNotMatch(indexHtml, /Apple Wallet[\s\S]{0,80}a2wBiPreviewCard/);
  assert.match(biCss, /\.a2w-bi-identity-summary/);
  assert.doesNotMatch(biCss, /\.a2w-bi-pass-preview/);
  assert.match(biCss, /\.a2w-bi-identity-summary__initial\[hidden\][\s\S]*display:\s*none\s*!important/);
  assert.match(biCss, /\.a2w-bi-identity-summary__logo\[hidden\][\s\S]*display:\s*none\s*!important/);
});

test('brand identity layout: form due colonne e riepilogo collassabile in fondo', () => {
  assert.match(indexHtml, /id="a2wBiSummaryDisclosure"/);
  assert.match(indexHtml, /a2w-bi-summary-disclosure/);
  assert.doesNotMatch(indexHtml, /id="a2wBiPreviewMobileToggle"/);
  assert.match(biCss, /\.a2w-bi-main[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(biCss, /\.a2w-bi-layout[\s\S]*flex-direction:\s*column/);
  assert.match(biCss, /\.a2w-bi-summary-disclosure/);
  assert.match(biCss, /\.a2w-bi-danger-zone[\s\S]*grid-column:\s*1\s*\/\s*-1/);
  assert.match(indexHtml, /a2wBiSummaryDisclosure[\s\S]*addEventListener\('toggle'/);
});

test('brand identity asset slots: compact library picker senza upload inline', () => {
  assert.match(indexHtml, /a2w-bi-asset-slot/);
  assert.match(indexHtml, /Scegli da libreria/);
  assert.match(indexHtml, /a2wBiBindAssetSlotActions/);
  assert.doesNotMatch(indexHtml, /a2wBiAssetBrowseBtn/);
  assert.doesNotMatch(indexHtml, /a2wBiAssetUploadInput/);
  assert.doesNotMatch(indexHtml, /a2w-bi-asset-dropzone/);
  assert.doesNotMatch(indexHtml, /function a2wBiBindAssetDropzone/);
  assert.doesNotMatch(indexHtml, /function a2wBiUploadAsset/);
  assert.match(biCss, /\.a2w-bi-asset-slot/);
  assert.match(biCss, /max-width:\s*1200px/);
  assert.match(biCss, /\.a2w-bi-section--assets[\s\S]*grid-column:\s*1\s*\/\s*-1/);
  assert.match(indexHtml, /a2w-bi-section--assets/);
  assert.match(indexHtml, /Seleziona gli asset dalla Media Library/);
});

test('media library include bucket wallet_icon', () => {
  assert.match(indexHtml, /id="mediaWalletIconGrid"/);
  assert.match(indexHtml, /512×512 px/);
  assert.match(indexHtml, /data-type="wallet_icon"/);
  assert.match(indexHtml, /<option value="wallet_icon">Icona notifiche Wallet<\/option>/);
});
