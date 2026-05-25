(function () {
  'use strict';

  function renderContactsToolbar(options) {
    const cfg = options || {};
    const host = cfg.host;
    if (!host) return;

    host.innerHTML = `
      <input
        type="text"
        id="leadsSearch"
        class="contacts-toolbar__search leads-toolbar__search"
        placeholder="${cfg.searchPlaceholder || 'Cerca nome, matricola, email...'}"
        aria-label="Ricerca anagrafica dipendenti"
      >
      <div class="contacts-toolbar__actions" role="group" aria-label="Azioni anagrafica">
        <button type="button" class="btn sec" id="leadsAddBtn" style="display:none;white-space:nowrap;">+ Aggiungi</button>
        <button type="button" class="btn sec" id="leadsImportBtn" style="display:none;white-space:nowrap;">✨ Importa da file</button>
        <button type="button" class="btn sec" id="leadsDistributeBtn" style="display:none;white-space:nowrap;">✉ Invia attivazione</button>
        <button type="button" class="btn sec" id="leadsExportBtn" style="white-space:nowrap;">⬇ Export CSV</button>
      </div>
    `;

    const searchInput = host.querySelector('#leadsSearch');
    if (searchInput && typeof cfg.onSearchInput === 'function') {
      searchInput.addEventListener('input', cfg.onSearchInput);
    }

    const addBtn = host.querySelector('#leadsAddBtn');
    if (addBtn && typeof cfg.onAdd === 'function') {
      addBtn.addEventListener('click', cfg.onAdd);
    }

    const importBtn = host.querySelector('#leadsImportBtn');
    if (importBtn && typeof cfg.onImport === 'function') {
      importBtn.addEventListener('click', cfg.onImport);
    }

    const distributeBtn = host.querySelector('#leadsDistributeBtn');
    if (distributeBtn && typeof cfg.onDistribute === 'function') {
      distributeBtn.addEventListener('click', cfg.onDistribute);
    }

    const exportBtn = host.querySelector('#leadsExportBtn');
    if (exportBtn && typeof cfg.onExport === 'function') {
      exportBtn.addEventListener('click', cfg.onExport);
    }
  }

  window.ContactsToolbar = {
    render: renderContactsToolbar
  };
})();
