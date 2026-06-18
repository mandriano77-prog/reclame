/**
 * FiloDiretto — associa label↔campi e alt mancanti nelle viste HR.
 */
(function () {
  'use strict';

  function isHr() {
    return document.documentElement.getAttribute('data-app') === 'filodiretto';
  }

  function wireFormLabels(root) {
    if (!root) return;
    root.querySelectorAll('.form-group').forEach(function (group) {
      var label = group.querySelector(':scope > label.form-label, :scope > .form-row > label.form-label');
      if (!label) return;
      var control = group.querySelector('input:not([type="hidden"]), select, textarea');
      if (!control) return;
      if (!control.id) {
        var base = (control.name || control.type || 'field').replace(/\W+/g, '-').slice(0, 24);
        control.id = 'fd-auto-' + base + '-' + Math.random().toString(36).slice(2, 7);
      }
      if (!label.getAttribute('for')) label.setAttribute('for', control.id);
      if (!control.getAttribute('aria-label') && label.textContent) {
        var text = label.textContent.replace(/[ⓘ*]/g, '').trim();
        if (text) control.setAttribute('aria-label', text);
      }
    });
  }

  function fixPreviewImages(root) {
    if (!root) return;
    var alts = {
      tplImgLogoPreview: 'Anteprima logo template',
      tplImgWalletIconPreview: 'Anteprima icona wallet',
      tplImgStripPreview: 'Anteprima strip template',
      tplImgThumbPreview: 'Anteprima thumbnail template',
      tplImgBgPreview: 'Anteprima sfondo template',
      bsLogoPreview: 'Anteprima logo brand',
      bsStripPreview: 'Anteprima strip brand',
      wzLogoPreview: 'Anteprima logo wizard'
    };
    Object.keys(alts).forEach(function (id) {
      var img = root.querySelector('#' + id);
      if (img && !img.hasAttribute('alt')) img.setAttribute('alt', alts[id]);
    });
    root.querySelectorAll('img:not([alt])').forEach(function (img) {
      if (img.closest('.pass-preview, .wallet-preview, [aria-hidden="true"]')) {
        img.setAttribute('alt', '');
      } else {
        img.setAttribute('alt', 'Immagine');
      }
    });
  }

  function enhanceConfirmDialogA11y() {
    var dlg = document.getElementById('appConfirmDialog');
    if (!dlg) return;
    dlg.setAttribute('role', 'dialog');
    dlg.setAttribute('aria-modal', 'true');
  }

  function ensureGlobalLiveRegion() {
    if (document.getElementById('fdGlobalAriaLive')) return;
    var node = document.createElement('div');
    node.id = 'fdGlobalAriaLive';
    node.className = 'sr-only';
    node.setAttribute('aria-live', 'polite');
    node.setAttribute('aria-atomic', 'true');
    document.body.appendChild(node);
  }

  function run() {
    if (!isHr()) return;
    var main = document.getElementById('main-content') || document.body;
    wireFormLabels(main);
    fixPreviewImages(main);
    enhanceConfirmDialogA11y();
    ensureGlobalLiveRegion();
    if (typeof window.fdEnhanceLoadingRegions === 'function') {
      window.fdEnhanceLoadingRegions(main);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
  window.fdWireFormA11y = run;
})();
