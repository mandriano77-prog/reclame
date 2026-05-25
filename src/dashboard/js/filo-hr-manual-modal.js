/**
 * FiloDiretto HR — modale Aggiungi dipendente (PR-A + PR-B).
 * Namespace unico: filoHrContatti.manualModal
 */
(function (global) {
  'use strict';

  var COPY = {
    queueEmpty: 'Nessun dipendente in coda. Compila il form e clicca Aggiungi alla lista.',
    matricolaHint: 'Identificativo univoco del dipendente',
    emailHint: 'Consigliata per inviare il link di attivazione pass',
    requiredNote: 'I campi con * sono obbligatori',
    matricolaRequired: 'Matricola obbligatoria',
    matricolaDup: 'Matricola già in coda',
    matricolaTaken: 'Matricola già assegnata a un dipendente',
    emailInvalid: 'Email non valida',
    saveTooltip: 'Aggiungi almeno un dipendente alla lista',
    sendActivationTooltip: 'Inserisci email per inviare l\'attivazione',
    discardTitle: 'Modifiche non salvate',
    discardMsg: 'Hai modifiche non salvate. Vuoi davvero chiudere?',
    discardStay: 'Mantieni in modifica',
    discardLeave: 'Esci senza salvare',
    saving: 'Salvataggio…'
  };

  var ICONS = {
  plus: '<path d="M10 5v10M5 10h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  x: '<path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  'alert-circle': '<circle cx="10" cy="10" r="7.5" stroke="currentColor" stroke-width="1.5"/><path d="M10 7v4M10 14h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  check: '<path d="M6 10.5l2.5 2.5L14 7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  loader: '<path d="M10 3a7 7 0 107 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  edit: '<path d="M12.5 4.5l1 1L7 12H5v-2l6.5-6.5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>'
  };

  var FIELD_OPTIONS_TTL_MS = 5 * 60 * 1000;
  var MATRICOLA_DEBOUNCE_MS = 400;

  var COMBO_FIELDS = [
    { inputId: 'manualDepartment', listId: 'filoManualDeptList', key: 'departments' },
    { inputId: 'manualOffice', listId: 'filoManualOfficeList', key: 'sites' },
    { inputId: 'manualManagerEmail', listId: 'filoManualManagerList', key: 'manager_emails' }
  ];

  var state = {
    queue: [],
    bound: false,
    focusReturn: null,
    trapHandler: null,
    keyHandler: null,
    backdropHandler: null,
    fieldHandlers: [],
    dirty: false,
    saving: false,
    fieldOptionsCache: { data: null, ts: 0, failed: false },
    matricolaTouched: false,
    matricolaCheckTimer: null,
    matricolaCheckAbort: null,
    matricolaServerAvailable: null,
    matricolaChecking: false
  };

  function resolveBrandId() {
    if (global.brandId) return global.brandId;
    if (typeof global.ensureBrandIdFromContext === 'function') {
      return global.ensureBrandIdFromContext();
    }
    var sel = global.document && global.document.getElementById('brandSelector');
    if (sel && sel.value) return sel.value;
    try {
      var qp = new URLSearchParams(global.location.search).get('brand_id');
      return qp || null;
    } catch (_) {
      return null;
    }
  }

  function resolveApiBase() {
    if (typeof global.API === 'string' && global.API.trim()) return global.API.trim();
    return '/api/v1';
  }

  function deps() {
    return {
      isFiloShell: typeof global.isFiloShell === 'function' ? global.isFiloShell : function () { return false; },
      isHrBrandContext: typeof global.isHrBrandContext === 'function' ? global.isHrBrandContext : function () { return false; },
      brandId: resolveBrandId(),
      API: resolveApiBase(),
      getAuthHeaders: global.getAuthHeaders,
      getDashboardFetchHeaders: global.getDashboardFetchHeaders,
      fetchCachedJson: global.fetchCachedJson,
      toast: global.toast,
      esc: global.esc,
      loadLeads: global.loadLeads
    };
  }

  function isEnabled() {
    var d = deps();
    return d.isFiloShell() && d.isHrBrandContext();
  }

  function el(id) {
    return document.getElementById(id);
  }

  function icon(name, decorative) {
    var wrap = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    wrap.setAttribute('width', '20');
    wrap.setAttribute('height', '20');
    wrap.setAttribute('viewBox', '0 0 20 20');
    wrap.setAttribute('fill', 'none');
    wrap.innerHTML = ICONS[name] || '';
    if (decorative) wrap.setAttribute('aria-hidden', 'true');
    return wrap;
  }

  function setDirty(v) {
    state.dirty = !!v;
  }

  function markDirtyFromInput() {
    setDirty(true);
  }

  function readForm() {
    return {
      employee_id: (el('manualEmployeeId') && el('manualEmployeeId').value || '').trim(),
      first_name: (el('manualFirstName') && el('manualFirstName').value || '').trim(),
      last_name: (el('manualLastName') && el('manualLastName').value || '').trim(),
      email: (el('manualEmail') && el('manualEmail').value || '').trim().toLowerCase(),
      department: (el('manualDepartment') && el('manualDepartment').value || '').trim(),
      office_location: (el('manualOffice') && el('manualOffice').value || '').trim(),
      hire_date: el('manualHireDate') ? el('manualHireDate').value : '',
      manager_email: (el('manualManagerEmail') && el('manualManagerEmail').value || '').trim()
    };
  }

  function resetMatricolaCheckState() {
    if (state.matricolaCheckTimer) {
      clearTimeout(state.matricolaCheckTimer);
      state.matricolaCheckTimer = null;
    }
    if (state.matricolaCheckAbort) {
      state.matricolaCheckAbort.abort();
      state.matricolaCheckAbort = null;
    }
    state.matricolaServerAvailable = null;
    state.matricolaChecking = false;
  }

  function clearForm() {
    ['manualEmployeeId', 'manualEmail', 'manualFirstName', 'manualLastName', 'manualDepartment', 'manualOffice', 'manualHireDate', 'manualManagerEmail'].forEach(function (id) {
      var node = el(id);
      if (node) node.value = '';
    });
    resetMatricolaCheckState();
    clearFieldErrors();
  }

  function removeDatalist(listId) {
    var existing = el(listId);
    if (existing) existing.remove();
  }

  function wireCombobox(inputId, listId, values) {
    var input = el(inputId);
    if (!input) return;
    removeDatalist(listId);
    if (!values || !values.length) {
      input.removeAttribute('list');
      return;
    }
    var dl = document.createElement('datalist');
    dl.id = listId;
    values.forEach(function (v) {
      var opt = document.createElement('option');
      opt.value = v;
      dl.appendChild(opt);
    });
    var modal = el('employeeManualModal');
    if (modal) modal.appendChild(dl);
    input.setAttribute('list', listId);
    input.setAttribute('autocomplete', 'off');
  }

  function removeFieldOptionComboboxes() {
    COMBO_FIELDS.forEach(function (cfg) {
      var input = el(cfg.inputId);
      if (input) input.removeAttribute('list');
      removeDatalist(cfg.listId);
    });
  }

  function applyFieldOptions(opts) {
    if (!opts) {
      removeFieldOptionComboboxes();
      return;
    }
    COMBO_FIELDS.forEach(function (cfg) {
      wireCombobox(cfg.inputId, cfg.listId, opts[cfg.key] || []);
    });
  }

  async function fetchFieldOptions() {
    var d = deps();
    if (!d.brandId) return;
    var now = Date.now();
    var cache = state.fieldOptionsCache;
    if (cache.data && (now - cache.ts) < FIELD_OPTIONS_TTL_MS) {
      applyFieldOptions(cache.data);
      return;
    }
    try {
      var res = await fetch(d.API + '/brands/' + d.brandId + '/employee-field-options', {
        headers: Object.assign({}, d.getAuthHeaders())
      });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || 'field-options');
      cache.data = data;
      cache.ts = now;
      cache.failed = false;
      applyFieldOptions(data);
    } catch (_) {
      cache.failed = true;
      removeFieldOptionComboboxes();
    }
  }

  function touchMatricolaField() {
    state.matricolaTouched = true;
  }

  function scheduleMatricolaCheck() {
    if (!state.matricolaTouched) return;
    var val = (el('manualEmployeeId') && el('manualEmployeeId').value || '').trim();
    if (state.matricolaCheckTimer) clearTimeout(state.matricolaCheckTimer);
    state.matricolaCheckTimer = setTimeout(function () {
      state.matricolaCheckTimer = null;
      runMatricolaCheck(val);
    }, MATRICOLA_DEBOUNCE_MS);
  }

  async function runMatricolaCheck(value) {
    var d = deps();
    if (!d.brandId || !state.matricolaTouched) return;
    if (!value) {
      state.matricolaServerAvailable = null;
      resetMatricolaCheckState();
      return;
    }
    if (state.queue.some(function (q) { return String(q.employee_id).toLowerCase() === value.toLowerCase(); })) {
      state.matricolaServerAvailable = null;
      return;
    }
    if (state.matricolaCheckAbort) state.matricolaCheckAbort.abort();
    var ac = new AbortController();
    state.matricolaCheckAbort = ac;
    state.matricolaChecking = true;
    try {
      var url = d.API + '/brands/' + d.brandId + '/employees/check-matricola?value=' + encodeURIComponent(value);
      var res = await fetch(url, {
        headers: Object.assign({}, d.getAuthHeaders()),
        signal: ac.signal
      });
      var data = await res.json();
      if (ac.signal.aborted) return;
      if (!res.ok) throw new Error(data.error || 'check-matricola');
      var current = (el('manualEmployeeId') && el('manualEmployeeId').value || '').trim();
      if (current.toLowerCase() !== value.toLowerCase()) return;
      state.matricolaServerAvailable = !!data.available;
      if (data.available) {
        if (current) showFieldSuccess('manualEmployeeId');
      } else {
        showFieldError('manualEmployeeId', COPY.matricolaTaken);
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      state.matricolaServerAvailable = null;
    } finally {
      if (state.matricolaCheckAbort === ac) state.matricolaCheckAbort = null;
      state.matricolaChecking = false;
    }
  }

  function clearFieldErrors() {
    var modal = el('employeeManualModal');
    if (!modal) return;
    modal.querySelectorAll('.form-group.filo-hr-field--error, .form-group.filo-hr-field--success').forEach(function (g) {
      g.classList.remove('filo-hr-field--error', 'filo-hr-field--success');
    });
    modal.querySelectorAll('.filo-hr-field-hint--error').forEach(function (h) { h.remove(); });
    modal.querySelectorAll('.filo-hr-field-icon').forEach(function (i) { i.remove(); });
  }

  function showFieldError(fieldId, message) {
    var input = el(fieldId);
    if (!input) return;
    var group = input.closest('.form-group');
    if (!group) return;
    group.classList.add('filo-hr-field--error');
    group.classList.remove('filo-hr-field--success');
    var old = group.querySelector('.filo-hr-field-hint--error');
    if (old) old.remove();
    var hint = document.createElement('p');
    hint.className = 'filo-hr-field-hint filo-hr-field-hint--error';
    hint.id = fieldId + '-error';
    hint.setAttribute('role', 'alert');
    var ic = icon('alert-circle', true);
    hint.appendChild(ic);
    hint.appendChild(document.createTextNode(' ' + message));
    group.appendChild(hint);
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', hint.id);
  }

  function showFieldSuccess(fieldId) {
    var input = el(fieldId);
    if (!input) return;
    var group = input.closest('.form-group');
    if (!group) return;
    group.classList.remove('filo-hr-field--error');
    group.classList.add('filo-hr-field--success');
    var err = group.querySelector('.filo-hr-field-hint--error');
    if (err) err.remove();
    input.removeAttribute('aria-invalid');
  }

  function validateMatricolaField() {
    var emp = readForm();
    if (!emp.employee_id) {
      showFieldError('manualEmployeeId', COPY.matricolaRequired);
      return false;
    }
    if (state.queue.some(function (q) { return String(q.employee_id).toLowerCase() === emp.employee_id.toLowerCase(); })) {
      showFieldError('manualEmployeeId', COPY.matricolaDup);
      return false;
    }
    if (state.matricolaTouched && state.matricolaServerAvailable === false) {
      showFieldError('manualEmployeeId', COPY.matricolaTaken);
      return false;
    }
    showFieldSuccess('manualEmployeeId');
    return true;
  }

  function validateEmailField() {
    var emp = readForm();
    if (!emp.email) {
      var group = el('manualEmail') && el('manualEmail').closest('.form-group');
      if (group) {
        group.classList.remove('filo-hr-field--error', 'filo-hr-field--success');
        var err = group.querySelector('.filo-hr-field-hint--error');
        if (err) err.remove();
      }
      return true;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emp.email)) {
      showFieldError('manualEmail', COPY.emailInvalid);
      return false;
    }
    showFieldSuccess('manualEmail');
    return true;
  }

  function validateFormForQueue() {
    var okM = validateMatricolaField();
    var okE = validateEmailField();
    return okM && okE;
  }

  function togglePassOptions() {
    var on = el('manualCreatePasses') && el('manualCreatePasses').checked;
    var wrap = el('manualTemplateWrap');
    if (wrap) wrap.classList.toggle('filo-hr-template--hidden', !on);
    syncActivationCheckbox();
  }

  function syncActivationCheckbox() {
    var send = el('manualSendActivation');
    var email = (el('manualEmail') && el('manualEmail').value || '').trim();
    if (!send) return;
    if (!email) {
      send.disabled = true;
      send.checked = false;
      send.title = COPY.sendActivationTooltip;
    } else {
      send.disabled = false;
      send.removeAttribute('title');
    }
  }

  function displayName(emp) {
    var n = [emp.first_name, emp.last_name].filter(Boolean).join(' ');
    return n || '—';
  }

  function renderQueue() {
    var countEl = el('manualQueueCount');
    var listEl = el('filoManualQueueList');
    var emptyEl = el('filoManualQueueEmpty');
    var saveBtn = el('manualSaveCloseBtn');
    var countSave = el('manualSaveCount');
    var n = state.queue.length;
    if (countEl) countEl.textContent = String(n);
    if (countSave) countSave.textContent = String(n);
    if (saveBtn) {
      saveBtn.disabled = n === 0 || state.saving;
      saveBtn.title = n === 0 ? COPY.saveTooltip : '';
    }
    if (!listEl || !emptyEl) return;
    if (!n) {
      listEl.innerHTML = '';
      listEl.hidden = true;
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;
    listEl.hidden = false;
    var d = deps();
    listEl.innerHTML = state.queue.map(function (e, i) {
      var email = e.email ? d.esc(e.email) : '—';
      return '<li class="filo-hr-queue-item">' +
        '<div class="filo-hr-queue-item__meta">' +
        '<p class="filo-hr-queue-item__line">' + d.esc(e.employee_id) + ' · ' + d.esc(displayName(e)) + '</p>' +
        '<p class="filo-hr-queue-item__sub">' + email + '</p>' +
        '</div>' +
        '<div class="filo-hr-queue-item__actions">' +
        '<button type="button" class="btn small sec filo-hr-queue-edit" data-index="' + i + '" aria-label="Modifica dipendente ' + d.esc(e.employee_id) + '">Modifica</button>' +
        '<button type="button" class="btn small sec filo-hr-queue-remove" data-index="' + i + '" aria-label="Rimuovi dipendente ' + d.esc(e.employee_id) + '">Rimuovi</button>' +
        '</div></li>';
    }).join('');
    listEl.querySelectorAll('.filo-hr-queue-edit').forEach(function (btn) {
      btn.addEventListener('click', function () {
        editQueueItem(parseInt(btn.getAttribute('data-index'), 10));
      });
    });
    listEl.querySelectorAll('.filo-hr-queue-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        removeQueueItem(parseInt(btn.getAttribute('data-index'), 10));
      });
    });
  }

  function fillForm(emp) {
    if (el('manualEmployeeId')) el('manualEmployeeId').value = emp.employee_id || '';
    if (el('manualEmail')) el('manualEmail').value = emp.email || '';
    if (el('manualFirstName')) el('manualFirstName').value = emp.first_name || '';
    if (el('manualLastName')) el('manualLastName').value = emp.last_name || '';
    if (el('manualDepartment')) el('manualDepartment').value = emp.department || '';
    if (el('manualOffice')) el('manualOffice').value = emp.office_location || '';
    if (el('manualHireDate')) el('manualHireDate').value = emp.hire_date || '';
    if (el('manualManagerEmail')) el('manualManagerEmail').value = emp.manager_email || '';
    syncActivationCheckbox();
  }

  async function addToQueue() {
    var matricolaVal = (el('manualEmployeeId') && el('manualEmployeeId').value || '').trim();
    if (state.matricolaTouched && matricolaVal) await runMatricolaCheck(matricolaVal);
    if (!validateFormForQueue()) return;
    var emp = readForm();
    state.queue.push(emp);
    setDirty(true);
    renderQueue();
    clearForm();
    clearFieldErrors();
    if (el('manualEmployeeId')) el('manualEmployeeId').focus();
    deps().toast('Aggiunto alla lista');
  }

  function editQueueItem(index) {
    var emp = state.queue[index];
    if (!emp) return;
    fillForm(emp);
    state.queue.splice(index, 1);
    renderQueue();
    setDirty(true);
    if (el('manualEmployeeId')) el('manualEmployeeId').focus();
  }

  function removeQueueItem(index) {
    state.queue.splice(index, 1);
    setDirty(true);
    renderQueue();
  }

  function isFormDirty() {
    var emp = readForm();
    return !!(emp.employee_id || emp.email || emp.first_name || emp.last_name || emp.department || emp.office_location || emp.hire_date || emp.manager_email);
  }

  function hasUnsavedChanges() {
    return state.dirty || state.queue.length > 0 || isFormDirty();
  }

  function confirmDiscard() {
    return new Promise(function (resolve) {
      if (!hasUnsavedChanges()) {
        resolve(true);
        return;
      }
      var dialog = el('filoManualDiscardDialog');
      if (!dialog) {
        resolve(global.confirm(COPY.discardMsg));
        return;
      }
      function cleanup(result) {
        dialog.removeEventListener('close', onClose);
        resolve(result);
      }
      function onClose() {
        cleanup(dialog.returnValue === 'discard');
      }
      dialog.addEventListener('close', onClose);
      dialog.returnValue = 'stay';
      dialog.showModal();
    });
  }

  function ensureDiscardDialog() {
    if (el('filoManualDiscardDialog')) return;
    var dialog = document.createElement('dialog');
    dialog.id = 'filoManualDiscardDialog';
    dialog.setAttribute('aria-labelledby', 'filoManualDiscardTitle');
    dialog.setAttribute('aria-describedby', 'filoManualDiscardMsg');
    dialog.innerHTML =
      '<div class="filo-hr-discard__inner">' +
      '<h3 class="filo-hr-discard__title" id="filoManualDiscardTitle">' + COPY.discardTitle + '</h3>' +
      '<p class="filo-hr-discard__msg" id="filoManualDiscardMsg">' + COPY.discardMsg + '</p>' +
      '<div class="filo-hr-discard__actions">' +
      '<button type="button" class="btn sec" id="filoManualDiscardStay">' + COPY.discardStay + '</button>' +
      '<button type="button" class="btn danger" id="filoManualDiscardLeave">' + COPY.discardLeave + '</button>' +
      '</div></div>';
    document.body.appendChild(dialog);
    el('filoManualDiscardStay').addEventListener('click', function () {
      dialog.close('stay');
    });
    el('filoManualDiscardLeave').addEventListener('click', function () {
      dialog.close('discard');
    });
  }

  function trapFocus(container) {
    var selector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    state.trapHandler = function (e) {
      if (e.key !== 'Tab' || !container) return;
      var nodes = Array.prototype.slice.call(container.querySelectorAll(selector)).filter(function (n) {
        return n.offsetParent !== null;
      });
      if (!nodes.length) return;
      var first = nodes[0];
      var last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    container.addEventListener('keydown', state.trapHandler);
  }

  function releaseFocusTrap(container) {
    if (state.trapHandler && container) {
      container.removeEventListener('keydown', state.trapHandler);
      state.trapHandler = null;
    }
  }

  async function populateTemplates() {
    if (typeof global.populateEmployeeTemplateSelect === 'function') {
      await global.populateEmployeeTemplateSelect('manualTemplateId');
      return;
    }
    var sel = el('manualTemplateId');
    var d = deps();
    if (!sel || !d.brandId) return;
    sel.innerHTML = '<option value="">— Seleziona template —</option>';
    try {
      var headers = typeof d.getDashboardFetchHeaders === 'function'
        ? d.getDashboardFetchHeaders()
        : Object.assign({}, d.getAuthHeaders());
      var res = await fetch(d.API + '/templates?brand_id=' + encodeURIComponent(d.brandId), { headers: headers });
      var templates = await res.json();
      if (!res.ok) throw new Error((templates && templates.error) || 'Errore caricamento template');
      if (!Array.isArray(templates)) templates = [];
      var hrTpl = templates.filter(function (t) { return t.pass_type === 'employee_pass'; });
      var list = hrTpl.length ? hrTpl : templates;
      if (!list.length) {
        d.toast('Nessun template pass per questo brand. Creane uno nella sezione Pass.');
        return;
      }
      list.forEach(function (t) {
        var o = document.createElement('option');
        o.value = t.id;
        o.textContent = t.name || t.id;
        sel.appendChild(o);
      });
      if (list.length === 1) sel.value = list[0].id;
    } catch (err) {
      d.toast(err.message || 'Errore caricamento template');
    }
  }

  async function saveQueue() {
    var d = deps();
    if (!d.brandId || !state.queue.length || state.saving) return;
    var createPasses = !!(el('manualCreatePasses') && el('manualCreatePasses').checked);
    var templateId = el('manualTemplateId') && el('manualTemplateId').value;
    var sendActivation = !!(el('manualSendActivation') && el('manualSendActivation').checked);
    if (createPasses && !templateId) return d.toast('Seleziona un template pass');
    if (sendActivation && !state.queue.some(function (e) { return e.email; })) {
      return d.toast('Almeno un dipendente deve avere email per l\'invito attivazione');
    }
    state.saving = true;
    var saveBtn = el('manualSaveCloseBtn');
    var statusEl = el('manualEmployeeStatus');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '';
      var spin = icon('loader', true);
      spin.classList.add('filo-hr-spinner');
      saveBtn.appendChild(spin);
      saveBtn.appendChild(document.createTextNode(' ' + COPY.saving));
    }
    if (statusEl) statusEl.textContent = COPY.saving;
    try {
      var res = await fetch(d.API + '/brands/' + d.brandId + '/employees', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, d.getAuthHeaders()),
        body: JSON.stringify({
          employees: state.queue,
          create_passes: createPasses,
          template_id: templateId || undefined,
          send_activation: sendActivation
        })
      });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || (data.errors && data.errors[0] && data.errors[0].reason) || 'Salvataggio fallito');
      var errN = (data.errors || []).length;
      var msg = 'Salvati: ' + (data.imported || 0);
      if (data.passes_created) msg += ' · Pass: ' + data.passes_created;
      if (data.activation_sent) msg += ' · Email inviate: ' + data.activation_sent;
      if (errN) msg += ' · ' + errN + ' errori';
      d.toast(msg);
      state.queue = [];
      state.dirty = false;
      clearForm();
      renderQueue();
      if (statusEl) statusEl.textContent = '';
      if (typeof d.loadLeads === 'function') await d.loadLeads();
      close(true);
    } catch (e) {
      if (statusEl) statusEl.textContent = e.message;
      d.toast(e.message);
    } finally {
      state.saving = false;
      var btn = el('manualSaveCloseBtn');
      if (btn) {
        btn.innerHTML = 'Salva <strong id="manualSaveCount">' + state.queue.length + '</strong> dipendenti';
      }
      renderQueue();
    }
  }

  function bindEvents() {
    if (state.bound) return;
    var modal = el('employeeManualModal');
    if (!modal) return;
    state.bound = true;

    ensureDiscardDialog();

    var addBtn = el('filoManualAddToQueue');
    if (addBtn) addBtn.addEventListener('click', addToQueue);

    var clearBtn = el('filoManualClearForm');
    if (clearBtn) clearBtn.addEventListener('click', function () {
      clearForm();
      setDirty(true);
    });

    var cancelBtn = el('filoManualCancelBtn');
    if (cancelBtn) cancelBtn.addEventListener('click', function () { close(false); });

    var saveBtn = el('manualSaveCloseBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveQueue);

    var closeBtn = el('filoManualCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', function () { close(false); });

    var createPasses = el('manualCreatePasses');
    if (createPasses) createPasses.addEventListener('change', togglePassOptions);

    ['manualEmail', 'manualFirstName', 'manualLastName', 'manualDepartment', 'manualOffice', 'manualHireDate', 'manualManagerEmail'].forEach(function (id) {
      var node = el(id);
      if (!node) return;
      var onInput = function () { markDirtyFromInput(); syncActivationCheckbox(); };
      var onBlur = function () {
        if (id === 'manualEmail') validateEmailField();
      };
      node.addEventListener('input', onInput);
      node.addEventListener('blur', onBlur);
      state.fieldHandlers.push({ node: node, onInput: onInput, onBlur: onBlur });
    });

    var matricolaInput = el('manualEmployeeId');
    if (matricolaInput) {
      var onMatricolaInput = function () {
        touchMatricolaField();
        markDirtyFromInput();
        state.matricolaServerAvailable = null;
        scheduleMatricolaCheck();
      };
      var onMatricolaFocus = function () { touchMatricolaField(); };
      var onMatricolaBlur = function () {
        var val = (matricolaInput.value || '').trim();
        if (state.matricolaTouched && val) runMatricolaCheck(val);
        validateMatricolaField();
      };
      matricolaInput.addEventListener('input', onMatricolaInput);
      matricolaInput.addEventListener('focus', onMatricolaFocus);
      matricolaInput.addEventListener('blur', onMatricolaBlur);
      state.fieldHandlers.push({ node: matricolaInput, onInput: onMatricolaInput, onBlur: onMatricolaBlur, onFocus: onMatricolaFocus });
    }

    state.backdropHandler = function (e) {
      if (e.target === modal) close(false);
    };
    modal.addEventListener('click', state.backdropHandler);

    state.keyHandler = function (e) {
      if (modal.style.display === 'none') return;
      if (e.key === 'Escape') {
        e.preventDefault();
        close(false);
      }
    };
    document.addEventListener('keydown', state.keyHandler);
  }

  function unbindEvents() {
    state.fieldHandlers.forEach(function (h) {
      h.node.removeEventListener('input', h.onInput);
      h.node.removeEventListener('blur', h.onBlur);
      if (h.onFocus) h.node.removeEventListener('focus', h.onFocus);
    });
    state.fieldHandlers = [];
    var modal = el('employeeManualModal');
    if (modal && state.backdropHandler) modal.removeEventListener('click', state.backdropHandler);
    if (state.keyHandler) document.removeEventListener('keydown', state.keyHandler);
    state.backdropHandler = null;
    state.keyHandler = null;
    state.bound = false;
  }

  function enhanceModalMarkup() {
    var modal = el('employeeManualModal');
    if (!modal || modal.dataset.filoHrManualEnhanced === '1') return;
    modal.dataset.filoHrManualEnhanced = '1';
    modal.classList.add('filo-hr-manual-modal--ready');

    var help = modal.querySelector('.import-wizard__matricola-help');
    if (help) help.remove();

    var body = modal.querySelector('.import-wizard__body');
    if (body && !el('filoHrRequiredNote')) {
      var note = document.createElement('p');
      note.id = 'filoHrRequiredNote';
      note.className = 'filo-hr-manual-modal__required-note';
      note.textContent = COPY.requiredNote;
      body.insertBefore(note, body.firstChild);
    }

    var matricolaGroup = el('manualEmployeeId') && el('manualEmployeeId').closest('.form-group');
    if (matricolaGroup) {
      var lbl = matricolaGroup.querySelector('.form-label');
      if (lbl) lbl.innerHTML = 'Matricola <span class="filo-hr-required" aria-hidden="true">*</span>';
      el('manualEmployeeId').setAttribute('aria-required', 'true');
      if (!matricolaGroup.querySelector('#manualMatricolaHint')) {
        var mh = document.createElement('p');
        mh.id = 'manualMatricolaHint';
        mh.className = 'filo-hr-field-hint';
        mh.textContent = COPY.matricolaHint;
        matricolaGroup.appendChild(mh);
      }
    }

    var emailGroup = el('manualEmail') && el('manualEmail').closest('.form-group');
    if (emailGroup && !emailGroup.querySelector('#manualEmailHint')) {
      var eh = document.createElement('p');
      eh.id = 'manualEmailHint';
      eh.className = 'filo-hr-field-hint';
      eh.textContent = COPY.emailHint;
      emailGroup.appendChild(eh);
    }

    var optionsWrap = modal.querySelector('.import-wizard__options');
    if (optionsWrap && !modal.querySelector('.filo-hr-activation-fieldset')) {
      var fieldset = document.createElement('fieldset');
      fieldset.className = 'filo-hr-activation-fieldset';
      fieldset.innerHTML = '<legend>Attivazione pass</legend>';
      var createRow = document.createElement('label');
      createRow.className = 'filo-hr-check-row';
      var createCb = el('manualCreatePasses');
      if (createCb) {
        createRow.appendChild(createCb);
        createRow.appendChild(document.createTextNode(' Crea pass Wallet'));
        fieldset.appendChild(createRow);
      }
      var tplWrap = el('manualTemplateWrap');
      if (tplWrap) fieldset.appendChild(tplWrap);
      var sendRow = document.createElement('label');
      sendRow.className = 'filo-hr-check-row';
      var sendCb = el('manualSendActivation');
      if (sendCb) {
        sendRow.appendChild(sendCb);
        sendRow.appendChild(document.createTextNode(' Invia email di attivazione'));
        fieldset.appendChild(sendRow);
      }
      optionsWrap.replaceWith(fieldset);
    }

    var queueWrap = el('manualEmployeeQueueWrap');
    if (queueWrap) {
      queueWrap.className = 'filo-hr-manual-modal__queue';
      queueWrap.style.display = '';
      queueWrap.innerHTML =
        '<h3 class="filo-hr-manual-modal__queue-title" id="filoManualQueueHeading">Dipendenti in coda (<span id="manualQueueCount">0</span>)</h3>' +
        '<p class="filo-hr-queue-empty" id="filoManualQueueEmpty">' + COPY.queueEmpty + '</p>' +
        '<ul class="filo-hr-queue-list" id="filoManualQueueList" hidden></ul>';
    }

    var saveAdd = el('manualSaveAddBtn');
    if (saveAdd) saveAdd.remove();

    var footer = modal.querySelector('.import-wizard__footer-inner');
    if (footer) {
      footer.className = 'filo-hr-manual-modal__footer';
      footer.innerHTML =
        '<button type="button" class="filo-hr-btn-ghost" id="filoManualCancelBtn">Annulla</button>' +
        '<button type="button" class="filo-hr-btn-primary" id="manualSaveCloseBtn" disabled title="' + COPY.saveTooltip + '">' +
        'Salva <strong id="manualSaveCount">0</strong> dipendenti</button>';
    }

    var closeLegacy = modal.querySelector('.import-wizard__close');
    if (closeLegacy) {
      closeLegacy.id = 'filoManualCloseBtn';
      closeLegacy.removeAttribute('onclick');
    }

    var actionsRow = modal.querySelector('.filo-hr-manual-modal__form-actions');
    if (!actionsRow) {
      var row = document.createElement('div');
      row.className = 'filo-hr-manual-modal__form-actions';
      row.innerHTML =
        '<button type="button" class="btn sec filo-hr-btn-outline" id="filoManualAddToQueue">+ Aggiungi alla lista</button>' +
        '<button type="button" class="btn sec" id="filoManualClearForm">Pulisci campi</button>';
      var queueAnchor = el('manualEmployeeQueueWrap');
      if (queueAnchor && queueAnchor.parentNode) queueAnchor.parentNode.insertBefore(row, queueAnchor);
    }
  }

  function open(triggerEl) {
    if (!isEnabled()) return false;
    var d = deps();
    if (!d.brandId) {
      d.toast('Seleziona un brand');
      return false;
    }
    init();
    state.focusReturn = triggerEl || document.activeElement;
    state.queue = [];
    state.dirty = false;
    state.saving = false;
    state.matricolaTouched = false;
    resetMatricolaCheckState();
    clearForm();
    clearFieldErrors();
    renderQueue();
    togglePassOptions();
    populateTemplates();
    fetchFieldOptions();
    var modal = el('employeeManualModal');
    if (modal) {
      modal.style.display = 'flex';
      trapFocus(modal.querySelector('.import-modal-card') || modal);
      setTimeout(function () {
        if (el('manualEmployeeId')) el('manualEmployeeId').focus();
      }, 0);
    }
    return true;
  }

  async function close(force) {
    var modal = el('employeeManualModal');
    if (!modal || modal.style.display === 'none') return;
    if (!force) {
      var ok = await confirmDiscard();
      if (!ok) return;
    }
    releaseFocusTrap(modal.querySelector('.import-modal-card') || modal);
    modal.style.display = 'none';
    state.queue = [];
    state.dirty = false;
    clearForm();
    renderQueue();
    if (state.focusReturn && typeof state.focusReturn.focus === 'function') {
      state.focusReturn.focus();
    }
    state.focusReturn = null;
  }

  function init() {
    if (!isEnabled()) return;
    enhanceModalMarkup();
    bindEvents();
  }

  function destroy() {
    unbindEvents();
    var modal = el('employeeManualModal');
    if (modal) modal.classList.remove('filo-hr-manual-modal--ready');
  }

  var manualModal = {
    isEnabled: isEnabled,
    init: init,
    open: open,
    close: close,
    destroy: destroy
  };

  if (!global.filoHrContatti) global.filoHrContatti = {};
  global.filoHrContatti.manualModal = manualModal;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (isEnabled()) init();
    });
  } else if (isEnabled()) {
    init();
  }
})(typeof window !== 'undefined' ? window : global);
