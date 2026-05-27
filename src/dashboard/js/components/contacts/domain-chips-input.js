(function () {
  'use strict';

  function renderDomainChipsInput(options) {
    const cfg = options || {};
    const host = cfg.host;
    if (!host) return null;

    let domains = Array.isArray(cfg.domains || cfg.values) ? (cfg.domains || cfg.values).slice() : [];
    let selectedIndex = -1;

    host.classList.add('contacts-domain-chips');
    host.innerHTML = `
      <div class="contacts-domain-chips__wrap" tabindex="0" role="group" aria-label="Domini email ammessi">
        <div class="contacts-domain-chips__list"></div>
        <input
          type="text"
          class="contacts-domain-chips__input"
          placeholder="${cfg.placeholder || 'aggiungi dominio e premi Invio'}"
          aria-describedby="${cfg.helperId || 'contactsDomainHelper'}"
          autocomplete="off"
        >
      </div>
      <p class="contacts-domain-chips__helper" id="${cfg.helperId || 'contactsDomainHelper'}">Solo email con questi domini potranno registrarsi.</p>
      <p class="contacts-domain-chips__warn" hidden>Senza domini, qualunque email può registrarsi. Procedi solo se è voluto.</p>
    `;

    const listEl = host.querySelector('.contacts-domain-chips__list');
    const inputEl = host.querySelector('.contacts-domain-chips__input');
    const warnEl = host.querySelector('.contacts-domain-chips__warn');

    function emitChange() {
      if (typeof cfg.onChange === 'function') cfg.onChange(domains.slice());
      warnEl.hidden = domains.length > 0;
    }

    function renderChips() {
      listEl.innerHTML = domains.map(function (domain, index) {
        const selected = index === selectedIndex ? ' is-selected' : '';
        return `<button type="button" class="contacts-domain-chips__chip${selected}" data-index="${index}" aria-label="Rimuovi dominio ${domain}">${domain}<span aria-hidden="true">×</span></button>`;
      }).join('');
    }

    function addDomain(raw) {
      const parts = String(raw || '').split(/[,;\s]+/).map(function (p) { return p.trim(); }).filter(Boolean);
      let changed = false;
      parts.forEach(function (part) {
        const validate = window.ContactsValidation && window.ContactsValidation.validateDomain;
        const result = validate ? validate(part) : { valid: !!part, domain: part };
        if (!result.valid || !result.domain) return;
        if (domains.includes(result.domain)) return;
        domains.push(result.domain);
        changed = true;
      });
      if (changed) {
        selectedIndex = -1;
        renderChips();
        emitChange();
      }
    }

    function removeAt(index) {
      if (index < 0 || index >= domains.length) return;
      domains.splice(index, 1);
      selectedIndex = Math.min(selectedIndex, domains.length - 1);
      renderChips();
      emitChange();
    }

    listEl.addEventListener('click', function (e) {
      const chip = e.target.closest('.contacts-domain-chips__chip');
      if (!chip) return;
      removeAt(Number(chip.dataset.index));
    });

    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        if (inputEl.value.trim()) {
          addDomain(inputEl.value);
          inputEl.value = '';
        }
        return;
      }
      if (e.key === 'Backspace' && !inputEl.value && domains.length) {
        if (selectedIndex >= 0) removeAt(selectedIndex);
        else {
          selectedIndex = domains.length - 1;
          renderChips();
        }
        return;
      }
      if (e.key === 'ArrowLeft' && !inputEl.value && domains.length) {
        e.preventDefault();
        selectedIndex = selectedIndex <= 0 ? 0 : selectedIndex - 1;
        renderChips();
        return;
      }
      if (e.key === 'ArrowRight' && !inputEl.value && domains.length) {
        e.preventDefault();
        selectedIndex = selectedIndex >= domains.length - 1 ? domains.length - 1 : selectedIndex + 1;
        renderChips();
      }
    });

    inputEl.addEventListener('input', function () {
      selectedIndex = -1;
      renderChips();
    });

    inputEl.addEventListener('blur', function () {
      if (inputEl.value.trim()) {
        addDomain(inputEl.value);
        inputEl.value = '';
      }
    });

    renderChips();
    emitChange();

    return {
      getDomains: function () { return domains.slice(); },
      getValues: function () { return domains.slice(); },
      setDomains: function (next) {
        domains = Array.isArray(next) ? next.slice() : [];
        selectedIndex = -1;
        renderChips();
        emitChange();
      },
      setValues: function (next) {
        domains = Array.isArray(next) ? next.slice() : [];
        selectedIndex = -1;
        renderChips();
        emitChange();
      },
      focus: function () { inputEl.focus(); }
    };
  }

  window.DomainChipsInput = {
    render: renderDomainChipsInput
  };
})();
