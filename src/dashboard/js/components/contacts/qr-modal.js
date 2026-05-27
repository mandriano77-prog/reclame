(function () {
  'use strict';

  let modalEl = null;
  let canvasHost = null;
  let urlInput = null;

  function ensureModal() {
    if (modalEl) return;
    modalEl = document.createElement('div');
    modalEl.id = 'contactsJoinQrModal';
    modalEl.className = 'contacts-qr-modal';
    modalEl.hidden = true;
    modalEl.innerHTML = `
      <div class="contacts-qr-modal__backdrop" data-close="1"></div>
      <div class="contacts-qr-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="contactsJoinQrTitle">
        <button type="button" class="contacts-qr-modal__close" data-close="1" aria-label="Chiudi">×</button>
        <h3 id="contactsJoinQrTitle" class="contacts-qr-modal__title">QR pagina Join</h3>
        <div class="contacts-qr-modal__canvas-wrap"><div id="contactsJoinQrCanvas"></div></div>
        <input type="text" id="contactsJoinQrUrl" class="contacts-qr-modal__url" readonly>
        <div class="contacts-qr-modal__actions">
          <button type="button" class="btn sec small" id="contactsJoinQrCopy">Copia link</button>
          <button type="button" class="btn sec small" id="contactsJoinQrPng">Download PNG</button>
          <button type="button" class="btn sec small" id="contactsJoinQrSvg">Download SVG</button>
        </div>
      </div>
    `;
    document.body.appendChild(modalEl);

    canvasHost = modalEl.querySelector('#contactsJoinQrCanvas');
    urlInput = modalEl.querySelector('#contactsJoinQrUrl');

    modalEl.addEventListener('click', function (e) {
      if (e.target.dataset.close) close();
    });

    modalEl.querySelector('#contactsJoinQrCopy').addEventListener('click', function () {
      const url = urlInput.value;
      if (!url) return;
      navigator.clipboard.writeText(url).then(function () {
        if (typeof toast === 'function') toast('Link copiato negli appunti');
      });
    });

    modalEl.querySelector('#contactsJoinQrPng').addEventListener('click', downloadPng);
    modalEl.querySelector('#contactsJoinQrSvg').addEventListener('click', downloadSvg);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modalEl && !modalEl.hidden) close();
    });
  }

  function renderQr(url) {
    canvasHost.innerHTML = '';
    if (typeof QRCode === 'undefined') {
      canvasHost.innerHTML = '<p>QR non disponibile</p>';
      return;
    }
    new QRCode(canvasHost, {
      text: url,
      width: 220,
      height: 220,
      colorDark: '#000000',
      colorLight: '#FFFFFF',
      correctLevel: QRCode.CorrectLevel.L
    });
  }

  function getCanvas() {
    return canvasHost.querySelector('canvas') || null;
  }

  function downloadPng() {
    const canvas = getCanvas();
    if (canvas) {
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = 'join-page-qr.png';
      a.click();
      return;
    }
    const img = canvasHost.querySelector('img');
    if (img) {
      const a = document.createElement('a');
      a.href = img.src;
      a.download = 'join-page-qr.png';
      a.click();
    }
  }

  function downloadSvg() {
    const canvas = getCanvas();
    if (!canvas) return;
    const size = canvas.width || 220;
    const dataUrl = canvas.toDataURL('image/png');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><image href="${dataUrl}" width="${size}" height="${size}"/></svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'join-page-qr.svg';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function open(url) {
    ensureModal();
    urlInput.value = url || '';
    renderQr(url);
    modalEl.hidden = false;
    modalEl.querySelector('.contacts-qr-modal__close').focus();
  }

  function close() {
    if (!modalEl) return;
    modalEl.hidden = true;
  }

  window.ContactsQrModal = {
    open,
    close
  };
})();
