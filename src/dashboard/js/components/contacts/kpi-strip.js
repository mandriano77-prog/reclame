(function () {
  'use strict';

  const KPI_ITEMS = [
    { key: 'total', label: 'Dipendenti', cluster: 'anagrafica' },
    { key: 'with_employee_id', label: 'Con matricola', cluster: 'anagrafica' },
    { key: 'with_email', label: 'Con email', cluster: 'anagrafica' },
    { key: 'candidate', label: 'Da invitare', cluster: 'distribuzione' },
    { key: 'invited', label: 'Invitati', cluster: 'distribuzione' },
    { key: 'activated', label: 'Attivi', cluster: 'distribuzione' },
    { key: 'pass_installed', label: 'Pass installati', cluster: 'distribuzione' }
  ];

  function toSafeNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  }

  function renderKpiButton(item, metrics, activeFilter, onSelect) {
    const value = toSafeNumber(metrics[item.key]);
    const isActive = activeFilter === item.key;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'contacts-kpi-strip__item' + (isActive ? ' is-active' : '');
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    btn.dataset.kpiKey = item.key;
    btn.innerHTML = `
      <span class="contacts-kpi-strip__value">${value}</span>
      <span class="contacts-kpi-strip__label">${item.label}</span>
    `;
    btn.addEventListener('click', function () {
      if (typeof onSelect === 'function') onSelect(item.key);
    });
    return btn;
  }

  function renderKpiStrip(options) {
    const cfg = options || {};
    const host = cfg.host;
    if (!host) return;

    host.innerHTML = '';
    host.classList.add('contacts-kpi-strip', 'fd-contacts-kpi');

    const clusterAnagrafica = document.createElement('div');
    clusterAnagrafica.className = 'contacts-kpi-strip__cluster';
    clusterAnagrafica.setAttribute('aria-label', 'Stato anagrafica');

    const clusterDistribuzione = document.createElement('div');
    clusterDistribuzione.className = 'contacts-kpi-strip__cluster';
    clusterDistribuzione.setAttribute('aria-label', 'Stato distribuzione');

    const divider = document.createElement('div');
    divider.className = 'contacts-kpi-strip__divider';
    divider.setAttribute('aria-hidden', 'true');

    KPI_ITEMS.forEach(function (item) {
      const targetCluster = item.cluster === 'anagrafica' ? clusterAnagrafica : clusterDistribuzione;
      targetCluster.appendChild(renderKpiButton(item, cfg.metrics || {}, cfg.activeFilter || null, cfg.onSelect));
    });

    host.append(clusterAnagrafica, divider, clusterDistribuzione);
  }

  window.KpiStrip = {
    render: renderKpiStrip
  };
})();
